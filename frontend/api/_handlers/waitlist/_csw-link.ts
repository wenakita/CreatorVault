import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { awardWaitlistPoints, WAITLIST_POINTS } from '../../../server/_lib/waitlistPoints.js'

type Body = {
  email?: string
  cswAddress?: string
  primaryWallet?: string
}

type CswLinkResponse = {
  email: string
  cswAddress: string
  awarded: boolean
  points: number
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
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

  const cswAddress = typeof body?.cswAddress === 'string' ? body.cswAddress.trim() : ''
  if (!isValidEvmAddress(cswAddress)) {
    return res.status(400).json({ success: false, error: 'Invalid CSW address' } satisfies ApiEnvelope<never>)
  }

  const primaryWallet = typeof body?.primaryWallet === 'string' ? body.primaryWallet.trim() : ''

  const db = await getDb()
  if (!db) {
    return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  }
  
  await ensureWaitlistSchema(db as any)

  // Find the signup
  const me = await db.sql`
    SELECT id, primary_wallet
    FROM waitlist_signups
    WHERE email = ${email}
    LIMIT 1;
  `
  const signupId = typeof me?.rows?.[0]?.id === 'number' ? (me.rows[0].id as number) : null
  
  if (!signupId) {
    return res.status(404).json({ success: false, error: 'Waitlist entry not found' } satisfies ApiEnvelope<never>)
  }

  // Update the signup with the CSW address if not already set
  if (primaryWallet && isValidEvmAddress(primaryWallet)) {
    await db.sql`
      UPDATE waitlist_signups
      SET primary_wallet = COALESCE(primary_wallet, ${primaryWallet}),
          updated_at = NOW()
      WHERE id = ${signupId};
    `
  }

  // Award CSW link points (idempotent via ledger unique key)
  await awardWaitlistPoints({
    db,
    signupId,
    source: 'csw_link',
    sourceId: cswAddress.toLowerCase(),
    amount: WAITLIST_POINTS.linkCsw,
  })

  // Also award referrer bonus if this user was referred
  const referrerResult = await db.sql`
    SELECT referred_by_signup_id
    FROM waitlist_signups
    WHERE id = ${signupId} AND referred_by_signup_id IS NOT NULL
    LIMIT 1;
  `
  const referrerId = typeof referrerResult?.rows?.[0]?.referred_by_signup_id === 'number'
    ? (referrerResult.rows[0].referred_by_signup_id as number)
    : null

  if (referrerId) {
    // Award referrer the CSW link bonus
    await awardWaitlistPoints({
      db,
      signupId: referrerId,
      source: 'referral_csw_link',
      sourceId: `invitee:${signupId}`,
      amount: WAITLIST_POINTS.referralCswLink,
    })

    // Update conversion status
    await db.sql`
      UPDATE referral_conversions
      SET status = 'csw_linked', qualified_at = NOW()
      WHERE invitee_signup_id = ${signupId} AND qualified_at IS NULL;
    `
  }

  const data: CswLinkResponse = {
    email,
    cswAddress,
    awarded: true,
    points: WAITLIST_POINTS.linkCsw,
  }
  
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<CswLinkResponse>)
}
