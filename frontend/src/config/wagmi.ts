import { http, fallback, createConfig as createWagmiConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { walletConnect } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'
import { coinbaseSmartWallet } from '@/web3/connectors/coinbaseSmartWallet'

/**
 * Wallet Setup (Simplified)
 *
 * Primary paths:
 * 1. Coinbase Smart Wallet - passkeys, cross-device, gas sponsorship via CDP
 * 2. Farcaster Mini App - when running inside Farcaster/Base app
 * 3. WalletConnect - universal fallback for any wallet (MetaMask, Rabby, etc.)
 *
 * This setup removes:
 * - Privy embedded wallets (conflicted with Coinbase Smart Wallet)
 * - Zora cross-app connector (Privy-based, removed for simplicity)
 * - Direct injected connectors (users can connect via WalletConnect instead)
 */

// Base RPC configuration with fallbacks
const DEFAULT_BASE_RPCS = [
  'https://base-mainnet.public.blastapi.io',
  'https://base.llamarpc.com',
  'https://mainnet.base.org',
] as const

const baseRpcUrls = (() => {
  const env = (import.meta.env.VITE_BASE_RPC as string | undefined)?.trim()
  const urls = env ? [env, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]
  return Array.from(new Set(urls))
})()

// WalletConnect project ID (public, restrict via WalletConnect Cloud)
const DEFAULT_WALLETCONNECT_PROJECT_ID = 'bc3dfd319b4a0ecaa25cdee7e36bd0c4'
const walletConnectProjectId = (() => {
  const env = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim()
  return env || DEFAULT_WALLETCONNECT_PROJECT_ID
})().trim()

const walletConnectMetadata = {
  name: 'Creator Vaults',
  description: 'Creator coin vaults on Base.',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://4626.fun',
  icons: ['https://4626.fun/pwa-512.png'] as string[],
}

const walletBranding = {
  appName: walletConnectMetadata.name,
  appLogoUrl: walletConnectMetadata.icons[0] ?? undefined,
}

export const wagmiConfig = createWagmiConfig({
  chains: [base],
  connectors: [
    // 1. Farcaster Mini App connector (when running in Farcaster/Base app)
    farcasterMiniApp(),
    // 2. Coinbase Smart Wallet - primary path for new users (passkeys, no seed phrase)
    coinbaseSmartWallet({
      appName: walletBranding.appName,
      appLogoUrl: walletBranding.appLogoUrl,
    }),
    // 3. WalletConnect - universal fallback for any wallet
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            metadata: walletConnectMetadata,
            showQrModal: true,
          }),
        ]
      : []),
  ],
  // Disable auto-discovery to avoid multi-injected provider conflicts
  multiInjectedProviderDiscovery: false,
  transports: {
    [base.id]: fallback(
      baseRpcUrls.map((url) =>
        http(url, {
          timeout: 15_000,
          retryCount: 2,
          retryDelay: 400,
        }),
      ),
    ),
  },
})

// Legacy exports for back-compat (all point to same config now)
export const wagmiConfigBase = wagmiConfig
export const wagmiConfigBaseNoZora = wagmiConfig
export const wagmiConfigDeploy = wagmiConfig

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
