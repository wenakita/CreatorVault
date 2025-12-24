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
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-black/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 transition-transform group-hover:scale-110 group-hover:rotate-6">
                <VaultLogo size="sm" />
              </div>
              <span className="font-bold text-xl tracking-tight">CreatorVault</span>
            </Link>

            {/* Nav */}
            <nav className="hidden md:flex items-center gap-2">
              {navItems.map(({ path, icon: Icon, label }) => {
                const isActive = location.pathname === path
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white/[0.06] text-white'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
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

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 z-50">
        <div className="card px-4 py-3 flex items-center justify-around">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
                  isActive ? 'text-blue-500' : 'text-zinc-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
