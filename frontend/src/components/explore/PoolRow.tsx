import { Link } from 'react-router-dom'
import { TokenSparkline } from './TokenSparkline'
import type { ZoraCoin } from '@/lib/zora/types'

type PoolRowProps = {
  rank: number
  coin: ZoraCoin
  timeframe?: string
}

type PoolTableHeaderProps = {
  timeframe?: string
}

function formatPrice(price: string | number | undefined): string {
  if (!price) return '$0.00'
  const num = typeof price === 'string' ? parseFloat(price) : price
  if (isNaN(num)) return '$0.00'
  if (num < 0.0001) return `$${num.toExponential(2)}`
  if (num < 0.01) return `$${num.toFixed(6)}`
  if (num < 1) return `$${num.toFixed(4)}`
  if (num < 1000) return `$${num.toFixed(2)}`
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function formatCompactNumber(value: string | number | undefined): string {
  if (!value) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  return `$${num.toFixed(2)}`
}

function formatChange(delta: string | undefined): { value: string; positive: boolean; neutral: boolean } {
  if (!delta) return { value: '-', positive: true, neutral: true }
  const num = parseFloat(delta)
  if (isNaN(num)) return { value: '-', positive: true, neutral: true }
  if (num === 0) return { value: '0.00%', positive: true, neutral: true }
  const positive = num >= 0
  const absNum = Math.abs(num)
  const formatted = absNum >= 1000 ? `${(absNum / 100).toFixed(0)}x` : `${absNum.toFixed(2)}%`
  return { value: positive ? `+${formatted}` : `-${formatted}`, positive, neutral: false }
}

// Generate mock sparkline data based on price change
function generateSparklineData(delta: string | undefined): number[] {
  const change = parseFloat(delta || '0') / 100
  const positive = change >= 0
  const baseValue = 100
  const points = 24

  return Array.from({ length: points }, (_, i) => {
    const progress = i / (points - 1)
    const noise = (Math.random() - 0.5) * 10
    const trend = positive
      ? baseValue + progress * Math.abs(change) * baseValue + noise
      : baseValue - progress * Math.abs(change) * baseValue + noise
    return Math.max(0, trend)
  })
}

// Get volume label based on timeframe
function getVolumeLabel(timeframe: string): string {
  const labels: Record<string, string> = {
    '1h': '1H volume',
    '1d': '1D volume',
    '1w': '1W volume',
    '1m': '1M volume',
    '1y': '1Y volume',
  }
  return labels[timeframe] || '1D volume'
}

// Get chart label based on timeframe
function getChartLabel(timeframe: string): string {
  const labels: Record<string, string> = {
    '1h': '1H',
    '1d': '1D',
    '1w': '1W',
    '1m': '1M',
    '1y': '1Y',
  }
  return labels[timeframe] || '1D'
}

export function PoolRow({ rank, coin, timeframe = '1d' }: PoolRowProps) {
  const price = formatPrice(coin.tokenPrice?.priceInUsdc)
  // TODO: Use timeframe-specific data when API supports it
  const change1h = formatChange(timeframe === '1h' ? coin.marketCapDelta24h : undefined) // API doesn't provide 1h data yet
  const change1d = formatChange(coin.marketCapDelta24h)
  const volume = formatCompactNumber(coin.volume24h)
  const fdv = formatCompactNumber(coin.marketCap)
  const sparklineData = generateSparklineData(coin.marketCapDelta24h)

  const avatarUrl = coin.mediaContent?.previewImage?.small || coin.creatorProfile?.avatar?.previewImage?.small
  const name = coin.name || coin.symbol || 'Unknown'
  const symbol = coin.symbol || ''
  const creatorHandle = coin.creatorProfile?.handle
  const chain = coin.chainId === 8453 ? 'base' : 'base'
  const address = coin.address || ''

  const detailPath = `/explore/content/${chain}/${address}`

  return (
    <Link
      to={detailPath}
      className="grid grid-cols-[32px_minmax(140px,2fr)_minmax(70px,1fr)_minmax(65px,1fr)_minmax(65px,1fr)_minmax(70px,1fr)_minmax(70px,1fr)_minmax(80px,1fr)] gap-3 items-center px-4 py-3 hover:bg-zinc-800/30 transition-colors cursor-pointer"
    >
      {/* Rank */}
      <span className="text-sm text-zinc-500 tabular-nums">{rank}</span>

      {/* Token Name */}
      <div className="flex items-center gap-2.5 min-w-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-zinc-400">{name.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">{name}</div>
          <div className="text-xs text-zinc-500 truncate">
            {creatorHandle ? `@${creatorHandle}` : symbol}
          </div>
        </div>
      </div>

      {/* Price */}
      <span className="text-sm text-white tabular-nums">{price}</span>

      {/* 1H Change */}
      <span className={`text-sm tabular-nums ${change1h.neutral ? 'text-zinc-500' : change1h.positive ? 'text-green-500' : 'text-red-500'}`}>
        {change1h.value}
      </span>

      {/* 1D Change */}
      <span className={`text-sm tabular-nums ${change1d.neutral ? 'text-zinc-500' : change1d.positive ? 'text-green-500' : 'text-red-500'}`}>
        {change1d.value}
      </span>

      {/* FDV */}
      <span className="text-sm text-white tabular-nums">{fdv}</span>

      {/* Volume */}
      <span className="text-sm text-white tabular-nums">{volume}</span>

      {/* Sparkline Chart */}
      <div className="flex justify-end">
        <TokenSparkline data={sparklineData} positive={change1d.positive} width={80} height={28} />
      </div>
    </Link>
  )
}

// Table Header Component for Pools
export function PoolTableHeader({ timeframe = '1d' }: PoolTableHeaderProps) {
  return (
    <div className="grid grid-cols-[32px_minmax(140px,2fr)_minmax(70px,1fr)_minmax(65px,1fr)_minmax(65px,1fr)_minmax(70px,1fr)_minmax(70px,1fr)_minmax(80px,1fr)] gap-3 items-center px-4 py-3 text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10">
      <span>#</span>
      <span>Token name</span>
      <span>Price</span>
      <span>1H</span>
      <span>1D</span>
      <span>FDV</span>
      <span>{getVolumeLabel(timeframe)}</span>
      <span className="text-right">{getChartLabel(timeframe)}</span>
    </div>
  )
}

// Loading skeleton row for Pools
export function PoolRowSkeleton() {
  return (
    <div className="grid grid-cols-[32px_minmax(140px,2fr)_minmax(70px,1fr)_minmax(65px,1fr)_minmax(65px,1fr)_minmax(70px,1fr)_minmax(70px,1fr)_minmax(80px,1fr)] gap-3 items-center px-4 py-3">
      <div className="h-4 w-5 bg-zinc-800 rounded animate-pulse" />
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-zinc-800 animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse" />
          <div className="h-3 w-12 bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
      <div className="h-4 w-14 bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-12 bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-12 bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-14 bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-14 bg-zinc-800 rounded animate-pulse" />
      <div className="h-7 w-20 bg-zinc-800 rounded animate-pulse ml-auto" />
    </div>
  )
}
