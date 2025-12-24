import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, LayoutDashboard } from 'lucide-react'
import { useAccount } from 'wagmi'
import { base } from 'wagmi/chains'
import { ConnectButton } from './ConnectButton'
import { VaultLogo } from './VaultLogo'

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/dashboard', icon: LayoutDashboard, label: 'Vaults' },
]

export function Layout() {
  const location = useLocation()
  const { chain, isConnected } = useAccount()
  const isCorrectNetwork = !isConnected || chain?.id === base.id

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Wrong Network Banner */}
      {!isConnected && (
        <div className="bg-[#0052FF]/10 border-b border-[#0052FF]/20 px-4 py-2.5 text-center">
          <p className="text-[#0052FF] text-sm">
            Connect wallet to get started
          </p>
        </div>
      )}
      
      {/* Header */}
      <header className="border-b border-zinc-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <VaultLogo size="sm" />
            <div className="hidden sm:flex items-baseline gap-1.5">
              <span className="font-semibold text-white text-lg">Creator</span>
              <span className="font-semibold text-[#0052FF] text-lg">Vault</span>
            </div>
          </Link>

          {/* Nav - Desktop */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map(({ path, label }) => {
              const isActive = location.pathname === path
              return (
                <Link
                  key={path}
                  to={path}
                  className={`text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-white'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </nav>

          <ConnectButton />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-zinc-900">
        <div className="flex items-center justify-around py-3">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className="flex flex-col items-center gap-1"
              >
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? 'text-[#0052FF]' : 'text-zinc-600'
                  }`}
                />
                <span
                  className={`text-xs ${
                    isActive ? 'text-[#0052FF]' : 'text-zinc-600'
                  }`}
                >
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
