import type { ComponentType, ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getPrivyAppId, isPrivyClientEnabled } from '@/lib/flags'
import { PrivyProvider } from '@privy-io/react-auth'
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets'

type PrivyClientStatus = 'disabled' | 'loading' | 'ready'

const PrivyClientContext = createContext<PrivyClientStatus>('disabled')

export function usePrivyClientStatus(): PrivyClientStatus {
  return useContext(PrivyClientContext)
}

type PrivyMiniAppAutoLoginComponent = ComponentType<Record<string, never>>
type PrivyBaseAppDevBadgeComponent = ComponentType<Record<string, never>>
type PrivyBaseSubAccountsDevPanelComponent = ComponentType<Record<string, never>>

export function PrivyClientProvider({ children }: { children: ReactNode }) {
  const enabled = isPrivyClientEnabled()
  const appId = enabled ? getPrivyAppId() : null

  const [MiniAppAutoLogin, setMiniAppAutoLogin] = useState<PrivyMiniAppAutoLoginComponent | null>(null)
  const [BaseAppDevBadge, setBaseAppDevBadge] = useState<PrivyBaseAppDevBadgeComponent | null>(null)
  const [BaseSubAccountsDevPanel, setBaseSubAccountsDevPanel] = useState<PrivyBaseSubAccountsDevPanelComponent | null>(null)

  useEffect(() => {
    // Only load Mini App login glue when Privy is actually present.
    if (!enabled || !appId) return
    if (MiniAppAutoLogin) return

    let cancelled = false
    import('./privyMiniAppAutoLogin')
      .then((m) => {
        if (cancelled) return
        setMiniAppAutoLogin(() => (m as any).PrivyMiniAppAutoLogin as PrivyMiniAppAutoLoginComponent)
      })
      .catch(() => {
        // Optional enhancement; ignore if it can't load.
      })
    return () => {
      cancelled = true
    }
  }, [MiniAppAutoLogin, appId, enabled])

  useEffect(() => {
    // Dev-only helper: confirm Base App integration wiring without digging through logs.
    if (!import.meta.env.DEV) return
    if (!enabled || !appId) return
    if (BaseAppDevBadge) return

    let cancelled = false
    import('./privyBaseAppDevBadge')
      .then((m) => {
        if (cancelled) return
        setBaseAppDevBadge(() => (m as any).PrivyBaseAppDevBadge as PrivyBaseAppDevBadgeComponent)
      })
      .catch(() => {
        // Optional enhancement; ignore if it can't load.
      })
    return () => {
      cancelled = true
    }
  }, [BaseAppDevBadge, appId, enabled])

  useEffect(() => {
    // Dev-only helper: test Base Sub Accounts flow interactively.
    if (!import.meta.env.DEV) return
    if (!enabled || !appId) return
    if (BaseSubAccountsDevPanel) return

    let cancelled = false
    import('./privyBaseSubAccountsDevPanel')
      .then((m) => {
        if (cancelled) return
        setBaseSubAccountsDevPanel(() => (m as any).PrivyBaseSubAccountsDevPanel as PrivyBaseSubAccountsDevPanelComponent)
      })
      .catch(() => {
        // Optional enhancement; ignore if it can't load.
      })
    return () => {
      cancelled = true
    }
  }, [BaseSubAccountsDevPanel, appId, enabled])

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
          // Keep this focused: a few high-signal login options for the waitlist.
          // Methods must also be enabled in the Privy dashboard.
          appearance: {
            // Show Base App (Base Account) as an external wallet option in Privy UI.
            // This is safe to include even if the user never opens Privy wallet connect.
            // Include common EOA options so users can sign in with their browser wallet.
            // (Strings are Privy-defined identifiers; extra entries are safe if unsupported.)
            // Put Base Account first to make it the default path.
            walletList: ['base_account', 'coinbase_wallet', 'detected_wallets', 'metamask', 'wallet_connect'],
            // Enable Solana + EVM from day 1 (Privy dashboard controls final availability).
            walletChainType: 'all' as any,
          },
          externalWallets: {
            // Prefer Coinbase Smart Wallet (Base Account) instead of EOA-only Coinbase Wallet.
            // Final wallet implementation is controlled by the Privy dashboard smart wallet setting.
            coinbaseWallet: ({
              // Privy types can lag behind dashboard capabilities; this is safe at runtime.
              connectionOptions: 'smartWalletOnly',
            } as any),
          },
          // Make embedded-wallet actions truly 1-click in-app:
          // hide Privy confirmation modals so our UI is the only "confirm" surface.
          // (You can also toggle this in the Privy dashboard: Embedded Wallets → “Add confirmation modals”.)
          embeddedWallets: {
            // Prompt for an embedded wallet only when the user has no wallet yet.
            // This keeps email flows viable for admin access without forcing wallet creation for everyone.
            ethereum: {
              createOnLogin: 'users-without-wallets',
            },
            solana: {
              createOnLogin: 'off',
            },
            showWalletUIs: false,
          },
          loginMethodsAndOrder: {
            // Include Farcaster for Mini App + Base App auth-address support.
            // Note: Telegram OAuth often fails in strict web contexts unless fully configured; keep it off by default.
            // Allow external/browser wallets as a first-class login method.
            // Email login must be enabled in the Privy dashboard.
            primary: ['wallet', 'email', 'farcaster', 'google', 'twitter'],
            overflow: [],
          },
        } as any}
      >
        <SmartWalletsProvider>
          {MiniAppAutoLogin ? <MiniAppAutoLogin /> : null}
          {BaseAppDevBadge ? <BaseAppDevBadge /> : null}
          {BaseSubAccountsDevPanel ? <BaseSubAccountsDevPanel /> : null}
          {children}
        </SmartWalletsProvider>
      </PrivyProvider>
    </PrivyClientContext.Provider>
  )
}
