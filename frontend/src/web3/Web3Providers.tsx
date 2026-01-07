import type { ReactNode } from 'react'
import { Buffer } from 'buffer'
import { OnchainKitProvider } from '@coinbase/onchainkit'
import { WagmiProvider } from 'wagmi'
import { base } from 'wagmi/chains'
import { useEffect, useRef } from 'react'
import { useAccount, useConnect } from 'wagmi'

import { wagmiConfig } from '@/config/wagmi'

// Polyfill Buffer for WalletConnect / Coinbase Wallet SDK.
if (typeof window !== 'undefined') {
  ;(window as any).Buffer = Buffer

  // Suppress wallet injection conflicts (multiple extensions trying to inject window.ethereum)
  const originalDefineProperty = Object.defineProperty
  Object.defineProperty = function (obj: any, prop: string, descriptor: PropertyDescriptor) {
    if (prop === 'ethereum' && obj === window) {
      try {
        return originalDefineProperty.call(this, obj, prop, {
          ...descriptor,
          configurable: true, // Allow redefinition
        })
      } catch {
        // If it fails, just return the existing property
        return obj[prop]
      }
    }
    return originalDefineProperty.call(this, obj, prop, descriptor)
  }
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

  return (
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
        {children}
      </OnchainKitProvider>
    </WagmiProvider>
  )
}
