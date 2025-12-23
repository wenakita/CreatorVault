import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { coinbaseWallet, injected } from 'wagmi/connectors'

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: 'CreatorVault',
      preference: 'smartWalletOnly', // Use Smart Wallet for gasless txs
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

