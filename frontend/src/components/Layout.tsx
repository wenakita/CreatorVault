import { Suspense } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, LayoutDashboard, HelpCircle, Mail, ShieldCheck } from 'lucide-react'
import { VaultNavBar } from './brand/VaultNavBar'
import { isPublicSiteMode } from '@/lib/flags'
import { useAdminStatus } from '@/hooks/useAdminStatus'

type MobileNavItem = {
  label: string
  path: string
  icon: any
  activePrefixes?: string[]
}

const navItems: MobileNavItem[] = [
  { path: '/', icon: Home, label: 'Home', activePrefixes: ['/'] },
  { path: '/explore/creators', icon: LayoutDashboard, label: 'Explore', activePrefixes: ['/explore', '/dashboard'] },
  { path: '/deploy', icon: LayoutDashboard, label: 'Deploy', activePrefixes: ['/deploy', '/launch', '/status'] },
  { path: '/#waitlist', icon: Mail, label: 'Waitlist', activePrefixes: ['/#waitlist', '/waitlist'] },
  { path: '/faq', icon: HelpCircle, label: 'FAQ', activePrefixes: ['/faq'] },
]

const navItemsPublic: MobileNavItem[] = [
  { path: '/', icon: Home, label: 'Home', activePrefixes: ['/'] },
  { path: '/#waitlist', icon: Mail, label: 'Waitlist', activePrefixes: ['/#waitlist', '/waitlist'] },
]

const adminNavItem: MobileNavItem = { path: '/admin/waitlist', icon: ShieldCheck, label: 'Admin', activePrefixes: ['/admin'] }

function isActiveLink(location: { pathname: string; hash?: string }, item: MobileNavItem): boolean {
  const pathname = location.pathname
  const hash = location.hash ?? ''

  if (item.path.includes('#')) {
    const [toPath, toHash = ''] = item.path.split('#')
    const wantPath = toPath || '/'
    const wantHash = `#${toHash}`
    if (pathname === wantPath && hash === wantHash) return true
    return item.activePrefixes?.includes('/waitlist') ? pathname === '/waitlist' : false
  }

  if (item.path === '/') return pathname === '/'
  const prefixes = item.activePrefixes && item.activePrefixes.length > 0 ? item.activePrefixes : [item.path]
  return prefixes.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)))
}

export function Layout() {
  const location = useLocation()
  const publicMode = isPublicSiteMode()
  const { isAdmin } = useAdminStatus()
  const baseItems = publicMode ? navItemsPublic : navItems
  const items = isAdmin ? [...baseItems, adminNavItem] : baseItems

  return (
    <div className="min-h-screen flex flex-col bg-vault-bg">
      <VaultNavBar />

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
          {items.map((item) => {
            const { path, icon: Icon, label } = item
            const isActive = isActiveLink(location, item)
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
