import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'

import { fetchZoraCoin, fetchZoraExplore, fetchZoraProfile, fetchZoraProfileCoins, fetchZoraTopCreators } from './client'
import type { ZoraExploreListType } from './types'

export function useZoraCoin(address?: Address) {
  return useQuery({
    queryKey: ['zora', 'coin', address],
    queryFn: async () => fetchZoraCoin(address as Address),
    enabled: !!address,
    // Coin stats change frequently; keep this fairly fresh.
    staleTime: 1000 * 60,
  })
}

export function useZoraProfile(identifier?: string) {
  return useQuery({
    queryKey: ['zora', 'profile', identifier],
    queryFn: async () => fetchZoraProfile(identifier as string),
    enabled: !!identifier,
    staleTime: 1000 * 60 * 5,
  })
}

export function useZoraExplore(list: ZoraExploreListType, params?: { count?: number; after?: string; enabled?: boolean }) {
  return useQuery({
    queryKey: ['zora', 'explore', list, params?.count, params?.after],
    queryFn: async () => fetchZoraExplore({ list, count: params?.count, after: params?.after }),
    enabled: params?.enabled ?? true,
    staleTime: 1000 * 60 * 2,
  })
}

export function useZoraProfileCoins(identifier?: string, params?: { count?: number; after?: string }) {
  return useQuery({
    queryKey: ['zora', 'profileCoins', identifier, params?.count, params?.after],
    queryFn: async () =>
      fetchZoraProfileCoins({
        identifier: identifier as string,
        count: params?.count,
        after: params?.after,
      }),
    enabled: !!identifier,
    staleTime: 1000 * 60 * 5,
  })
}

export function useZoraTopCreators(params?: { count?: number; after?: string; enabled?: boolean }) {
  return useQuery({
    queryKey: ['zora', 'topCreators', params?.count, params?.after],
    queryFn: async () => fetchZoraTopCreators({ count: params?.count, after: params?.after }),
    enabled: params?.enabled ?? true,
    staleTime: 1000 * 60 * 2,
  })
}

