import { createConfig, http, fallback } from 'wagmi'
import { base } from 'wagmi/chains'
import { coinbaseWallet, injected } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'
import { coinbaseSmartWallet } from '@/web3/connectors/coinbaseSmartWallet'

/**
 * Base RPC notes:
 * - `https://mainnet.base.org` is convenient but can 429 under load.
 * - Use `VITE_BASE_RPC` to provide your own paid/stable endpoint.
 * - We also include a small fallback set of public endpoints to reduce flakiness.
 */

const DEFAULT_BASE_RPCS = [
  'https://mainnet.base.org',
  // Public community RPCs (best-effort; can change over time)
  'https://base.llamarpc.com',
  'https://base-mainnet.public.blastapi.io',
] as const

const baseRpcUrls = (() => {
  const env = (import.meta.env.VITE_BASE_RPC as string | undefined)?.trim()
  if (env) return [env, ...DEFAULT_BASE_RPCS]
  return [...DEFAULT_BASE_RPCS]
})()

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    // Base app / Farcaster Mini App connector (when available).
    farcasterMiniApp(),
    injected(),
    // Coinbase Smart Wallet (SCW) connector: forces Smart Wallet accounts only.
    // This is required for paymaster-backed `wallet_sendCalls`.
    coinbaseSmartWallet({ appName: 'Creator Vaults' }),
    coinbaseWallet({
      appName: 'Creator Vaults',
      // Don’t force Smart Wallet UX; allow users to connect with whatever wallet they have access to.
      preference: 'all',
    }),
  ],
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

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
