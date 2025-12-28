import type { Address } from 'viem'
import { base } from 'viem/chains'

import { initZoraCoinsSdk } from './init'
import type { ZoraCoin, ZoraExploreList, ZoraExploreListType, ZoraProfile } from './types'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

function hasPublicKey(): boolean {
  return typeof import.meta.env.VITE_ZORA_PUBLIC_API_KEY === 'string' && import.meta.env.VITE_ZORA_PUBLIC_API_KEY.length > 0
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

export async function fetchZoraCoin(address: Address, chainId: number = base.id): Promise<ZoraCoin | null> {
  try {
    const envelope = await fetchJson<ApiEnvelope<ZoraCoin | null>>(
      `/api/zora/coin?address=${encodeURIComponent(address)}&chain=${encodeURIComponent(String(chainId))}`,
    )
    return envelope.data ?? null
  } catch (e: any) {
    if (!hasPublicKey()) throw e
  }

  // Fallback (local dev / missing server key): query directly via SDK (public key required).
  await initZoraCoinsSdk()
  const { getCoin } = await import('@zoralabs/coins-sdk')
  const response = await getCoin({ address, chain: chainId })
  return (response.data?.zora20Token as any) ?? null
}

export async function fetchZoraProfile(identifier: string): Promise<ZoraProfile | null> {
  try {
    const envelope = await fetchJson<ApiEnvelope<ZoraProfile | null>>(
      `/api/zora/profile?identifier=${encodeURIComponent(identifier)}`,
    )
    return envelope.data ?? null
  } catch (e: any) {
    if (!hasPublicKey()) throw e
  }

  await initZoraCoinsSdk()
  const { getProfile } = await import('@zoralabs/coins-sdk')
  const response = await getProfile({ identifier })
  return ((response as any)?.data?.profile as ZoraProfile | undefined) ?? null
}

export async function fetchZoraProfileCoins(params: {
  identifier: string
  count?: number
  after?: string
}): Promise<ZoraProfile | null> {
  const { identifier, count, after } = params

  try {
    const qs = new URLSearchParams({
      identifier,
      ...(count ? { count: String(count) } : {}),
      ...(after ? { after } : {}),
    })
    const envelope = await fetchJson<ApiEnvelope<ZoraProfile | null>>(`/api/zora/profileCoins?${qs.toString()}`)
    return envelope.data ?? null
  } catch (e: any) {
    if (!hasPublicKey()) throw e
  }

  await initZoraCoinsSdk()
  const { getProfileCoins } = await import('@zoralabs/coins-sdk')
  const response = await getProfileCoins({
    identifier,
    count,
    after,
    chainIds: [base.id],
  })
  return ((response as any)?.data?.profile as ZoraProfile | undefined) ?? null
}

export async function fetchZoraExplore(params: {
  list: ZoraExploreListType
  count?: number
  after?: string
}): Promise<ZoraExploreList | null> {
  const { list, count, after } = params

  try {
    const qs = new URLSearchParams({
      list,
      ...(count ? { count: String(count) } : {}),
      ...(after ? { after } : {}),
    })

    const envelope = await fetchJson<ApiEnvelope<ZoraExploreList | null>>(`/api/zora/explore?${qs.toString()}`)
    return envelope.data ?? null
  } catch (e: any) {
    if (!hasPublicKey()) throw e
  }

  await initZoraCoinsSdk()
  const sdk = await import('@zoralabs/coins-sdk')

  const options = { count, after }
  const response =
    list === 'TOP_GAINERS'
      ? await sdk.getCoinsTopGainers(options)
      : list === 'TOP_VOLUME_24H'
        ? await sdk.getCoinsTopVolume24h(options)
        : list === 'MOST_VALUABLE'
          ? await sdk.getCoinsMostValuable(options)
          : list === 'NEW'
            ? await sdk.getCoinsNew(options)
            : list === 'LAST_TRADED'
              ? await sdk.getCoinsLastTraded(options)
              : await sdk.getCoinsLastTradedUnique(options)

  return (response.data?.exploreList as any) ?? null
}

export async function fetchZoraTopCreators(params?: { count?: number; after?: string }): Promise<ZoraExploreList | null> {
  const count = params?.count
  const after = params?.after

  const qs = new URLSearchParams({
    ...(count ? { count: String(count) } : {}),
    ...(after ? { after } : {}),
  })

  const url = qs.toString() ? `/api/zora/topCreators?${qs.toString()}` : '/api/zora/topCreators'
  try {
    const envelope = await fetchJson<ApiEnvelope<ZoraExploreList | null>>(url)
    return envelope.data ?? null
  } catch {
    return null
  }
}

