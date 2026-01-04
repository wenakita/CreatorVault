import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { coinbaseWallet, injected } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    // Base app / Farcaster Mini App connector (when available).
    farcasterMiniApp(),
    injected(),
    coinbaseWallet({
      appName: 'Creator Vaults',
      // Don’t force Smart Wallet UX; allow users to connect with whatever wallet they have access to.
      preference: 'all',
    }),
  ],
  transports: {
    [base.id]: http(import.meta.env.VITE_BASE_RPC || 'https://mainnet.base.org'),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
