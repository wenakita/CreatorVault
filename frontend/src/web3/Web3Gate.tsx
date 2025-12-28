import type { ComponentType, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { RouteDebugBadge } from '@/components/RouteDebugBadge'

import { Web3Context, type Web3Status } from './Web3Context'

type Web3ProvidersComponent = ComponentType<{ children: ReactNode }>

function routeNeedsWeb3(pathname: string): boolean {
  return pathname !== '/'
}

function FullPageLoading() {
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-600">
          Loading…
        </div>
      </div>
    </div>
  )
}

export function Web3Gate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [userEnabled, setUserEnabled] = useState(false)
  const [Providers, setProviders] = useState<Web3ProvidersComponent | null>(null)

  const enable = useCallback(() => setUserEnabled(true), [])
  const shouldUseWeb3 = userEnabled || routeNeedsWeb3(location.pathname)

  const status: Web3Status = !shouldUseWeb3
    ? 'disabled'
    : Providers
      ? 'ready'
      : 'loading'

  useEffect(() => {
    if (!shouldUseWeb3 || Providers) return

    let cancelled = false
    import('./Web3Providers')
      .then((m) => {
        if (cancelled) return
        setProviders(() => m.Web3Providers)
      })
      .catch(() => {
        // Keep status as "loading" (fallback UI). User can navigate away/retry.
      })

    return () => {
      cancelled = true
    }
  }, [shouldUseWeb3, Providers])

  const ctxValue = useMemo(() => ({ status, enable }), [status, enable])

  return (
    <Web3Context.Provider value={ctxValue}>
      <RouteDebugBadge />
      {status === 'ready' && Providers ? (
        <Providers>{children}</Providers>
      ) : status === 'loading' ? (
        location.pathname === '/' ? (
          children
        ) : (
          <FullPageLoading />
        )
      ) : (
        children
      )}
    </Web3Context.Provider>
  )
}


