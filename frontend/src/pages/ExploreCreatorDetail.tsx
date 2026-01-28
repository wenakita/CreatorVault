import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, ArrowLeft, Copy, Check, Share2, Globe, Users, Coins, TrendingUp, Calendar } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getAddress, isAddress } from 'viem'
import { useQuery } from '@tanstack/react-query'

import { fetchZoraCoin } from '@/lib/zora/client'
import { useZoraProfile, useZoraProfileCoins } from '@/lib/zora/hooks'
import type { ZoraCoin, ZoraProfile } from '@/lib/zora/types'

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

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-'
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '-'
  }
}

function shortAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

// Dexscreener Chart Embed Component
function DexscreenerChart({ pairAddress, tokenAddress }: { pairAddress?: string; tokenAddress: string }) {
  // Dexscreener embeds work with pair addresses, but we can use token address as fallback
  const embedUrl = pairAddress 
    ? `https://dexscreener.com/base/${pairAddress}?embed=1&theme=dark&trades=0&info=0`
    : `https://dexscreener.com/base/${tokenAddress}?embed=1&theme=dark&trades=0&info=0`

  return (
    <div className="w-full h-[400px] rounded-xl overflow-hidden bg-zinc-900/50">
      <iframe
        src={embedUrl}
        title="Price Chart"
        className="w-full h-full border-0"
        loading="lazy"
        allow="clipboard-write"
      />
    </div>
  )
}

// ============================================================================
// OFFICIAL BRAND ICONS
// Social icons from Simple Icons (https://simpleicons.org) - MIT licensed
// Web3 platform logos use official favicon URLs
// ============================================================================

// X (Twitter) - Simple Icons: https://simpleicons.org/icons/x.svg
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  )
}

// Farcaster - Simple Icons: https://simpleicons.org/icons/farcaster.svg
function FarcasterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.24.24H5.76A5.76 5.76 0 0 0 0 6v12a5.76 5.76 0 0 0 5.76 5.76h12.48A5.76 5.76 0 0 0 24 18V6A5.76 5.76 0 0 0 18.24.24zm1.28 17.52h-1.84V12.6l-5.68 6.2-5.68-6.2v5.16H4.48V6.24h1.84l5.68 6.2 5.68-6.2h1.84v11.52z" />
    </svg>
  )
}

// Instagram - Simple Icons: https://simpleicons.org/icons/instagram.svg
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" />
    </svg>
  )
}

// TikTok - Simple Icons: https://simpleicons.org/icons/tiktok.svg
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
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

function StatRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <span className="text-sm text-zinc-400 flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="text-sm text-white font-medium">{value}</span>
    </div>
  )
}

// Content Coin Row Component
function ContentCoinRow({ coin, rank }: { coin: ZoraCoin; rank: number }) {
  const avatarUrl = coin.mediaContent?.previewImage?.small
  const name = coin.name || coin.symbol || 'Untitled'
  const symbol = coin.symbol || '???'
  const price = formatPrice(coin.tokenPrice?.priceInUsdc)
  const marketCap = formatNumber(coin.marketCap)
  const change = formatChange(coin.marketCapDelta24h)
  const address = coin.address || ''

  return (
    <Link
      to={`/explore/content/base/${address}`}
      className="flex items-center gap-4 p-4 hover:bg-zinc-800/50 transition-colors rounded-xl"
    >
      <span className="text-xs text-zinc-600 w-6 text-center">{rank}</span>
      
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-10 h-10 rounded-lg object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
          <Coins className="w-5 h-5 text-zinc-500" />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="text-white font-medium truncate">{name}</div>
        <div className="text-xs text-zinc-500">{symbol}</div>
      </div>
      
      <div className="text-right">
        <div className="text-sm text-white">{price}</div>
        <div className={`text-xs ${change.positive ? 'text-green-500' : 'text-red-500'}`}>
          {change.positive ? '+' : '-'}{change.value}
        </div>
      </div>
      
      <div className="text-right hidden sm:block">
        <div className="text-xs text-zinc-500">MCap</div>
        <div className="text-sm text-white">{marketCap}</div>
      </div>
    </Link>
  )
}

// Social Links Component
function SocialLinks({ profile }: { profile: ZoraProfile | null }) {
  if (!profile?.socialAccounts) return null

  const { twitter, farcaster, instagram, tiktok } = profile.socialAccounts

  const links = [
    twitter?.username && {
      name: 'X',
      url: `https://x.com/${twitter.username}`,
      icon: <XIcon className="w-4 h-4" />,
      handle: `@${twitter.username}`,
      followers: twitter.followerCount,
    },
    farcaster?.username && {
      name: 'Farcaster',
      url: `https://warpcast.com/${farcaster.username}`,
      icon: <FarcasterIcon className="w-4 h-4" />,
      handle: `@${farcaster.username}`,
      followers: farcaster.followerCount,
    },
    instagram?.username && {
      name: 'Instagram',
      url: `https://instagram.com/${instagram.username}`,
      icon: <InstagramIcon className="w-4 h-4" />,
      handle: `@${instagram.username}`,
      followers: instagram.followerCount,
    },
    tiktok?.username && {
      name: 'TikTok',
      url: `https://tiktok.com/@${tiktok.username}`,
      icon: <TikTokIcon className="w-4 h-4" />,
      handle: `@${tiktok.username}`,
      followers: tiktok.followerCount,
    },
  ].filter(Boolean) as Array<{
    name: string
    url: string
    icon: React.ReactNode
    handle: string
    followers?: number
  }>

  if (links.length === 0) return null

  return (
    <div className="space-y-2">
      {links.map((link) => (
        <a
          key={link.name}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300">
              {link.icon}
            </div>
            <div>
              <span className="text-sm text-white">{link.handle}</span>
              {link.followers && (
                <div className="text-xs text-zinc-500">
                  {link.followers.toLocaleString()} followers
                </div>
              )}
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
        </a>
      ))}
    </div>
  )
}

export function ExploreCreatorDetail() {
  const params = useParams()
  const chain = String(params.chain ?? '').trim()
  const tokenAddressRaw = String(params.tokenAddress ?? '').trim()
  const [activeTab, setActiveTab] = useState<'chart' | 'coins'>('chart')

  const tokenAddress = isAddress(tokenAddressRaw) ? getAddress(tokenAddressRaw) : null

  // Fetch the main creator coin
  const { data: coin, isLoading } = useQuery({
    queryKey: ['coin', tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) return null
      return fetchZoraCoin(tokenAddress as `0x${string}`, 8453)
    },
    enabled: !!tokenAddress,
    staleTime: 30_000,
  })

  // Get creator address from the coin
  const creatorAddress = coin?.creatorAddress || coin?.payoutRecipientAddress

  // Fetch creator profile using their address or handle
  const profileIdentifier = coin?.creatorProfile?.handle || creatorAddress
  const { data: creatorProfile } = useZoraProfile(profileIdentifier ?? undefined)

  // Fetch all coins created by this creator (profileCoins)
  const { data: profileCoinsData, isLoading: profileCoinsLoading } = useZoraProfileCoins(
    profileIdentifier ?? undefined,
    { count: 50 }
  )

  // Extract created coins from profile data
  const createdCoins = useMemo(() => {
    const edges = (profileCoinsData as ZoraProfile | null)?.createdCoins?.edges ?? []
    return edges.map((e) => e.node).filter(Boolean) as ZoraCoin[]
  }, [profileCoinsData])

  // Separate content coins from creator coin
  const contentCoins = useMemo(() => {
    return createdCoins.filter((c) => c.coinType !== 'CREATOR')
  }, [createdCoins])

  if (!chain || !isSupportedChain(chain)) {
    return <Navigate replace to="/explore/creators" />
  }

  if (!tokenAddress) {
    return <Navigate replace to="/explore/creators" />
  }

  // Profile info
  const profile = creatorProfile || (profileCoinsData as ZoraProfile | null)
  const avatarUrl = profile?.avatar?.medium || profile?.avatar?.small || coin?.mediaContent?.previewImage?.medium || coin?.creatorProfile?.avatar?.previewImage?.medium
  const displayName = profile?.displayName || coin?.name || 'Creator'
  const handle = profile?.handle || coin?.creatorProfile?.handle
  const bio = profile?.bio
  const website = profile?.website
  const symbol = coin?.symbol || '...'
  const price = formatPrice(coin?.tokenPrice?.priceInUsdc)
  const change = formatChange(coin?.marketCapDelta24h)
  const marketCap = formatNumber(coin?.marketCap)
  const volume24h = formatNumber(coin?.volume24h)
  const totalVolume = formatNumber(coin?.totalVolume)
  const holders = coin?.uniqueHolders ? coin.uniqueHolders.toLocaleString() : '-'
  const createdAt = formatDate(coin?.createdAt)
  const totalCoinsCreated = createdCoins.length

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

        {/* Creator Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar & Name */}
            <div className="flex items-start gap-4">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-20 h-20 rounded-2xl object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center">
                  <span className="text-2xl font-medium text-zinc-300">{displayName.slice(0, 2).toUpperCase()}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-semibold text-white truncate">{displayName}</h1>
                {handle && (
                  <div className="text-zinc-400 text-sm">@{handle}</div>
                )}
                {bio && (
                  <p className="text-zinc-500 text-sm mt-2 line-clamp-2">{bio}</p>
                )}
                {website && (
                  <a
                    href={website.startsWith('http') ? website : `https://${website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 text-sm mt-1 inline-flex items-center gap-1"
                  >
                    <Globe className="w-3 h-3" />
                    {website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-6 sm:ml-auto">
              <div className="text-center">
                <div className="text-2xl font-semibold text-white">{price}</div>
                <div className="text-xs text-zinc-500">Coin Price</div>
                <div className={`text-xs ${change.positive ? 'text-green-500' : 'text-red-500'}`}>
                  {change.positive ? '+' : '-'}{change.value}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-white">{marketCap}</div>
                <div className="text-xs text-zinc-500">Market Cap</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-white">{holders}</div>
                <div className="text-xs text-zinc-500">Holders</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-white">{totalCoinsCreated}</div>
                <div className="text-xs text-zinc-500">Coins Created</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main content - Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Left Column - Chart & Content Coins */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('chart')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'chart'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Price Chart
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('coins')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'coins'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <Coins className="w-4 h-4 inline mr-2" />
                Content Coins ({contentCoins.length})
              </button>
            </div>

            {/* Chart Tab */}
            {activeTab === 'chart' && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
                <div className="p-4 border-b border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium">{displayName}</span>
                      <span className="text-zinc-500 ml-2">{symbol}</span>
                    </div>
                    <a
                      href={`https://dexscreener.com/base/${tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-zinc-500 hover:text-white flex items-center gap-1"
                    >
                      Open in Dexscreener
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                {isLoading ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <div className="h-8 w-8 border-2 border-zinc-700 border-t-cyan-500 rounded-full animate-spin" />
                  </div>
                ) : (
                  <DexscreenerChart tokenAddress={tokenAddress} />
                )}
              </div>
            )}

            {/* Content Coins Tab */}
            {activeTab === 'coins' && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
                <div className="p-4 border-b border-zinc-800">
                  <h3 className="text-white font-medium">Content Coins by {displayName}</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    All content coins created by this creator on Zora
                  </p>
                </div>
                
                {profileCoinsLoading ? (
                  <div className="p-8 flex items-center justify-center">
                    <div className="h-8 w-8 border-2 border-zinc-700 border-t-cyan-500 rounded-full animate-spin" />
                  </div>
                ) : contentCoins.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500">
                    No content coins found for this creator.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/50">
                    {contentCoins.map((contentCoin, index) => (
                      <ContentCoinRow 
                        key={contentCoin.address || contentCoin.id || index} 
                        coin={contentCoin} 
                        rank={index + 1} 
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {coin?.description && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6"
              >
                <h3 className="text-sm font-medium text-zinc-400 mb-3">About {displayName}</h3>
                <p className="text-sm text-zinc-300 leading-relaxed">{coin.description}</p>
              </motion.div>
            )}
          </motion.div>

          {/* Right Column - Info Cards */}
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
                    <img src={avatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center">
                      <span className="text-sm font-medium text-zinc-300">{symbol.slice(0, 2)}</span>
                    </div>
                  )}
                  <div>
                    <div className="text-white font-medium">{displayName}</div>
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
                Buy Creator Coin
              </Link>
            </div>

            {/* Social Links Card */}
            {profile && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Social</h3>
                <SocialLinks profile={profile} />
                {!profile.socialAccounts && (
                  <div className="text-sm text-zinc-600">No social accounts linked.</div>
                )}
              </div>
            )}

            {/* Stats Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Creator Coin Stats</h3>
              <StatRow label="Market cap" value={marketCap} icon={<TrendingUp className="w-3 h-3" />} />
              <StatRow label="24H volume" value={volume24h} icon={<TrendingUp className="w-3 h-3" />} />
              <StatRow label="All-time volume" value={totalVolume} icon={<TrendingUp className="w-3 h-3" />} />
              <StatRow label="Holders" value={holders} icon={<Users className="w-3 h-3" />} />
              <StatRow label="Created" value={createdAt} icon={<Calendar className="w-3 h-3" />} />
              <StatRow label="Content coins" value={String(contentCoins.length)} icon={<Coins className="w-3 h-3" />} />
            </div>

            {/* Links Card - Official logos from each platform */}
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
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center overflow-hidden">
                      {/* Zora official favicon: https://zora.co/favicon.svg */}
                      <img src="https://zora.co/favicon.svg" alt="Zora" className="w-5 h-5" />
                    </div>
                    <span className="text-sm text-white">Zora</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                </a>
                
                <a
                  href={`https://dexscreener.com/base/${tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center overflow-hidden">
                      {/* Dexscreener official favicon: https://dexscreener.com/favicon.png */}
                      <img src="https://dexscreener.com/favicon.png" alt="Dexscreener" className="w-5 h-5" />
                    </div>
                    <span className="text-sm text-white">Dexscreener</span>
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
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center overflow-hidden">
                      {/* Basescan official logo: https://basescan.org/images/svg/brands/main.svg */}
                      <img src="https://basescan.org/images/svg/brands/main.svg" alt="Basescan" className="w-5 h-5" />
                    </div>
                    <span className="text-sm text-white">Basescan</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                </a>
              </div>
            </div>

            {/* Contract Info */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-400 mb-1">Creator Coin</h3>
                    <span className="text-xs text-zinc-500 font-mono">
                      {shortAddress(tokenAddress)}
                    </span>
                  </div>
                  <CopyButton text={tokenAddress} className="p-2 rounded-lg hover:bg-zinc-800" />
                </div>
                
                {creatorAddress && (
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                    <div>
                      <h3 className="text-sm font-medium text-zinc-400 mb-1">Creator Wallet</h3>
                      <span className="text-xs text-zinc-500 font-mono">
                        {shortAddress(creatorAddress)}
                      </span>
                    </div>
                    <CopyButton text={creatorAddress} className="p-2 rounded-lg hover:bg-zinc-800" />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
