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
    <div className="min-h-screen flex flex-col bg-black">
      {/* Minimal Header - Documentary Style */}
      <header className="sticky top-0 z-50 border-b border-zinc-900/50 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-4 group">
              <div className="w-7 h-7 transition-opacity group-hover:opacity-70">
                <VaultLogo size="sm" />
              </div>
              <span className="font-light text-sm tracking-[0.1em] uppercase text-zinc-400 group-hover:text-white transition-colors">
                CreatorVault
              </span>
            </Link>

            {/* Minimal Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {navItems.map(({ path, label }) => {
                const isActive = location.pathname === path
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`label transition-colors ${
                      isActive
                        ? 'text-zinc-400'
                        : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    {label}
                  </Link>
                )
              })}
            </nav>

            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Mobile Nav - Minimal */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-zinc-900/50 bg-black/80 backdrop-blur-xl">
        <div className="flex items-center justify-around py-4 px-6">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className="flex flex-col items-center gap-2 group"
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-zinc-400' : 'text-zinc-600 group-hover:text-zinc-400'
                  }`}
                />
                <span className={`label ${isActive ? 'text-zinc-400' : 'text-zinc-600'}`}>
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
