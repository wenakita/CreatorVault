import type { ReactNode } from 'react'
import { Buffer } from 'buffer'
import { OnchainKitProvider } from '@coinbase/onchainkit'
import { WagmiProvider } from 'wagmi'
import { base } from 'wagmi/chains'

import { wagmiConfig } from '@/config/wagmi'

// Polyfill Buffer for WalletConnect / Coinbase Wallet SDK.
if (typeof window !== 'undefined') {
  ;(window as any).Buffer = Buffer
}

export function Web3Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <OnchainKitProvider chain={base} apiKey={import.meta.env.VITE_CDP_API_KEY}>
        {children}
      </OnchainKitProvider>
    </WagmiProvider>
  )
}


