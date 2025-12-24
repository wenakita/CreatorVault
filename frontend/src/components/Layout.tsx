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
      {/* Subtle gradient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-900/50 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-8 h-8 transition-transform group-hover:scale-110">
                <VaultLogo size="sm" />
              </div>
              <span className="font-bold text-lg tracking-tight">CreatorVault</span>
            </Link>

            {/* Nav */}
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map(({ path, icon: Icon, label }) => {
                const isActive = location.pathname === path
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-blue-500'
                        : 'text-zinc-400 hover:text-white'
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-900">
        <div className="flex items-center justify-around p-4">
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
                    isActive ? 'text-blue-500' : 'text-zinc-500'
                  }`}
                />
                <span
                  className={`text-xs ${
                    isActive ? 'text-blue-500' : 'text-zinc-500'
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
