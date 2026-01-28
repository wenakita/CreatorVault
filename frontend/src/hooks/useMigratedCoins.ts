/**
 * React hook for checking coin migration status
 */

import { useEffect, useState } from 'react'
import { fetchMigratedCoins, hasCoinMigratedSync, preloadMigratedCoins } from '@/lib/zora/migrations'

// Start preloading on module load
preloadMigratedCoins()

/**
 * Hook to get the set of migrated coins
 * Triggers a fetch if not cached
 */
export function useMigratedCoins() {
  const [migratedCoins, setMigratedCoins] = useState<Set<string> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchMigratedCoins()
      .then((coins) => {
        if (!cancelled) {
          setMigratedCoins(coins)
          setIsLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e)
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { migratedCoins, isLoading, error }
}

/**
 * Hook to check if a specific coin has migrated
 */
export function useIsCoinMigrated(coinAddress: string | undefined): boolean | undefined {
  const [isMigrated, setIsMigrated] = useState<boolean | undefined>(() => {
    if (!coinAddress) return undefined
    return hasCoinMigratedSync(coinAddress)
  })

  useEffect(() => {
    if (!coinAddress) {
      setIsMigrated(undefined)
      return
    }

    // Check sync first
    const syncResult = hasCoinMigratedSync(coinAddress)
    if (syncResult !== undefined) {
      setIsMigrated(syncResult)
      return
    }

    // Otherwise fetch and check
    let cancelled = false
    fetchMigratedCoins().then((coins) => {
      if (!cancelled) {
        setIsMigrated(coins.has(coinAddress.toLowerCase()))
      }
    })

    return () => {
      cancelled = true
    }
  }, [coinAddress])

  return isMigrated
}

/**
 * Batch check for multiple coins
 * More efficient than individual checks
 */
export function useBatchMigrationCheck(coinAddresses: string[]): Map<string, boolean> {
  const { migratedCoins, isLoading } = useMigratedCoins()
  const [results, setResults] = useState<Map<string, boolean>>(new Map())

  useEffect(() => {
    if (isLoading || !migratedCoins) return

    const newResults = new Map<string, boolean>()
    for (const addr of coinAddresses) {
      newResults.set(addr.toLowerCase(), migratedCoins.has(addr.toLowerCase()))
    }
    setResults(newResults)
  }, [coinAddresses, migratedCoins, isLoading])

  return results
}
