import type { ComponentType, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { RouteDebugBadge } from '@/components/RouteDebugBadge'

import { Web3Context, type Web3Status } from './Web3Context'

type Web3ProvidersComponent = ComponentType<{ children: ReactNode }>

function routeNeedsWeb3(pathname: string): boolean {
  // We want wallet connect to be 1-click on every route (including Home).
  // Keeping Web3 providers mounted avoids "click once to load web3, click again to connect" UX.
  void pathname
  return true
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
  const [isMiniApp, setIsMiniApp] = useState(false)

  const enable = useCallback(() => setUserEnabled(true), [])
  const shouldUseWeb3 = isMiniApp || userEnabled || routeNeedsWeb3(location.pathname)

  const status: Web3Status = !shouldUseWeb3
    ? 'disabled'
    : Providers
      ? 'ready'
      : 'loading'

  useEffect(() => {
    let cancelled = false
    // Base app / Farcaster Mini App: mark app as ready + enable Web3 from the start.
    // We keep this lazy/dynamic so regular web loads stay lightweight.
    ;(async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk')
        const inMini = await sdk.isInMiniApp().catch(() => false)

        // Always call `ready()` (best-effort). Do NOT treat it as a Mini App detection signal:
        // some environments may resolve the promise even when not embedded, which would incorrectly
        // force Web3 to load on every page.
        sdk.actions.ready().catch(() => {})

        if (cancelled) return
        setIsMiniApp(Boolean(inMini))
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
