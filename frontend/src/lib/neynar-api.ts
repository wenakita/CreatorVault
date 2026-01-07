// Neynar API integration for Farcaster data
// Calls backend proxy to avoid CORS issues and keep API keys secure
// Backend: /api/social/farcaster

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
  verifiedAddresses: string[]
}

/**
 * Fetch Farcaster user by FID (Farcaster ID)
 * Note: Currently not implemented in backend proxy
 * Use getFarcasterUserByAddress instead
 */
export async function getFarcasterUserByFid(fid: number): Promise<FarcasterProfile | null> {
  console.log('[Neynar] Fetching user by FID not implemented:', fid)
  console.warn('[Neynar] Use getFarcasterUserByAddress instead')
  return null
}

/**
 * Fetch Farcaster user by username
 * Note: Currently not implemented in backend proxy
 * Use getFarcasterUserByAddress instead
 */
export async function getFarcasterUserByUsername(username: string): Promise<FarcasterProfile | null> {
  console.log('[Neynar] Fetching user by username not implemented:', username)
  console.warn('[Neynar] Use getFarcasterUserByAddress instead')
  return null
}

/**
 * Fetch Farcaster user by verified wallet address via backend proxy
 * Backend handles API authentication and CORS
 */
export async function getFarcasterUserByAddress(address: string): Promise<FarcasterProfile | null> {
  console.log('[Neynar] Fetching user by address:', address)
  
  try {
    // Call backend proxy instead of Neynar API directly
    const response = await fetch(`/api/social/farcaster?address=${encodeURIComponent(address)}`)
    
    if (!response.ok) {
      console.error('[Neynar] Proxy error:', response.status, response.statusText)
      return null
    }
    
    const result = await response.json()
    
    if (result.success && result.data) {
      console.log('[Neynar] User data:', result.data)
      return result.data
    }
    
    return null
  } catch (error) {
    console.error('[Neynar] Failed to fetch user:', error)
    return null
  }
}

