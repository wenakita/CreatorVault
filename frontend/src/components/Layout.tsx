import { Outlet, Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Rocket, LayoutDashboard } from 'lucide-react'
import { useAccount } from 'wagmi'
import { base } from 'wagmi/chains'
import { ConnectButton } from './ConnectButton'
import { VaultLogo } from './VaultLogo'

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/launch', icon: Rocket, label: 'Launch' },
  { path: '/dashboard', icon: LayoutDashboard, label: 'Vaults' },
]

export function Layout() {
  const location = useLocation()
  const { chain, isConnected } = useAccount()
  const isCorrectNetwork = !isConnected || chain?.id === base.id

  return (
    <div className="min-h-screen flex flex-col">
      {/* Wrong Network Banner */}
      {!isCorrectNetwork && (
        <div className="bg-orange-500/10 border-b border-orange-500/30 px-4 py-2 text-center">
          <p className="text-orange-400 text-sm font-medium">
            ⚠️ Wrong Network - Please switch to Base Network
          </p>
        </div>
      )}
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            {/* wsAKITA Logo - Real AKITA in Base Vault */}
            <motion.div
              className="relative"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <VaultLogo size="sm" />
            </motion.div>
            <div className="hidden sm:flex items-baseline gap-1">
              <span className="font-semibold text-white tracking-tight">Creator</span>
              <span className="font-semibold text-purple-500 tracking-tight">Vault</span>
            </div>
          </Link>

          {/* Built on Base badge */}
          <div className="hidden md:flex items-center gap-4">
            <a 
              href="https://base.org" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10 transition-all group"
            >
              <span className="text-slate-400 text-xs">Built on</span>
              <div className="flex items-center gap-1.5">
                <img src="/base-logo.svg" alt="Base" className="w-4 h-4" />
                <span className="text-white font-semibold text-sm">base</span>
              </div>
            </a>
          </div>

          <ConnectButton />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 pb-24">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-xl border-t border-white/[0.06] safe-area-bottom sm:hidden">
        <div className="flex items-center justify-around py-2 px-4">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className="relative flex flex-col items-center gap-1 py-2 px-4"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-[#0052FF]/15 rounded-xl"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-[#0052FF]' : 'text-slate-500'
                  }`}
                />
                <span
                  className={`text-xs font-medium transition-colors ${
                    isActive ? 'text-[#0052FF]' : 'text-slate-500'
                  }`}
                >
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Desktop sidebar nav */}
      <nav className="hidden sm:flex fixed left-4 top-1/2 -translate-y-1/2 z-50">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-2 flex flex-col gap-1">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className={`relative group p-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-[#0052FF]/15 text-[#0052FF]'
                    : 'text-slate-500 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-white/[0.06] text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

