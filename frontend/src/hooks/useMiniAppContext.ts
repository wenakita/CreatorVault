import { useEffect, useMemo, useState } from 'react'

type MiniAppContext = {
  client: { clientFid: number; added: boolean; platformType?: 'web' | 'mobile' }
  user: { fid: number; username?: string; displayName?: string; pfpUrl?: string }
}

export function useMiniAppContext() {
  // NOTE:
  // `sdk.context` is useful for UX (e.g. showing @username), but it is NOT an authoritative identity oracle.
  // For any irreversible / security-sensitive action, verify identity server-side:
  // - Farcaster: use `useFarcasterAuth()` (Quick Auth / SIWF) which returns a server-trustable `fid`.
  // - App auth: use SIWE (`useSiweAuth`) for creator-access/admin only.
  const [isMiniApp, setIsMiniApp] = useState<boolean | null>(null)
  const [context, setContext] = useState<MiniAppContext | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk')
        const inMini = await sdk.isInMiniApp().catch(() => false)
        if (cancelled) return
        setIsMiniApp(inMini)
        if (!inMini) {
          setContext(null)
          return
        }

        const ctx = (await sdk.context) as any
        if (cancelled) return
        const cleaned: MiniAppContext | null =
          ctx && typeof ctx === 'object' && typeof ctx?.user?.fid === 'number' ? (ctx as MiniAppContext) : null
        setContext(cleaned)
      } catch {
        if (cancelled) return
        setIsMiniApp(false)
        setContext(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const fid = useMemo(() => (typeof context?.user?.fid === 'number' ? context.user.fid : null), [context])
  const username = useMemo(() => (typeof context?.user?.username === 'string' ? context.user.username : null), [context])
  const clientFid = useMemo(
    () => (typeof context?.client?.clientFid === 'number' ? context.client.clientFid : null),
    [context],
  )
  const platformType = useMemo(() => {
    const v = context?.client?.platformType
    return v === 'web' || v === 'mobile' ? v : null
  }, [context])
  const added = useMemo(
    () => (typeof context?.client?.added === 'boolean' ? context.client.added : null),
    [context],
  )
  // Base App currently uses clientFid 309857 (non-authoritative, UI-only).
  const isBaseApp = useMemo(() => clientFid === 309857, [clientFid])

  return { isMiniApp, context, fid, username, clientFid, platformType, added, isBaseApp }
}

