import type { Address } from 'viem'

type ApiEnvelope<T> = {
  success: boolean
  data: T | null
  error?: string
}

export async function fetchCoinMarketRewardsCurrencyFromApi(params: {
  recipient: Address
  currency: Address
  hook?: Address
}): Promise<bigint> {
  const qs = new URLSearchParams({
    recipient: params.recipient,
    currency: params.currency,
    ...(params.hook ? { hook: params.hook } : {}),
  })

  const res = await fetch(`/api/onchain/coinMarketRewardsCurrency?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiEnvelope<any> | null
    const msg = body?.error || `HTTP ${res.status}`
    const err: any = new Error(msg)
    err.status = res.status
    throw err
  }

  const body = (await res.json()) as ApiEnvelope<{ amountRaw: string }>
  if (!body.success) throw new Error(body.error || 'Failed to fetch currency rewards')

  const raw = body.data?.amountRaw ?? '0'
  try {
    return BigInt(raw)
  } catch {
    return 0n
  }
}


