import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { awardWaitlistPoints, WAITLIST_POINTS } from '../../../server/_lib/waitlistPoints.js'

declare const process: { env: Record<string, string | undefined> }

type SocialPlatform = 'farcaster' | 'discord' | 'telegram'

type Body = {
  email?: string
  platform?: SocialPlatform
  // Platform-specific identifiers
  fid?: number           // Farcaster FID
  discordUserId?: string // Discord user ID
  telegramUserId?: string // Telegram user ID
}

type VerifySocialResponse = {
  email: string
  platform: SocialPlatform
  verified: boolean
  awarded: boolean
  points: number
}

// Our Farcaster FID for @4626
const OUR_FARCASTER_FID = 2274738

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

// Verify Farcaster follow using Neynar API
async function verifyFarcasterFollow(userFid: number): Promise<boolean> {
  const apiKey = (process.env.NEYNAR_API_KEY || '').trim()
  if (!apiKey) {
    console.warn('NEYNAR_API_KEY not configured, using honor system for Farcaster')
    return true // Honor system fallback
  }

  try {
    // Check if user follows our account using the user/bulk endpoint with viewer_fid
    // This returns follow relationship in the response
    const url = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${OUR_FARCASTER_FID}&viewer_fid=${userFid}`
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'x-api-key': apiKey,
      },
    })

    if (!response.ok) {
      console.error('Neynar API error:', response.status)
      return true // Honor system fallback on error
    }

    const data = await response.json() as any
    
    // Check if the viewer (user) follows the target (us)
    const users = Array.isArray(data?.users) ? data.users : []
    const ourUser = users.find((u: any) => u?.fid === OUR_FARCASTER_FID)
    
    // viewer_context.following indicates if the viewer follows this user
    return ourUser?.viewer_context?.following === true
  } catch (e) {
    console.error('Farcaster verification error:', e)
    return true // Honor system fallback on error
  }
}

// Discord verification would require a bot - use honor system for now
async function verifyDiscordMembership(discordUserId: string): Promise<boolean> {
  // TODO: Implement Discord bot verification
  // For now, use honor system
  return true
}

// Telegram verification would require a bot - use honor system for now
async function verifyTelegramMembership(telegramUserId: string): Promise<boolean> {
  // TODO: Implement Telegram bot verification
  // For now, use honor system
  return true
}

const PLATFORM_POINTS: Record<SocialPlatform, number> = {
  farcaster: WAITLIST_POINTS.farcaster,
  discord: WAITLIST_POINTS.discord,
  telegram: WAITLIST_POINTS.telegram,
}

const PLATFORM_SOURCE: Record<SocialPlatform, string> = {
  farcaster: 'social_farcaster',
  discord: 'social_discord',
  telegram: 'social_telegram',
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<Body>(req)
  
  const emailRaw = typeof body?.email === 'string' ? body.email : ''
  const email = normalizeEmail(emailRaw)
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }

  const platform = body?.platform as SocialPlatform
  if (!platform || !['farcaster', 'discord', 'telegram'].includes(platform)) {
    return res.status(400).json({ success: false, error: 'Invalid platform' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  }
  
  await ensureWaitlistSchema(db as any)

  // Find the signup
  const me = await db.sql`
    SELECT id, farcaster_fid
    FROM waitlist_signups
    WHERE email = ${email}
    LIMIT 1;
  `
  const signupId = typeof me?.rows?.[0]?.id === 'number' ? (me.rows[0].id as number) : null
  
  if (!signupId) {
    return res.status(404).json({ success: false, error: 'Waitlist entry not found' } satisfies ApiEnvelope<never>)
  }

  let verified = false

  switch (platform) {
    case 'farcaster': {
      const fid = typeof body?.fid === 'number' ? body.fid : null
      if (fid) {
        verified = await verifyFarcasterFollow(fid)
        // Store the FID for future reference
        if (verified) {
          await db.sql`
            UPDATE waitlist_signups
            SET farcaster_fid = ${fid}, updated_at = NOW()
            WHERE id = ${signupId} AND farcaster_fid IS NULL;
          `
        }
      } else {
        verified = true // Honor system if no FID provided
      }
      break
    }
    case 'discord': {
      const discordUserId = typeof body?.discordUserId === 'string' ? body.discordUserId : ''
      verified = await verifyDiscordMembership(discordUserId)
      break
    }
    case 'telegram': {
      const telegramUserId = typeof body?.telegramUserId === 'string' ? body.telegramUserId : ''
      verified = await verifyTelegramMembership(telegramUserId)
      break
    }
  }

  let awarded = false
  if (verified) {
    // Award points (idempotent via ledger unique key)
    await awardWaitlistPoints({
      db,
      signupId,
      source: PLATFORM_SOURCE[platform],
      sourceId: platform,
      amount: PLATFORM_POINTS[platform],
    })
    awarded = true
  }

  const data: VerifySocialResponse = {
    email,
    platform,
    verified,
    awarded,
    points: verified ? PLATFORM_POINTS[platform] : 0,
  }
  
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<VerifySocialResponse>)
}
