import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readSessionFromRequest, setCors, setNoStore } from '../../server/auth/_shared.js'
import { getDb } from '../../server/_lib/postgres.js'
import { ensureReferralsSchema } from '../../server/_lib/referrals.js'

type ReferralsMeResponse = {
  referralCode: string | null
  referralLink: string | null
  weeklyConversions: number
  allTimeConversions: number
  weeklyRank: number | null
  allTimeRank: number | null
}

function getOrigin(req: VercelRequest): string {
  const host = typeof req.headers?.host === 'string' ? req.headers.host : '4626.fun'
  const xfProto = typeof req.headers?.['x-forwarded-proto'] === 'string' ? req.headers['x-forwarded-proto'] : 'https'
  const proto = xfProto.toLowerCase() === 'http' ? 'http' : 'https'
  return `${proto}://${host}`
}

function getWeekBoundsUtc(now = new Date()): { start: Date; end: Date } {
  // Monday 00:00 UTC → next Monday 00:00 UTC
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
  const day = d.getUTCDay() // 0=Sun,1=Mon
  const diffToMon = (day + 6) % 7
  d.setUTCDate(d.getUTCDate() - diffToMon)
  const start = d
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
  return { start, end }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureReferralsSchema(db)

  // Primary: look up by SIWE session (cookie or bearer).
  const session = readSessionFromRequest(req)
  const address = session?.address ? String(session.address).toLowerCase() : ''

  // Fallback: allow clients without a SIWE session (e.g. SIWF-only) to query by referral code.
  const codeParam = typeof req.query?.referralCode === 'string' ? req.query.referralCode : ''

  const me =
    address.length > 0
      ? await db.sql`
          SELECT id, referral_code
          FROM waitlist_signups
          WHERE (primary_wallet = ${address} OR embedded_wallet = ${address})
          LIMIT 1;
        `
      : codeParam.trim().length > 0
        ? await db.sql`
            SELECT id, referral_code
            FROM waitlist_signups
            WHERE referral_code = ${codeParam.trim().toUpperCase()}
              AND persona = 'creator'
              AND has_creator_coin = TRUE
            LIMIT 1;
          `
        : null

  const row = me?.rows?.[0] ?? null
  const signupId = typeof row?.id === 'number' ? (row.id as number) : null
  const referralCode = typeof row?.referral_code === 'string' ? (row.referral_code as string) : null
  if (!signupId) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<ReferralsMeResponse | null>)
  }

  const { start, end } = getWeekBoundsUtc()

  const weekly = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM referral_conversions
    WHERE referrer_signup_id = ${signupId}
      AND is_valid = TRUE
      AND created_at >= ${start.toISOString()}
      AND created_at < ${end.toISOString()};
  `
  const weeklyConversions = typeof weekly?.rows?.[0]?.c === 'number' ? (weekly.rows[0].c as number) : 0

  const allTime = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM referral_conversions
    WHERE referrer_signup_id = ${signupId}
      AND is_valid = TRUE;
  `
  const allTimeConversions = typeof allTime?.rows?.[0]?.c === 'number' ? (allTime.rows[0].c as number) : 0

  const rankWeekly = await db.sql`
    WITH referrers AS (
      SELECT id
      FROM waitlist_signups
      WHERE persona = 'creator' AND has_creator_coin = TRUE AND referral_code IS NOT NULL
    ),
    scored AS (
      SELECT r.id,
        COALESCE(COUNT(c.id), 0)::int AS conversions
      FROM referrers r
      LEFT JOIN referral_conversions c
        ON c.referrer_signup_id = r.id
       AND c.is_valid = TRUE
       AND c.created_at >= ${start.toISOString()}
       AND c.created_at < ${end.toISOString()}
      GROUP BY r.id
    ),
    ranked AS (
      SELECT id, conversions,
        DENSE_RANK() OVER (ORDER BY conversions DESC, id ASC)::int AS rank
      FROM scored
    )
    SELECT rank FROM ranked WHERE id = ${signupId} LIMIT 1;
  `
  const weeklyRank = typeof rankWeekly?.rows?.[0]?.rank === 'number' ? (rankWeekly.rows[0].rank as number) : null

  const rankAll = await db.sql`
    WITH referrers AS (
      SELECT id
      FROM waitlist_signups
      WHERE persona = 'creator' AND has_creator_coin = TRUE AND referral_code IS NOT NULL
    ),
    scored AS (
      SELECT r.id,
        COALESCE(COUNT(c.id), 0)::int AS conversions
      FROM referrers r
      LEFT JOIN referral_conversions c
        ON c.referrer_signup_id = r.id
       AND c.is_valid = TRUE
      GROUP BY r.id
    ),
    ranked AS (
      SELECT id, conversions,
        DENSE_RANK() OVER (ORDER BY conversions DESC, id ASC)::int AS rank
      FROM scored
    )
    SELECT rank FROM ranked WHERE id = ${signupId} LIMIT 1;
  `
  const allTimeRank = typeof rankAll?.rows?.[0]?.rank === 'number' ? (rankAll.rows[0].rank as number) : null

  const origin = getOrigin(req)
  const referralLink = referralCode ? `${origin}/?ref=${encodeURIComponent(referralCode)}#waitlist` : null

  const data: ReferralsMeResponse = {
    referralCode,
    referralLink,
    weeklyConversions,
    allTimeConversions,
    weeklyRank,
    allTimeRank,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ReferralsMeResponse>)
}

