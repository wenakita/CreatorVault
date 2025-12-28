import type { Address } from 'viem'

type ApiEnvelope<T> = {
  success: boolean
  data: T | null
  error?: string
}

export async function fetchCoinTradeRewardsBatchFromApi(params: {
  recipient: Address
  pairs: Array<{ coin: Address; currency: Address; createdAtSeconds?: number }>
}): Promise<Record<string, bigint>> {
  const pairs = params.pairs
    .map((p) =>
      p.createdAtSeconds ? `${p.coin}:${p.currency}:${String(Math.floor(p.createdAtSeconds))}` : `${p.coin}:${p.currency}`,
    )
    .join(',')

  const qs = new URLSearchParams({
    recipient: params.recipient,
    pairs,
  })

  const res = await fetch(`/api/onchain/coinTradeRewardsBatch?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiEnvelope<any> | null
    const msg = body?.error || `HTTP ${res.status}`
    const err: any = new Error(msg)
    err.status = res.status
    throw err
  }

  const body = (await res.json()) as ApiEnvelope<{ totalsByCoin: Record<string, string> }>
  if (!body.success) throw new Error(body.error || 'Failed to fetch coin trade rewards')

  const raw = body.data?.totalsByCoin ?? {}
  const out: Record<string, bigint> = {}
  for (const [k, v] of Object.entries(raw)) {
    try {
      out[String(k).toLowerCase()] = BigInt(v)
    } catch {
      out[String(k).toLowerCase()] = 0n
    }
  }
  return out
}


