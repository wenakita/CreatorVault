import type { ReactNode } from 'react'
// Use the browser-safe Buffer shim (Vite can externalize Node built-ins like `buffer`).
import { Buffer } from 'buffer/'
import { OnchainKitProvider } from '@coinbase/onchainkit'
import { WagmiProvider as PrivyWagmiProvider } from '@privy-io/wagmi'
import { WagmiProvider as BaseWagmiProvider } from 'wagmi'
import { base } from 'wagmi/chains'
import { useEffect, useRef } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { useLocation } from 'react-router-dom'

import { wagmiConfigBase, wagmiConfigBaseNoZora, wagmiConfigDeploy } from '@/config/wagmi'
import { logger } from '@/lib/logger'
import { WalletDebugPanel } from '@/components/WalletDebugPanel'
import { PrivyWagmiSmartAccountBridge } from '@/web3/PrivyWagmiSmartAccountBridge'
import { usePrivyClientStatus } from '@/lib/privy/client'

// Polyfill Buffer for Coinbase Wallet SDK (and some wallet adapters).
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
  const location = useLocation()
  const privyStatus = usePrivyClientStatus()

  // Feature flag: keep the Zora (read-only) connector scoped to deploy flows only.
  // Default is enabled for deploy routes unless explicitly disabled via env.
  const zoraConnectorEnabled = (() => {
    const raw = (import.meta.env.VITE_ENABLE_ZORA_READONLY_CONNECTOR as string | undefined)?.trim()
    if (!raw) return true
    return raw !== '0' && raw.toLowerCase() !== 'false'
  })()
  const isDeployRoute =
    location.pathname === '/deploy' ||
    location.pathname.startsWith('/deploy/') ||
    location.pathname === '/admin/deploy-strategies' ||
    location.pathname.startsWith('/admin/deploy-strategies/')
  const isAdminRoute = location.pathname === '/admin' || location.pathname.startsWith('/admin/')
  const disableZoraForAdmin = isAdminRoute && !isDeployRoute
  const wagmiConfig = disableZoraForAdmin
    ? wagmiConfigBaseNoZora
    : zoraConnectorEnabled && isDeployRoute
      ? wagmiConfigDeploy
      : wagmiConfigBase

  // Coinbase Developer Platform (OnchainKit) config.
  // - `VITE_CDP_API_KEY` is the CDP key id (safe to expose; origin-restrict in CDP).
  // - If you want to force a specific paymaster/bundler endpoint, set `VITE_CDP_PAYMASTER_URL`.
  const cdpApiKey = import.meta.env.VITE_CDP_API_KEY as string | undefined
  const cdpPaymasterUrl = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined

  // Debug hint: if both are set but the URL does not contain the key, it's likely the wrong value was pasted
  // (CDP has multiple identifiers). We still respect the explicit URL override, but warn in dev.
  if (import.meta.env.DEV && cdpApiKey && cdpPaymasterUrl && !cdpPaymasterUrl.includes(cdpApiKey)) {
    logger.warn(
      '[Web3Providers] VITE_CDP_PAYMASTER_URL does not include VITE_CDP_API_KEY. This may indicate a mismatched CDP key vs paymaster URL.',
    )
  }

  // IMPORTANT:
  // - `@privy-io/wagmi`'s provider MUST be mounted under `PrivyProvider`.
  // - In local/dev setups Privy may be disabled (missing VITE_PRIVY_APP_ID, etc).
  //   In that case, fall back to plain wagmi to avoid runtime crashes.
  const WagmiProvider = privyStatus === 'ready' ? PrivyWagmiProvider : BaseWagmiProvider

  const content = (
    <WagmiProvider config={wagmiConfig} key={zoraConnectorEnabled && isDeployRoute ? 'wagmi-deploy' : 'wagmi-base'}>
      <OnchainKitProvider
        chain={base}
        apiKey={cdpApiKey}
        config={{
          // If set, this overrides the default paymaster URL derived from `apiKey`.
          paymaster: cdpPaymasterUrl || undefined,
        }}
      >
        {privyStatus === 'ready' ? <PrivyWagmiSmartAccountBridge /> : null}
        <MiniAppAutoConnect />
        {import.meta.env.DEV ? <WalletDebugPanel /> : null}
        {children}
      </OnchainKitProvider>
    </WagmiProvider>
  )

  return content
}
