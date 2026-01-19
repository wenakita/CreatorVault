import { http, fallback, createConfig as createWagmiConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'

/**
 * Base RPC notes:
 * - `https://mainnet.base.org` is convenient but can 429 under load.
 * - Use `VITE_BASE_RPC` to provide your own paid/stable endpoint.
 * - We also include a small fallback set of public endpoints to reduce flakiness.
 */

// Put `mainnet.base.org` LAST because it can 429 under load.
// If a paid RPC is configured via `VITE_BASE_RPC`, it is always tried first.
const DEFAULT_BASE_RPCS = [
  // Public community RPCs (best-effort; can change over time)
  'https://base-mainnet.public.blastapi.io',
  // Note: some public RPCs can lag behind chain head; keep them last (before base.org).
  'https://base.llamarpc.com',
  // Official public endpoint (convenient, but rate-limited)
  'https://mainnet.base.org',
] as const

const baseRpcUrls = (() => {
  const env = (import.meta.env.VITE_BASE_RPC as string | undefined)?.trim()
  const urls = env ? [env, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]
  // Avoid duplicate endpoints (e.g. when VITE_BASE_RPC matches a default).
  return Array.from(new Set(urls))
})()

/**
 * WalletConnect
 * - `projectId` is PUBLIC (safe to expose), but you should restrict Allowed Origins in WalletConnect Cloud.
 * - If you rotate the project id, set `VITE_WALLETCONNECT_PROJECT_ID` in Vercel.
 */
const DEFAULT_WALLETCONNECT_PROJECT_ID = 'bc3dfd319b4a0ecaa25cdee7e36bd0c4'
const walletConnectProjectId = (
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim() || DEFAULT_WALLETCONNECT_PROJECT_ID
).trim()

const walletConnectMetadata = {
  name: 'Creator Vaults',
  description: 'Creator coin vaults on Base.',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://4626.fun',
  icons: ['https://4626.fun/pwa-512.png'] as string[],
}

export const wagmiConfig = createWagmiConfig({
  chains: [base],
  connectors: [
    // Base app / Farcaster Mini App connector (when available).
    farcasterMiniApp(),
    // Prefer Rabby explicitly (avoids multi-wallet `window.ethereum` conflicts and gives users a clear "Rabby" option).
    injected({ target: 'rabby' }),
    walletConnect({
      projectId: walletConnectProjectId,
      metadata: walletConnectMetadata,
      showQrModal: true,
    }),
  ],
  // Avoid multi-injected provider discovery issues (MetaMask/Rabby conflicts, etc).
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

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
