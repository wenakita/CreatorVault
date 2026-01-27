import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { coinbaseWallet, walletConnect, injected } from 'wagmi/connectors'

/**
 * Minimal Wagmi Config
 * 
 * Three connection paths:
 * 1. Coinbase Wallet (includes Smart Wallet)
 * 2. WalletConnect (MetaMask, Rainbow, etc.)
 * 3. Injected (browser extension fallback)
 */

const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string || 'bc3dfd319b4a0ecaa25cdee7e36bd0c4'

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: 'Creator Vaults',
      preference: 'smartWalletOnly',
    }),
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: 'Creator Vaults',
        description: 'Creator coin vaults on Base',
        url: 'https://4626.fun',
        icons: ['https://4626.fun/pwa-512.png'],
      },
      showQrModal: true,
    }),
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [base.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
