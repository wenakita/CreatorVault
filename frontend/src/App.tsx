import { lazy, useMemo } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useLogin, usePrivy } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { useCreatorAllowlist } from '@/hooks'
import { Layout } from './components/Layout'
import { MarketingLayout } from './components/MarketingLayout'
import { Home } from './pages/Home'
import { isPublicSiteMode } from './lib/flags'
import { getHostMode, getAppBaseUrl } from './lib/host'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type CreatorAllowlistMode = 'disabled' | 'enforced'

type CreatorAllowlistStatus = {
  address: string | null
  coin: string | null
  creator: string | null
  payoutRecipient: string | null
  mode: CreatorAllowlistMode
  allowed: boolean
}

const ADMIN_BYPASS_ADDRESSES = new Set<string>(['0xb05cf01231cf2ff99499682e64d3780d57c80fdd'])

function getMarketingBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://4626.fun'
  const host = window.location.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '0.0.0.0') return 'https://4626.fun'
  if (host.startsWith('app.')) return `https://${host.slice(4)}`
  return `https://${host}`
}

function AppAllowlistGate() {
  const privyClientStatus = usePrivyClientStatus()

  if (privyClientStatus !== 'ready') {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4">CreatorVaults</div>
          <div className="card rounded-xl p-8 space-y-3">
            <div className="text-lg font-medium">App is not configured</div>
            <div className="text-sm text-zinc-400 leading-relaxed">
              This app uses Privy smart wallets. Privy is currently disabled for this environment.
            </div>
            <a className="btn-accent inline-flex w-fit" href={getMarketingBaseUrl()}>
              Join the waitlist
            </a>
          </div>
        </div>
      </div>
    )
  }

  return <AppAllowlistGatePrivyEnabled />
}

function AppAllowlistGatePrivyEnabled() {
  const location = useLocation()
  const { ready: privyReady, authenticated } = usePrivy()
  const { login } = useLogin()
  const { client: smartWalletClient } = useSmartWallets()

  // Detect whether allowlist gating is even enabled server-side.
  const allowlistModeQuery = useQuery({
    queryKey: ['creatorAllowlist', 'mode'],
    queryFn: async (): Promise<CreatorAllowlistStatus> => {
      const res = await fetch('/api/creator-allowlist', { method: 'GET' })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<CreatorAllowlistStatus> | null
      if (!res.ok || !json) throw new Error('Allowlist check failed')
      if (!json.success || !json.data) throw new Error(json.error || 'Allowlist check failed')
      return json.data
    },
    staleTime: 30_000,
    retry: 0,
  })

  const smartWalletAddress = useMemo(() => {
    const a = (smartWalletClient as any)?.account?.address
    return typeof a === 'string' && a.startsWith('0x') ? a : null
  }, [smartWalletClient])

  const allowQuery = useCreatorAllowlist(smartWalletAddress)
  const allowed = allowQuery.data?.allowed === true
  const isAdminRoute = location.pathname === '/admin' || location.pathname.startsWith('/admin/')
  const isBypassAdmin =
    isAdminRoute && !!smartWalletAddress && ADMIN_BYPASS_ADDRESSES.has(smartWalletAddress.toLowerCase())

  const allowlistMode = allowlistModeQuery.data?.mode
  const allowlistEnforced = allowlistMode === 'enforced'

  if (allowlistModeQuery.isError) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4">CreatorVaults</div>
          <div className="card rounded-xl p-8 space-y-3">
            <div className="text-lg font-medium">Access check unavailable</div>
            <div className="text-sm text-zinc-400 leading-relaxed">
              We couldn’t verify allowlist status right now. Please try again in a moment.
            </div>
            <a className="btn-accent inline-flex w-fit" href={getMarketingBaseUrl()}>
              Join the waitlist
            </a>
          </div>
        </div>
      </div>
    )
  }

  // If allowlist is not enforced (e.g. local dev / no DB / no env allowlist), don't gate.
  if (!allowlistEnforced) return <Outlet />

  if (!privyReady) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4">CreatorVaults</div>
          <div className="card rounded-xl p-8 space-y-3">
            <div className="text-sm text-zinc-400">Loading…</div>
          </div>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4">CreatorVaults</div>
          <div className="card rounded-xl p-8 space-y-3">
            <div className="text-lg font-medium">Invite-only access</div>
            <div className="text-sm text-zinc-400 leading-relaxed">
              Sign in to check whether your wallet is allowlisted for early access.
            </div>
            <button
              type="button"
              className="btn-accent w-fit"
              onClick={() =>
                void Promise.resolve(
                  login({
                    // Force external wallet sign-in (EOA) so users see MetaMask / WalletConnect options immediately.
                    loginMethods: ['wallet'],
                  } as any),
                )
              }
            >
              Continue
            </button>
            <a className="text-xs text-zinc-500 hover:text-zinc-300 w-fit" href={getMarketingBaseUrl()}>
              Join the waitlist
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!smartWalletAddress) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4">CreatorVaults</div>
          <div className="card rounded-xl p-8 space-y-3">
            <div className="text-sm text-zinc-400">Setting up your smart wallet…</div>
          </div>
        </div>
      </div>
    )
  }

  if (allowQuery.isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4">CreatorVaults</div>
          <div className="card rounded-xl p-8 space-y-3">
            <div className="text-sm text-zinc-400">Checking access…</div>
          </div>
        </div>
      </div>
    )
  }

  if (!allowed && !isBypassAdmin) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-4">CreatorVaults</div>
          <div className="card rounded-xl p-8 space-y-3">
            <div className="text-lg font-medium">Not allowlisted yet</div>
            <div className="text-sm text-zinc-400 leading-relaxed">
              This app is invite-only while we onboard creators. Join the waitlist and we’ll notify you when access opens.
            </div>
            <a className="btn-accent inline-flex w-fit" href={getMarketingBaseUrl()}>
              Join the waitlist
            </a>
            <div className="text-xs text-zinc-600">
              Signed in as <span className="font-mono text-zinc-300">{smartWalletAddress}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <Outlet />
}

const Vault = lazy(async () => {
  const m = await import('./pages/Vault')
  return { default: m.Vault }
})

const CompleteAuction = lazy(async () => {
  const m = await import('./pages/CompleteAuction')
  return { default: m.CompleteAuction }
})

const AuctionBid = lazy(async () => {
  const m = await import('./pages/AuctionBid')
  return { default: m.AuctionBid }
})

const DeployVault = lazy(async () => {
  const m = await import('./pages/DeployVault')
  return { default: m.DeployVault }
})

const Waitlist = lazy(async () => {
  const m = await import('./pages/Waitlist')
  return { default: m.Waitlist }
})

const WaitlistLanding = lazy(async () => {
  const m = await import('./pages/WaitlistLanding')
  return { default: m.WaitlistLanding }
})

const CoinManage = lazy(async () => {
  const m = await import('./pages/CoinManage')
  return { default: m.CoinManage }
})

const CreatorEarnings = lazy(async () => {
  const m = await import('./pages/CreatorEarnings')
  return { default: m.CreatorEarnings }
})

const Faq = lazy(async () => {
  const m = await import('./pages/Faq')
  return { default: m.Faq }
})

const FaqHowItWorks = lazy(async () => {
  const m = await import('./pages/FaqHowItWorks')
  return { default: m.FaqHowItWorks }
})

const Status = lazy(async () => {
  const m = await import('./pages/Status')
  return { default: m.Status }
})

const AdminCreatorAccess = lazy(async () => {
  const m = await import('./pages/AdminCreatorAccess')
  return { default: m.AdminCreatorAccess }
})

const AdminMiniApp = lazy(async () => {
  const m = await import('./pages/AdminMiniApp')
  return { default: m.AdminMiniApp }
})

const AdminDeployStrategies = lazy(async () => {
  const m = await import('./pages/AdminDeployStrategies')
  return { default: m.AdminDeployStrategies }
})

const GaugeVoting = lazy(async () => {
  const m = await import('./pages/GaugeVoting')
  return { default: m.default }
})

const AuctionDemo = lazy(async () => {
  const m = await import('./pages/AuctionDemo')
  return { default: m.default }
})

const ExploreCreators = lazy(async () => {
  const m = await import('./pages/ExploreCreators')
  return { default: m.ExploreCreators }
})

const ExploreContent = lazy(async () => {
  const m = await import('./pages/ExploreContent')
  return { default: m.ExploreContent }
})

const ExploreTransactions = lazy(async () => {
  const m = await import('./pages/ExploreTransactions')
  return { default: m.ExploreTransactions }
})

const ExploreCreatorDetail = lazy(async () => {
  const m = await import('./pages/ExploreCreatorDetail')
  return { default: m.ExploreCreatorDetail }
})

const ExploreContentDetail = lazy(async () => {
  const m = await import('./pages/ExploreContentDetail')
  return { default: m.ExploreContentDetail }
})

const ExploreCreatorTransactions = lazy(async () => {
  const m = await import('./pages/ExploreCreatorTransactions')
  return { default: m.ExploreCreatorTransactions }
})

const ExploreContentTransactions = lazy(async () => {
  const m = await import('./pages/ExploreContentTransactions')
  return { default: m.ExploreContentTransactions }
})

const ExploreContentPoolAlias = lazy(async () => {
  const m = await import('./pages/ExploreContentPoolAlias')
  return { default: m.ExploreContentPoolAlias }
})

const Swap = lazy(async () => {
  const m = await import('./pages/Swap')
  return { default: m.Swap }
})

const Positions = lazy(async () => {
  const m = await import('./pages/Positions')
  return { default: m.Positions }
})

const Portfolio = lazy(async () => {
  const m = await import('./pages/Portfolio')
  return { default: m.Portfolio }
})

function ExternalRedirect({ to }: { to: string }) {
  if (typeof window !== 'undefined') window.location.replace(to)
  return null
}

function App() {
  const publicMode = isPublicSiteMode()
  const hostMode = getHostMode()
  const appBase = getAppBaseUrl()

  return (
    <>
      {/* Noise texture overlay */}
      <div className="noise-overlay" />

      <Routes>
        {hostMode === 'marketing' ? (
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<WaitlistLanding />} />
            {/* Back-compat */}
            <Route path="/waitlist" element={<Navigate to="/" replace />} />

            {/* If someone hits an app route on the marketing domain, push them to app.* */}
            <Route path="/explore/*" element={<ExternalRedirect to={`${appBase}/explore`} />} />
            <Route path="/deploy" element={<ExternalRedirect to={`${appBase}/deploy`} />} />
            <Route path="/dashboard" element={<ExternalRedirect to={`${appBase}/explore`} />} />
            <Route path="/vault/*" element={<ExternalRedirect to={`${appBase}/vault`} />} />
            <Route path="/coin/*" element={<ExternalRedirect to={`${appBase}/coin`} />} />
            <Route path="/creator/*" element={<ExternalRedirect to={`${appBase}/creator`} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        ) : (
          <>
            {publicMode ? (
              <Route element={<Layout />}>
                {/* App host */}
                {/* Keep Home on "/" so "/#waitlist" works reliably. */}
                <Route path="/" element={<Home />} />
                <Route path="/home" element={<Navigate to="/" replace />} />
                {/* Back-compat: preserve /waitlist URLs */}
                <Route path="/waitlist" element={<Waitlist />} />

                {/* Admin routes must remain reachable even in public mode (auth is enforced server-side). */}
                <Route path="/admin/creator-access" element={<AdminCreatorAccess />} />
                <Route path="/admin/miniapp" element={<AdminMiniApp />} />
                <Route path="/admin/deploy-strategies" element={<AdminDeployStrategies />} />

                {/* Optional ops page; useful while public mode is enabled. */}
                <Route path="/status" element={<Status />} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            ) : (
              <Route element={<AppAllowlistGate />}>
                <Route element={<Layout />}>
                  {/* App host */}
                  {/* Keep users on "/" so the allowlist gate is visible on the root URL. */}
                  <Route path="/" element={<ExploreCreators />} />
                  {/* Keep /waitlist route as a back-compat target (marketing is on 4626.fun). */}
                  <Route path="/waitlist" element={<Waitlist />} />
                  {/* Optional: keep existing Home page available at /home if you still want it */}
                  <Route path="/home" element={<Home />} />

                  <Route path="/explore" element={<Navigate to="/explore/creators" replace />} />
                  <Route path="/explore/creators" element={<ExploreCreators />} />
                  <Route path="/explore/content" element={<ExploreContent />} />
                  <Route path="/explore/transactions" element={<ExploreTransactions />} />
                  <Route path="/explore/creators/:chain/:tokenAddress" element={<ExploreCreatorDetail />} />
                  <Route path="/explore/creators/:chain/:tokenAddress/transactions" element={<ExploreCreatorTransactions />} />
                  <Route path="/explore/content/:chain/:contentCoinAddress" element={<ExploreContentDetail />} />
                  <Route path="/explore/content/:chain/:contentCoinAddress/transactions" element={<ExploreContentTransactions />} />
                  <Route path="/explore/content/:chain/pool/:poolIdOrPoolKeyHash" element={<ExploreContentPoolAlias />} />
                  <Route path="/explore/tokens" element={<Navigate to="/explore/creators" replace />} />
                  <Route path="/explore/pools" element={<Navigate to="/explore/content" replace />} />
                  <Route path="/swap" element={<Swap />} />
                  <Route path="/positions" element={<Positions />} />
                  <Route path="/portfolio" element={<Portfolio />} />
                  <Route path="/launch" element={<Navigate to="/deploy" replace />} />
                  <Route path="/deploy" element={<DeployVault />} />
                  <Route path="/coin/:address/manage" element={<CoinManage />} />
                  <Route path="/creator/earnings" element={<CreatorEarnings />} />
                  <Route path="/creator/:identifier/earnings" element={<CreatorEarnings />} />
                  <Route path="/faq" element={<Faq />} />
                  <Route path="/faq/how-it-works" element={<FaqHowItWorks />} />
                  <Route path="/status" element={<Status />} />
                  <Route path="/admin/creator-access" element={<AdminCreatorAccess />} />
                  <Route path="/admin/miniapp" element={<AdminMiniApp />} />
                  <Route path="/admin/deploy-strategies" element={<AdminDeployStrategies />} />
                  <Route path="/vote" element={<GaugeVoting />} />
                  <Route path="/activate-akita" element={<Navigate to="/deploy" replace />} />
                  <Route path="/auction/bid/:address" element={<AuctionBid />} />
                  <Route path="/complete-auction" element={<CompleteAuction />} />
                  <Route path="/complete-auction/:strategy" element={<CompleteAuction />} />
                  <Route path="/dashboard" element={<Navigate to="/explore/creators" replace />} />
                  <Route path="/vault/:address" element={<Vault />} />
                  <Route path="/auction-demo" element={<AuctionDemo />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
            )}
          </>
        )}
      </Routes>
    </>
  )
}

export default App