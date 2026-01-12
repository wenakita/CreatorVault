// Neynar API integration for Farcaster data
// Calls backend proxy to avoid CORS issues and keep API keys secure
// Backend: /api/social/farcaster

import { logger } from './logger'

export interface FarcasterUser {
  fid: number
  username: string
  display_name: string
  pfp_url: string
  follower_count: number
  following_count: number
  verified_addresses: {
    eth_addresses: string[]
    sol_addresses: string[]
  }
}

export interface FarcasterProfile {
  username: string
  displayName: string
  avatar: string
  followers: number
  following: number
  bio?: string
  fid: number
  verifiedAddresses?: string[]
  custodyAddress?: string | null
  verifiedEthAddresses?: string[]
  fetchedAt?: number
}

/**
 * Fetch Farcaster user by FID (Farcaster ID)
 * Note: Currently not implemented in backend proxy
 * Use getFarcasterUserByAddress instead
 */
export async function getFarcasterUserByFid(fid: number): Promise<FarcasterProfile | null> {
  logger.debug('[Neynar] Fetching user by FID:', fid)

  if (!Number.isFinite(fid) || fid <= 0) return null

  try {
    const response = await fetch(`/api/social/farcaster?fid=${encodeURIComponent(String(fid))}`)

    if (!response.ok) {
      logger.error('[Neynar] Proxy error:', { status: response.status, statusText: response.statusText })
      return null
    }

    const result = await response.json()

    if (result.success && result.data) {
      logger.debug('[Neynar] User data:', result.data)
      return result.data
    }

    return null
  } catch (error) {
    logger.error('[Neynar] Failed to fetch user:', error)
    return null
  }
}

/**
 * Fetch Farcaster user by username
 * Note: Currently not implemented in backend proxy
 * Use getFarcasterUserByAddress instead
 */
export async function getFarcasterUserByUsername(username: string): Promise<FarcasterProfile | null> {
  logger.warn('[Neynar] Fetching user by username not implemented:', username)
  return null
}

/**
 * Fetch Farcaster user by verified wallet address via backend proxy
 * Backend handles API authentication and CORS
 */
export async function getFarcasterUserByAddress(address: string): Promise<FarcasterProfile | null> {
  logger.debug('[Neynar] Fetching user by address:', address)
  
  try {
    // Call backend proxy instead of Neynar API directly
    const response = await fetch(`/api/social/farcaster?address=${encodeURIComponent(address)}`)
    
    if (!response.ok) {
      logger.error('[Neynar] Proxy error:', { status: response.status, statusText: response.statusText })
      return null
    }
    
    const result = await response.json()
    
    if (result.success && result.data) {
      logger.debug('[Neynar] User data:', result.data)
      return result.data
    }
    
    return null
  } catch (error) {
    logger.error('[Neynar] Failed to fetch user:', error)
    return null
  }
}

