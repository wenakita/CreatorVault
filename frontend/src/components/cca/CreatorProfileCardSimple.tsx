import { motion } from 'framer-motion'
import { useState, useEffect, type ElementType } from 'react'
import { CheckCircle, Award, ExternalLink, Twitter, Copy } from 'lucide-react'
import type { Address } from 'viem'
import { getTalentPassport, formatTalentScore, type TalentPassport } from '@/lib/talent-api'
import { resolveCreatorAddress } from '@/lib/creator-coin-resolver'

// TikTok icon
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
  </svg>
)

export interface CreatorSocials {
  twitter?: string
  tiktok?: string
  farcaster?: string
}

interface CreatorProfileCardSimpleProps {
  creatorAddress: Address
  creatorName: string
  creatorBio?: string
  creatorImage?: string
  socials?: CreatorSocials
}

export function CreatorProfileCardSimple({
  creatorAddress,
  creatorName,
  creatorBio,
  creatorImage,
  socials,
}: CreatorProfileCardSimpleProps) {
  const [passport, setPassport] = useState<TalentPassport | null>(null)
  const [resolvedAddress, setResolvedAddress] = useState<Address>(creatorAddress)
  const [loading, setLoading] = useState(true)

  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // no-op: clipboard may be unavailable in some contexts
    }
  }

  useEffect(() => {
    async function loadCreatorData() {
      setLoading(true)
      // Resolve CreatorCoin -> creator wallet before querying Talent.
      const resolved = await resolveCreatorAddress(creatorAddress)
      setResolvedAddress(resolved)
      const talentData = await getTalentPassport(resolved)
      setPassport(talentData)
      setLoading(false)
    }
    loadCreatorData()
  }, [creatorAddress])

  // Use props, fallback to Talent data
  const displayName = creatorName || passport?.passport_profile?.name || 'Creator'
  const displayBio = creatorBio || passport?.passport_profile?.bio || ''
  const displayImage = creatorImage || passport?.passport_profile?.image_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${creatorAddress}`
  const isVerified = passport?.verified || false
  const talentScore = passport?.score || 0
  const talentScoreLabel = formatTalentScore(talentScore)

  // Build simple social links
  const simpleSocials = []
  if (socials?.twitter) {
    simpleSocials.push({
      platform: 'Twitter',
      username: socials.twitter.replace('@', ''),
      url: socials.twitter.startsWith('http') ? socials.twitter : `https://x.com/${socials.twitter}`,
      icon: Twitter
    })
  }
  if (socials?.tiktok) {
    simpleSocials.push({
      platform: 'TikTok',
      username: socials.tiktok.replace('@', ''),
      url: socials.tiktok.startsWith('http') ? socials.tiktok : `https://tiktok.com/@${socials.tiktok}`,
      icon: TikTokIcon
    })
  }

  return (
    <div className="bg-black/40 border border-white/5 rounded-xl overflow-hidden">
      <div className="p-6">
        {loading ? (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/5" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-40 bg-white/5 rounded" />
                <div className="h-3 w-64 bg-white/5 rounded" />
              </div>
            </div>
            <div className="h-16 bg-white/5 rounded-lg" />
          </div>
        ) : (
          <>
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
              className="w-16 h-16 rounded-full object-cover border-2 border-uniswap/30"
            />
            {isVerified && (
              <div className="absolute -bottom-1 -right-1 bg-uniswap rounded-full p-1" title="Talent Verified">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            )}
          </motion.div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="headline text-xl">{displayName}</h3>
              {isVerified && <CheckCircle className="w-5 h-5 text-uniswap" />}
            </div>
            <div className="text-zinc-600 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span>Coin: {creatorAddress.slice(0, 10)}...{creatorAddress.slice(-8)}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(creatorAddress)}
                  className="text-zinc-600 hover:text-uniswap transition-colors"
                  aria-label="Copy coin address"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              {resolvedAddress.toLowerCase() !== creatorAddress.toLowerCase() && (
                <div className="flex items-center gap-2">
                  <span>Wallet: {resolvedAddress.slice(0, 10)}...{resolvedAddress.slice(-8)}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(resolvedAddress)}
                    className="text-zinc-600 hover:text-uniswap transition-colors"
                    aria-label="Copy wallet address"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {displayBio && (
          <p className="text-zinc-400 text-sm leading-relaxed mb-4">
            {displayBio}
          </p>
        )}

        {/* Talent Score */}
        {talentScore > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 border border-white/10 rounded-lg p-4 mb-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-uniswap" />
                <span className="text-zinc-400 text-sm">Talent Builder Score</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-uniswap">{talentScore}</div>
                <div className="text-zinc-600 text-xs">{talentScoreLabel}</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Simple Social Links */}
        {simpleSocials.length > 0 && (
          <div>
            <h4 className="text-zinc-500 text-xs uppercase tracking-wider mb-3">Social Links</h4>
            <div className="space-y-2">
              {simpleSocials.map((social, index) => {
                const Icon = social.icon as ElementType
                return (
                  <motion.a
                    key={social.platform}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between bg-black/40 border border-zinc-800/50 rounded-lg p-3 hover:bg-uniswap/5 hover:border-uniswap/35 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-uniswap/10 rounded-md text-uniswap">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-zinc-400 text-xs">{social.platform}</div>
                        <div className="text-white font-medium text-sm">@{social.username}</div>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-uniswap transition-colors" />
                  </motion.a>
                )
              })}
            </div>
          </div>
        )}

        {/* Talent Protocol Link */}
        {passport && (
          <div className="mt-4 pt-4 border-t border-zinc-800/50">
            <a
              href={`https://talentprotocol.com/${resolvedAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-zinc-600 hover:text-uniswap transition-colors text-xs"
            >
              <span>View Talent Profile</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  )
}
