import { useQuery } from '@tanstack/react-query'

import { formatBasename, getBasename } from '@/lib/basename-api'

export function useBasename(address?: string | null) {
  const addr = typeof address === 'string' && address.length > 0 ? address.toLowerCase() : null

  const query = useQuery({
    queryKey: ['basename', addr],
    enabled: Boolean(addr),
    queryFn: async () => (addr ? getBasename(addr) : null),
    staleTime: 5 * 60 * 1000,
    retry: 0,
  })

  const basename = query.data ? formatBasename(query.data) : null

  return {
    basename,
    isLoading: query.isLoading,
    error: query.error,
  }
}
