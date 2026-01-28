import type { ReactNode } from 'react'
import { Component, createContext, useContext, useMemo } from 'react'
import { getPrivyAppId, isPrivyClientEnabled } from '@/lib/flags'
import { PrivyProvider } from '@privy-io/react-auth'

type PrivyClientStatus = 'disabled' | 'loading' | 'ready'

const PrivyClientContext = createContext<PrivyClientStatus>('disabled')

export function usePrivyClientStatus(): PrivyClientStatus {
  return useContext(PrivyClientContext)
}

type PrivyProviderConfig = Parameters<typeof PrivyProvider>[0]['config']

class PrivyProviderSafetyBoundary extends Component<
  { appId: string; baseConfig: PrivyProviderConfig; safeConfig: PrivyProviderConfig; children: ReactNode },
  { safeMode: boolean }
> {
  state = { safeMode: false }

  static getDerivedStateFromError(error: unknown): { safeMode: boolean } | null {
    const msg = String((error as any)?.message ?? error ?? '')
    const m = msg.toLowerCase()
    // Privy embedded wallets throw in insecure contexts (HTTP / non-secure origin).
    // Fall back to a config without embedded wallets instead of blank-screening.
    if (m.includes('embedded wallet') && m.includes('https')) return { safeMode: true }
    return null
  }

  componentDidCatch(error: unknown) {
    // Intentionally no-op: state transition handled in `getDerivedStateFromError`.
    void error
  }

  render() {
    const { appId, baseConfig, safeConfig, children } = this.props
    const config = this.state.safeMode ? safeConfig : baseConfig

    return (
      <PrivyProvider appId={appId} config={config as any}>
        {children}
      </PrivyProvider>
    )
  }
}

/**
 * Privy Client Provider
 *
 * Privy handles:
 * - Authentication (email, Farcaster, etc.)
 * - Global Wallet access (shared with Zora via Privy's global wallet feature)
 * - Smart wallet operations via useSmartWallets hook
 *
 * With Zora Global Wallet enabled:
 * - Users who created their coin on Zora can access the SAME Coinbase Smart Wallet
 * - The embedded wallet from Zora is shared with CreatorVaults
 * - No new wallet is created - they use their existing Zora wallet
 */
export function PrivyClientProvider({ children }: { children: ReactNode }) {
  const enabled = isPrivyClientEnabled()
  const appId = enabled ? getPrivyAppId() : null

  const status: PrivyClientStatus = !enabled || !appId ? 'disabled' : 'ready'
  const ctx = useMemo(() => status, [status])

  if (status !== 'ready' || !appId) {
    return <PrivyClientContext.Provider value={ctx}>{children}</PrivyClientContext.Provider>
  }

  const baseConfig: PrivyProviderConfig = {
    appearance: {
      walletList: ['metamask', 'coinbase_wallet', 'phantom', 'detected_wallets', 'wallet_connect'],
    },
    // Enable embedded wallets - this is the signer for the Coinbase Smart Wallet
    embeddedWallets: {
      ethereum: { createOnLogin: 'users-without-wallets' },
    },
    loginMethods: ['wallet', 'email'],
  } as any

  const safeConfig: PrivyProviderConfig = {
    appearance: baseConfig.appearance,
    // Intentionally omit `embeddedWallets` so HTTP/insecure dev origins don't crash the app.
    loginMethods: baseConfig.loginMethods,
  } as any

  return (
    <PrivyClientContext.Provider value="ready">
      <PrivyProviderSafetyBoundary appId={appId} baseConfig={baseConfig} safeConfig={safeConfig}>
        {children}
      </PrivyProviderSafetyBoundary>
    </PrivyClientContext.Provider>
  )
}
