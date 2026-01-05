import { useEffect, useMemo, useState } from 'react'

type MiniAppContext = {
  client: { clientFid: number; added: boolean; platformType?: 'web' | 'mobile' }
  user: { fid: number; username?: string; displayName?: string; pfpUrl?: string }
}

export function useMiniAppContext() {
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

  return { isMiniApp, context, fid, username }
}
