// Aggregates on-chain reputation from multiple sources
// Combines: Talent Protocol, Guild.xyz, Basenames, Zora, etc.

import type { Address } from 'viem'
import { getTalentPassport, getTalentSocials, type TalentPassport } from './talent-api'
import { getBaseGuildStats, type BaseGuildStats } from './guild-api'
import { getBasenameProfile, type BasenameInfo } from './basename-api'
import { getZoraCreatorProfile, type ZoraCreator } from './zora-api'
import { resolveCreatorAddress } from './creator-coin-resolver'
import { logger } from './logger'

export interface OnchainReputation {
  // Identity
  address: string
  basename: BasenameInfo
  
  // Reputation scores
  talent: {
    passport: TalentPassport | null
    score: number // 0-100
    builderRank?: number
    verified: boolean
  }
  
  guild: BaseGuildStats
  
  // Social profiles
  profiles: {
    zora: ZoraCreator | null
    twitter?: string
    github?: string
    farcaster?: string
    lens?: string
    website?: string
  }
  
  // Aggregated metrics
  aggregated: {
    totalScore: number // Weighted composite score 0-100
    reputationLevel: 'Legendary' | 'Elite' | 'Established' | 'Rising' | 'New'
    badges: string[] // Array of achievement badges
    trustScore: number // 0-100 based on verifications
    socialReach: number // Estimated total followers/reach
  }
}

/**
 * Calculate weighted reputation score from all sources
 */
function calculateAggregatedScore(
  talent: TalentPassport | null,
  guild: BaseGuildStats,
  basename: BasenameInfo
): number {
  let score = 0
  let weights = 0

  // Talent Protocol (40% weight)
  if (talent?.score) {
    score += talent.score * 0.4
    weights += 0.4
  }

  // Guild roles (30% weight)
  const guildScore = calculateGuildScore(guild)
  score += guildScore * 0.3
  weights += 0.3

  // Basename (10% weight)
  if (basename.name) {
    score += 100 * 0.1
    weights += 0.1
  }

  // Verifications (20% weight)
  const verificationScore = calculateVerificationScore(talent, guild, basename)
  score += verificationScore * 0.2
  weights += 0.2

  return weights > 0 ? Math.round(score / weights) : 0
}

/**
 * Calculate score from Guild roles
 */
function calculateGuildScore(guild: BaseGuildStats): number {
  let score = 0

  if (guild.isBased) score += 20
  if (guild.isOnchain) score += 15
  if (guild.isBuilder) score += 20
  if (guild.isCreator) score += 15
  if (guild.isCoinbaseVerified) score += 10

  // Bonus for high ranks
  if (guild.casterRank === '100k+') score += 20
  else if (guild.casterRank === '50k+') score += 15
  else if (guild.casterRank === '10k+') score += 10

  if (guild.xCreatorRank === '100k+') score += 20
  else if (guild.xCreatorRank === '50k+') score += 15
  else if (guild.xCreatorRank === '10k+') score += 10

  if (guild.baseSocialScore) {
    score += Math.min(guild.baseSocialScore, 20)
  }

  return Math.min(score, 100)
}

/**
 * Calculate verification trust score
 */
function calculateVerificationScore(
  talent: TalentPassport | null,
  guild: BaseGuildStats,
  basename: BasenameInfo
): number {
  let score = 0

  if (talent?.verified) score += 40
  if (guild.isCoinbaseVerified) score += 30
  if (basename.name) score += 30

  return Math.min(score, 100)
}

/**
 * Get reputation level based on score
 */
function getReputationLevel(score: number): OnchainReputation['aggregated']['reputationLevel'] {
  if (score >= 90) return 'Legendary'
  if (score >= 75) return 'Elite'
  if (score >= 50) return 'Established'
  if (score >= 25) return 'Rising'
  return 'New'
}

/**
 * Generate achievement badges
 */
function generateBadges(
  talent: TalentPassport | null,
  guild: BaseGuildStats,
  basename: BasenameInfo
): string[] {
  const badges: string[] = []

  // Talent Protocol badges
  if (talent?.verified) badges.push('Talent Verified')
  if (talent?.score && talent.score >= 80) badges.push('Top Builder')
  
  // Guild badges
  if (guild.builderStatus === 'Recognized by Base') badges.push('Recognized by Base')
  if (guild.casterRank === '100k+') badges.push('Mega Caster')
  else if (guild.casterRank) badges.push('Active Caster')
  
  if (guild.xCreatorRank === '100k+') badges.push('Major Creator')
  else if (guild.xCreatorRank) badges.push('Content Creator')
  
  if (guild.isCoinbaseVerified) badges.push('Coinbase Verified')
  
  // Basename badge
  if (basename.name) badges.push('Based')

  // Activity badges
  if (guild.isOnchain) badges.push('Onchain Active')
  if (guild.isBuilder) badges.push('Builder')

  return badges
}

/**
 * Estimate total social reach
 */
function estimateSocialReach(
  talent: TalentPassport | null,
  guild: BaseGuildStats
): number {
  let reach = 0

  // From Talent Protocol (if available)
  // Add actual follower counts if available in the API
  // NOTE: `TalentPassport.followers` is not guaranteed.
  // We intentionally keep this conservative.
  const talentFollowers = talent?.followers
  if (typeof talentFollowers === 'number' && Number.isFinite(talentFollowers) && talentFollowers > 0) {
    reach += Math.round(talentFollowers)
  }

  // From Guild roles (conservative estimates)
  if (guild.casterRank === '100k+') reach += 100000
  else if (guild.casterRank === '50k+') reach += 50000
  else if (guild.casterRank === '10k+') reach += 10000

  if (guild.xCreatorRank === '100k+') reach += 100000
  else if (guild.xCreatorRank === '50k+') reach += 50000
  else if (guild.xCreatorRank === '10k+') reach += 10000

  return reach
}

/**
 * Fetch comprehensive on-chain reputation for an address
 */
export async function getOnchainReputation(address: string): Promise<OnchainReputation> {
  try {
    // STEP 1: Resolve CreatorCoin address to actual creator address
    logger.debug('[Reputation] Input address:', address)
    const resolvedAddress = await resolveCreatorAddress(address as Address)
    logger.debug('[Reputation] Resolved address:', resolvedAddress)
    
    // STEP 2: Fetch all data sources in parallel using the resolved address
    const [talent, talentSocials, guild, basename, zora] = await Promise.all([
      getTalentPassport(resolvedAddress),
      getTalentSocials(resolvedAddress),
      getBaseGuildStats(resolvedAddress),
      getBasenameProfile(resolvedAddress),
      getZoraCreatorProfile(resolvedAddress),
    ])

    // Calculate aggregated metrics
    const totalScore = calculateAggregatedScore(talent, guild, basename)
    const reputationLevel = getReputationLevel(totalScore)
    const badges = generateBadges(talent, guild, basename)
    const trustScore = calculateVerificationScore(talent, guild, basename)
    const socialReach = estimateSocialReach(talent, guild)

    return {
      address: resolvedAddress, // Use resolved address for display
      basename,
      talent: {
        passport: talent,
        score: talent?.score || 0,
        builderRank: talent?.rank || undefined,
        verified: talent?.verified || false,
      },
      guild,
      profiles: {
        zora,
        twitter: talentSocials.twitter || talent?.socials?.twitter || basename.twitter || zora?.twitter,
        github: talentSocials.github || talent?.socials?.github || basename.github || undefined,
        farcaster: talent?.socials?.farcaster,
        website: talentSocials.website,
      },
      aggregated: {
        totalScore,
        reputationLevel,
        badges,
        trustScore,
        socialReach,
      },
    }
  } catch (error) {
    logger.error('[Reputation] Failed to fetch onchain reputation:', error)
    
    // Return minimal fallback
    return {
      address,
      basename: { name: null },
      talent: {
        passport: null,
        score: 0,
        verified: false,
      },
      guild: { roles: [] },
      profiles: {
        zora: null,
      },
      aggregated: {
        totalScore: 0,
        reputationLevel: 'New',
        badges: [],
        trustScore: 0,
        socialReach: 0,
      },
    }
  }
}

/**
 * Format reputation for display
 */
export function formatReputation(reputation: OnchainReputation) {
  return {
    score: `${reputation.aggregated.totalScore}/100`,
    level: reputation.aggregated.reputationLevel,
    badges: reputation.aggregated.badges.join(' '),
    trust: `${reputation.aggregated.trustScore}% verified`,
    reach: reputation.aggregated.socialReach >= 1000
      ? `${Math.round(reputation.aggregated.socialReach / 1000)}k+ reach`
      : `${reputation.aggregated.socialReach} reach`,
  }
}
