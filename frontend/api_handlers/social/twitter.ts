import type { VercelRequest, VercelResponse } from '@vercel/node'
import { logger } from '../../server/_lib/logger.js'
import { handleOptions, setCors } from '../../server/auth/_shared.js'

declare const process: { env: Record<string, string | undefined> }

// Server-only secret. Do NOT use client-exposed env vars here.
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || ''
const TWITTER_API_BASE = 'https://api.twitter.com/2'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { username } = req.query

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ success: false, error: 'Username parameter is required' })
  }

  if (!TWITTER_BEARER_TOKEN) {
    return res.status(500).json({ success: false, error: 'Twitter API not configured' })
  }

  // Remove @ if present
  const cleanUsername = username.replace('@', '')

  try {
    const response = await fetch(
      `${TWITTER_API_BASE}/users/by/username/${cleanUsername}?user.fields=description,profile_image_url,public_metrics,verified`,
      {
        headers: {
          'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('[Twitter API] Error', { status: response.status, errorText })
      return res.status(response.status).json({ 
        success: false, 
        error: `Twitter API error: ${response.statusText}` 
      })
    }

    const data = (await response.json()) as unknown

    const json = (data ?? {}) as any

    if (!json.data) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    const user = json.data

    // Transform to our format
    const profile = {
      username: user.username,
      displayName: user.name,
      avatar: user.profile_image_url,
      followers: user.public_metrics?.followers_count || 0,
      following: user.public_metrics?.following_count || 0,
      bio: user.description,
      verified: user.verified || false,
      url: `https://x.com/${user.username}`,
    }

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

    return res.status(200).json({ success: true, data: profile })
  } catch (error) {
    logger.error('[Twitter API] Failed to fetch user', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch Twitter profile' 
    })
  }
}
