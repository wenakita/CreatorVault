import { useState, useEffect, useRef, type ReactNode } from 'react'
// Use the browser-safe Buffer shim (Vite can externalize Node built-ins like `buffer`).
import { Buffer } from 'buffer/'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OnchainKitProvider } from '@coinbase/onchainkit'
import { WagmiProvider } from 'wagmi'
import { base } from 'wagmi/chains'
import { useAccount, useConnect } from 'wagmi'

import { wagmiConfig } from '@/config/wagmi'
import { logger } from '@/lib/logger'
import { WalletDebugPanel } from '@/components/WalletDebugPanel'

// Polyfill Buffer for Coinbase Wallet SDK (and some wallet adapters).
if (typeof window !== 'undefined') {
  ;(window as any).Buffer = Buffer
}

// Shared QueryClient for wagmi + app queries.
// Must be inside WagmiProvider per wagmi v2 requirements.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
      // Prevent synchronous state updates during render
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * Auto-connect to Farcaster wallet when running inside a Mini App.
 */
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

/**
 * Web3 Provider Stack (Simplified)
 *
 * - WagmiProvider: core wallet connection state
 * - OnchainKitProvider: Coinbase CDP paymaster for gas sponsorship
 *
 * Primary wallet paths:
 * 1. Coinbase Smart Wallet (passkeys, cross-device)
 * 2. Farcaster Mini App (when in Farcaster/Base app)
 * 3. WalletConnect (universal fallback)
 */
export function Web3Providers({ children }: { children: ReactNode }) {
  // Coinbase Developer Platform (OnchainKit) config.
  const cdpApiKey = import.meta.env.VITE_CDP_API_KEY as string | undefined
  const cdpPaymasterUrl = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined

  // Debug hint: if both are set but the URL does not contain the key, it's likely a config issue.
  if (import.meta.env.DEV && cdpApiKey && cdpPaymasterUrl && !cdpPaymasterUrl.includes(cdpApiKey)) {
    logger.warn(
      '[Web3Providers] VITE_CDP_PAYMASTER_URL does not include VITE_CDP_API_KEY. This may indicate a mismatched CDP key vs paymaster URL.',
    )
  }

  // TEMPORARY: Skip OnchainKitProvider to debug React #426 crash.
  // If the crash stops, OnchainKit is the culprit.
  const skipOnchainKit = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  ).has('skipOnchainKit')

  if (skipOnchainKit) {
    return (
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <MiniAppAutoConnect />
          {import.meta.env.DEV ? <WalletDebugPanel /> : null}
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    )
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          chain={base}
          apiKey={cdpApiKey}
          config={{
            paymaster: cdpPaymasterUrl || undefined,
          }}
        >
          <MiniAppAutoConnect />
          {import.meta.env.DEV ? <WalletDebugPanel /> : null}
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
