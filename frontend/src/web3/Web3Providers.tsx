import type { ReactNode } from 'react'
// Use the browser-safe Buffer shim (Vite can externalize Node built-ins like `buffer`).
import { Buffer } from 'buffer/'
import { OnchainKitProvider } from '@coinbase/onchainkit'
import { WagmiProvider } from 'wagmi'
import { base } from 'wagmi/chains'
import { useEffect, useRef } from 'react'
import { useAccount, useConnect } from 'wagmi'

import { wagmiConfig } from '@/config/wagmi'
import { logger } from '@/lib/logger'
import { WalletDebugPanel } from '@/components/WalletDebugPanel'

// Polyfill Buffer for Coinbase Wallet SDK (and some wallet adapters).
if (typeof window !== 'undefined') {
  ;(window as any).Buffer = Buffer
}

function MiniAppAutoConnect() {
  const { isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const attemptedRef = useRef(false)

  useEffect(() => {
    if (isConnected) return
    if (attemptedRef.current) return

    let cancelled = false
    ;(async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk')
        const inMini = await sdk.isInMiniApp().catch(() => false)
        if (!inMini || cancelled) return

        const farcasterConnector = connectors.find((c) => c.id === 'farcaster')
        if (!farcasterConnector) return

        attemptedRef.current = true
        connect({ connector: farcasterConnector })
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
    }
  }, [connect, connectors, isConnected])

  return null
}

export function Web3Providers({ children }: { children: ReactNode }) {
  // Coinbase Developer Platform (OnchainKit) config.
  // - `VITE_CDP_API_KEY` is the CDP key id (safe to expose; origin-restrict in CDP).
  // - If you want to force a specific paymaster/bundler endpoint, set `VITE_CDP_PAYMASTER_URL`.
  const cdpApiKey = import.meta.env.VITE_CDP_API_KEY as string | undefined
  const cdpPaymasterUrl = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined

  // Debug hint: if both are set but the URL does not contain the key, it's likely the wrong value was pasted
  // (CDP has multiple identifiers). We still respect the explicit URL override, but warn in dev.
  if (import.meta.env.DEV && cdpApiKey && cdpPaymasterUrl && !cdpPaymasterUrl.includes(cdpApiKey)) {
    logger.warn(
      '[Web3Providers] VITE_CDP_PAYMASTER_URL does not include VITE_CDP_API_KEY. This may indicate a mismatched CDP key vs paymaster URL.',
    )
  }

  const content = (
    <WagmiProvider config={wagmiConfig}>
      <OnchainKitProvider
        chain={base}
        apiKey={cdpApiKey}
        config={{
          // If set, this overrides the default paymaster URL derived from `apiKey`.
          paymaster: cdpPaymasterUrl || undefined,
        }}
      >
        <MiniAppAutoConnect />
        {import.meta.env.DEV ? <WalletDebugPanel /> : null}
        {children}
      </OnchainKitProvider>
    </WagmiProvider>
  )

  return content
}
