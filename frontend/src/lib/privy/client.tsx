import type { ReactNode } from 'react'
import { createContext, useContext, useMemo } from 'react'
import { getPrivyAppId, isPrivyClientEnabled } from '@/lib/flags'
import { PrivyProvider } from '@privy-io/react-auth'

type PrivyClientStatus = 'disabled' | 'loading' | 'ready'

const PrivyClientContext = createContext<PrivyClientStatus>('disabled')

export function usePrivyClientStatus(): PrivyClientStatus {
  return useContext(PrivyClientContext)
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

  return (
    <PrivyClientContext.Provider value="ready">
      <PrivyProvider
        appId={appId}
        config={{
          appearance: {
            walletList: ['coinbase_wallet', 'wallet_connect', 'detected_wallets'],
          },
          // Enable embedded wallets - this is the signer for the Coinbase Smart Wallet
          embeddedWallets: {
            ethereum: { createOnLogin: 'users-without-wallets' },
            solana: { createOnLogin: 'off' },
          },
          loginMethodsAndOrder: {
            primary: ['email', 'google', 'farcaster', 'twitter', 'apple'],
            overflow: ['discord', 'github'],
          },
        } as any}
      >
        {children}
      </PrivyProvider>
    </PrivyClientContext.Provider>
  )
}
