// Twitter API v2 integration for fetching user data and follower counts
// Calls backend proxy to avoid CORS issues and keep API keys secure
// Backend: /api/social/twitter

import { logger } from './logger'

export interface TwitterUser {
  id: string
  username: string
  name: string
  profile_image_url: string
  description?: string
  verified: boolean
  public_metrics: {
    followers_count: number
    following_count: number
    tweet_count: number
  }
}

export interface TwitterProfile {
  username: string
  displayName: string
  avatar: string
  followers: number
  following: number
  bio?: string
  verified: boolean
  url: string
}

/**
 * Fetch Twitter user by username via backend proxy
 * Backend handles API authentication and CORS
 */
export async function getTwitterUserByUsername(username: string): Promise<TwitterProfile | null> {
  logger.debug('[Twitter] Fetching user by username', { username })
  
  // Remove @ if present
  const cleanUsername = username.replace('@', '')
  
  try {
    // Call backend proxy instead of Twitter API directly
    const response = await fetch(`/api/social/twitter?username=${encodeURIComponent(cleanUsername)}`)
    
    if (!response.ok) {
      logger.error('[Twitter] Proxy error', { status: response.status, statusText: response.statusText })
      return null
    }
    
    const result = await response.json()
    
    if (result.success && result.data) {
      logger.debug('[Twitter] User data', result.data)
      return result.data
    }
    
    return null
  } catch (error) {
    logger.error('[Twitter] Failed to fetch user', error)
    return null
  }
}

/**
 * Fetch Twitter user by user ID via backend proxy
 * Note: Currently not implemented in backend proxy
 * Use getTwitterUserByUsername instead
 */
export async function getTwitterUserById(userId: string): Promise<TwitterProfile | null> {
  logger.warn('[Twitter] Fetching user by ID not implemented', { userId })
  return null
}

/**
 * Extract Twitter username from a URL or handle
 * Examples:
 * - "https://x.com/username" -> "username"
 * - "https://twitter.com/username" -> "username"
 * - "@username" -> "username"
 * - "username" -> "username"
 */
export function extractTwitterUsername(input: string): string | null {
  if (!input) return null
  
  // Remove @ if present
  let username = input.replace('@', '')
  
  // Extract from URL
  const urlMatch = username.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/)
  if (urlMatch) {
    username = urlMatch[1]
  }
  
  // Remove any query params or fragments
  username = username.split('?')[0].split('#')[0]
  
  return username || null
}

