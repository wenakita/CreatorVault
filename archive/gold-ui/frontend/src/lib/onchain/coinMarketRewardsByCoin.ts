import type { Address } from 'viem'

type ApiEnvelope<T> = {
  success: boolean
  data: T | null
  error?: string
}

export async function fetchCoinMarketRewardsByCoinFromApi(params: {
  recipient: Address
  currency: Address
  hook?: Address
  coin?: Address
  createdAtSeconds?: number
  fromBlock?: bigint
}): Promise<Record<string, bigint>> {
  const qs = new URLSearchParams({
    recipient: params.recipient,
    currency: params.currency,
    ...(params.hook ? { hook: params.hook } : {}),
    ...(params.coin ? { coin: params.coin } : {}),
    ...(typeof params.createdAtSeconds === 'number' && Number.isFinite(params.createdAtSeconds)
      ? { createdAtSeconds: String(Math.floor(params.createdAtSeconds)) }
      : {}),
    ...(typeof params.fromBlock === 'bigint' ? { fromBlock: params.fromBlock.toString() } : {}),
  })

  const res = await fetch(`/api/onchain/coinMarketRewardsByCoin?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiEnvelope<any> | null
    const msg = body?.error || `HTTP ${res.status}`
    const err: any = new Error(msg)
    err.status = res.status
    throw err
  }

  const body = (await res.json()) as ApiEnvelope<{ amountByCoin: Record<string, string> }>
  if (!body.success) throw new Error(body.error || 'Failed to fetch per-coin rewards')

  const rawMap = body.data?.amountByCoin ?? {}
  const out: Record<string, bigint> = {}
  for (const [coin, raw] of Object.entries(rawMap)) {
    try {
      out[String(coin).toLowerCase()] = BigInt(raw)
    } catch {
      out[String(coin).toLowerCase()] = 0n
    }
  }

  return out
}


