import type { VercelRequest, VercelResponse } from '@vercel/node'

declare const process: { env: Record<string, string | undefined> }

const NEYNAR_API_KEY = process.env.VITE_NEYNAR_API_KEY || ''
const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster'

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    setCors(res)
    res.status(200).end()
    return true
  }
  return false
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { address } = req.query

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ success: false, error: 'Address parameter is required' })
  }

  if (!NEYNAR_API_KEY) {
    return res.status(500).json({ success: false, error: 'Neynar API not configured' })
  }

  try {
    // Use the correct Neynar endpoint: bulk-by-address
    // The correct format is: addresses=0x123,0x456 (comma-separated, no viewer_fid)
    const response = await fetch(
      `${NEYNAR_API_BASE}/user/bulk-by-address?addresses=${address}`,
      {
        headers: {
          'api_key': NEYNAR_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Neynar API] Error:', response.status, errorText)
      
      // If no user found, return null instead of error
      if (response.status === 404) {
        return res.status(200).json({ success: true, data: null })
      }
      
      return res.status(response.status).json({ 
        success: false, 
        error: `Neynar API error: ${response.statusText}` 
      })
    }

    const data = (await response.json()) as unknown

    // Neynar returns an object with address keys
    // Example: { "0x123": [{ fid, username, ... }] }
    const map = (data ?? {}) as Record<string, any>
    const addressKey = Object.keys(map)[0]
    const users = addressKey ? map[addressKey] : null

    if (!users || users.length === 0) {
      return res.status(200).json({ success: true, data: null })
    }

    const user = (users as any[])[0] // Get the first user

    // Transform to our format
    const profile = {
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      avatar: user.pfp_url,
      bio: user.profile?.bio?.text || '',
      followers: user.follower_count || 0,
      following: user.following_count || 0,
      verified: user.power_badge || false,
      verifications: user.verifications || [],
      url: `https://warpcast.com/${user.username}`,
    }

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

    return res.status(200).json({ success: true, data: profile })
  } catch (error) {
    console.error('[Neynar API] Failed to fetch user:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch Farcaster profile' 
    })
  }
}
