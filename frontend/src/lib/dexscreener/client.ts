type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

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

export type DexscreenerTokenStatsBatch = {
  asOf: number
  chainId: string
  results: Record<string, DexscreenerTokenStats | null>
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiEnvelope<any> | null
    const msg = body?.error || `HTTP ${res.status}`
    const err: any = new Error(msg)
    err.status = res.status
    throw err
  }
  return (await res.json()) as T
}

function normalizeAddresses(addresses: string[]): { key: string; list: string[] } {
  const uniq = new Set<string>()
  for (const a of addresses) {
    const trimmed = String(a || '').trim()
    if (!trimmed) continue
    uniq.add(trimmed.toLowerCase())
  }
  const list = Array.from(uniq).sort()
  return { list, key: list.join(',') }
}

function chunk<T>(list: T[], size: number): T[][] {
  if (size <= 0) return [list]
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export async function fetchDexscreenerTokenStatsBatch(params: {
  addresses: string[]
  chainId?: string
}): Promise<DexscreenerTokenStatsBatch | null> {
  const { addresses } = params
  const chainId = (params.chainId ?? 'base').toLowerCase()
  if (!addresses || addresses.length === 0) return null

  const normalized = normalizeAddresses(addresses)
  if (normalized.list.length === 0) return null

  // Our Vercel route caps at 25 tokens for safety. Client can chunk.
  const batches = chunk(normalized.list, 25)

  const results: Record<string, DexscreenerTokenStats | null> = {}
  let asOf = 0

  try {
    for (const group of batches) {
      const qs = new URLSearchParams({ chainId, tokens: group.join(',') })
      const envelope = await fetchJson<ApiEnvelope<DexscreenerTokenStatsBatch>>(`/api/dexscreener/tokenStatsBatch?${qs.toString()}`)
      const data = envelope.data ?? null
      if (!data) continue
      asOf = Math.max(asOf, typeof data.asOf === 'number' ? data.asOf : 0)
      for (const [k, v] of Object.entries(data.results ?? {})) results[k.toLowerCase()] = v
    }

    return { asOf: asOf || Date.now(), chainId, results }
  } catch {
    return null
  }
}


