import { Outlet, Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Wallet, Home, Rocket, LayoutDashboard } from 'lucide-react'
import { ConnectButton } from './ConnectButton'

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/launch', icon: Rocket, label: 'Launch' },
  { path: '/dashboard', icon: LayoutDashboard, label: 'Vaults' },
]

export function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-x-0 border-t-0 rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <motion.div
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-vault-500 to-vault-700 flex items-center justify-center"
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <Wallet className="w-5 h-5 text-white" />
            </motion.div>
            <span className="font-display font-bold text-lg hidden sm:block">
              Creator<span className="text-vault-500">Vault</span>
            </span>
          </Link>

          <ConnectButton />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 pb-24">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card border-x-0 border-b-0 rounded-none rounded-t-2xl safe-area-bottom sm:hidden">
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
                    className="absolute inset-0 bg-vault-500/20 rounded-xl"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-vault-500' : 'text-surface-400'
                  }`}
                />
                <span
                  className={`text-xs font-medium transition-colors ${
                    isActive ? 'text-vault-500' : 'text-surface-400'
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
        <div className="glass-card p-2 flex flex-col gap-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className={`relative group p-3 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-vault-500/20 text-vault-500'
                    : 'text-surface-400 hover:bg-surface-800/50 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="absolute left-full ml-3 px-2 py-1 rounded-lg bg-surface-800 text-white text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
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

