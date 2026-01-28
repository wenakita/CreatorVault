import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, ArrowLeft, Copy, Check, Share2, Globe, Twitter, Users, Coins, TrendingUp, Calendar } from 'lucide-react'
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

// Farcaster icon component
function FarcasterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.24 0.24H5.76C2.5764 0.24 0 2.8164 0 6V18C0 21.1836 2.5764 23.76 5.76 23.76H18.24C21.4236 23.76 24 21.1836 24 18V6C24 2.8164 21.4236 0.24 18.24 0.24ZM19.0736 18.2364H17.2764V10.5552L12 15.8316L6.7236 10.5552V18.2364H4.9264V6.7636H6.7236L12 12.04L17.2764 6.7636H19.0736V18.2364Z" />
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
      name: 'Twitter',
      url: `https://twitter.com/${twitter.username}`,
      icon: <Twitter className="w-4 h-4" />,
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
      icon: <Globe className="w-4 h-4" />,
      handle: `@${instagram.username}`,
      followers: instagram.followerCount,
    },
    tiktok?.username && {
      name: 'TikTok',
      url: `https://tiktok.com/@${tiktok.username}`,
      icon: <Globe className="w-4 h-4" />,
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
                  href={`https://dexscreener.com/base/${tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-zinc-300" />
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
