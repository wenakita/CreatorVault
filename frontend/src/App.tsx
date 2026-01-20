import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { MarketingLayout } from './components/MarketingLayout'
import { Home } from './pages/Home'
import { isPublicSiteMode } from './lib/flags'
import { getHostMode, getAppBaseUrl } from './lib/host'

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
          <Route element={<Layout />}>
            {/* App host */}
            <Route path="/" element={<Navigate to="/explore" replace />} />
            {/* Keep /waitlist route as a redirect for old links */}
            <Route path="/waitlist" element={<Waitlist />} />
            {/* Optional: keep existing Home page available at /home if you still want it */}
            <Route path="/home" element={<Home />} />
            {publicMode ? (
              <>
                {/* Admin routes must remain reachable even in public mode (auth is enforced server-side). */}
                <Route path="/admin/creator-access" element={<AdminCreatorAccess />} />
                <Route path="/admin/miniapp" element={<AdminMiniApp />} />
                <Route path="/admin/deploy-strategies" element={<AdminDeployStrategies />} />

                {/* Optional ops page; useful while public mode is enabled. */}
                <Route path="/status" element={<Status />} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            ) : (
              <>
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
              </>
            )}
          </Route>
        )}
      </Routes>
    </>
  )
}

export default App