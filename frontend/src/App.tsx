import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Launch } from './pages/Launch'
import { Dashboard } from './pages/Dashboard'
import { Vault } from './pages/Vault'

function App() {
  return (
    <>
      {/* Noise texture overlay */}
      <div className="noise-overlay" />
      
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/launch" element={<Launch />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/vault/:address" element={<Vault />} />
        </Route>
      </Routes>
    </>
  )
}

export default App

