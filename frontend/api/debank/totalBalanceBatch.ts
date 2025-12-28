import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getStringQuery, handleOptions, isAddressLike, requireDebankAccessKey, setCache, setCors } from './_shared'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type RateBucket = { count: number; resetAt: number }

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS_PER_IP = 20

const MAX_WALLETS_PER_REQUEST = 20
const CACHE_SECONDS = 300

const DEBANK_BASE_URL = 'https://pro-openapi.debank.com/v1'

export type DebankChainBalance = {
  id: string
  name?: string
  logoUrl?: string
  usdValue: number
}

export type DebankTotalBalance = {
  address: string
  totalUsdValue: number
  chains: DebankChainBalance[]
}

export type DebankTotalBalanceBatchResponse = {
  asOf: number
  results: Record<string, DebankTotalBalance | null>
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
  const buckets: Map<string, RateBucket> = (g.__creatorvault_debank_total_balance_rate_buckets ??= new Map())

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

function parseWalletList(raw: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  for (const part of raw.split(',')) {
    const addr = part.trim()
    if (!addr) continue
    if (!isAddressLike(addr)) continue
    const lc = addr.toLowerCase()
    if (seen.has(lc)) continue
    seen.add(lc)
    out.push(lc)
  }

  return out
}

async function fetchJson<T>(url: string, headers: Record<string, string>, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal })
    if (!res.ok) throw new Error(`DeBank HTTP ${res.status}`)
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const rl = rateLimitOk(req)
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfterSeconds))
    return res.status(429).json({ success: false, error: 'Rate limited. Please retry shortly.' } satisfies ApiEnvelope<never>)
  }

  const accessKey = requireDebankAccessKey()
  if (!accessKey) {
    return res
      .status(501)
      .json({ success: false, error: 'DEBANK_ACCESS_KEY is not configured' } satisfies ApiEnvelope<never>)
  }

  const raw = getStringQuery(req, 'ids') ?? getStringQuery(req, 'wallets') ?? getStringQuery(req, 'id')
  if (!raw) {
    return res.status(400).json({ success: false, error: 'Missing ids' } satisfies ApiEnvelope<never>)
  }

  const wallets = parseWalletList(raw)
  if (wallets.length === 0) {
    return res.status(400).json({ success: false, error: 'No valid wallet addresses provided' } satisfies ApiEnvelope<never>)
  }

  if (wallets.length > MAX_WALLETS_PER_REQUEST) {
    return res.status(400).json({
      success: false,
      error: `Too many wallets. Max ${MAX_WALLETS_PER_REQUEST}.`,
    } satisfies ApiEnvelope<never>)
  }

  try {
    const includeChains = getStringQuery(req, 'includeChains') === '1'

    type DebankTotalBalanceRaw = {
      total_usd_value: number
      chain_list: Array<{
        id: string
        name?: string
        logo_url?: string
        usd_value: number
      }>
    }

    const headers = { accept: 'application/json', AccessKey: accessKey }

    const resultsArr = await mapWithLimit(wallets, 6, async (addrLc) => {
      const url = `${DEBANK_BASE_URL}/user/total_balance?id=${encodeURIComponent(addrLc)}`
      try {
        const data = await fetchJson<DebankTotalBalanceRaw>(url, headers, 8_000)
        const totalUsdValue = typeof data?.total_usd_value === 'number' ? data.total_usd_value : NaN
        const chainList = Array.isArray(data?.chain_list) ? data.chain_list : []
        if (!Number.isFinite(totalUsdValue)) return null

        const chains: DebankChainBalance[] = includeChains
          ? chainList
              .map((c) => ({
                id: c.id,
                name: c.name,
                logoUrl: c.logo_url,
                usdValue: typeof c.usd_value === 'number' ? c.usd_value : NaN,
              }))
              .filter((c) => typeof c.id === 'string' && c.id.length > 0 && Number.isFinite(c.usdValue) && c.usdValue > 0.01)
              .sort((a, b) => b.usdValue - a.usdValue)
              .slice(0, 8)
          : []

        return {
          address: addrLc,
          totalUsdValue,
          chains,
        } satisfies DebankTotalBalance
      } catch {
        return null
      }
    })

    const results: Record<string, DebankTotalBalance | null> = {}
    wallets.forEach((addrLc, i) => {
      results[addrLc] = resultsArr[i] ?? null
    })

    setCache(res, CACHE_SECONDS)
    return res.status(200).json({
      success: true,
      data: { asOf: Date.now(), results } satisfies DebankTotalBalanceBatchResponse,
    } satisfies ApiEnvelope<DebankTotalBalanceBatchResponse>)
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to fetch DeBank balances' } satisfies ApiEnvelope<never>)
  }
}


