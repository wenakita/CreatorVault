import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { fetchDebankTotalBalanceBatch } from './client'

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

export function useDebankTotalBalanceBatch(params: { addresses?: string[]; enabled?: boolean }) {
  const normalized = useMemo(() => normalizeAddressList(params.addresses), [params.addresses])

  return useQuery({
    queryKey: ['debank', 'totalBalanceBatch', normalized.key],
    queryFn: async () => fetchDebankTotalBalanceBatch({ addresses: normalized.list }),
    enabled: (params.enabled ?? true) && normalized.list.length > 0,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
}

