import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAccount } from 'wagmi'
import { isAddress, type Address } from 'viem'
import { base } from 'viem/chains'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { Play, RotateCw } from 'lucide-react'
import { AKITA } from '../config/contracts'
import { LiquidGoldVaultCard } from '@/components/liquidGold/LiquidGoldVaultCard'
import { useDebankTotalBalanceBatch } from '@/lib/debank/hooks'
import { useDexscreenerTokenStatsBatch } from '@/lib/dexscreener/hooks'
import type { DexscreenerTokenStats } from '@/lib/dexscreener/client'
import { computeCreatorScore } from '@/lib/reputation/creatorScore'
import { useZoraExplore, useZoraTopCreators } from '@/lib/zora/hooks'
import type { ZoraCoin } from '@/lib/zora/types'

const vaults = [
  {
    id: 'akita',
    name: 'AKITA',
    symbol: 'AKITA',
    token: AKITA.token as Address,
    vault: AKITA.vault as Address,
    ccaStrategy: AKITA.ccaStrategy as Address,
  },
]

function formatUsdDeltaCompact(value?: string): string | null {
  if (!value) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  const abs = Math.abs(n)
  if (abs > 0 && abs < 0.01) return `${n >= 0 ? '+' : '-'}<$0.01`
  const absText = Intl.NumberFormat(undefined, {
    maximumFractionDigits: abs >= 1 ? 0 : 2,
  }).format(abs)
  return `${n >= 0 ? '+' : '-'}$${absText}`
}

function formatPercentSigned(fraction: number): string | null {
  if (!Number.isFinite(fraction)) return null
  try {
    return Intl.NumberFormat(undefined, {
      style: 'percent',
      maximumFractionDigits: 2,
      signDisplay: 'exceptZero',
    }).format(fraction)
  } catch {
    // Older runtimes may not support signDisplay.
    const base = Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(fraction)
    return fraction > 0 ? `+${base}` : base
  }
}

function shortAddress(addr?: string): string | null {
  if (!addr) return null
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatDaysSinceIso(iso?: string): string | null {
  if (!iso) return null
  const ms = Date.parse(String(iso))
  if (!Number.isFinite(ms)) return null
  const delta = Date.now() - ms
  if (!Number.isFinite(delta)) return null
  if (delta < 0) return '<1d'
  const days = Math.floor(delta / 86_400_000)
  if (days <= 0) return '<1d'
  return `${days}d`
}

type CoinTypeFilter = 'ALL' | 'CREATOR' | 'CONTENT' | 'VIDEO'
type SortKey = 'MARKET_CAP' | 'VOLUME' | 'CHANGE_24H'
type Timeframe = 'TOTAL' | '24H'

function mergeZoraCoins(a: ZoraCoin, b: ZoraCoin): ZoraCoin {
  const pick = <T,>(next: T | undefined, prev: T | undefined): T | undefined => (next !== undefined ? next : prev)
  const pickStr = (next: string | undefined, prev: string | undefined): string | undefined => {
    if (typeof next === 'string' && next.trim().length > 0) return next
    if (typeof prev === 'string' && prev.trim().length > 0) return prev
    return next ?? prev
  }
  const pickNum = (next: number | undefined, prev: number | undefined): number | undefined => {
    if (typeof next === 'number' && Number.isFinite(next)) return next
    if (typeof prev === 'number' && Number.isFinite(prev)) return prev
    return next ?? prev
  }

  // Prefer b when it provides a value, otherwise keep a.
  return {
    id: pickStr(b.id, a.id),
    platformBlocked: pick(b.platformBlocked, a.platformBlocked),
    name: pickStr(b.name, a.name),
    description: pickStr(b.description, a.description),
    address: pickStr(b.address, a.address),
    symbol: pickStr(b.symbol, a.symbol),
    coinType: pickStr(typeof b.coinType === 'string' ? b.coinType : undefined, typeof a.coinType === 'string' ? a.coinType : undefined),
    totalSupply: pickStr(b.totalSupply, a.totalSupply),
    totalVolume: pickStr(b.totalVolume, a.totalVolume),
    volume24h: pickStr(b.volume24h, a.volume24h),
    createdAt: pickStr(b.createdAt, a.createdAt),
    creatorAddress: pickStr(b.creatorAddress, a.creatorAddress),
    creatorProfile: pick(b.creatorProfile, a.creatorProfile),
    creatorEarnings: pick(b.creatorEarnings, a.creatorEarnings),
    poolCurrencyToken: pick(b.poolCurrencyToken, a.poolCurrencyToken),
    tokenPrice: pick(b.tokenPrice, a.tokenPrice),
    marketCap: pickStr(b.marketCap, a.marketCap),
    marketCapDelta24h: pickStr(b.marketCapDelta24h, a.marketCapDelta24h),
    chainId: pickNum(b.chainId, a.chainId),
    uniqueHolders: pickNum(b.uniqueHolders, a.uniqueHolders),
    tokenUri: pickStr(b.tokenUri, a.tokenUri),
    platformReferrerAddress: pickStr(b.platformReferrerAddress, a.platformReferrerAddress),
    payoutRecipientAddress: pickStr(b.payoutRecipientAddress, a.payoutRecipientAddress),
    mediaContent: pick(b.mediaContent, a.mediaContent),
  }
}

function timeframeLabel(tf: Timeframe): string {
  switch (tf) {
    case 'TOTAL':
      return 'All-time'
    case '24H':
      return '24h'
    default:
      return String(tf)
  }
}

function volumeForTimeframe(
  coin: ZoraCoin,
  tf: Timeframe,
  dex?: DexscreenerTokenStats | null,
): { volume: number; isEstimated: boolean } {
  const toNum = (v?: string) => {
    const n = v ? Number(v) : NaN
    return Number.isFinite(n) ? n : NaN
  }

  const zoraTotal = toNum(coin.totalVolume)
  const zora24h = toNum(coin.volume24h)

  if (tf === 'TOTAL') return { volume: zoraTotal, isEstimated: false }

  const dex24h = typeof dex?.volumeUsd24h === 'number' && Number.isFinite(dex.volumeUsd24h) ? dex.volumeUsd24h : NaN

  const v = Number.isFinite(zora24h) ? zora24h : Number.isFinite(dex24h) ? dex24h : NaN
  return { volume: v, isEstimated: !Number.isFinite(zora24h) && Number.isFinite(dex24h) }
}

function coinMatchesTypeFilter(coin: ZoraCoin, filter: CoinTypeFilter): boolean {
  if (filter === 'ALL') return true

  const coinType = coin.coinType ? String(coin.coinType).toUpperCase() : ''
  const mime = coin.mediaContent?.mimeType ? String(coin.mediaContent.mimeType).toLowerCase() : ''
  const isVideo = mime.startsWith('video/')

  if (filter === 'CREATOR') return coinType === 'CREATOR'
  if (filter === 'CONTENT') return coinType === 'CONTENT'
  if (filter === 'VIDEO') return coinType === 'CONTENT' && isVideo
  return true
}

function CoinTypeFilterPills({
  value,
  onChange,
  options,
}: {
  value: CoinTypeFilter
  onChange: (value: CoinTypeFilter) => void
  options?: Array<{ value: CoinTypeFilter; label: string }>
}) {
  const opts: Array<{ value: CoinTypeFilter; label: string }> =
    options ?? [
      { value: 'ALL', label: 'All' },
      { value: 'CREATOR', label: 'Creator' },
      { value: 'CONTENT', label: 'Content' },
      { value: 'VIDEO', label: 'Video' },
    ]

  return (
    <div className="flex-none inline-flex items-center gap-0.5 rounded-full border border-zinc-900/70 bg-black/30 p-0.5 backdrop-blur-sm">
      {opts.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`h-8 px-3 rounded-full text-[10px] uppercase tracking-[0.18em] transition-colors ${
              active ? 'bg-zinc-900 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={opt.value === 'VIDEO' ? 'Content coins with video media' : undefined}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function ZoraCoinRow({
  coin,
  sortKey,
  timeframe,
  dex,
  showScore,
  creatorNetWorthUsd,
  netWorthLoading,
  rank,
  analytics,
}: {
  coin: ZoraCoin
  sortKey: SortKey
  timeframe: Timeframe
  dex?: DexscreenerTokenStats | null
  showScore?: boolean
  creatorNetWorthUsd?: number | null
  netWorthLoading?: boolean
  rank?: number
  analytics?: { maxVolume24h: number; maxMarketCap: number } | null
}) {
  const image = coin.mediaContent?.previewImage?.medium || coin.mediaContent?.previewImage?.small
  const symbol = coin.symbol ? String(coin.symbol) : 'COIN'
  const name = coin.name ? String(coin.name) : symbol
  const creatorHandle = coin.creatorProfile?.handle ? `@${coin.creatorProfile.handle}` : null
  const creatorAddr = coin.creatorAddress ? String(coin.creatorAddress) : undefined
  const creatorLabel = creatorHandle ?? shortAddress(creatorAddr) ?? null

  const launchAge = formatDaysSinceIso(coin.createdAt)
  const launchAgeTitle = coin.createdAt ? `Coin launched: ${coin.createdAt}` : undefined

  const coinType = coin.coinType ? String(coin.coinType).toUpperCase() : ''
  const isCreatorCoin = coinType === 'CREATOR'
  const isContentCoin = coinType === 'CONTENT'

  const symbolDisplay =
    symbol && name && symbol.trim().toLowerCase() !== name.trim().toLowerCase() ? symbol.trim() : null

  // Visual distinction without extra text: Content Coins show a small creator badge (like token + chain icon).
  const contentAvatarRingClass = isContentCoin ? 'ring-1 ring-amber-400/30 ring-offset-0' : ''
  const creatorBadgeRingClass = isContentCoin ? 'ring-1 ring-amber-400/40 ring-offset-0' : ''
  const avatarTitle = isContentCoin ? 'Not eligible for vaults (Creator Coins only)' : isCreatorCoin ? 'Eligible for vaults' : undefined

  const href = coin.address ? `/deploy?token=${encodeURIComponent(String(coin.address))}` : '/deploy'

  // Replace “direct payouts” label with “fees generated”.
  // This is an estimate derived from API-provided 24h volume (fast, no RPC).
  // Note: Zora's `volume24h` / `totalVolume` are displayed in USD on zora.co coin pages.
  // Example: https://zora.co/coin/base:0x3dab2f1e41674760f174fd6cc70fc3d8f681fb02
  // Zora Coins (v2.2.0+) use a unified 1% total pool fee.
  // Source: https://docs.zora.co/coins/contracts/rewards
  const ZORA_POOL_FEE_RATE = 0.01 // 1%

  const { volume: volumeWindow, isEstimated: volumeIsEstimated } = volumeForTimeframe(coin, timeframe, dex)
  const estTotalFeesWindow = Number.isFinite(volumeWindow) ? volumeWindow * ZORA_POOL_FEE_RATE : NaN

  function fmtUsd(n: number): string {
    if (!Number.isFinite(n)) return '—'
    const abs = Math.abs(n)
    if (abs > 0 && abs < 0.01) return '<$0.01'
    return Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: abs >= 1 ? 0 : 2,
    }).format(n)
  }

  const formattedTotalFees = Number.isFinite(estTotalFeesWindow)
    ? fmtUsd(estTotalFeesWindow)
    : null
  const totalFeesPrefix = formattedTotalFees && formattedTotalFees.startsWith('<') ? '' : '~'

  // Creator-fee breakdown is available in Zora docs, but we keep the table focused; fees shown (when enabled) are total fees.

  const creatorAvatar =
    coin.creatorProfile?.avatar?.previewImage?.small || coin.creatorProfile?.avatar?.previewImage?.medium || null
  const creatorBadgeTitle = creatorLabel ? `Creator: ${creatorLabel}` : 'Creator'
  const creatorBadgeInitial =
    (creatorHandle ? creatorHandle.replace('@', '').slice(0, 1) : null) ||
    (creatorAddr ? creatorAddr.slice(2, 3) : null) ||
    'C'

  const mediaMime = coin.mediaContent?.mimeType ? String(coin.mediaContent.mimeType).toLowerCase() : ''
  const isVideoContent = isContentCoin && mediaMime.startsWith('video/')

  const volPct =
    analytics && analytics.maxVolume24h > 0 && Number.isFinite(volumeWindow)
      ? Math.max(0, Math.min(1, volumeWindow / analytics.maxVolume24h))
      : null
  const mcap =
    coin.marketCap && Number.isFinite(Number(coin.marketCap))
      ? Number(coin.marketCap)
      : typeof dex?.marketCapUsd === 'number' && Number.isFinite(dex.marketCapUsd)
        ? dex.marketCapUsd
        : NaN
  const mcapPct =
    analytics && analytics.maxMarketCap > 0 && Number.isFinite(mcap)
      ? Math.max(0, Math.min(1, mcap / analytics.maxMarketCap))
      : null

  const mcapText = Number.isFinite(mcap) ? fmtUsd(mcap) : '—'
  const volText = Number.isFinite(volumeWindow)
    ? `${volumeIsEstimated ? '~' : ''}${fmtUsd(volumeWindow)}`
    : '—'
  const feesText = formattedTotalFees !== null ? `${totalFeesPrefix}${formattedTotalFees}` : '—'
  const deltaVal = coin.marketCapDelta24h ? Number(coin.marketCapDelta24h) : NaN
  const deltaText = formatUsdDeltaCompact(coin.marketCapDelta24h) ?? '—'
  const deltaPctText = (() => {
    if (!Number.isFinite(deltaVal) || !Number.isFinite(mcap)) return null
    const prev = mcap - deltaVal
    if (!Number.isFinite(prev) || prev <= 0) return null
    return formatPercentSigned(deltaVal / prev)
  })()
  const deltaClass =
    Number.isFinite(deltaVal) && deltaVal !== 0 ? (deltaVal > 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-zinc-200'

  const ch1h = typeof dex?.change1h === 'number' && Number.isFinite(dex.change1h) ? dex.change1h : NaN
  const ch24h = typeof dex?.change24h === 'number' && Number.isFinite(dex.change24h) ? dex.change24h : NaN
  const ch6h = typeof dex?.change6h === 'number' && Number.isFinite(dex.change6h) ? dex.change6h : NaN

  const ch1hText = Number.isFinite(ch1h) ? formatPercentSigned(ch1h) ?? '—' : '—'
  const ch24hText = Number.isFinite(ch24h) ? formatPercentSigned(ch24h) ?? '—' : '—'
  const ch6hText = Number.isFinite(ch6h) ? formatPercentSigned(ch6h) ?? '—' : '—'

  const changeClass = (v: number) =>
    Number.isFinite(v) && v !== 0 ? (v > 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-zinc-500'

  const netWorthUsd =
    typeof creatorNetWorthUsd === 'number' && Number.isFinite(creatorNetWorthUsd) ? creatorNetWorthUsd : NaN
  const netWorthText = Number.isFinite(netWorthUsd) ? fmtUsd(netWorthUsd) : null
  const netWorthDisplay = netWorthText ?? (netWorthLoading ? '…' : '—')
  const netWorthDisplayClass = netWorthText
    ? 'text-zinc-200'
    : netWorthLoading
      ? 'text-zinc-500 animate-pulse'
      : 'text-zinc-600'
  const netWorthScore = showScore ? computeCreatorScore({ netWorthUsd }) : null
  const netWorthScoreText = netWorthScore ? String(Math.round(netWorthScore.score)) : null

  const mobileMetric = (() => {
    switch (sortKey) {
      case 'MARKET_CAP':
        return mcapText
      case 'VOLUME':
        return volText
      case 'CHANGE_24H':
        return ch24hText
      default:
        return mcapText
    }
  })()

  return (
    <Link to={href}>
      <div className="px-6 py-4 hover:bg-zinc-950/20 transition-colors">
        <div className="grid grid-cols-12 items-center gap-4">
          <div className="col-span-7 sm:col-span-4 lg:col-span-3 flex items-center gap-3 min-w-0">
            {typeof rank === 'number' ? (
              <div className="w-8 flex-shrink-0 text-[10px] font-mono tabular-nums text-zinc-600">#{rank}</div>
            ) : null}
            <div className="relative flex-shrink-0" title={avatarTitle}>
              {image ? (
                <img
                  src={image}
                  alt={symbol}
                  className={`w-9 h-9 rounded-full object-cover ${contentAvatarRingClass}`}
                  loading="lazy"
                />
              ) : (
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-xs font-medium text-cyan-400 ${contentAvatarRingClass}`}>
                  {symbol.slice(0, 2).toUpperCase()}
                </div>
              )}

              {/* Video indicator */}
              {isVideoContent ? (
                <div
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full overflow-hidden bg-black border border-zinc-900 ring-1 ring-purple-500/30 ring-offset-0 flex items-center justify-center text-zinc-200"
                  title="Video content"
                >
                  <Play className="w-2.5 h-2.5" />
                </div>
              ) : null}

              {isContentCoin ? (
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full overflow-hidden bg-black border border-zinc-900 ${creatorBadgeRingClass}`}
                  title={creatorBadgeTitle}
                >
                  {creatorAvatar ? (
                    <img
                      src={creatorAvatar}
                      alt={creatorLabel ? `${creatorLabel} avatar` : 'Creator avatar'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] font-medium text-zinc-300 bg-zinc-900">
                      {String(creatorBadgeInitial).toUpperCase()}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="text-zinc-200 font-light truncate">{name}</div>
                {symbolDisplay ? (
                  <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-[0.18em] flex-shrink-0">
                    {symbolDisplay}
                  </div>
                ) : null}
              </div>

              {!isCreatorCoin && creatorLabel ? (
                <div className="text-xs text-zinc-600 min-w-0 truncate">
                  <span className="font-mono">{creatorLabel}</span>
                  {showScore ? (
                    <>
                      <span className="text-zinc-700 lg:hidden"> · </span>
                      <span
                        className={`font-mono tabular-nums lg:hidden ${netWorthLoading ? 'animate-pulse' : ''}`}
                        title={netWorthText ? `Net worth: ${netWorthText}` : netWorthLoading ? 'Loading net worth…' : 'Net worth unavailable'}
                      >
                        Net worth {netWorthDisplay}
                      </span>
                      {netWorthScoreText ? (
                        <>
                          <span className="text-zinc-700"> · </span>
                          <span className="font-mono tabular-nums" title="Beta score (0–100) derived from net worth (log-scaled)">
                            Score {netWorthScoreText}
                          </span>
                        </>
                      ) : null}
                    </>
                  ) : null}
                  {launchAge ? (
                    <span className="lg:hidden">
                      <span className="text-zinc-700"> · </span>
                      <span className="font-mono tabular-nums" title={launchAgeTitle}>
                        Age {launchAge}
                      </span>
                    </span>
                  ) : null}
                </div>
              ) : null}

              {isCreatorCoin && showScore ? (
                <div className="text-xs text-zinc-600 min-w-0 truncate">
                  <span
                    className={`font-mono tabular-nums lg:hidden ${netWorthLoading ? 'animate-pulse' : ''}`}
                    title={netWorthText ? `Net worth: ${netWorthText}` : netWorthLoading ? 'Loading net worth…' : 'Net worth unavailable'}
                  >
                    Net worth {netWorthDisplay}
                  </span>
                  {netWorthScoreText ? (
                    <>
                      <span className="text-zinc-700 lg:hidden"> · </span>
                      <span className="font-mono tabular-nums" title="Beta score (0–100) derived from net worth (log-scaled)">
                        Score {netWorthScoreText}
                      </span>
                    </>
                  ) : null}
                </div>
              ) : null}

              {/* Always show launch age for creator coins; show it for other coins when we don't have a creator label line. */}
              {launchAge && (isCreatorCoin || !creatorLabel) ? (
                <div className="text-xs text-zinc-600 min-w-0 truncate lg:hidden">
                  <span className="font-mono tabular-nums" title={launchAgeTitle}>
                    Age {launchAge}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Age (days since launch) */}
          <div className="hidden lg:block lg:col-span-1 text-right" title={launchAgeTitle ?? 'Days since coin launch'}>
            <div className="text-sm font-mono tabular-nums text-zinc-200">{launchAge ?? '—'}</div>
          </div>

          {/* Mobile: show only the active sort column value */}
          <div className="col-span-5 sm:hidden text-right">
            <div className="text-sm font-mono tabular-nums text-zinc-200">{mobileMetric}</div>
          </div>

          {showScore ? (
            <div
              className="hidden sm:block sm:col-span-2 lg:col-span-1 text-right"
              title="Portfolio value (USD)"
            >
              <div
                className={`text-sm font-mono tabular-nums whitespace-nowrap ${netWorthDisplayClass}`}
                title={netWorthText ? `Net worth: ${netWorthText}` : netWorthLoading ? 'Loading net worth…' : 'Net worth unavailable'}
              >
                {netWorthDisplay}
              </div>
            </div>
          ) : null}

          {/* Desktop/tablet columns */}
          <div className="hidden lg:block lg:col-span-1 text-right">
            <div className={`text-sm font-mono tabular-nums ${changeClass(ch1h)}`}>{ch1hText}</div>
          </div>

          <div className="hidden lg:block lg:col-span-1 text-right">
            <div className={`text-sm font-mono tabular-nums ${changeClass(ch6h)}`}>{ch6hText}</div>
          </div>

          <div className="hidden sm:block sm:col-span-2 lg:col-span-1 text-right">
            <div className={`text-sm font-mono tabular-nums ${changeClass(ch24h)}`}>{ch24hText}</div>
          </div>

          <div className="hidden sm:block sm:col-span-2 lg:col-span-1 text-right">
            <div className="text-sm font-mono tabular-nums text-zinc-200">{volText}</div>
            {analytics ? (
              <div className="mt-1 text-[10px] text-zinc-600 font-mono tabular-nums">fees: {feesText}</div>
            ) : null}
          </div>

          <div className={`hidden sm:block ${showScore ? 'sm:col-span-2 lg:col-span-3' : 'sm:col-span-4 lg:col-span-4'} text-right`}>
            <div className="text-sm font-mono tabular-nums text-zinc-200">{mcapText}</div>
            {analytics && timeframe === '24H' && deltaPctText ? (
              <div className={`mt-1 text-[10px] font-mono tabular-nums ${deltaClass} opacity-70`}>
                <span className="opacity-70">Mcap 24h:</span> {deltaText} <span className="opacity-70">({deltaPctText})</span>
              </div>
            ) : null}
          </div>
        </div>

        {analytics ? (
          <div className="mt-3 grid grid-cols-12 items-center gap-3 text-[10px] text-zinc-600">
            <div className="hidden sm:block sm:col-span-4" />
            <div className="col-span-12 sm:col-span-4 flex items-center gap-2">
              <span>VOL</span>
              <div className="relative h-1.5 flex-1 bg-zinc-900 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-cyan-500/60" style={{ width: `${Math.round((volPct ?? 0) * 100)}%` }} />
              </div>
            </div>
            <div className="col-span-12 sm:col-span-4 flex items-center gap-2">
              <span>MCAP</span>
              <div className="relative h-1.5 flex-1 bg-zinc-900 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-purple-500/60" style={{ width: `${Math.round((mcapPct ?? 0) * 100)}%` }} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Link>
  )
}

export function Dashboard() {
  const queryClient = useQueryClient()
  const dashboardFetchCount = useIsFetching({
    predicate: (q) => {
      const root = q.queryKey?.[0]
      return root === 'zora' || root === 'dexscreener' || root === 'debank'
    },
  })
  const isRefreshing = dashboardFetchCount > 0

  const { address: viewerAddress } = useAccount()
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showScore, setShowScore] = useState(false)
  // Default to All so the first view feels like a true market leaderboard.
  const [typeFilter, setTypeFilter] = useState<CoinTypeFilter>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('MARKET_CAP')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [timeframe, setTimeframe] = useState<Timeframe>('24H')
  const [lastTradedAfter, setLastTradedAfter] = useState<string | undefined>(undefined)
  const [lastTradedAccumulated, setLastTradedAccumulated] = useState<ZoraCoin[]>([])
  const loadedLastTradedCursors = useRef<Set<string>>(new Set())
  const [lastTradedPageInfo, setLastTradedPageInfo] = useState<{ hasNextPage?: boolean; endCursor?: string } | null>(
    null,
  )

  async function handleRefresh() {
    // Reset pagination so the “Load more” list starts fresh.
    loadedLastTradedCursors.current.clear()
    setLastTradedPageInfo(null)
    setLastTradedAccumulated([])
    setLastTradedAfter(undefined)

    await queryClient.invalidateQueries({
      predicate: (q) => {
        const root = q.queryKey?.[0]
        return root === 'zora' || root === 'dexscreener' || root === 'debank'
      },
      refetchType: 'active',
    })
  }

  const {
    data: topGainers,
    isLoading: gainersLoading,
    error: gainersError,
  } = useZoraExplore('TOP_GAINERS', { count: 6 })
  const {
    data: topVolume,
    isLoading: volumeLoading,
    error: volumeError,
  } = useZoraExplore('TOP_VOLUME_24H', { count: 6 })
  const {
    data: mostValuable,
    isLoading: valuableLoading,
    error: valuableError,
  } = useZoraExplore('MOST_VALUABLE', { count: 50 })
  const {
    data: newest,
    isLoading: newLoading,
    error: newError,
  } = useZoraExplore('NEW', { count: 6 })
  const {
    data: lastTradedUnique,
    isLoading: tradedLoading,
    isFetching: tradedFetching,
    error: tradedError,
  } = useZoraExplore('LAST_TRADED_UNIQUE', { count: 50, after: lastTradedAfter })

  const { data: topCreators, isLoading: creatorsLoading } = useZoraTopCreators({ count: 50 })

  const creators = ((topCreators?.edges ?? []).map((e) => e.node).filter(Boolean) as ZoraCoin[]).filter(
    (c) => c.chainId === base.id,
  )
  const gainers = ((topGainers?.edges ?? []).map((e) => e.node).filter(Boolean) as ZoraCoin[]).filter(
    (c) => c.chainId === base.id,
  )
  const volume = ((topVolume?.edges ?? []).map((e) => e.node).filter(Boolean) as ZoraCoin[]).filter(
    (c) => c.chainId === base.id,
  )
  const valuable = ((mostValuable?.edges ?? []).map((e) => e.node).filter(Boolean) as ZoraCoin[]).filter(
    (c) => c.chainId === base.id,
  )
  const newCoins = ((newest?.edges ?? []).map((e) => e.node).filter(Boolean) as ZoraCoin[]).filter(
    (c) => c.chainId === base.id,
  )
  useEffect(() => {
    if (!lastTradedUnique) return
    const key = lastTradedAfter ?? '__first__'
    if (loadedLastTradedCursors.current.has(key)) return
    loadedLastTradedCursors.current.add(key)

    const pageCoins = (lastTradedUnique.edges ?? []).map((e) => e.node).filter(Boolean) as ZoraCoin[]
    setLastTradedAccumulated((prev) => (key === '__first__' ? pageCoins : [...prev, ...pageCoins]))
    setLastTradedPageInfo(lastTradedUnique.pageInfo ?? null)
  }, [lastTradedAfter, lastTradedUnique])

  const lastTraded = useMemo(
    () => lastTradedAccumulated.filter((c) => c.chainId === base.id),
    [lastTradedAccumulated],
  )

  const allExploreCoins = useMemo(() => {
    const map = new Map<string, ZoraCoin>()
    for (const c of [...creators, ...gainers, ...volume, ...valuable, ...newCoins, ...lastTraded]) {
      const addr = c.address ? String(c.address) : ''
      if (!addr || !isAddress(addr)) continue
      const key = addr.toLowerCase()
      const prev = map.get(key)
      map.set(key, prev ? mergeZoraCoins(prev, c) : c)
    }
    return Array.from(map.values())
  }, [creators, gainers, volume, valuable, newCoins, lastTraded])

  const sourceCoins = allExploreCoins

  const dexscreenerAddresses = useMemo(() => {
    const uniq = new Set<string>()
    const MAX = 150 // hook chunks requests; keep it bounded for perf
    for (const c of allExploreCoins) {
      const addr = c.address ? String(c.address) : ''
      if (!addr || !isAddress(addr)) continue
      uniq.add(addr.toLowerCase())
      if (uniq.size >= MAX) break
    }
    return Array.from(uniq)
  }, [allExploreCoins])

  const { data: dexBatch } = useDexscreenerTokenStatsBatch({
    addresses: dexscreenerAddresses,
    chainId: 'base',
    enabled: dexscreenerAddresses.length > 0,
  })

  const dexMap = dexBatch?.results ?? null

  const analyticsMax = useMemo(() => {
    let maxVolume24h = 0
    let maxMarketCap = 0
    for (const c of sourceCoins) {
      const addr = c.address ? String(c.address) : ''
      const addrLc = addr && isAddress(addr) ? addr.toLowerCase() : ''
      const dex = addrLc ? (dexMap?.[addrLc] ?? null) : null
      const v = volumeForTimeframe(c, timeframe, dex).volume
      if (Number.isFinite(v)) maxVolume24h = Math.max(maxVolume24h, v)
      const m =
        c.marketCap && Number.isFinite(Number(c.marketCap))
          ? Number(c.marketCap)
          : typeof dex?.marketCapUsd === 'number' && Number.isFinite(dex.marketCapUsd)
            ? dex.marketCapUsd
            : NaN
      if (Number.isFinite(m)) maxMarketCap = Math.max(maxMarketCap, m)
    }
    return { maxVolume24h, maxMarketCap }
  }, [dexMap, sourceCoins, timeframe])

  const tableCoins = useMemo(() => {
    const filtered = sourceCoins.filter((c) => coinMatchesTypeFilter(c, typeFilter))
    const sortValue = (coin: ZoraCoin) => {
      const num = (val?: string) => {
        const parsed = val ? Number(val) : NaN
        return Number.isFinite(parsed) ? parsed : -Infinity
      }
      const addr = coin.address ? String(coin.address) : ''
      const addrLc = addr && isAddress(addr) ? addr.toLowerCase() : ''
      const dex = addrLc ? (dexMap?.[addrLc] ?? null) : null
      switch (sortKey) {
        case 'MARKET_CAP': {
          const z = num(coin.marketCap)
          if (Number.isFinite(z)) return z
          const m = typeof dex?.marketCapUsd === 'number' && Number.isFinite(dex.marketCapUsd) ? dex.marketCapUsd : NaN
          return Number.isFinite(m) ? m : -Infinity
        }
        case 'VOLUME': {
          const v = volumeForTimeframe(coin, timeframe, dex).volume
          return Number.isFinite(v) ? v : -Infinity
        }
        case 'CHANGE_24H': {
          const ch = typeof dex?.change24h === 'number' ? dex.change24h : NaN
          return Number.isFinite(ch) ? ch : NaN
        }
        default:
          return -Infinity
      }
    }

    return [...filtered].sort((a, b) => {
      const av = sortValue(a)
      const bv = sortValue(b)
      if (!Number.isFinite(av) && !Number.isFinite(bv)) return 0
      if (!Number.isFinite(av)) return 1
      if (!Number.isFinite(bv)) return -1
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [dexMap, sortDir, sortKey, sourceCoins, timeframe, typeFilter])

  const debankCreatorAddresses = useMemo(() => {
    const out: string[] = []
    const seen = new Set<string>()
    const MAX = 120 // enough to cover most rows; client chunks to 20 per request

    for (const c of tableCoins) {
      const raw = c.creatorAddress ? String(c.creatorAddress) : ''
      if (!raw || !isAddress(raw)) continue
      const lc = raw.toLowerCase()
      if (seen.has(lc)) continue
      seen.add(lc)
      out.push(lc)
      if (out.length >= MAX) break
    }

    return out
  }, [tableCoins])

  const { data: debankBatch, isFetching: debankFetching } = useDebankTotalBalanceBatch({
    addresses: debankCreatorAddresses,
    enabled: showScore,
  })
  const debankMap = debankBatch?.results ?? null
  const debankLoading = showScore && debankCreatorAddresses.length > 0 && debankFetching && debankBatch === undefined
  const debankUnavailable = showScore && debankCreatorAddresses.length > 0 && !debankFetching && debankBatch === null

  const trendingLoading =
    allExploreCoins.length === 0 &&
    (creatorsLoading || gainersLoading || volumeLoading || valuableLoading || newLoading || tradedLoading)
  const trendingError =
    allExploreCoins.length === 0 && (gainersError || volumeError || valuableError || newError || tradedError)

  const anyLoading = trendingLoading
  const anyError = trendingError

  return (
    <div className="relative">
      {/* Particle atmosphere */}
      <div className="particles">
        <div className="absolute top-1/4 left-1/3 w-px h-px bg-purple-500 rounded-full" style={{ animation: 'particle-float 8s ease-in-out infinite' }} />
        <div className="absolute top-1/2 right-1/4 w-px h-px bg-cyan-500 rounded-full" style={{ animation: 'particle-float 10s ease-in-out infinite', animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <span className="label">Vault Marketplace</span>
            <h1 className="headline text-7xl lg:text-8xl leading-[1.05]">
              Creator Vaults
            </h1>
            <p className="text-zinc-500 text-xl font-light max-w-2xl">
              Deposit creator coins · Earn yield · Grow together
            </p>
          </motion.div>
        </div>
      </section>

      {/* Vaults */}
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16"
          >
            <span className="label">Available Now</span>
            <h2 className="headline text-5xl mt-6">Active Vaults</h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {vaults.map((vault) => (
              <LiquidGoldVaultCard key={vault.id} vault={vault} />
            ))}
          </div>
        </div>
      </section>

      {/* Zora Coins */}
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-12"
          >
            <span className="label">Zora Coins</span>
            <h2 className="headline text-5xl mt-6">Market</h2>
            <p className="text-zinc-600 text-sm font-light mt-4 max-w-2xl">
              <>
                Explore what’s moving. Vaults are <span className="text-zinc-400">Creator Coin</span>–only, and only the creator wallet can deploy.
              </>
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Link to="/creator/earnings" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                {viewerAddress ? 'View your creator earnings' : 'View creator earnings'}
              </Link>

              <button
                type="button"
                onClick={() => setShowAnalytics((v) => !v)}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                {showAnalytics ? 'Hide analytics' : 'Show analytics'}
              </button>

              <button
                type="button"
                onClick={() => setShowScore((v) => !v)}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                title="Shows a beta score derived from the creator wallet’s portfolio value (USD)."
              >
                {showScore ? 'Hide score' : 'Show score'}
              </button>

              {showScore && debankCreatorAddresses.length > 0 ? (
                debankLoading ? (
                  <div className="text-xs text-zinc-700">Loading net worth…</div>
                ) : debankUnavailable ? (
                  <div className="text-xs text-zinc-700">Net worth is temporarily unavailable.</div>
                ) : null
              ) : null}

              {showAnalytics ? (
                <a
                  href="https://docs.zora.co/coins/contracts/rewards"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors"
                  title="Assumes v2.2+ 1% pool fee; creator share shown is 50% of total fees."
                >
                  (fee assumptions)
                </a>
              ) : null}
            </div>
          </motion.div>

          <div className="card p-0 overflow-hidden">
            <div className="p-6 border-b border-zinc-900/50 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="label">
                  Zora Coins (Base)
                </div>
                <div className="text-sm text-zinc-600">
                  See what’s moving right now. Sort by market cap, volume, or 24h change.
                </div>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <CoinTypeFilterPills value={typeFilter} onChange={setTypeFilter} />
                <div className="flex-none inline-flex items-center gap-0.5 rounded-full border border-zinc-900/70 bg-black/30 p-0.5 backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={() => setTimeframe('24H')}
                      aria-pressed={timeframe === '24H'}
                      className={`h-8 px-3 rounded-full text-[10px] uppercase tracking-[0.18em] transition-colors ${
                        timeframe === '24H'
                          ? 'bg-zinc-900 text-zinc-100'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      24h
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeframe('TOTAL')}
                      aria-pressed={timeframe === 'TOTAL'}
                      className={`h-8 px-3 rounded-full text-[10px] uppercase tracking-[0.18em] transition-colors ${
                        timeframe === 'TOTAL'
                          ? 'bg-zinc-900 text-zinc-100'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      All-time
                    </button>
                  </div>

                <div className="flex-none inline-flex items-center rounded-full border border-zinc-900/70 bg-black/30 backdrop-blur-sm overflow-hidden">
                  <div className="relative">
                    <select
                      value={sortKey}
                      onChange={(e) => {
                        const key = e.target.value as SortKey
                        setSortKey(key)
                        setSortDir('desc')
                      }}
                      className="h-9 appearance-none bg-transparent pl-3 pr-8 text-xs text-zinc-200 focus:outline-none"
                      aria-label="Sort coins"
                    >
                      <option value="MARKET_CAP">Market cap</option>
                      <option value="CHANGE_24H">24h change</option>
                      <option value="VOLUME">Volume ({timeframeLabel(timeframe)})</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-500 text-[10px]">
                      ▾
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                    className="h-9 w-9 border-l border-zinc-900/70 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors flex items-center justify-center"
                    title="Toggle sort direction"
                    aria-label="Toggle sort direction"
                  >
                    {sortDir === 'desc' ? '↓' : '↑'}
                  </button>
                </div>

                <div className="flex-none h-9 px-3 rounded-full border border-zinc-900/70 bg-black/30 backdrop-blur-sm text-xs text-zinc-600 font-mono tabular-nums flex items-center">
                  {tableCoins.length} coins
                </div>

                <button
                  type="button"
                  onClick={() => void handleRefresh()}
                  disabled={isRefreshing}
                  className="flex-none h-9 w-9 rounded-full border border-zinc-900/70 bg-black/30 backdrop-blur-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors disabled:opacity-50 disabled:hover:text-zinc-500 disabled:hover:border-zinc-900/70 flex items-center justify-center"
                  title="Refresh"
                  aria-label="Refresh"
                >
                  <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            {anyLoading ? (
              <div className="p-6 text-sm text-zinc-600">Loading…</div>
            ) : anyError ? (
              <div className="p-6 text-sm text-zinc-600">
                Coin data is temporarily unavailable. Please try again.
              </div>
            ) : tableCoins.length > 0 ? (
              <div>
                <div className="px-6 py-3 border-b border-zinc-900/50 bg-black/10">
                  <div className="grid grid-cols-12 items-center gap-4 text-[10px] text-zinc-600 uppercase tracking-[0.18em]">
                    <div className="col-span-7 sm:col-span-4 lg:col-span-3">Coin</div>
                    <div className="col-span-5 sm:hidden text-right">
                      {(() => {
                        switch (sortKey) {
                          case 'MARKET_CAP':
                            return 'Mcap'
                          case 'CHANGE_24H':
                            return '24h'
                          case 'VOLUME':
                            return `Vol ${timeframeLabel(timeframe)}`
                          default:
                            return 'Mcap'
                        }
                      })()}
                      <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
                    </div>

                    <div className="hidden lg:block lg:col-span-1 text-right" title="Days since coin launch">
                      Age
                    </div>

                    {showScore ? (
                      <div
                        className="hidden sm:block sm:col-span-2 lg:col-span-1 text-right"
                        title="Portfolio value (USD)"
                      >
                        Net worth
                      </div>
                    ) : null}

                    <div className="hidden lg:block lg:col-span-1 text-right">1h</div>

                    <div className="hidden lg:block lg:col-span-1 text-right">6h</div>

                    <button
                      type="button"
                      onClick={() => {
                        if (sortKey === 'CHANGE_24H') setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
                        else {
                          setSortKey('CHANGE_24H')
                          setSortDir('desc')
                        }
                      }}
                      className={`hidden sm:block sm:col-span-2 lg:col-span-1 text-right hover:text-zinc-300 transition-colors ${
                        sortKey === 'CHANGE_24H' ? 'text-zinc-300' : ''
                      }`}
                      title="24h price change"
                    >
                      24h{sortKey === 'CHANGE_24H' ? ` ${sortDir === 'desc' ? '↓' : '↑'}` : ''}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (sortKey === 'VOLUME') setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
                        else {
                          setSortKey('VOLUME')
                          setSortDir('desc')
                        }
                      }}
                      className={`hidden sm:block sm:col-span-2 lg:col-span-1 text-right hover:text-zinc-300 transition-colors ${
                        sortKey === 'VOLUME' ? 'text-zinc-300' : ''
                      }`}
                    >
                      Vol {timeframeLabel(timeframe)}{sortKey === 'VOLUME' ? ` ${sortDir === 'desc' ? '↓' : '↑'}` : ''}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (sortKey === 'MARKET_CAP') setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
                        else {
                          setSortKey('MARKET_CAP')
                          setSortDir('desc')
                        }
                      }}
                      className={`hidden sm:block ${showScore ? 'sm:col-span-2 lg:col-span-4' : 'sm:col-span-4 lg:col-span-5'} text-right hover:text-zinc-300 transition-colors ${
                        sortKey === 'MARKET_CAP' ? 'text-zinc-300' : ''
                      }`}
                    >
                      Mcap{sortKey === 'MARKET_CAP' ? ` ${sortDir === 'desc' ? '↓' : '↑'}` : ''}
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-zinc-900/60">
                  {tableCoins.map((coin) => {
                    const addr = coin.address ? String(coin.address) : ''
                    const addrLc = addr && isAddress(addr) ? addr.toLowerCase() : ''
                    const dex = addrLc ? (dexMap?.[addrLc] ?? null) : null
                    const creatorAddr = coin.creatorAddress ? String(coin.creatorAddress) : ''
                    const creatorAddrLc = creatorAddr && isAddress(creatorAddr) ? creatorAddr.toLowerCase() : ''
                    const debank = showScore && creatorAddrLc ? (debankMap?.[creatorAddrLc] ?? null) : null
                    const creatorNetWorthUsd = debank?.totalUsdValue ?? null
                    return (
                      <ZoraCoinRow
                        key={coin.address ?? coin.id}
                        coin={coin}
                        sortKey={sortKey}
                        timeframe={timeframe}
                        dex={dex}
                        showScore={showScore}
                        creatorNetWorthUsd={creatorNetWorthUsd}
                        netWorthLoading={debankLoading && Boolean(creatorAddrLc) && !debank}
                        analytics={showAnalytics ? analyticsMax : null}
                      />
                    )
                  })}
                </div>

                {lastTradedPageInfo?.hasNextPage && lastTradedPageInfo?.endCursor ? (
                  <div className="px-6 py-4 border-t border-zinc-900/50 flex items-center justify-between gap-4">
                    <div className="text-xs text-zinc-700">
                      Showing <span className="text-zinc-400">{tableCoins.length}</span> coins (Base)
                    </div>
                    <button
                      type="button"
                      onClick={() => setLastTradedAfter(lastTradedPageInfo.endCursor)}
                      disabled={tradedFetching}
                      className="px-4 py-2 rounded-full border border-zinc-900/60 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors disabled:opacity-50 disabled:hover:text-zinc-500 disabled:hover:border-zinc-900/60"
                    >
                      {tradedFetching ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="p-6 text-sm text-zinc-600">No matches for this filter.</div>
            )}
          </div>
        </div>
      </section>

    </div>
  )
}
