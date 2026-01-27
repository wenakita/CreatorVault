import { Link } from 'react-router-dom'
import { TokenSparkline } from './TokenSparkline'
import type { ZoraCoin } from '@/lib/zora/types'

type PoolRowProps = {
  rank: number
  coin: ZoraCoin
}

function formatVolume(volume: string | undefined): string {
  if (!volume) return '$0'
  const num = parseFloat(volume)
  if (isNaN(num)) return '$0'
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  return `$${num.toFixed(2)}`
}

function formatTVL(marketCap: string | undefined): string {
  if (!marketCap) return '-'
  const num = parseFloat(marketCap)
  if (isNaN(num)) return '-'
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  return `$${num.toFixed(2)}`
}

function formatChange(delta: string | undefined): { value: string; positive: boolean } {
  if (!delta) return { value: '-', positive: true }
  const num = parseFloat(delta)
  if (isNaN(num)) return { value: '-', positive: true }
  const positive = num >= 0
  const absNum = Math.abs(num)
  const formatted = absNum >= 1000 ? `${(absNum / 100).toFixed(0)}x` : `${absNum.toFixed(2)}%`
  return { value: positive ? `+${formatted}` : `-${formatted}`, positive }
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

export function PoolRow({ rank, coin }: PoolRowProps) {
  const change = formatChange(coin.marketCapDelta24h)
  const volume24h = formatVolume(coin.volume24h)
  const totalVolume = formatVolume(coin.totalVolume)
  const tvl = formatTVL(coin.marketCap)
  const sparklineData = generateSparklineData(coin.marketCapDelta24h)

  const avatarUrl = coin.mediaContent?.previewImage?.small || coin.creatorProfile?.avatar?.previewImage?.small
  const symbol = coin.symbol || '???'
  const name = coin.name || 'Unknown'
  const creatorHandle = coin.creatorProfile?.handle
  const chain = coin.chainId === 8453 ? 'base' : 'base'
  const address = coin.address || ''

  const detailPath = `/explore/content/${chain}/${address}`

  return (
    <Link
      to={detailPath}
      className="grid grid-cols-[40px_minmax(180px,2fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(100px,1fr)] gap-4 items-center px-4 py-4 hover:bg-zinc-900/50 transition-colors border-b border-zinc-800/50 cursor-pointer"
    >
      {/* Rank */}
      <span className="text-sm text-zinc-500 tabular-nums">{rank}</span>

      {/* Pool Name & Creator */}
      <div className="flex items-center gap-3 min-w-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-zinc-400">{symbol.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white truncate">{name}</div>
          <div className="text-xs text-zinc-500 truncate">
            {creatorHandle ? `@${creatorHandle}` : symbol}
          </div>
        </div>
      </div>

      {/* TVL */}
      <span className="text-sm text-white tabular-nums">{tvl}</span>

      {/* 24h Change */}
      <span className={`text-sm tabular-nums ${change.positive ? 'text-green-500' : 'text-red-500'}`}>
        {change.value}
      </span>

      {/* 24h Volume */}
      <span className="text-sm text-white tabular-nums">{volume24h}</span>

      {/* Total Volume */}
      <span className="text-sm text-zinc-400 tabular-nums">{totalVolume}</span>

      {/* Sparkline */}
      <div className="flex justify-end">
        <TokenSparkline data={sparklineData} positive={change.positive} width={100} height={32} />
      </div>
    </Link>
  )
}

// Table Header Component for Pools
export function PoolTableHeader() {
  return (
    <div className="grid grid-cols-[40px_minmax(180px,2fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(100px,1fr)] gap-4 items-center px-4 py-3 text-xs text-zinc-500 border-b border-zinc-800 bg-zinc-900/30 sticky top-0 z-10">
      <span>#</span>
      <span>Content</span>
      <span>TVL</span>
      <span>24h</span>
      <span>1D volume</span>
      <span>Total volume</span>
      <span className="text-right">Last 24h</span>
    </div>
  )
}

// Loading skeleton row for Pools
export function PoolRowSkeleton() {
  return (
    <div className="grid grid-cols-[40px_minmax(180px,2fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(100px,1fr)] gap-4 items-center px-4 py-4 border-b border-zinc-800/50">
      <div className="h-4 w-6 bg-zinc-800 rounded animate-pulse" />
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-800 animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
          <div className="h-3 w-16 bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
      <div className="h-4 w-16 bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-14 bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-16 bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-16 bg-zinc-800 rounded animate-pulse" />
      <div className="h-8 w-24 bg-zinc-800 rounded animate-pulse ml-auto" />
    </div>
  )
}
