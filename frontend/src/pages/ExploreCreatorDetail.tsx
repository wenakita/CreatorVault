import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, ArrowLeft, Copy, Check, Share2, Globe } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getAddress, isAddress } from 'viem'
import { useQuery } from '@tanstack/react-query'

import { fetchZoraCoin } from '@/lib/zora/client'

function isSupportedChain(chain: string): boolean {
  return chain.toLowerCase() === 'base'
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

function formatNumber(value: string | number | undefined): string {
  if (!value) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  return `$${num.toFixed(2)}`
}

function formatChange(delta: string | undefined): { value: string; positive: boolean } {
  if (!delta) return { value: '0.00%', positive: true }
  const num = parseFloat(delta)
  if (isNaN(num)) return { value: '0.00%', positive: true }
  const positive = num >= 0
  const absNum = Math.abs(num)
  return { value: `${absNum.toFixed(2)}%`, positive }
}

const TIME_PERIODS = ['1H', '1D', '1W', '1M', '1Y'] as const

function PriceChart({ data, positive }: { data: number[]; positive: boolean }) {
  const width = 600
  const height = 300
  const padding = { top: 20, right: 20, bottom: 20, left: 20 }
  
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const pathD = useMemo(() => {
    if (!data || data.length < 2) return ''
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const points = data.map((value, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth
      const y = padding.top + chartHeight - ((value - min) / range) * chartHeight
      return `${x},${y}`
    })

    return `M${points.join(' L')}`
  }, [data, chartWidth, chartHeight])

  const areaD = useMemo(() => {
    if (!pathD) return ''
    const firstX = padding.left
    const lastX = padding.left + chartWidth
    const bottomY = padding.top + chartHeight
    return `${pathD} L${lastX},${bottomY} L${firstX},${bottomY} Z`
  }, [pathD, chartWidth, chartHeight])

  const strokeColor = positive ? '#22c55e' : '#ef4444'
  const gradientId = `chart-gradient-${positive ? 'up' : 'down'}`

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.15" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {areaD && <path d={areaD} fill={`url(#${gradientId})`} />}
      {pathD && (
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`text-zinc-400 hover:text-white transition-colors ${className}`}
      title="Copy address"
    >
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </button>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="text-sm text-white font-medium">{value}</span>
    </div>
  )
}

export function ExploreCreatorDetail() {
  const params = useParams()
  const chain = String(params.chain ?? '').trim()
  const tokenAddressRaw = String(params.tokenAddress ?? '').trim()
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1D')

  const tokenAddress = isAddress(tokenAddressRaw) ? getAddress(tokenAddressRaw) : null

  const { data: coin, isLoading } = useQuery({
    queryKey: ['coin', tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) return null
      return fetchZoraCoin(tokenAddress as `0x${string}`, 8453)
    },
    enabled: !!tokenAddress,
    staleTime: 30_000,
  })

  // Generate chart data based on price change
  const chartData = useMemo(() => {
    const changeVal = parseFloat(coin?.marketCapDelta24h || '0') / 100
    const positive = changeVal >= 0
    const baseValue = 100
    const points = 100
    
    return Array.from({ length: points }, (_, i) => {
      const progress = i / (points - 1)
      const noise = (Math.random() - 0.5) * 5
      return Math.max(0, positive
        ? baseValue + progress * Math.abs(changeVal) * baseValue * 0.5 + noise
        : baseValue - progress * Math.abs(changeVal) * baseValue * 0.5 + noise
      )
    })
  }, [coin?.marketCapDelta24h])

  if (!chain || !isSupportedChain(chain)) {
    return <Navigate replace to="/explore/creators" />
  }

  if (!tokenAddress) {
    return <Navigate replace to="/explore/creators" />
  }

  const avatarUrl = coin?.mediaContent?.previewImage?.medium || coin?.creatorProfile?.avatar?.previewImage?.medium
  const name = coin?.name || 'Loading...'
  const symbol = coin?.symbol || '...'
  const price = formatPrice(coin?.tokenPrice?.priceInUsdc)
  const change = formatChange(coin?.marketCapDelta24h)
  const marketCap = formatNumber(coin?.marketCap)
  const volume24h = formatNumber(coin?.volume24h)
  const totalVolume = formatNumber(coin?.totalVolume)
  const holders = coin?.uniqueHolders ? coin.uniqueHolders.toLocaleString() : '-'

  return (
    <div className="relative min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Back navigation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4"
        >
          <Link
            to="/explore/creators"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Creators
          </Link>
        </motion.div>

        {/* Main content - Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Left Column - Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Price Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center">
                    <span className="text-xs font-medium text-zinc-300">{symbol.slice(0, 2)}</span>
                  </div>
                )}
                <span className="text-zinc-400 text-lg">{name}</span>
                <span className="text-zinc-600 text-lg">{symbol}</span>
              </div>
              
              <div className="flex items-baseline gap-3">
                {isLoading ? (
                  <div className="h-12 w-40 bg-zinc-800 rounded animate-pulse" />
                ) : (
                  <>
                    <span className="text-5xl font-medium text-white tabular-nums">{price}</span>
                    <span className={`text-lg font-medium ${change.positive ? 'text-green-500' : 'text-red-500'}`}>
                      {change.positive ? '+' : '-'}{change.value}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Chart */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
              {/* Time period selector */}
              <div className="flex items-center gap-1 p-4 border-b border-zinc-800">
                {TIME_PERIODS.map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setSelectedPeriod(period)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedPeriod === period
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>

              {/* Chart area */}
              <div className="h-[350px] p-4">
                {isLoading ? (
                  <div className="h-full w-full bg-zinc-800/30 rounded animate-pulse" />
                ) : (
                  <PriceChart data={chartData} positive={change.positive} />
                )}
              </div>
            </div>

            {/* Description - Below chart on desktop */}
            {coin?.description && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6"
              >
                <h3 className="text-sm font-medium text-zinc-400 mb-3">About {name}</h3>
                <p className="text-sm text-zinc-300 leading-relaxed">{coin.description}</p>
              </motion.div>
            )}
          </motion.div>

          {/* Right Column - Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-4"
          >
            {/* Swap Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center">
                      <span className="text-sm font-medium text-zinc-300">{symbol.slice(0, 2)}</span>
                    </div>
                  )}
                  <div>
                    <div className="text-white font-medium">{name}</div>
                    <div className="text-xs text-zinc-500">{symbol}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CopyButton text={tokenAddress} />
                  <button
                    type="button"
                    className="text-zinc-400 hover:text-white transition-colors"
                    title="Share"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <Link
                to={`/swap?token=${tokenAddress}`}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[#FF007A] hover:bg-[#FF007A]/90 text-white font-semibold text-base transition-colors"
              >
                Swap
              </Link>
            </div>

            {/* Stats Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Stats</h3>
              <StatRow label="Market cap" value={marketCap} />
              <StatRow label="24H volume" value={volume24h} />
              <StatRow label="All-time volume" value={totalVolume} />
              <StatRow label="Holders" value={holders} />
            </div>

            {/* Links Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Links</h3>
              <div className="space-y-2">
                <a
                  href={`https://zora.co/coin/base:${tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                      <Globe className="w-4 h-4 text-zinc-300" />
                    </div>
                    <span className="text-sm text-white">Zora</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                </a>
                
                <a
                  href={`https://basescan.org/token/${tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                      <img src="https://basescan.org/images/favicon.ico" alt="Basescan" className="w-4 h-4" />
                    </div>
                    <span className="text-sm text-white">Basescan</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                </a>
              </div>
            </div>

            {/* Contract Info */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-1">Contract address</h3>
                  <span className="text-xs text-zinc-500 font-mono">
                    {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
                  </span>
                </div>
                <CopyButton text={tokenAddress} className="p-2 rounded-lg hover:bg-zinc-800" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
