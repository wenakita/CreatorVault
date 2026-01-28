import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { TokenRow, TokenTableHeader, TokenRowSkeleton } from '@/components/explore/TokenRow'
import { fetchZoraExplore } from '@/lib/zora/client'
import { apiFetch } from '@/lib/apiBase'
import { useMigratedCoins } from '@/hooks/useMigratedCoins'
import type { ZoraCoin, ZoraExploreListType } from '@/lib/zora/types'

const SORT_TO_LIST_TYPE: Record<string, ZoraExploreListType> = {
  volume: 'TOP_VOLUME_CREATORS_24H',
  marketCap: 'MOST_VALUABLE_CREATORS',
  priceChange: 'TOP_GAINERS',
  new: 'NEW_CREATORS',
}

const PAGE_SIZE = 20

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type ExploreMetrics = {
  scope: 'creators'
  updatedAt: string
  totals: {
    creatorsTotal: number | null
    creatorsNew24h: number | null
    creatorCoinsMarketCapUsd: number | null
    creatorCoinsVolume24hUsd: number | null
    partial: boolean
    sampledCreators: number
  }
}

function formatCompactUsd(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const n = v
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

export function ExploreCreators() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')

  const currentTimeFilter = searchParams.get('time') || '1d'
  const currentSort = searchParams.get('sort') || 'volume'

  const listType = SORT_TO_LIST_TYPE[currentSort] || 'TOP_VOLUME_24H'
  
  // Fetch migrated coins for accurate fee detection
  const { migratedCoins } = useMigratedCoins()

  const metricsQuery = useQuery({
    queryKey: ['explore', 'creators', 'metrics'],
    queryFn: async (): Promise<ExploreMetrics | null> => {
      const res = await apiFetch('/api/zora/metrics?scope=creators', { method: 'GET' })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<ExploreMetrics | null> | null
      if (!res.ok || !json?.success) return null
      return json.data ?? null
    },
    staleTime: 60_000,
    retry: 1,
  })

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ['explore', 'creators', listType],
    queryFn: async ({ pageParam }) => {
      const result = await fetchZoraExplore({
        list: listType,
        count: PAGE_SIZE,
        after: pageParam,
      })
      return result
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.pageInfo?.hasNextPage) return undefined
      return lastPage.pageInfo.endCursor
    },
    staleTime: 30_000,
  })

  // Flatten all pages into a single array of coins
  const allCoins = useMemo(() => {
    if (!data?.pages) return []
    const coins: ZoraCoin[] = []
    for (const page of data.pages) {
      if (page?.edges) {
        for (const edge of page.edges) {
          if (edge?.node) {
            coins.push(edge.node)
          }
        }
      }
    }
    return coins
  }, [data])

  // Filter coins based on search query
  const filteredCoins = useMemo(() => {
    if (!searchQuery.trim()) return allCoins
    const query = searchQuery.toLowerCase()
    return allCoins.filter((coin) => {
      const name = (coin.name || '').toLowerCase()
      const symbol = (coin.symbol || '').toLowerCase()
      const address = (coin.address || '').toLowerCase()
      return name.includes(query) || symbol.includes(query) || address.includes(query)
    })
  }, [allCoins, searchQuery])

  // Handle infinite scroll
  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop >=
      document.documentElement.offsetHeight - 500
    ) {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const handleTimeFilterChange = (filter: string) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('time', filter)
    setSearchParams(newParams, { replace: true })
  }

  const handleSortChange = (sort: string) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('sort', sort)
    setSearchParams(newParams, { replace: true })
  }

  return (
    <div className="relative pb-24 md:pb-0 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-medium text-white mb-2">
            Top Creators on Base
          </h1>
          <p className="text-zinc-400 text-sm">
            Creator Coins ranked by volume, market cap, and more.
          </p>

          {/* Uniswap-style metrics strip */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Total creators</div>
              <div className="mt-1 text-[22px] font-medium text-white tabular-nums">
                {metricsQuery.data?.totals.creatorsTotal?.toLocaleString() ?? '—'}
              </div>
              <div className="mt-1 text-[12px] text-zinc-500">
                {metricsQuery.data?.totals.creatorsNew24h != null ? `+${metricsQuery.data.totals.creatorsNew24h} today` : '—'}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Creator coin TVL</div>
              <div className="mt-1 text-[22px] font-medium text-white tabular-nums">
                {formatCompactUsd(metricsQuery.data?.totals.creatorCoinsMarketCapUsd ?? null)}
              </div>
              <div className="mt-1 text-[12px] text-zinc-500">
                {metricsQuery.data?.totals.partial ? `Sampled ${metricsQuery.data.totals.sampledCreators.toLocaleString()} creators` : 'All creators'}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">1D volume</div>
              <div className="mt-1 text-[22px] font-medium text-white tabular-nums">
                {formatCompactUsd(metricsQuery.data?.totals.creatorCoinsVolume24hUsd ?? null)}
              </div>
              <div className="mt-1 text-[12px] text-zinc-500">Across creator coins</div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Updated</div>
              <div className="mt-1 text-[22px] font-medium text-white tabular-nums">
                {metricsQuery.data?.updatedAt ? new Date(metricsQuery.data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
              <div className="mt-1 text-[12px] text-zinc-500">Cached ~5 min</div>
            </div>
          </div>
        </motion.div>

        {/* Navigation & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-6"
        >
          <ExploreSubnav
            searchPlaceholder="Search creators"
            onSearch={setSearchQuery}
            onTimeFilterChange={handleTimeFilterChange}
            onSortChange={handleSortChange}
            currentTimeFilter={currentTimeFilter}
            currentSort={currentSort}
          />
        </motion.div>

        {/* Token Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50"
        >
          {/* Single horizontal scroll container (no double scrollbars) */}
          <div className="overflow-x-auto scrollbar-hide">
            <div className="min-w-max">
              <div className="sticky top-24 z-20 border-b border-zinc-800 bg-zinc-900/70 backdrop-blur">
                <TokenTableHeader timeframe={currentTimeFilter} currentSort={currentSort} onSortChange={handleSortChange} />
              </div>

              <div className="divide-y divide-zinc-800/50">
                {isLoading ? (
                  // Loading skeletons
                  Array.from({ length: 10 }).map((_, i) => <TokenRowSkeleton key={i} />)
                ) : isError ? (
                  // Error state
                  <div className="px-6 py-12 text-center">
                    <p className="text-zinc-400 mb-4">Failed to load creators</p>
                    <p className="text-xs text-zinc-600">{(error as Error)?.message || 'Unknown error'}</p>
                  </div>
                ) : filteredCoins.length === 0 ? (
                  // Empty state
                  <div className="px-6 py-12 text-center">
                    <p className="text-zinc-400">
                      {searchQuery ? 'No creators found matching your search' : 'No creators available'}
                    </p>
                  </div>
                ) : (
                  // Token rows
                  filteredCoins.map((coin, index) => (
                    <TokenRow
                      key={coin.address || index}
                      rank={index + 1}
                      coin={coin}
                      linkPrefix="/explore/creators"
                      timeframe={currentTimeFilter}
                      migratedCoins={migratedCoins ?? undefined}
                    />
                  ))
                )}

                {/* Loading more indicator */}
                {isFetchingNextPage && (
                  <>
                    <TokenRowSkeleton />
                    <TokenRowSkeleton />
                    <TokenRowSkeleton />
                  </>
                )}

                {/* Load more button (fallback for scroll) */}
                {hasNextPage && !isFetchingNextPage && (
                  <div className="px-6 py-4 border-t border-zinc-800 flex justify-center">
                    <button
                      type="button"
                      onClick={() => fetchNextPage()}
                      className="px-6 py-2 rounded-full text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                      Load more
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats footer */}
        {!isLoading && filteredCoins.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-4 text-center text-xs text-zinc-600"
          >
            Showing {filteredCoins.length} creators
          </motion.div>
        )}
      </div>
    </div>
  )
}

