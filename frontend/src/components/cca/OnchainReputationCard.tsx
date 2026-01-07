// Comprehensive on-chain reputation card
// Aggregates: Talent Protocol, Guild.xyz, Basenames, Zora

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { 
  Shield, 
  Award, 
  TrendingUp, 
  Users, 
  CheckCircle, 
  ExternalLink,
  Target,
  Activity,
} from 'lucide-react'
import type { Address } from 'viem'
import { getOnchainReputation, type OnchainReputation } from '@/lib/reputation-aggregator'
import { formatBasename } from '@/lib/basename-api'

interface OnchainReputationCardProps {
  creatorAddress: Address
  className?: string
}

export function OnchainReputationCard({ 
  creatorAddress, 
  className = '' 
}: OnchainReputationCardProps) {
  const [reputation, setReputation] = useState<OnchainReputation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadReputation() {
      setLoading(true)
      console.log('[OnchainReputation] Fetching reputation for:', creatorAddress)
      const data = await getOnchainReputation(creatorAddress)
      console.log('[OnchainReputation] Received data:', data)
      setReputation(data)
      setLoading(false)
    }

    loadReputation()
  }, [creatorAddress])

  if (loading) {
    return (
      <div className={`card p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-purple-400 animate-pulse" />
          <h4 className="text-lg font-bold">Loading Reputation...</h4>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-zinc-800/50 rounded animate-pulse" />
          <div className="h-4 bg-zinc-800/50 rounded w-3/4 animate-pulse" />
        </div>
      </div>
    )
  }

  if (!reputation) return null

  const { aggregated, talent, guild, basename } = reputation

  // Professional monochrome color scheme
  const levelColors = {
    Legendary: 'from-cyan-400 to-blue-400',
    Elite: 'from-cyan-500 to-blue-500',
    Established: 'from-cyan-600 to-blue-600',
    Rising: 'from-zinc-400 to-zinc-500',
    New: 'from-zinc-600 to-zinc-700',
  }

  const levelGradient = levelColors[aggregated.reputationLevel]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`card overflow-hidden ${className}`}
    >
      {/* Header with gradient */}
      <div className={`relative bg-gradient-to-br ${levelGradient} bg-opacity-10 p-6 border-b border-zinc-800/50`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-white/90" />
              <h4 className="text-lg font-semibold text-white">Reputation Score</h4>
              {talent.verified && (
                <CheckCircle className="w-4 h-4 text-green-400" />
              )}
            </div>
            {basename.name && (
              <p className="text-sm text-white/60">
                {formatBasename(basename.name)}
              </p>
            )}
          </div>

          {/* Overall Score */}
          <div className="text-right">
            <div className="text-4xl font-bold text-white mb-1">
              {aggregated.totalScore}
            </div>
            <div className="text-xs text-white/60 uppercase tracking-wider">
              {aggregated.reputationLevel}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${aggregated.totalScore}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-white/90 rounded-full"
            />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Trust Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 rounded-xl p-4 border border-zinc-800/30 hover:border-cyan-500/20 transition-colors"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-cyan-500/10 rounded-lg">
              <CheckCircle className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Verified</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {aggregated.trustScore}%
          </div>
        </motion.div>

        {/* Talent Score */}
        {talent.score > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 rounded-xl p-4 border border-zinc-800/30 hover:border-cyan-500/20 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-cyan-500/10 rounded-lg">
                <Target className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Talent</span>
            </div>
            <div className="flex items-baseline gap-1">
              <div className="text-2xl font-bold text-white">
                {talent.score}
              </div>
              {talent.builderRank && (
                <div className="text-xs text-zinc-500">
                  #{talent.builderRank}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Social Reach */}
        {aggregated.socialReach > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 rounded-xl p-4 border border-zinc-800/30 hover:border-cyan-500/20 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-cyan-500/10 rounded-lg">
                <Users className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Reach</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {aggregated.socialReach >= 1000
                ? `${Math.round(aggregated.socialReach / 1000)}k`
                : aggregated.socialReach}
            </div>
          </motion.div>
        )}
      </div>

      {/* Badges */}
      {aggregated.badges.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-cyan-400" />
            <h5 className="text-sm font-semibold text-white">Credentials</h5>
          </div>
          <div className="flex flex-wrap gap-2">
            {aggregated.badges.map((badge, idx) => {
              // Remove emojis from badge text
              const cleanBadge = badge.replace(/[^\w\s]/gi, '').trim()
              return (
                <motion.div
                  key={badge}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 * idx }}
                  className="px-3 py-1.5 bg-zinc-900/50 border border-zinc-800/50 rounded-lg text-xs font-medium text-zinc-300 hover:border-cyan-500/30 hover:bg-zinc-800/50 transition-colors"
                >
                  {cleanBadge}
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Guild Roles */}
      {(guild.casterRank || guild.xCreatorRank || guild.baseSocialScore !== undefined || guild.builderStatus) && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h5 className="text-sm font-semibold text-white">Base Network Activity</h5>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {guild.casterRank && (
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg px-3 py-2.5 hover:border-cyan-500/30 transition-colors">
                <div className="text-xs text-zinc-500 mb-1">Farcaster</div>
                <div className="font-semibold text-zinc-200">{guild.casterRank}</div>
              </div>
            )}
            {guild.xCreatorRank && (
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg px-3 py-2.5 hover:border-cyan-500/30 transition-colors">
                <div className="text-xs text-zinc-500 mb-1">X / Twitter</div>
                <div className="font-semibold text-zinc-200">{guild.xCreatorRank}</div>
              </div>
            )}
            {guild.baseSocialScore !== undefined && (
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg px-3 py-2.5 hover:border-cyan-500/30 transition-colors">
                <div className="text-xs text-zinc-500 mb-1">Social Score</div>
                <div className="font-semibold text-zinc-200">{guild.baseSocialScore}</div>
              </div>
            )}
            {guild.builderStatus && (
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg px-3 py-2.5 hover:border-cyan-500/30 transition-colors">
                <div className="text-xs text-zinc-500 mb-1">Status</div>
                <div className="font-semibold text-zinc-200">{guild.builderStatus}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Investment Signal */}
      {aggregated.totalScore >= 60 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-r from-cyan-500/5 to-blue-500/5 border border-cyan-500/20 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h6 className="font-semibold text-white mb-1">Verified Creator</h6>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Strong on-chain credentials and verified social presence indicate reliability and community trust.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Data Sources Footer */}
      <div className="pt-4 border-t border-zinc-800/30">
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Data Sources</p>
          <div className="flex items-center gap-3 text-xs">
            {talent.passport && (
              <a
                href={`https://talent.app/${basename.name || creatorAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors group"
              >
                <span>Talent</span>
                <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            )}
            {guild.roles.length > 0 && (
              <a
                href="https://guild.xyz/base"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors group"
              >
                <span>Guild</span>
                <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            )}
            {basename.name && (
              <a
                href="https://www.base.org/names"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors group"
              >
                <span>Base</span>
                <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            )}
          </div>
        </div>
      </div>
      </div>
    </motion.div>
  )
}
