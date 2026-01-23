import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readSessionFromRequest, setCors, setNoStore } from '../../server/auth/_shared.js'
import { getDb } from '../../server/_lib/postgres.js'
import { ensureReferralsSchema } from '../../server/_lib/referrals.js'

type Period = 'weekly' | 'all_time'

type LeaderboardRow = {
  rank: number
  referralCode: string
  conversions: number
  primaryWallet: string | null
}

type LeaderboardResponse = {
  period: Period
  weekStartUtc?: string
  weekEndUtc?: string
  top: LeaderboardRow[]
  me?: { weeklyRank?: number | null; allTimeRank?: number | null } | null
}

function getWeekBoundsUtc(now = new Date()): { start: Date; end: Date } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
  const day = d.getUTCDay()
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

  const rawPeriod = typeof req.query?.period === 'string' ? req.query.period : ''
  const period: Period = rawPeriod === 'all_time' ? 'all_time' : 'weekly'
  const limitRaw = typeof req.query?.limit === 'string' ? Number(req.query.limit) : NaN
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 100) : 50

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureReferralsSchema(db)

  const { start, end } = getWeekBoundsUtc()

  const rows =
    period === 'weekly'
      ? await db.sql`
          WITH referrers AS (
            SELECT id, referral_code, primary_wallet
            FROM waitlist_signups
            WHERE referral_code IS NOT NULL
          ),
          conversions AS (
            SELECT referrer_signup_id, COUNT(*)::int AS conversions
            FROM referral_conversions
            WHERE is_valid = TRUE
              AND created_at >= ${start.toISOString()}
              AND created_at < ${end.toISOString()}
            GROUP BY referrer_signup_id
          ),
          clicks AS (
            SELECT referrer_signup_id,
              COUNT(DISTINCT COALESCE(session_id, ip_hash, ua_hash))::int AS unique_clicks
            FROM referral_clicks
            WHERE is_bot_suspected = FALSE
              AND created_at >= ${start.toISOString()}
              AND created_at < ${end.toISOString()}
            GROUP BY referrer_signup_id
          ),
          scored AS (
            SELECT r.id, r.referral_code, r.primary_wallet,
              COALESCE(conv.conversions, 0)::int AS conversions,
              COALESCE(clk.unique_clicks, 0)::int AS unique_clicks
            FROM referrers r
            LEFT JOIN conversions conv ON conv.referrer_signup_id = r.id
            LEFT JOIN clicks clk ON clk.referrer_signup_id = r.id
          ),
          ranked AS (
            SELECT
              referral_code,
              primary_wallet,
              conversions,
              DENSE_RANK() OVER (ORDER BY conversions DESC, unique_clicks DESC, id ASC)::int AS rank
            FROM scored
          )
          SELECT rank, referral_code, conversions, primary_wallet
          FROM ranked
          ORDER BY rank ASC
          LIMIT ${limit};
        `
      : await db.sql`
          WITH referrers AS (
            SELECT id, referral_code, primary_wallet
            FROM waitlist_signups
            WHERE referral_code IS NOT NULL
          ),
          conversions AS (
            SELECT referrer_signup_id, COUNT(*)::int AS conversions
            FROM referral_conversions
            WHERE is_valid = TRUE
            GROUP BY referrer_signup_id
          ),
          clicks AS (
            SELECT referrer_signup_id,
              COUNT(DISTINCT COALESCE(session_id, ip_hash, ua_hash))::int AS unique_clicks
            FROM referral_clicks
            WHERE is_bot_suspected = FALSE
            GROUP BY referrer_signup_id
          ),
          scored AS (
            SELECT r.id, r.referral_code, r.primary_wallet,
              COALESCE(conv.conversions, 0)::int AS conversions,
              COALESCE(clk.unique_clicks, 0)::int AS unique_clicks
            FROM referrers r
            LEFT JOIN conversions conv ON conv.referrer_signup_id = r.id
            LEFT JOIN clicks clk ON clk.referrer_signup_id = r.id
          ),
          ranked AS (
            SELECT
              referral_code,
              primary_wallet,
              conversions,
              DENSE_RANK() OVER (ORDER BY conversions DESC, unique_clicks DESC, id ASC)::int AS rank
            FROM scored
          )
          SELECT rank, referral_code, conversions, primary_wallet
          FROM ranked
          ORDER BY rank ASC
          LIMIT ${limit};
        `

  const top: LeaderboardRow[] = Array.isArray(rows?.rows)
    ? rows.rows.map((r: any) => ({
        rank: Number(r.rank) || 0,
        referralCode: typeof r.referral_code === 'string' ? r.referral_code : '',
        conversions: Number(r.conversions) || 0,
        primaryWallet: typeof r.primary_wallet === 'string' ? r.primary_wallet : null,
      }))
    : []

  const session = readSessionFromRequest(req)
  const addr = session?.address ? String(session.address).toLowerCase() : ''
  let me: LeaderboardResponse['me'] = null
  if (addr) {
    const mine = await db.sql`
      SELECT id
      FROM waitlist_signups
      WHERE (primary_wallet = ${addr} OR embedded_wallet = ${addr})
      LIMIT 1;
    `
    const myId = typeof mine?.rows?.[0]?.id === 'number' ? (mine.rows[0].id as number) : null
    if (myId) {
      // Return both ranks for convenience.
      const rWeekly = await db.sql`
        WITH referrers AS (
          SELECT id
          FROM waitlist_signups
          WHERE referral_code IS NOT NULL
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
          SELECT id, DENSE_RANK() OVER (ORDER BY conversions DESC, id ASC)::int AS rank
          FROM scored
        )
        SELECT rank FROM ranked WHERE id = ${myId} LIMIT 1;
      `
      const weeklyRank = typeof rWeekly?.rows?.[0]?.rank === 'number' ? (rWeekly.rows[0].rank as number) : null

      const rAll = await db.sql`
        WITH referrers AS (
          SELECT id
          FROM waitlist_signups
          WHERE referral_code IS NOT NULL
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
          SELECT id, DENSE_RANK() OVER (ORDER BY conversions DESC, id ASC)::int AS rank
          FROM scored
        )
        SELECT rank FROM ranked WHERE id = ${myId} LIMIT 1;
      `
      const allTimeRank = typeof rAll?.rows?.[0]?.rank === 'number' ? (rAll.rows[0].rank as number) : null
      me = { weeklyRank, allTimeRank }
    }
  }

  const data: LeaderboardResponse = {
    period,
    ...(period === 'weekly' ? { weekStartUtc: start.toISOString(), weekEndUtc: end.toISOString() } : null),
    top,
    ...(me ? { me } : null),
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<LeaderboardResponse>)
}

