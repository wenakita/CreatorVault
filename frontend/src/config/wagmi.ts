import { http, fallback, createConfig as createWagmiConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'
import { zoraGlobalWalletConnector } from '@/lib/privy/zoraGlobalWalletConnector'

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
const walletConnectProjectId = (() => {
  const env = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim()
  // If not provided, fall back to a default project id so wallet connect still works.
  // IMPORTANT: WalletConnect project IDs are public, but you should still set a dedicated
  // `VITE_WALLETCONNECT_PROJECT_ID` in production and restrict Allowed Origins in WalletConnect Cloud.
  return env || DEFAULT_WALLETCONNECT_PROJECT_ID
})().trim()

const walletConnectMetadata = {
  name: 'Creator Vaults',
  description: 'Creator coin vaults on Base.',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://4626.fun',
  icons: ['https://4626.fun/pwa-512.png'] as string[],
}

const enableZoraConnect = (() => {
  const raw = (import.meta.env.VITE_ENABLE_ZORA_CONNECT as string | undefined) ?? ''
  const v = raw.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
})()

function createWagmiBaseConfig({ includeZoraReadOnly }: { includeZoraReadOnly: boolean }) {
  return createWagmiConfig({
    chains: [base],
    connectors: [
      // Base app / Farcaster Mini App connector (when available).
      farcasterMiniApp(),
      // Prefer Rabby explicitly (avoids multi-wallet `window.ethereum` conflicts and gives users a clear "Rabby" option).
      injected({ target: 'rabby' }),
      // Explicit MetaMask option (so extensions show up even with multi-injected discovery off).
      injected({ target: 'metaMask' }),
      ...(walletConnectProjectId
        ? [
            walletConnect({
              projectId: walletConnectProjectId,
              metadata: walletConnectMetadata,
              showQrModal: true,
            }),
          ]
        : []),
      ...(includeZoraReadOnly && enableZoraConnect
        ? [
            // Privy Global Wallet (Requester): Zora embedded wallet (read-only provider).
            zoraGlobalWalletConnector(),
          ]
        : []),
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
}

// Default app config: Base-only connectors.
export const wagmiConfigBase = createWagmiBaseConfig({ includeZoraReadOnly: true })
// Admin config: disable Zora/Privy cross-app connector to avoid auth redirects.
export const wagmiConfigBaseNoZora = createWagmiBaseConfig({ includeZoraReadOnly: false })

// Deploy config: includes Privy/Zora read-only connector (used only on deploy flows).
export const wagmiConfigDeploy = createWagmiBaseConfig({ includeZoraReadOnly: true })

// Back-compat: keep the existing export name as the base config.
export const wagmiConfig = wagmiConfigBase

/* Legacy block (kept for git history context)
export const wagmiConfig = createWagmiConfig({
  chains: [base],
  connectors: [
    // Base app / Farcaster Mini App connector (when available).
    farcasterMiniApp(),
    // Prefer Rabby explicitly (avoids multi-wallet `window.ethereum` conflicts and gives users a clear "Rabby" option).
    injected({ target: 'rabby' }),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            metadata: walletConnectMetadata,
            showQrModal: true,
          }),
        ]
      : []),
    // Privy Global Wallet (Requester): Zora embedded wallet (read-only provider).
    zoraGlobalWalletConnector(),
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
*/

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
