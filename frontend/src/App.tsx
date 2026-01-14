import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'

const Launch = lazy(async () => {
  const m = await import('./pages/Launch')
  return { default: m.Launch }
})

const Vault = lazy(async () => {
  const m = await import('./pages/Vault')
  return { default: m.Vault }
})

const CompleteAuction = lazy(async () => {
  const m = await import('./pages/CompleteAuction')
  return { default: m.CompleteAuction }
})

const ActivateAkita = lazy(async () => {
  const m = await import('./pages/ActivateAkita')
  return { default: m.ActivateAkita }
})

const AuctionBid = lazy(async () => {
  const m = await import('./pages/AuctionBid')
  return { default: m.AuctionBid }
})

const DeployVault = lazy(async () => {
  const m = await import('./pages/DeployVault')
  return { default: m.DeployVault }
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

function App() {
  return (
    <>
      {/* Noise texture overlay */}
      <div className="noise-overlay" />
      
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
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
          <Route path="/launch" element={<Launch />} />
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
          <Route path="/activate-akita" element={<ActivateAkita />} />
          <Route path="/auction/bid/:address" element={<AuctionBid />} />
          <Route path="/complete-auction" element={<CompleteAuction />} />
          <Route path="/complete-auction/:strategy" element={<CompleteAuction />} />
          <Route path="/dashboard" element={<Navigate to="/explore/creators" replace />} />
          <Route path="/vault/:address" element={<Vault />} />
          <Route path="/auction-demo" element={<AuctionDemo />} />
        </Route>
      </Routes>
    </>
  )
}

export default App