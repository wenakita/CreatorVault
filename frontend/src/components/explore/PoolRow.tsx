import { Link } from 'react-router-dom'
import type { ZoraCoin } from '@/lib/zora/types'

type PoolRowProps = {
  rank: number
  coin: ZoraCoin
  timeframe?: string
}

type PoolTableHeaderProps = {
  timeframe?: string
}

// Zora V4 Fee Structure (1% total fee)
const FEE_RATES = {
  total: 0.01,        // 1% total trading fee
  creator: 0.50,      // 50% of fees → Creator/payoutRecipient
  platform: 0.20,     // 20% of fees → Platform Referral
  lpRewards: 0.20,    // 20% of fees → Locked LP (not distributed)
  protocol: 0.05,     // 5% of fees → Zora Protocol
  tradeRef: 0.04,     // 4% of fees → Trade Referral
  doppler: 0.01,      // 1% of fees → Doppler (LP hook)
}

function formatCompactNumber(value: string | number | undefined): string {
  if (!value) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num) || num === 0) return '-'
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  if (num >= 1) return `$${num.toFixed(2)}`
  if (num >= 0.01) return `$${num.toFixed(2)}`
  return `$${num.toFixed(4)}`
}

function formatFeeAmount(volume: string | undefined, feeRate: number): string {
  if (!volume) return '-'
  const vol = parseFloat(volume)
  if (isNaN(vol) || vol === 0) return '-'
  const fee = vol * FEE_RATES.total * feeRate
  return formatCompactNumber(fee)
}

function shortAddress(addr: string | undefined): string {
  if (!addr) return '-'
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// Get volume label based on timeframe
function getVolumeLabel(timeframe: string): string {
  const labels: Record<string, string> = {
    '1h': '1H Vol',
    '1d': '24H Vol',
    '1w': '7D Vol',
    '1m': '30D Vol',
    '1y': '1Y Vol',
  }
  return labels[timeframe] || '24H Vol'
}

export function PoolRow({ rank, coin, timeframe = '1d' }: PoolRowProps) {
  // Use timeframe for future API support
  const volume = timeframe === '1d' ? coin.volume24h : coin.volume24h // TODO: support other timeframes
  
  const avatarUrl = coin.mediaContent?.previewImage?.small || coin.creatorProfile?.avatar?.previewImage?.small
  const name = coin.name || coin.symbol || 'Unknown'
  const creatorHandle = coin.creatorProfile?.handle
  const chain = coin.chainId === 8453 ? 'base' : 'base'
  const address = coin.address || ''
  const payoutTo = coin.payoutRecipientAddress

  const detailPath = `/explore/content/${chain}/${address}`

  return (
    <Link
      to={detailPath}
      className="grid grid-cols-[32px_minmax(120px,1.5fr)_60px_minmax(70px,1fr)_minmax(60px,1fr)_minmax(60px,1fr)_minmax(60px,1fr)_minmax(50px,1fr)_minmax(50px,1fr)_minmax(80px,1fr)] gap-2 items-center px-3 py-3 hover:bg-zinc-800/30 transition-colors cursor-pointer text-xs"
    >
      {/* Rank */}
      <span className="text-zinc-500 tabular-nums">{rank}</span>

      {/* Content Name */}
      <div className="flex items-center gap-2 min-w-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-medium text-zinc-400">{name.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">{name}</div>
          {creatorHandle && <div className="text-[10px] text-zinc-500 truncate">@{creatorHandle}</div>}
        </div>
      </div>

      {/* Holders */}
      <span className="text-white tabular-nums">{coin.uniqueHolders?.toLocaleString() || '-'}</span>

      {/* Volume */}
      <span className="text-white tabular-nums">{formatCompactNumber(volume)}</span>

      {/* Creator Fee (50%) */}
      <span className="text-green-400 tabular-nums">{formatFeeAmount(volume, FEE_RATES.creator)}</span>

      {/* Platform Fee (20%) */}
      <span className="text-blue-400 tabular-nums">{formatFeeAmount(volume, FEE_RATES.platform)}</span>

      {/* LP Locked (20%) */}
      <span className="text-purple-400 tabular-nums">{formatFeeAmount(volume, FEE_RATES.lpRewards)}</span>

      {/* Zora (5%) */}
      <span className="text-zinc-400 tabular-nums">{formatFeeAmount(volume, FEE_RATES.protocol)}</span>

      {/* Doppler (1%) */}
      <span className="text-zinc-500 tabular-nums">{formatFeeAmount(volume, FEE_RATES.doppler)}</span>

      {/* Payout To */}
      <span className="text-zinc-400 font-mono text-[10px] truncate" title={payoutTo || undefined}>
        {shortAddress(payoutTo)}
      </span>
    </Link>
  )
}

// Table Header Component
export function PoolTableHeader({ timeframe = '1d' }: PoolTableHeaderProps) {
  return (
    <div className="grid grid-cols-[32px_minmax(120px,1.5fr)_60px_minmax(70px,1fr)_minmax(60px,1fr)_minmax(60px,1fr)_minmax(60px,1fr)_minmax(50px,1fr)_minmax(50px,1fr)_minmax(80px,1fr)] gap-2 items-center px-3 py-2 text-[10px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10">
      <span>#</span>
      <span>Content</span>
      <span>Holders</span>
      <span>{getVolumeLabel(timeframe)}</span>
      <span className="text-green-400/70" title="50% of 1% fee → Creator/Payout Recipient">Creator</span>
      <span className="text-blue-400/70" title="20% of 1% fee → Platform that deployed coin">Platform</span>
      <span className="text-purple-400/70" title="20% of 1% fee → Locked as permanent LP">LP Lock</span>
      <span className="text-zinc-400/70" title="5% of 1% fee → Zora Protocol">Zora</span>
      <span className="text-zinc-500/70" title="1% of 1% fee → Doppler (LP hook)">Doppler</span>
      <span>Payout To</span>
    </div>
  )
}

// Loading skeleton row
export function PoolRowSkeleton() {
  return (
    <div className="grid grid-cols-[32px_minmax(120px,1.5fr)_60px_minmax(70px,1fr)_minmax(60px,1fr)_minmax(60px,1fr)_minmax(60px,1fr)_minmax(50px,1fr)_minmax(50px,1fr)_minmax(80px,1fr)] gap-2 items-center px-3 py-3">
      <div className="h-3 w-4 bg-zinc-800 rounded animate-pulse" />
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-zinc-800 animate-pulse" />
        <div className="space-y-1">
          <div className="h-3 w-16 bg-zinc-800 rounded animate-pulse" />
          <div className="h-2 w-10 bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
      <div className="h-3 w-10 bg-zinc-800 rounded animate-pulse" />
      <div className="h-3 w-12 bg-zinc-800 rounded animate-pulse" />
      <div className="h-3 w-10 bg-zinc-800 rounded animate-pulse" />
      <div className="h-3 w-10 bg-zinc-800 rounded animate-pulse" />
      <div className="h-3 w-10 bg-zinc-800 rounded animate-pulse" />
      <div className="h-3 w-8 bg-zinc-800 rounded animate-pulse" />
      <div className="h-3 w-8 bg-zinc-800 rounded animate-pulse" />
      <div className="h-3 w-14 bg-zinc-800 rounded animate-pulse" />
    </div>
  )
}
