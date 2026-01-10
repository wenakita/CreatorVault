import { motion } from 'framer-motion'
import { useState, useEffect, type ElementType } from 'react'
import { ExternalLink, Twitter, Instagram, Youtube, Globe, CheckCircle } from 'lucide-react'
import type { Address } from 'viem'
import { getTalentPassport, type TalentPassport, type SocialAccount } from '@/lib/talent-api'

// TikTok icon (from lucide-react or custom)
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
  </svg>
)

// Farcaster icon
const FarcasterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M21.5 5.5v13h-2v-13h2zm-6 0v13h-2v-7h-3v7h-2v-13h2v5h3v-5h2zm-11 0v13h-2v-13h2z"/>
  </svg>
)

export interface CreatorSocials {
  twitter?: string
  instagram?: string
  tiktok?: string
  youtube?: string
  discord?: string
  telegram?: string
  website?: string
}

interface CreatorProfileCardProps {
  creatorAddress: Address
  creatorName: string
  creatorBio?: string
  creatorImage?: string
  socials?: CreatorSocials
  liveStreamUrl?: string // Zora or other platform
}

export function CreatorProfileCard({
  creatorAddress,
  creatorName,
  creatorBio,
  creatorImage,
  socials: _socials,
  liveStreamUrl: _liveStreamUrl,
}: CreatorProfileCardProps) {
  const [passport, setPassport] = useState<TalentPassport | null>(null)
  // Optional future sources:
  const [zoraProfile] = useState<any>(null)
  const [farcasterProfile] = useState<any>(null)
  const [twitterProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCreatorData() {
      setLoading(true)
      
      // Only fetch Talent Protocol data - keep it simple
      const talentData = await getTalentPassport(creatorAddress)
      setPassport(talentData)
      
      setLoading(false)
    }

    loadCreatorData()
  }, [creatorAddress])

  // Merge data from multiple sources: Props > Talent > Zora
  const displayName = creatorName || passport?.passport_profile?.name || zoraProfile?.name || 'Creator'
  const displayBio = creatorBio || passport?.passport_profile?.bio || zoraProfile?.description || ''
  const displayImage = creatorImage || passport?.passport_profile?.image_url || zoraProfile?.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${creatorAddress}`
  const isVerified = passport?.verified || false

  // Get social accounts with follower counts
  let socialAccounts: SocialAccount[] = passport?.social_accounts || []
  
  // Add real Twitter data if available from Twitter API
  if (twitterProfile && !loading) {
    const existingTwitter = socialAccounts.findIndex(s => s.platform === 'twitter' || s.platform === 'x')
    if (existingTwitter >= 0) {
      // Update existing entry with real follower count
      socialAccounts[existingTwitter] = {
        ...socialAccounts[existingTwitter],
        followers: twitterProfile.followers,
        verified: twitterProfile.verified,
        url: twitterProfile.url,
      }
    } else {
      // Add new entry
      socialAccounts.push({
        platform: 'twitter',
        username: twitterProfile.username,
        url: twitterProfile.url,
        followers: twitterProfile.followers,
        verified: twitterProfile.verified,
      })
    }
  }
  
  // Add real Farcaster data if available from Neynar API
  if (farcasterProfile && !loading) {
    const existingFarcaster = socialAccounts.findIndex(s => s.platform === 'farcaster')
    if (existingFarcaster >= 0) {
      // Update existing entry with real follower count
      socialAccounts[existingFarcaster] = {
        ...socialAccounts[existingFarcaster],
        followers: farcasterProfile.followers,
        url: `https://warpcast.com/${farcasterProfile.username}`,
      }
    } else {
      // Add new entry
      socialAccounts.push({
        platform: 'farcaster',
        username: farcasterProfile.username,
        url: `https://warpcast.com/${farcasterProfile.username}`,
        followers: farcasterProfile.followers,
        verified: false,
      })
    }
  }
  
  // Helper to format follower count
  const formatFollowers = (count?: number): string => {
    if (!count) return '0'
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count.toString()
  }
  
  // Get icon for each platform
  const getSocialIcon = (platform: string): ElementType => {
    switch (platform.toLowerCase()) {
      case 'twitter':
      case 'x':
        return Twitter
      case 'farcaster':
        return FarcasterIcon
      case 'tiktok':
        return TikTokIcon
      case 'instagram':
        return Instagram
      case 'youtube':
        return Youtube
      case 'github':
        return Globe // Using Globe as placeholder
      default:
        return Globe
    }
  }
  
  // Filter to show Twitter, Farcaster, TikTok
  const priorityPlatforms = ['twitter', 'x', 'farcaster', 'tiktok']
  const displaySocials = socialAccounts.filter(account => 
    priorityPlatforms.includes(account.platform.toLowerCase())
  )

  return (
    <div className="bg-gradient-to-br from-zinc-950/80 via-black/40 to-black/40 border border-zinc-800/50 rounded-xl overflow-hidden">
      <div className="p-6">
        {/* Creator Header */}
        <div className="flex items-start gap-4 mb-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="relative"
          >
            <img
              src={displayImage}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover border-2 border-cyan-500/30"
            />
            {isVerified && (
              <div className="absolute -bottom-1 -right-1 bg-cyan-500 rounded-full p-1">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            )}
          </motion.div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="headline text-xl">{displayName}</h3>
            </div>
            <p className="text-zinc-600 text-xs font-mono">{creatorAddress.slice(0, 10)}...{creatorAddress.slice(-8)}</p>
          </div>
        </div>

        {/* Bio */}
        {displayBio && (
          <p className="text-zinc-400 text-sm leading-relaxed mb-4">
            {displayBio}
          </p>
        )}

        {/* Social Accounts with Follower Counts */}
        {displaySocials.length > 0 && (
          <div className="mb-4">
            <h4 className="text-zinc-500 text-xs uppercase tracking-wider mb-3">Social Accounts</h4>
            <div className="space-y-2">
              {displaySocials.map((account, index) => {
                const IconComponent = getSocialIcon(account.platform)
                return (
                  <motion.a
                    key={account.platform}
                    href={account.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 flex items-center justify-between gap-3 transition-all hover:border-cyan-500/30 hover:bg-zinc-900/70 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                        <IconComponent className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium capitalize">
                          {account.platform}
                        </div>
                        <div className="text-zinc-600 text-xs font-mono">
                          @{account.username}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {account.followers !== undefined && (
                        <div className="text-right">
                          <div className="text-cyan-400 text-lg font-bold">
                            {formatFollowers(account.followers)}
                          </div>
                          <div className="text-zinc-600 text-[10px] uppercase tracking-wider">
                            followers
                          </div>
                        </div>
                      )}
                      <ExternalLink className="w-4 h-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </motion.a>
                )
              })}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !passport && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400" />
          </div>
        )}
      </div>
    </div>
  )
}
