import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getStringQuery, handleOptions, isAddressLike, setCache, setCors } from './_shared.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type RateBucket = { count: number; resetAt: number }

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS_PER_IP = 25

const MAX_TOKENS_PER_REQUEST = 25
const CACHE_SECONDS = 60

const DEFAULT_CHAIN_ID = 'base'

export type DexscreenerTokenStats = {
  address: string
  chainId: string
  pairAddress?: string
  url?: string
  marketCapUsd?: number
  fdvUsd?: number
  liquidityUsd?: number
  volumeUsd5m?: number
  volumeUsd1h?: number
  volumeUsd6h?: number
  volumeUsd24h?: number
  /** Fractions (0.05 == +5%) */
  change5m?: number
  change1h?: number
  change6h?: number
  change24h?: number
}

export type DexscreenerTokenStatsBatchResponse = {
  asOf: number
  chainId: string
  results: Record<string, DexscreenerTokenStats | null>
}

function getClientKey(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim().length > 0) return xff.split(',')[0]!.trim()
  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim().length > 0) return realIp.trim()
  return 'unknown'
}

function rateLimitOk(req: VercelRequest): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const key = getClientKey(req)
  const now = Date.now()

  const g: any = globalThis as any
  const buckets: Map<string, RateBucket> = (g.__creatorvault_dexscreener_rate_buckets ??= new Map())

  const bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { ok: true }
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS_PER_IP) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    return { ok: false, retryAfterSeconds }
  }

  bucket.count += 1
  return { ok: true }
}

function parseTokenList(raw: string): Array<{ address: string; addressLc: string }> {
  const out: Array<{ address: string; addressLc: string }> = []
  const seen = new Set<string>()

  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const addr = trimmed.includes(':') ? trimmed.split(':')[0]!.trim() : trimmed
    if (!isAddressLike(addr)) continue

    const addressLc = addr.toLowerCase()
    if (seen.has(addressLc)) continue
    seen.add(addressLc)

    out.push({ address: addr, addressLc })
  }

  return out
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal })
    if (!res.ok) throw new Error(`Dexscreener HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  let idx = 0

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (idx < items.length) {
      const current = idx++
      out[current] = await fn(items[current]!)
    }
  })

  await Promise.all(workers)
  return out
}

type DexscreenerTokenResponse = {
  schemaVersion?: string
  pairs?: Array<{
    chainId?: string
    dexId?: string
    url?: string
    pairAddress?: string
    priceUsd?: string
    fdv?: number
    marketCap?: number
    volume?: { m5?: number; h1?: number; h6?: number; h24?: number }
    priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number }
    liquidity?: { usd?: number }
  }>
}

function pickBestPair(pairs: DexscreenerTokenResponse['pairs'], chainId: string) {
  const list = (pairs ?? []).filter((p) => (p?.chainId ?? '').toLowerCase() === chainId.toLowerCase())
  if (list.length === 0) return null

  // Prefer the deepest liquidity (stable) then highest 24h volume (active).
  return [...list].sort((a, b) => {
    const la = typeof a?.liquidity?.usd === 'number' ? a.liquidity.usd : 0
    const lb = typeof b?.liquidity?.usd === 'number' ? b.liquidity.usd : 0
    if (lb !== la) return lb - la
    const va = typeof a?.volume?.h24 === 'number' ? a.volume.h24 : 0
    const vb = typeof b?.volume?.h24 === 'number' ? b.volume.h24 : 0
    return vb - va
  })[0]!
}

function toFractionPercent(n: unknown): number | undefined {
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined
  return n / 100
}

function toNum(n: unknown): number | undefined {
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined
  return n
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const rl = rateLimitOk(req)
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfterSeconds))
    return res.status(429).json({ success: false, error: 'Rate limited. Please retry shortly.' } satisfies ApiEnvelope<never>)
  }

  const rawTokens = getStringQuery(req, 'tokens')
  if (!rawTokens) {
    return res.status(400).json({ success: false, error: 'Missing tokens' } satisfies ApiEnvelope<never>)
  }

  const chainId = (getStringQuery(req, 'chainId') ?? DEFAULT_CHAIN_ID).toLowerCase()

  const parsed = parseTokenList(rawTokens)
  if (parsed.length === 0) {
    return res.status(400).json({ success: false, error: 'No valid tokens provided' } satisfies ApiEnvelope<never>)
  }

  if (parsed.length > MAX_TOKENS_PER_REQUEST) {
    return res.status(400).json({
      success: false,
      error: `Too many tokens. Max ${MAX_TOKENS_PER_REQUEST}.`,
    } satisfies ApiEnvelope<never>)
  }

  try {
    const resultsArr = await mapWithLimit(parsed, 6, async (t) => {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(t.addressLc)}`
      try {
        const data = await fetchJson<DexscreenerTokenResponse>(url, 8_000)
        const pair = pickBestPair(data.pairs, chainId)
        if (!pair) return null

        const liquidityUsd = toNum(pair.liquidity?.usd)
        const marketCapUsd = toNum(pair.marketCap)
        const fdvUsd = toNum(pair.fdv)
        const volumeUsd5m = toNum(pair.volume?.m5)
        const volumeUsd1h = toNum(pair.volume?.h1)
        const volumeUsd6h = toNum(pair.volume?.h6)
        const volumeUsd24h = toNum(pair.volume?.h24)

        const change5m = toFractionPercent(pair.priceChange?.m5)
        const change1h = toFractionPercent(pair.priceChange?.h1)
        const change6h = toFractionPercent(pair.priceChange?.h6)
        const change24h = toFractionPercent(pair.priceChange?.h24)

        return {
          address: t.addressLc,
          chainId,
          pairAddress: pair.pairAddress,
          url: pair.url,
          ...(typeof marketCapUsd === 'number' ? { marketCapUsd } : {}),
          ...(typeof fdvUsd === 'number' ? { fdvUsd } : {}),
          ...(typeof liquidityUsd === 'number' ? { liquidityUsd } : {}),
          ...(typeof volumeUsd5m === 'number' ? { volumeUsd5m } : {}),
          ...(typeof volumeUsd1h === 'number' ? { volumeUsd1h } : {}),
          ...(typeof volumeUsd6h === 'number' ? { volumeUsd6h } : {}),
          ...(typeof volumeUsd24h === 'number' ? { volumeUsd24h } : {}),
          ...(typeof change5m === 'number' ? { change5m } : {}),
          ...(typeof change1h === 'number' ? { change1h } : {}),
          ...(typeof change6h === 'number' ? { change6h } : {}),
          ...(typeof change24h === 'number' ? { change24h } : {}),
        } satisfies DexscreenerTokenStats
      } catch {
        return null
      }
    })

    const results: Record<string, DexscreenerTokenStats | null> = {}
    parsed.forEach((t, i) => {
      results[t.addressLc] = resultsArr[i] ?? null
    })

    setCache(res, CACHE_SECONDS)
    return res.status(200).json({
      success: true,
      data: {
        asOf: Date.now(),
        chainId,
        results,
      } satisfies DexscreenerTokenStatsBatchResponse,
    } satisfies ApiEnvelope<DexscreenerTokenStatsBatchResponse>)
  } catch (e: any) {
    return res
      .status(500)
      .json({ success: false, error: e?.message || 'Failed to fetch Dexscreener stats' } satisfies ApiEnvelope<never>)
  }
}


