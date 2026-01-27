import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, ArrowLeft, Copy, Check, TrendingUp, TrendingDown, Activity, Layers, Image } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getAddress, isAddress } from 'viem'
import { useQuery } from '@tanstack/react-query'

import { TokenSparkline } from '@/components/explore/TokenSparkline'
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

function formatNumber(value: string | number | undefined, prefix = ''): string {
  if (!value) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '-'
  if (num >= 1_000_000_000) return `${prefix}${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000) return `${prefix}${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `${prefix}${(num / 1_000).toFixed(2)}K`
  return `${prefix}${num.toFixed(2)}`
}

function formatChange(delta: string | undefined): { value: string; positive: boolean; num: number } {
  if (!delta) return { value: '-', positive: true, num: 0 }
  const num = parseFloat(delta)
  if (isNaN(num)) return { value: '-', positive: true, num: 0 }
  const positive = num >= 0
  const absNum = Math.abs(num)
  const formatted = absNum >= 1000 ? `${(absNum / 100).toFixed(0)}x` : `${absNum.toFixed(2)}%`
  return { value: positive ? `+${formatted}` : `-${formatted}`, positive, num }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const state = { copied: false, setCopied: (v: boolean) => { state.copied = v } }
    return [() => state.copied, (v: boolean) => {
      state.copied = v
      if (timer) clearTimeout(timer)
      if (v) timer = setTimeout(() => { state.copied = false }, 2000)
    }] as const
  }, [])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-zinc-500 hover:text-white transition-colors"
      title="Copy address"
    >
      {copied() ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </button>
  )
}

function StatCard({ label, value, subValue, icon: Icon }: { label: string; value: string; subValue?: string; icon?: typeof TrendingUp }) {
  return (
    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="w-4 h-4 text-zinc-500" />}
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-medium text-white">{value}</div>
      {subValue && <div className="text-xs text-zinc-500 mt-1">{subValue}</div>}
    </div>
  )
}

export function ExploreContentDetail() {
  const params = useParams()
  const chain = String(params.chain ?? '').trim()
  const contentCoinAddressRaw = String(params.contentCoinAddress ?? '').trim()

  const contentCoinAddress = isAddress(contentCoinAddressRaw) ? getAddress(contentCoinAddressRaw) : null

  const { data: coin, isLoading } = useQuery({
    queryKey: ['coin', contentCoinAddress],
    queryFn: async () => {
      if (!contentCoinAddress) return null
      return fetchZoraCoin(contentCoinAddress as `0x${string}`, 8453)
    },
    enabled: !!contentCoinAddress,
    staleTime: 30_000,
  })

  if (!chain || !isSupportedChain(chain)) {
    return <Navigate replace to="/explore/content" />
  }

  if (!contentCoinAddress) {
    return <Navigate replace to="/explore/content" />
  }

  const mediaUrl = coin?.mediaContent?.previewImage?.medium || coin?.mediaContent?.originalUri
  const name = coin?.name || 'Loading...'
  const symbol = coin?.symbol || '...'
  const price = formatPrice(coin?.tokenPrice?.priceInUsdc)
  const change = formatChange(coin?.marketCapDelta24h)
  const tvl = formatNumber(coin?.marketCap, '$')
  const volume24h = formatNumber(coin?.volume24h, '$')
  const totalVolume = formatNumber(coin?.totalVolume, '$')
  const creatorHandle = coin?.creatorProfile?.handle

  // Generate sparkline data
  const sparklineData = useMemo(() => {
    const changeVal = parseFloat(coin?.marketCapDelta24h || '0') / 100
    const positive = changeVal >= 0
    const baseValue = 100
    return Array.from({ length: 48 }, (_, i) => {
      const progress = i / 47
      const noise = (Math.random() - 0.5) * 8
      return Math.max(0, positive
        ? baseValue + progress * Math.abs(changeVal) * baseValue + noise
        : baseValue - progress * Math.abs(changeVal) * baseValue + noise
      )
    })
  }, [coin?.marketCapDelta24h])

  return (
    <div className="relative pb-24 md:pb-0 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Back navigation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <Link
            to="/explore/content"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to content
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Content preview */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-1"
          >
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              {mediaUrl ? (
                <img src={mediaUrl} alt={name} className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square bg-zinc-800 flex items-center justify-center">
                  <Image className="w-16 h-16 text-zinc-600" />
                </div>
              )}
              <div className="p-4">
                <h2 className="text-lg font-medium text-white truncate">{name}</h2>
                {creatorHandle && (
                  <p className="text-sm text-zinc-400 mt-1">by @{creatorHandle}</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Right column - Stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* Price header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-zinc-500 font-mono">{contentCoinAddress.slice(0, 10)}...{contentCoinAddress.slice(-8)}</span>
                  <CopyButton text={contentCoinAddress} />
                </div>
                <h1 className="text-2xl sm:text-3xl font-medium text-white flex items-center gap-3">
                  {symbol}
                  <span className="px-2 py-1 text-xs bg-zinc-800 rounded-full text-zinc-400">Content Coin</span>
                </h1>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-3xl font-medium text-white tabular-nums">
                  {isLoading ? (
                    <div className="h-10 w-32 bg-zinc-800 rounded animate-pulse" />
                  ) : (
                    price
                  )}
                </div>
                <div className={`text-lg mt-1 ${change.positive ? 'text-green-500' : 'text-red-500'}`}>
                  {isLoading ? (
                    <div className="h-6 w-20 bg-zinc-800 rounded animate-pulse mt-2" />
                  ) : (
                    <span className="flex items-center gap-1 justify-start sm:justify-end">
                      {change.positive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                      {change.value} (24h)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm text-zinc-400">Price History (24h)</h2>
                <div className="flex items-center gap-2">
                  {['1H', '1D', '1W', '1M', '1Y'].map((period) => (
                    <button
                      key={period}
                      type="button"
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        period === '1D' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-32 flex items-center justify-center">
                {isLoading ? (
                  <div className="h-full w-full bg-zinc-800/50 rounded animate-pulse" />
                ) : (
                  <TokenSparkline
                    data={sparklineData}
                    positive={change.positive}
                    width={600}
                    height={120}
                    strokeWidth={2}
                  />
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard label="TVL" value={tvl} icon={Layers} />
              <StatCard label="24h Volume" value={volume24h} icon={Activity} />
              <StatCard label="Total Volume" value={totalVolume} icon={TrendingUp} />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Link
                to="/swap"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-brand-primary text-white font-medium text-sm hover:bg-brand-hover transition-colors"
              >
                Trade
              </Link>
              <Link
                to={`/explore/content/base/${contentCoinAddress}/transactions`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-zinc-700 text-zinc-300 font-medium text-sm hover:bg-zinc-800 transition-colors"
              >
                View Transactions
              </Link>
              <a
                href={`https://basescan.org/address/${contentCoinAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-zinc-700 text-zinc-300 font-medium text-sm hover:bg-zinc-800 transition-colors"
              >
                Basescan <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href={`https://zora.co/coin/base:${contentCoinAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-zinc-700 text-zinc-300 font-medium text-sm hover:bg-zinc-800 transition-colors"
              >
                Zora <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        </div>

        {/* Description */}
        {coin?.description && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
          >
            <h2 className="text-sm text-zinc-400 mb-3">About</h2>
            <p className="text-sm text-zinc-300 leading-relaxed">{coin.description}</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
