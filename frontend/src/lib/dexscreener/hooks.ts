import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchDexscreenerTokenStatsBatch } from './client'

function normalizeAddressList(addresses: string[] | undefined): { key: string; list: string[] } {
  const uniq = new Set<string>()
  for (const a of addresses ?? []) {
    const trimmed = String(a || '').trim()
    if (!trimmed) continue
    uniq.add(trimmed.toLowerCase())
  }
  const list = Array.from(uniq).sort()
  return { list, key: list.join(',') }
}

export function useDexscreenerTokenStatsBatch(params: { addresses?: string[]; chainId?: string; enabled?: boolean }) {
  const normalized = useMemo(() => normalizeAddressList(params.addresses), [params.addresses])
  const chainId = (params.chainId ?? 'base').toLowerCase()

  return useQuery({
    queryKey: ['dexscreener', 'tokenStatsBatch', chainId, normalized.key],
    queryFn: async () => fetchDexscreenerTokenStatsBatch({ addresses: normalized.list, chainId }),
    enabled: (params.enabled ?? true) && normalized.list.length > 0,
    staleTime: 1000 * 60, // 60s
  })
}


