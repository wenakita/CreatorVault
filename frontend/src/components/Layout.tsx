import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, LayoutDashboard } from 'lucide-react'
import { ConnectButton } from './ConnectButton'
import { VaultLogo } from './VaultLogo'

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/dashboard', icon: LayoutDashboard, label: 'Vaults' },
]

export function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col bg-[#1a1a1a]">
      {/* Header */}
      <header className="neu-card mx-6 mt-6 mb-4">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="neu-card-inset p-2 rounded-xl">
              <VaultLogo size="sm" />
            </div>
            <div className="hidden sm:flex items-baseline gap-2">
              <span className="font-bold text-white text-xl">Creator</span>
              <span className="font-bold text-[#0052FF] text-xl">Vault</span>
            </div>
          </Link>

          {/* Nav - Desktop */}
          <nav className="hidden md:flex items-center gap-4">
            {navItems.map(({ path, label }) => {
              const isActive = location.pathname === path
              return (
                <Link
                  key={path}
                  to={path}
                  className={`
                    px-5 py-2.5 rounded-xl font-medium transition-all duration-200
                    ${isActive 
                      ? 'neu-card-inset text-[#0052FF]' 
                      : 'neu-card text-zinc-400 hover:text-white'
                    }
                  `}
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
      <nav className="md:hidden fixed bottom-6 left-6 right-6 z-50">
        <div className="neu-card p-3 flex items-center justify-around">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className={`
                  flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all duration-200
                  ${isActive ? 'neu-card-inset' : ''}
                `}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? 'text-[#0052FF]' : 'text-zinc-500'
                  }`}
                />
                <span
                  className={`text-xs font-medium ${
                    isActive ? 'text-[#0052FF]' : 'text-zinc-500'
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
