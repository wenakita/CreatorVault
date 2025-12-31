import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'

const Launch = lazy(async () => {
  const m = await import('./pages/Launch')
  return { default: m.Launch }
})

const Dashboard = lazy(async () => {
  const m = await import('./pages/Dashboard')
  return { default: m.Dashboard }
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

function App() {
  return (
    <>
      {/* Noise texture overlay */}
      <div className="noise-overlay" />
      
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/launch" element={<Launch />} />
          <Route path="/deploy" element={<DeployVault />} />
          <Route path="/coin/:address/manage" element={<CoinManage />} />
          <Route path="/creator/earnings" element={<CreatorEarnings />} />
          <Route path="/creator/:identifier/earnings" element={<CreatorEarnings />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/faq/how-it-works" element={<FaqHowItWorks />} />
          <Route path="/status" element={<Status />} />
          <Route path="/activate-akita" element={<ActivateAkita />} />
          <Route path="/auction/bid/:address" element={<AuctionBid />} />
          <Route path="/complete-auction" element={<CompleteAuction />} />
          <Route path="/complete-auction/:strategy" element={<CompleteAuction />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/vault/:address" element={<Vault />} />
        </Route>
      </Routes>
    </>
  )
}

export default App