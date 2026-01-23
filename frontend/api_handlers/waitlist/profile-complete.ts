import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../server/auth/_shared.js'
import { getDb } from '../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../server/_lib/waitlistSchema.js'
import { awardWaitlistPoints, ensureWaitlistPointsSchema, WAITLIST_POINTS } from '../../server/_lib/waitlistPoints.js'

type Body = { email?: string }

type ProfileCompleteResponse = {
  email: string
  profileCompleted: boolean
  qualifiedReferral: boolean
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
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

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)

  await ensureWaitlistSchema(db as any)
  await ensureWaitlistPointsSchema(db as any)

  // Mark profile completed (idempotent).
  const updated = await db.sql`
    UPDATE waitlist_signups
    SET profile_completed_at = COALESCE(profile_completed_at, NOW()), updated_at = NOW()
    WHERE email = ${email}
    RETURNING id, profile_completed_at;
  `
  const row = updated?.rows?.[0] ?? null
  const signupId = typeof row?.id === 'number' ? (row.id as number) : null
  const profileCompleted = Boolean(row?.profile_completed_at)
  if (!signupId) {
    // Not on waitlist (yet). Return success with a clear state so the client can ignore.
    const data: ProfileCompleteResponse = { email, profileCompleted: false, qualifiedReferral: false }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ProfileCompleteResponse>)
  }

  // If this signup has a referrer conversion, qualify it and award points to the referrer (idempotent via ledger).
  const conv = await db.sql`
    SELECT id, referrer_signup_id, is_valid, status, qualified_at
    FROM referral_conversions
    WHERE invitee_signup_id = ${signupId}
    LIMIT 1;
  `
  const c = conv?.rows?.[0] ?? null
  const convId = typeof c?.id === 'number' ? (c.id as number) : null
  const referrerSignupId = typeof c?.referrer_signup_id === 'number' ? (c.referrer_signup_id as number) : null
  const isValid = c?.is_valid === true
  const isAlreadyQualified = (typeof c?.status === 'string' && String(c.status) === 'qualified') || Boolean(c?.qualified_at)

  let qualifiedReferral = false
  if (convId && referrerSignupId && isValid && !isAlreadyQualified) {
    await db.sql`
      UPDATE referral_conversions
      SET status = 'qualified', qualified_at = COALESCE(qualified_at, NOW())
      WHERE id = ${convId};
    `
    await awardWaitlistPoints({
      db,
      signupId: referrerSignupId,
      source: 'referral_qualified',
      sourceId: `conversion:${convId}`,
      amount: WAITLIST_POINTS.qualifiedReferral,
    })
    qualifiedReferral = true
  }

  const data: ProfileCompleteResponse = { email, profileCompleted, qualifiedReferral }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ProfileCompleteResponse>)
}

