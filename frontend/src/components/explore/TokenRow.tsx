import { Link } from 'react-router-dom'
import type { ZoraCoin } from '@/lib/zora/types'

type TokenRowProps = {
  rank: number
  coin: ZoraCoin
  linkPrefix?: string
  timeframe?: string
}

type TokenTableHeaderProps = {
  timeframe?: string
}

// V4 cutoff: June 6, 2025 (Zora V4 mainnet launch)
const V4_CUTOFF_DATE = new Date('2025-06-06T00:00:00Z')

// Zora V4 Fee Structure (1% total fee) - coins created after June 6, 2025
const FEE_RATES_V4 = {
  total: 0.01,        // 1% total trading fee
  creator: 0.50,      // 50% of fees → Creator/payoutRecipient
  platform: 0.20,     // 20% of fees → Platform Referral
  lpRewards: 0.20,    // 20% of fees → Locked LP (not distributed)
  protocol: 0.05,     // 5% of fees → Zora Protocol
  tradeRef: 0.04,     // 4% of fees → Trade Referral
  doppler: 0.01,      // 1% of fees → Doppler (LP hook)
}

// Legacy Fee Structure (3% total fee) - coins created before June 6, 2025
const FEE_RATES_LEGACY = {
  total: 0.03,        // 3% total trading fee
  creator: 0.50,      // 50% of fees → Creator/payoutRecipient
  platform: 0.25,     // 25% of fees → Platform Referral
  lpRewards: 0.00,    // No LP rewards in legacy
  protocol: 0.25,     // 25% of fees → Zora Protocol
  tradeRef: 0.00,     // No trade referral in legacy
  doppler: 0.00,      // No Doppler in legacy
}

// Determine if coin uses V4 fee structure based on creation date
function isV4Coin(createdAt: string | undefined): boolean {
  if (!createdAt) return true // Default to V4 if unknown
  const created = new Date(createdAt)
  return created >= V4_CUTOFF_DATE
}

function getFeeRates(createdAt: string | undefined) {
  return isV4Coin(createdAt) ? FEE_RATES_V4 : FEE_RATES_LEGACY
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

function formatFeeAmount(volume: string | undefined, totalFeeRate: number, splitRate: number): string {
  if (!volume) return '-'
  const vol = parseFloat(volume)
  if (isNaN(vol) || vol === 0) return '-'
  const fee = vol * totalFeeRate * splitRate
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

export function TokenRow({ rank, coin, linkPrefix = '/explore/creators', timeframe = '1d' }: TokenRowProps) {
  // Use timeframe for future API support
  const volume = timeframe === '1d' ? coin.volume24h : coin.volume24h // TODO: support other timeframes
  
  const avatarUrl = coin.mediaContent?.previewImage?.small || coin.creatorProfile?.avatar?.previewImage?.small
  const name = coin.name || coin.symbol || 'Unknown'
  const symbol = coin.symbol || ''
  const chain = coin.chainId === 8453 ? 'base' : 'base'
  const address = coin.address || ''
  const payoutTo = coin.payoutRecipientAddress
  
  // Determine fee structure based on creation date
  const isV4 = isV4Coin(coin.createdAt)
  const feeRates = getFeeRates(coin.createdAt)

  const detailPath = `${linkPrefix}/${chain}/${address}`

  return (
    <Link
      to={detailPath}
      className="grid grid-cols-[32px_minmax(120px,1.5fr)_40px_60px_minmax(70px,1fr)_minmax(60px,1fr)_minmax(60px,1fr)_minmax(60px,1fr)_minmax(50px,1fr)_minmax(50px,1fr)_minmax(80px,1fr)] gap-2 items-center px-3 py-3 hover:bg-zinc-800/30 transition-colors cursor-pointer text-xs"
    >
      {/* Rank */}
      <span className="text-zinc-500 tabular-nums">{rank}</span>

      {/* Token Name */}
      <div className="flex items-center gap-2 min-w-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-medium text-zinc-400">{name.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">{name}</div>
          {symbol && <div className="text-[10px] text-zinc-500 truncate">{symbol}</div>}
        </div>
      </div>

      {/* Fee Version Badge */}
      <span 
        className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
          isV4 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-amber-500/20 text-amber-400'
        }`}
        title={isV4 ? '1% fee (V4 - after June 2025)' : '3% fee (Legacy - before June 2025)'}
      >
        {isV4 ? '1%' : '3%'}
      </span>

      {/* Holders */}
      <span className="text-white tabular-nums">{coin.uniqueHolders?.toLocaleString() || '-'}</span>

      {/* Volume */}
      <span className="text-white tabular-nums">{formatCompactNumber(volume)}</span>

      {/* Creator Fee (50%) */}
      <span className="text-green-400 tabular-nums">{formatFeeAmount(volume, feeRates.total, feeRates.creator)}</span>

      {/* Platform Fee */}
      <span className="text-blue-400 tabular-nums">{formatFeeAmount(volume, feeRates.total, feeRates.platform)}</span>

      {/* LP Locked (V4 only) */}
      <span className="text-purple-400 tabular-nums">
        {feeRates.lpRewards > 0 ? formatFeeAmount(volume, feeRates.total, feeRates.lpRewards) : '-'}
      </span>

      {/* Zora Protocol */}
      <span className="text-zinc-400 tabular-nums">{formatFeeAmount(volume, feeRates.total, feeRates.protocol)}</span>

      {/* Doppler (V4 only) */}
      <span className="text-zinc-500 tabular-nums">
        {feeRates.doppler > 0 ? formatFeeAmount(volume, feeRates.total, feeRates.doppler) : '-'}
      </span>

      {/* Payout To */}
      <span className="text-zinc-400 font-mono text-[10px] truncate" title={payoutTo || undefined}>
        {shortAddress(payoutTo)}
      </span>
    </Link>
  )
}

// Table Header Component
export function TokenTableHeader({ timeframe = '1d' }: TokenTableHeaderProps) {
  return (
    <div className="grid grid-cols-[32px_minmax(120px,1.5fr)_40px_60px_minmax(70px,1fr)_minmax(60px,1fr)_minmax(60px,1fr)_minmax(60px,1fr)_minmax(50px,1fr)_minmax(50px,1fr)_minmax(80px,1fr)] gap-2 items-center px-3 py-2 text-[10px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10">
      <span>#</span>
      <span>Token</span>
      <span title="Fee version: 1% (V4, after June 2025) or 3% (Legacy)">Fee</span>
      <span>Holders</span>
      <span>{getVolumeLabel(timeframe)}</span>
      <span className="text-green-400/70" title="50% of fees → Creator/Payout Recipient">Creator</span>
      <span className="text-blue-400/70" title="20-25% of fees → Platform that deployed coin">Platform</span>
      <span className="text-purple-400/70" title="20% of fees → Locked as permanent LP (V4 only)">LP Lock</span>
      <span className="text-zinc-400/70" title="5-25% of fees → Zora Protocol">Zora</span>
      <span className="text-zinc-500/70" title="1% of fees → Doppler LP hook (V4 only)">Doppler</span>
      <span>Payout To</span>
    </div>
  )
}

// Loading skeleton row
export function TokenRowSkeleton() {
  return (
    <div className="grid grid-cols-[32px_minmax(120px,1.5fr)_40px_60px_minmax(70px,1fr)_minmax(60px,1fr)_minmax(60px,1fr)_minmax(60px,1fr)_minmax(50px,1fr)_minmax(50px,1fr)_minmax(80px,1fr)] gap-2 items-center px-3 py-3">
      <div className="h-3 w-4 bg-zinc-800 rounded animate-pulse" />
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-zinc-800 animate-pulse" />
        <div className="space-y-1">
          <div className="h-3 w-16 bg-zinc-800 rounded animate-pulse" />
          <div className="h-2 w-10 bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
      <div className="h-4 w-6 bg-zinc-800 rounded animate-pulse" />
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
