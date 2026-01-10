// Guild.xyz API integration for Base Guild roles
// Docs: https://github.com/guildxyz/guild.xyz

const GUILD_API_BASE = 'https://api.guild.xyz/v2'

export interface GuildRole {
  id: number
  name: string
  description?: string
  imageUrl?: string
  memberCount?: number
}

export interface GuildMembership {
  guildId: number
  guildName: string
  roles: GuildRole[]
  joinedAt?: string
}

export interface BaseGuildStats {
  // Base Guild specific roles
  isBased?: boolean // Has Basename
  isOnchain?: boolean // Made transactions on Base
  isBuilder?: boolean // GitHub commits
  isCreator?: boolean // Farcaster/X following
  isCoinbaseVerified?: boolean
  
  // Detailed stats
  casterRank?: '10k+' | '50k+' | '100k+' | null
  xCreatorRank?: '10k+' | '50k+' | '100k+' | null
  baseSocialScore?: number // 0-100+
  builderStatus?: 'Based Developer' | 'Recognized by Base' | null
  
  roles: GuildRole[]
}

/**
 * Fetch user's Guild memberships by wallet address
 */
export async function getGuildMemberships(address: string): Promise<GuildMembership[]> {
  try {
    const response = await fetch(
      `${GUILD_API_BASE}/users/${address}/memberships`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error('Guild API error:', response.status, response.statusText)
      return []
    }

    const data = await response.json()
    return data || []
  } catch (error) {
    console.error('Failed to fetch Guild memberships:', error)
    return []
  }
}

/**
 * Get Base Guild specific stats
 * Base Guild ID: You'll need to find the actual guild ID for Base
 */
export async function getBaseGuildStats(address: string): Promise<BaseGuildStats> {
  try {
    const memberships = await getGuildMemberships(address)
    
    // Find Base guild (adjust guild name/ID as needed)
    const baseGuild = memberships.find(m => 
      m.guildName.toLowerCase().includes('base') ||
      m.guildId === 1985 // Example ID, adjust based on actual Base guild
    )

    if (!baseGuild) {
      return { roles: [] }
    }

    // Parse roles to extract stats
    const roles = baseGuild.roles
    const stats: BaseGuildStats = {
      roles,
      isBased: roles.some(r => r.name.toLowerCase().includes('based')),
      isOnchain: roles.some(r => r.name.toLowerCase().includes('onchain')),
      isBuilder: roles.some(r => r.name.toLowerCase().includes('builder') || r.name.toLowerCase().includes('developer')),
      isCreator: roles.some(r => r.name.toLowerCase().includes('creator') || r.name.toLowerCase().includes('caster')),
      isCoinbaseVerified: roles.some(r => r.name.toLowerCase().includes('coinbase') && r.name.toLowerCase().includes('verified')),
    }

    // Extract Caster rank
    const casterRole = roles.find(r => r.name.toLowerCase().includes('caster'))
    if (casterRole) {
      if (casterRole.name.includes('100k')) stats.casterRank = '100k+'
      else if (casterRole.name.includes('50k')) stats.casterRank = '50k+'
      else if (casterRole.name.includes('10k')) stats.casterRank = '10k+'
    }

    // Extract X Creator rank
    const xCreatorRole = roles.find(r => r.name.toLowerCase().includes('x creator'))
    if (xCreatorRole) {
      if (xCreatorRole.name.includes('100K')) stats.xCreatorRank = '100k+'
      else if (xCreatorRole.name.includes('50K')) stats.xCreatorRank = '50k+'
      else if (xCreatorRole.name.includes('10K')) stats.xCreatorRank = '10k+'
    }

    // Extract Base Social Score (parse from role name if available)
    const socialScoreRole = roles.find(r => r.name.toLowerCase().includes('base social score'))
    if (socialScoreRole) {
      const match = socialScoreRole.name.match(/(\d+)/)
      if (match) {
        stats.baseSocialScore = parseInt(match[1])
      }
    }

    // Extract builder status
    if (roles.some(r => r.name === 'Recognized by Base')) {
      stats.builderStatus = 'Recognized by Base'
    } else if (roles.some(r => r.name === 'Based Developer')) {
      stats.builderStatus = 'Based Developer'
    }

    return stats
  } catch (error) {
    console.error('Failed to fetch Base Guild stats:', error)
    return { roles: [] }
  }
}

/**
 * Format Guild role badge for display
 */
export function formatGuildRole(role: GuildRole): string {
  return role.name
}



