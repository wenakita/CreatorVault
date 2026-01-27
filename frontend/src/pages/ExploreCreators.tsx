import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { TokenRow, TokenTableHeader, TokenRowSkeleton } from '@/components/explore/TokenRow'
import { fetchZoraExplore } from '@/lib/zora/client'
import type { ZoraCoin, ZoraExploreListType } from '@/lib/zora/types'

const SORT_TO_LIST_TYPE: Record<string, ZoraExploreListType> = {
  volume: 'TOP_VOLUME_24H',
  marketCap: 'MOST_VALUABLE',
  priceChange: 'TOP_GAINERS',
  new: 'NEW',
}

const PAGE_SIZE = 20

export function ExploreCreators() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')

  const currentTimeFilter = searchParams.get('time') || '1d'
  const currentSort = searchParams.get('sort') || 'volume'

  const listType = SORT_TO_LIST_TYPE[currentSort] || 'TOP_VOLUME_24H'

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
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden"
        >
          {/* Table Header */}
          <TokenTableHeader />

          {/* Table Body */}
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
          </div>

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

