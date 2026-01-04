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
  return (
    <WagmiProvider config={wagmiConfig}>
      <OnchainKitProvider chain={base} apiKey={import.meta.env.VITE_CDP_API_KEY}>
        <MiniAppAutoConnect />
        {children}
      </OnchainKitProvider>
    </WagmiProvider>
  )
}


