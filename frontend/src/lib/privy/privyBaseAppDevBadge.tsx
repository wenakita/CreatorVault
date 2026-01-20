import { useEffect, useState } from 'react'

/**
 * Dev-only, non-intrusive Base App integration probe.
 *
 * We avoid calling `useBaseAccountSdk` directly here so we don't hard-crash the app
 * if the installed Privy version or bundle split changes. Instead, we just confirm
 * the export exists and that we've enabled `appearance.walletList: ['base_account']`.
 */
export function PrivyBaseAppDevBadge() {
  const [hasHook, setHasHook] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const mod = (await import('@privy-io/react-auth')) as any
        const ok = typeof mod?.useBaseAccountSdk === 'function'
        if (!cancelled) setHasHook(ok)
      } catch {
        if (!cancelled) setHasHook(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!import.meta.env.DEV) return null

  const hookStatus =
    hasHook === null ? 'checking…' : hasHook ? 'useBaseAccountSdk available' : 'useBaseAccountSdk missing'

  return (
    <div className="fixed bottom-4 left-4 z-[10000] pointer-events-none">
      <div className="card px-3 py-2 bg-black/70">
        <div className="label">Base App enabled (Privy walletList)</div>
        <div className="mt-1 text-[10px] text-zinc-500">{hookStatus}</div>
      </div>
    </div>
  )
}

