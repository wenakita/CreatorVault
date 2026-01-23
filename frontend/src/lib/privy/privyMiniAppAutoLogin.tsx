import { useEffect, useRef, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useLoginToMiniApp } from '@privy-io/react-auth/farcaster'
import { useMiniAppContext } from '@/hooks'
import { logger } from '@/lib/logger'

/**
 * Farcaster Mini App → Privy seamless auth
 *
 * This uses the Mini Apps SDK to produce a FIP-11 SIWF credential, then passes it
 * to Privy's `loginToMiniApp` for authentication.
 *
 * Prereqs (Privy dashboard):
 * - Enable Farcaster login.
 * - Add https://farcaster.xyz to allowed domains for Mini Apps.
 *
 * Notes:
 * - We set `acceptAuthAddress: true` to support auth-address signing (e.g. Base App wallet).
 * - This does NOT create embedded wallets automatically (per Privy Mini App limitation).
 */
export function PrivyMiniAppAutoLogin() {
  const mini = useMiniAppContext()
  const { ready, authenticated } = usePrivy()
  const { initLoginToMiniApp, loginToMiniApp } = useLoginToMiniApp()

  const attemptedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    if (mini.isMiniApp !== true) return
    if (!ready) return
    if (authenticated) return
    if (attemptedRef.current) return

    attemptedRef.current = true
    let cancelled = false

    ;(async () => {
      try {
        setError(null)

        const { nonce } = await initLoginToMiniApp()
        if (!nonce) throw new Error('Missing Farcaster nonce')

        const { sdk } = await import('@farcaster/miniapp-sdk')
        if (!sdk?.actions?.signIn) throw new Error('Mini App host does not support Farcaster sign-in')

        const result = await sdk.actions.signIn({ nonce, acceptAuthAddress: true })
        if (!result?.message || !result?.signature) throw new Error('Missing Farcaster signature')

        await loginToMiniApp({ message: result.message, signature: result.signature })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Mini App login failed'
        logger.warn('[PrivyMiniAppAutoLogin] failed', { msg })
        if (!cancelled) setError(msg)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authenticated, initLoginToMiniApp, loginToMiniApp, mini.isMiniApp, ready, retryTick])

  const retryLogin = () => {
    attemptedRef.current = false
    setError(null)
    setRetryTick((v) => v + 1)
  }

  // Dev-only, non-intrusive status badge (keeps production UI clean).
  if (import.meta.env.DEV) {
    const status =
      mini.isMiniApp !== true
        ? 'Not in Mini App'
        : !ready
          ? 'Privy not ready'
          : authenticated
            ? 'Privy authenticated'
            : error
              ? 'Mini App auth failed'
              : attemptedRef.current
                ? 'Authenticating…'
                : 'Waiting…'

    return (
      <div className="fixed bottom-4 right-4 z-[10000] pointer-events-none">
        <div className="card px-3 py-2 bg-black/70">
          <div className="label">{status}</div>
          {error ? (
            <div className="mt-1 text-[10px] text-red-400/90 max-w-[260px] break-words">{error}</div>
          ) : null}
        </div>
      </div>
    )
  }

  if (!error || mini.isMiniApp !== true) return null

  const hint = mini.isBaseApp
    ? 'Base App users: add your Base App wallet as a Farcaster auth address, then retry.'
    : 'If this keeps failing, try again from your Farcaster client.'

  return (
    <div className="fixed bottom-4 right-4 z-[10000]">
      <div className="card px-3 py-2 bg-black/70 space-y-2">
        <div className="label">Farcaster login failed</div>
        <div className="text-[10px] text-zinc-500 max-w-[240px]">{hint}</div>
        <button type="button" className="btn-primary w-full" onClick={retryLogin}>
          Retry
        </button>
      </div>
    </div>
  )
}

