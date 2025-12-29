type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

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

export type DebankTotalBalanceBatch = {
  asOf: number
  results: Record<string, DebankTotalBalance | null>
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

export async function fetchDebankTotalBalanceBatch(params: { addresses: string[] }): Promise<DebankTotalBalanceBatch | null> {
  const { addresses } = params
  if (!addresses || addresses.length === 0) return null

  const normalized = normalizeAddresses(addresses)
  if (normalized.list.length === 0) return null

  // Our Vercel route limits requests to 20 ids for safety. Client can chunk.
  const batches = chunk(normalized.list, 20)

  const results: Record<string, DebankTotalBalance | null> = {}
  let asOf = 0

  for (const group of batches) {
    try {
      const qs = new URLSearchParams({ ids: group.join(',') })
      const envelope = await fetchJson<ApiEnvelope<DebankTotalBalanceBatch>>(`/api/debank/totalBalanceBatch?${qs.toString()}`)
      const data = envelope.data ?? null
      if (!data) continue
      asOf = Math.max(asOf, typeof data.asOf === 'number' ? data.asOf : 0)
      for (const [k, v] of Object.entries(data.results ?? {})) results[k.toLowerCase()] = v
    } catch {
      // Best-effort: partial results are better than flapping everything to null.
      continue
    }
  }

  if (Object.keys(results).length === 0) return null
  return { asOf: asOf || Date.now(), results }
}


