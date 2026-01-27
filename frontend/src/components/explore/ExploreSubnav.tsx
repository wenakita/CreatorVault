import { Search } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

type Tab = {
  label: string
  to: string
}

const TABS: Tab[] = [
  { label: 'Tokens', to: '/explore/creators' },
  { label: 'Pools', to: '/explore/content' },
  { label: 'Transactions', to: '/explore/transactions' },
]

const TIME_FILTERS = [
  { label: '1H', value: '1h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '1Y', value: '1y' },
] as const

const SORT_OPTIONS = [
  { label: 'Volume', value: 'volume' },
  { label: 'Market cap', value: 'marketCap' },
  { label: 'Price change', value: 'priceChange' },
  { label: 'Recently added', value: 'new' },
] as const

function isActive(pathname: string, to: string): boolean {
  if (pathname === to) return true
  return pathname.startsWith(`${to}/`)
}

export function ExploreSubnav({
  searchPlaceholder = 'Search tokens',
  onSearch,
  onTimeFilterChange,
  onSortChange,
  currentTimeFilter = '1d',
  currentSort = 'volume',
}: {
  searchPlaceholder?: string
  onSearch?: (query: string) => void
  onTimeFilterChange?: (filter: string) => void
  onSortChange?: (sort: string) => void
  currentTimeFilter?: string
  currentSort?: string
}) {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const handleTimeFilterClick = (value: string) => {
    if (onTimeFilterChange) {
      onTimeFilterChange(value)
    }
    const newParams = new URLSearchParams(searchParams)
    newParams.set('time', value)
    setSearchParams(newParams, { replace: true })
  }

  const handleSortClick = (value: string) => {
    if (onSortChange) {
      onSortChange(value)
    }
    const newParams = new URLSearchParams(searchParams)
    newParams.set('sort', value)
    setSearchParams(newParams, { replace: true })
  }

  return (
    <div className="space-y-4">
      {/* Main navigation row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1">
          {TABS.map((tab) => {
            const active = isActive(location.pathname, tab.to)
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  active
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="w-full sm:w-[280px] h-10 pl-10 pr-4 bg-zinc-900 border border-zinc-800 rounded-full text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
              aria-label="Search"
              onChange={(e) => onSearch?.(e.target.value)}
            />
          </div>

          {/* Time filter pills */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-full p-1">
            {TIME_FILTERS.map((filter) => {
              const active = currentTimeFilter === filter.value
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => handleTimeFilterClick(filter.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Sort options row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <span className="text-xs text-zinc-500 flex-shrink-0">Sort by:</span>
        {SORT_OPTIONS.map((option) => {
          const active = currentSort === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSortClick(option.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

