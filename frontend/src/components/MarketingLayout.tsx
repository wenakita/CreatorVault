import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'

import '@farcaster/auth-kit/styles.css'
import { AuthKitProvider } from '@farcaster/auth-kit'

const FARCASTER_AUTH_CONFIG = {
  // Must match server-side FARCASTER_DOMAIN (defaults to 4626.fun).
  domain: '4626.fun',
  // A URI identifying the app (used in the SIWF message).
  siweUri: 'https://4626.fun',
  // Farcaster custody verification lives on Optimism.
  rpcUrl: 'https://mainnet.optimism.io',
} as const

export function MarketingLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-vault-bg">
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="max-w-7xl mx-auto px-6 py-12">
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-600">Loading…</div>
            </div>
          }
        >
          <AuthKitProvider config={FARCASTER_AUTH_CONFIG}>
            <Outlet />
          </AuthKitProvider>
        </Suspense>
      </main>
    </div>
  )
}

