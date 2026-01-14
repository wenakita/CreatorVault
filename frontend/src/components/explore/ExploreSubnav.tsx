import { Link, useLocation } from 'react-router-dom'

type Tab = {
  label: string
  to: string
}

const TABS: Tab[] = [
  { label: 'CREATORS', to: '/explore/creators' },
  { label: 'CONTENT', to: '/explore/content' },
  { label: 'TRANSACTIONS', to: '/explore/transactions' },
]

function isActive(pathname: string, to: string): boolean {
  if (pathname === to) return true
  return pathname.startsWith(`${to}/`)
}

export function ExploreSubnav({
  searchPlaceholder = 'Search by name, symbol, or address…',
}: {
  searchPlaceholder?: string
}) {
  const location = useLocation()

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] overflow-hidden">
      <div className="flex flex-col gap-4 sm:gap-5 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="inline-flex items-center gap-0.5 rounded-full border border-white/5 bg-black/30 p-0.5 backdrop-blur-sm">
            {TABS.map((tab) => {
              const active = isActive(location.pathname, tab.to)
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  aria-current={active ? 'page' : undefined}
                  className={`h-9 px-4 rounded-full text-[10px] uppercase tracking-[0.18em] transition-colors ${
                    active ? 'bg-zinc-900 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>

          {/* Search scaffold (Phase 1: UI only) */}
          <div className="w-full sm:w-[360px]">
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="input-field w-full text-sm"
              aria-label="Search"
              disabled
              title="Search is coming soon"
            />
          </div>
        </div>

        {/* Filter scaffold (Phase 1: UI only) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="label">Filters</span>
          <span className="text-[11px] text-zinc-600 font-light">Coming soon</span>
        </div>
      </div>
    </div>
  )
}

