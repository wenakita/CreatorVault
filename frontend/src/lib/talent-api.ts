// Talent Protocol API integration
// Docs: https://docs.talentprotocol.com/docs/developers/talent-api/api-reference

const TALENT_API_KEY = import.meta.env.VITE_TALENT_API_KEY || 'a4ff9ba57e689ac0e22ed2b448986717329dae9b8f5b45344f4140e6a7e6'
const TALENT_API_BASE = 'https://api.talentprotocol.com'
const TALENT_DEBUG = import.meta.env.DEV && import.meta.env.VITE_DEBUG_LOGS === 'true'

export interface SocialAccount {
  platform: string
  username: string
  url: string
  followers?: number
  verified?: boolean
}

export interface TalentPassport {
  passport_id: number
  passport_profile: {
    name: string
    bio: string
    image_url: string
    location?: string
    tags?: string[]
  }
  score: number
  verified: boolean
  main_wallet: string
  activity_score: number
  identity_score: number
  skills_score: number
  rank?: number // Builder rank (e.g., #317)
  followers?: number // Follower count
  socials?: {
    twitter?: string
    linkedin?: string
    github?: string
    discord?: string
    telegram?: string
    farcaster?: string
  }
  // Enhanced social accounts with follower counts
  social_accounts?: SocialAccount[]
  credentials?: Array<{
    type: string
    name: string
    verified: boolean
  }>
  // Creator Coin stats (if available)
  creator_coin?: {
    market_cap?: number
    total_volume?: number
    holders?: number
  }
}

export interface CreatorSocials {
  twitter?: string
  github?: string
  farcaster?: string
  linkedin?: string
  instagram?: string
  tiktok?: string
  youtube?: string
  discord?: string
  telegram?: string
  website?: string
}

/**
 * Fetch Talent Profile using the CORRECT unified search endpoint
 * Endpoint: /search/advanced/profiles with wallet search
 * 
 * Docs: https://docs.talentprotocol.com/docs/developers/talent-api/api-reference
 */
export async function getTalentPassport(walletAddress: string): Promise<TalentPassport | null> {
  try {
    // Use the UNIFIED search endpoint with wallet address query
    const query = {
      walletAddresses: [walletAddress],
      exactMatch: true // Case-insensitive exact match
    }
    
    const sort = {
      score: { order: 'desc' },
      id: { order: 'desc' }
    }
    
    // URL encode the parameters
    const queryString = Object.entries({
      query: JSON.stringify(query),
      sort: JSON.stringify(sort),
      page: '1',
      per_page: '1'
    })
      .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
      .join('&')
    
    const response = await fetch(
      `${TALENT_API_BASE}/search/advanced/profiles?${queryString}`,
      {
        headers: {
          'X-API-KEY': TALENT_API_KEY,
          'Accept': 'application/json',
        },
      }
    )
    
    if (!response.ok) {
      console.error('[Talent] Search error:', response.status, response.statusText)
      return null
    }
    
    const data = await response.json()
    // Extract the first profile from search results
    if (data.profiles && data.profiles.length > 0) {
      return mapProfileData(data.profiles[0])
    }
    
    if (TALENT_DEBUG) console.warn('[Talent] No profile found for wallet:', walletAddress)
    return null
  } catch (error) {
    console.error('[Talent] Failed to search profile:', error)
    return null
  }
}

/**
 * Map search result to our TalentPassport interface
 */
function mapProfileData(profile: any): TalentPassport | null {
  if (!profile) return null
  
  // The advanced search response exposes the builder score as `builder_score.points`.
  // It may also include `scores[]` entries with `slug`, depending on the profile.
  const builderScorePoints =
    (typeof profile.builder_score?.points === 'number' ? profile.builder_score.points : undefined) ??
    (typeof profile.builder_score === 'number' ? profile.builder_score : undefined) ??
    (Array.isArray(profile.scores)
      ? (profile.scores.find((s: any) => s?.slug === 'builder_score' || s?.scorer_slug === 'builder_score')?.points ??
        profile.scores.find((s: any) => s?.slug === 'builder_score' || s?.scorer_slug === 'builder_score')?.score)
      : undefined) ??
    0
  
  return {
    passport_id: profile.id,
    passport_profile: {
      name: profile.display_name || profile.username || '',
      bio: profile.bio || '',
      image_url: profile.image_url || '',
      location: profile.location,
      tags: profile.tags || [],
    },
    score: typeof builderScorePoints === 'number' ? builderScorePoints : 0,
    verified: Boolean(profile.human_checkmark),
    main_wallet: profile.main_wallet || '',
    activity_score: 0,
    identity_score: 0,
    skills_score: 0,
    socials: extractSocials(profile),
    social_accounts: extractSocialAccounts(profile),
    credentials: profile.credentials || [],
    rank: typeof profile.builder_rank === 'number' ? profile.builder_rank : undefined,
    followers: typeof profile.followers_count === 'number' ? profile.followers_count : undefined,
  }
}

/**
 * Extract social links from profile accounts
 */
function extractSocials(profile: any): Record<string, string> {
  const socials: Record<string, string> = {}
  
  if (profile.accounts) {
    for (const account of profile.accounts) {
      const source = account.source?.toLowerCase()
      const identifier = account.identifier || account.username
      
      if (!identifier) continue
      
      switch (source) {
        case 'twitter':
        case 'x':
          socials.twitter = `https://x.com/${identifier}`
          break
        case 'github':
          socials.github = `https://github.com/${identifier}`
          break
        case 'linkedin':
          socials.linkedin = `https://linkedin.com/in/${identifier}`
          break
        case 'farcaster':
          socials.farcaster = `https://warpcast.com/${identifier}`
          break
        case 'tiktok':
          socials.tiktok = `https://tiktok.com/@${identifier}`
          break
      }
    }
  }
  
  return socials
}

/**
 * Extract social accounts with follower counts from profile accounts
 */
function extractSocialAccounts(profile: any): SocialAccount[] {
  const accounts: SocialAccount[] = []

  if (profile.accounts) {
    for (const account of profile.accounts) {
      const source = account.source?.toLowerCase()
      const identifier = account.identifier || account.username
      
      if (!identifier) continue
      
      let platform = ''
      let url = ''
      
      switch (source) {
        case 'twitter':
        case 'x':
          platform = 'twitter'
          url = `https://x.com/${identifier}`
          break
        case 'farcaster':
          platform = 'farcaster'
          url = `https://warpcast.com/${identifier}`
          break
        case 'tiktok':
          platform = 'tiktok'
          url = `https://tiktok.com/@${identifier}`
          break
        case 'instagram':
          platform = 'instagram'
          url = `https://instagram.com/${identifier}`
          break
        case 'youtube':
          platform = 'youtube'
          url = `https://youtube.com/@${identifier}`
          break
        case 'github':
          platform = 'github'
          url = `https://github.com/${identifier}`
          break
        case 'linkedin':
          platform = 'linkedin'
          url = `https://linkedin.com/in/${identifier}`
          break
        default:
          continue
      }
      
      // Use actual follower count if available, otherwise undefined
      const followersCount = account.followers_count || account.follower_count || account.following_count
      
      accounts.push({
        platform,
        username: identifier,
        url,
        followers: followersCount,
        verified: account.verified || account.is_verified || false,
      })
    }
  }
  
  return accounts
}

/**
 * Fetch connected social accounts for a wallet
 * Uses the same unified search endpoint - socials are included in profile data
 */
export async function getTalentSocials(walletAddress: string): Promise<CreatorSocials> {
  try {
    // Fetch the full profile (which includes socials)
    const profile = await getTalentPassport(walletAddress)
    return profile?.socials || {}
  } catch (error) {
    console.error('[Talent] Failed to fetch socials:', error)
    return {}
  }
}

/**
 * Fetch Talent Builder Score by wallet address
 */
export async function getTalentScore(walletAddress: string): Promise<number | null> {
  try {
    const passport = await getTalentPassport(walletAddress)
    return passport?.score ?? null
  } catch (error) {
    console.error('Failed to fetch Talent Score:', error)
    return null
  }
}

/**
 * Format Talent Score for display (0-100 scale)
 */
export function formatTalentScore(score: number): string {
  if (score >= 80) return 'Exceptional'
  if (score >= 60) return 'Strong'
  if (score >= 40) return 'Good'
  if (score >= 20) return 'Emerging'
  return 'New'
}

/**
 * Get score color based on value
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-purple-400'
  if (score >= 60) return 'text-cyan-400'
  if (score >= 40) return 'text-green-400'
  if (score >= 20) return 'text-amber-400'
  return 'text-zinc-400'
}
