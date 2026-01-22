import type { VercelRequest, VercelResponse } from '@vercel/node'
import { logger } from '../../server/_lib/logger.js'
import { getAddress, isAddress } from 'viem'
import { handleOptions, setCors } from '../../server/auth/_shared.js'

declare const process: { env: Record<string, string | undefined> }

// Server-only secret. Do NOT use client-exposed env vars here.
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || ''
const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster'

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!isAddress(value)) return null
  try {
    return getAddress(value)
  } catch {
    return null
  }
}

function uniqueChecksummed(addrs: Array<string | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const a of addrs) {
    if (!a) continue
    const lc = a.toLowerCase()
    if (seen.has(lc)) continue
    seen.add(lc)
    out.push(a)
  }
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { address, fid } = req.query

  const addressParam = typeof address === 'string' ? address : null
  const fidParam = typeof fid === 'string' ? fid : null

  if (!addressParam && !fidParam) {
    return res.status(400).json({ success: false, error: 'Address or fid parameter is required' })
  }

  const fidNumber =
    fidParam && /^\d+$/.test(fidParam) ? Number(fidParam) : null
  if (fidParam && (!fidNumber || !Number.isFinite(fidNumber) || fidNumber <= 0)) {
    return res.status(400).json({ success: false, error: 'Invalid fid parameter' })
  }

  if (!NEYNAR_API_KEY) {
    return res.status(500).json({ success: false, error: 'Neynar API not configured' })
  }

  try {
    const now = Math.floor(Date.now() / 1000)

    const headers = {
      api_key: NEYNAR_API_KEY,
      'Content-Type': 'application/json',
    } as const

    // Keep cache short to reduce rate-limit risk while still de-duping bursts.
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')

    let response: Response

    if (fidNumber) {
      // Neynar FID lookup. Response shape varies by endpoint; parse defensively below.
      response = await fetch(`${NEYNAR_API_BASE}/user/bulk?fids=${fidNumber}`, { headers })
    } else {
      // Use the correct Neynar endpoint: bulk-by-address
      // The correct format is: addresses=0x123,0x456 (comma-separated, no viewer_fid)
      response = await fetch(`${NEYNAR_API_BASE}/user/bulk-by-address?addresses=${addressParam}`, { headers })
    }

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('[Neynar API] Error', { status: response.status, errorText })
      
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

    // Parse user payload defensively:
    // - bulk-by-address: { "0xabc": [ user ] }
    // - bulk by fid: { users: [ user ] } (expected)
    let user: any | null = null
    if (fidNumber) {
      const obj = (data ?? {}) as any
      const users = Array.isArray(obj?.users) ? obj.users : Array.isArray(obj) ? obj : null
      user = Array.isArray(users) && users.length > 0 ? users[0] : null
    } else {
      const map = (data ?? {}) as Record<string, any>
      const addressKey = Object.keys(map)[0]
      const users = addressKey ? map[addressKey] : null
      user = Array.isArray(users) && users.length > 0 ? users[0] : null
    }

    if (!user) {
      return res.status(200).json({ success: true, data: null })
    }

    const custodyAddress =
      normalizeAddress(user.custody_address) ??
      normalizeAddress(user.custodyAddress) ??
      normalizeAddress(user?.custody?.address)

    const verifiedEthAddresses = uniqueChecksummed([
      // Common Neynar fields
      ...(Array.isArray(user.verifications) ? user.verifications.map((v: any) => normalizeAddress(v)) : []),
      ...(Array.isArray(user?.verified_addresses?.eth_addresses)
        ? user.verified_addresses.eth_addresses.map((v: any) => normalizeAddress(v))
        : []),
    ])

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
      custodyAddress,
      verifiedEthAddresses,
      fetchedAt: now,
    }

    return res.status(200).json({ success: true, data: profile })
  } catch (error) {
    logger.error('[Neynar API] Failed to fetch user', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch Farcaster profile' 
    })
  }
}
