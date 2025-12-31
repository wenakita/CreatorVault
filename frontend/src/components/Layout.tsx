import { Suspense } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, LayoutDashboard, HelpCircle, ShieldCheck } from 'lucide-react'
import { LiquidGoldNavBar } from './liquidGold/LiquidGoldNavBar'

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/dashboard', icon: LayoutDashboard, label: 'Vaults' },
  { path: '/deploy', icon: LayoutDashboard, label: 'Deploy' },
  { path: '/status', icon: ShieldCheck, label: 'Status' },
  { path: '/faq', icon: HelpCircle, label: 'FAQ' },
]

export function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <LiquidGoldNavBar />

      {/* Main */}
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="max-w-7xl mx-auto px-6 py-12">
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-600">
                Loading…
              </div>
            </div>
          }
        >
          <Outlet />
        </Suspense>
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


