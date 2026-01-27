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
 * Privy Client Provider (Auth-Only Mode)
 *
 * Privy is used ONLY for social authentication (email, Farcaster, Google, Twitter).
 * Wallet management is handled by Coinbase Smart Wallet via OnchainKit.
 *
 * This provider:
 * - Enables Privy login for social auth
 * - Disables Privy embedded wallets (we use Coinbase Smart Wallet instead)
 * - Provides access tokens for backend session verification
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
            // Wallet options shown in Privy UI (for users who want to link a wallet to their account)
            walletList: ['coinbase_wallet', 'wallet_connect', 'detected_wallets'],
          },
          externalWallets: {
            // Prefer Coinbase Smart Wallet when connecting via Privy
            coinbaseWallet: {
              connectionOptions: 'smartWalletOnly',
            } as any,
          },
          // DISABLED: We use Coinbase Smart Wallet directly, not Privy embedded wallets
          embeddedWallets: {
            ethereum: { createOnLogin: 'off' },
            solana: { createOnLogin: 'off' },
            showWalletUIs: false,
          },
          loginMethodsAndOrder: {
            // Social auth methods (wallet connection is handled separately via wagmi)
            primary: ['email', 'farcaster', 'google', 'twitter'],
            overflow: [],
          },
        } as any}
      >
        {children}
      </PrivyProvider>
    </PrivyClientContext.Provider>
  )
}
