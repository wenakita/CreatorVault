import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

type PointsType = 'total' | 'invite'

type LeaderboardRow = {
  rank: number
  signupId: number
  display: string
  referralCode: string | null
  pointsTotal: number
  pointsInvite: number
}

type LeaderboardResponse = {
  page: number
  limit: number
  pointsType: PointsType
  totalPages: number
  hasMore: boolean
  leaderboard: LeaderboardRow[]
}

function safeInt(v: any): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.floor(n) : 0
}

function shortAddr(a: string | null): string | null {
  if (!a) return null
  const s = String(a)
  if (!s.startsWith('0x') || s.length < 12) return s
  return `${s.slice(0, 6)}…${s.slice(-4)}`
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const rawPage = typeof (req.query as any)?.page === 'string' ? Number((req.query as any).page) : NaN
  const rawLimit = typeof (req.query as any)?.limit === 'string' ? Number((req.query as any).limit) : NaN
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 10

  const pointsTypeParam = typeof (req.query as any)?.pointsType === 'string' ? String((req.query as any).pointsType).toLowerCase() : ''
  const pointsType: PointsType = pointsTypeParam === 'total' ? 'total' : 'invite'

  const offset = (page - 1) * limit

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)

  const maxUsers = 100
  const totalPages = Math.max(1, Math.ceil(maxUsers / limit))
  const hasMore = page < totalPages

  const rows =
    pointsType === 'total'
      ? await db.sql`
          WITH eligible AS (
            SELECT id, primary_wallet, embedded_wallet, referral_code
            FROM waitlist_signups
            WHERE profile_completed_at IS NOT NULL
            ORDER BY id ASC
            LIMIT ${maxUsers}
          ),
          eligible_with_key AS (
            SELECT
              id,
              COALESCE(NULLIF(primary_wallet, ''), NULLIF(embedded_wallet, '')) AS wallet_key,
              referral_code
            FROM eligible
          ),
          wallet_rollup AS (
            SELECT
              wallet_key,
              MIN(id)::bigint AS canonical_signup_id,
              MAX(referral_code) FILTER (WHERE referral_code IS NOT NULL) AS referral_code
            FROM eligible_with_key
            WHERE wallet_key IS NOT NULL
            GROUP BY wallet_key
          ),
          scored AS (
            SELECT
              w.canonical_signup_id::bigint AS signup_id,
              w.wallet_key AS primary_wallet,
              NULL::text AS embedded_wallet,
              w.referral_code,
              COALESCE(SUM(l.amount), 0)::int AS total_points,
              COALESCE(SUM(CASE WHEN l.source = 'referral_qualified' THEN l.amount ELSE 0 END), 0)::int AS invite_points
            FROM wallet_rollup w
            LEFT JOIN eligible_with_key e ON e.wallet_key = w.wallet_key
            LEFT JOIN waitlist_points_ledger l ON l.signup_id = e.id
            GROUP BY w.canonical_signup_id, w.wallet_key, w.referral_code
          ),
          ranked AS (
            SELECT
              signup_id,
              primary_wallet,
              embedded_wallet,
              referral_code,
              total_points,
              invite_points,
              ROW_NUMBER() OVER (ORDER BY total_points DESC, invite_points DESC, signup_id ASC)::int AS rank
            FROM scored
          )
          SELECT rank, signup_id, primary_wallet, embedded_wallet, referral_code, total_points, invite_points
          FROM ranked
          ORDER BY rank ASC
          OFFSET ${offset}
          LIMIT ${limit};
        `
      : await db.sql`
          WITH eligible AS (
            SELECT id, primary_wallet, embedded_wallet, referral_code
            FROM waitlist_signups
            WHERE profile_completed_at IS NOT NULL
            ORDER BY id ASC
            LIMIT ${maxUsers}
          ),
          eligible_with_key AS (
            SELECT
              id,
              COALESCE(NULLIF(primary_wallet, ''), NULLIF(embedded_wallet, '')) AS wallet_key,
              referral_code
            FROM eligible
          ),
          wallet_rollup AS (
            SELECT
              wallet_key,
              MIN(id)::bigint AS canonical_signup_id,
              MAX(referral_code) FILTER (WHERE referral_code IS NOT NULL) AS referral_code
            FROM eligible_with_key
            WHERE wallet_key IS NOT NULL
            GROUP BY wallet_key
          ),
          scored AS (
            SELECT
              w.canonical_signup_id::bigint AS signup_id,
              w.wallet_key AS primary_wallet,
              NULL::text AS embedded_wallet,
              w.referral_code,
              COALESCE(SUM(l.amount), 0)::int AS total_points,
              COALESCE(SUM(CASE WHEN l.source = 'referral_qualified' THEN l.amount ELSE 0 END), 0)::int AS invite_points
            FROM wallet_rollup w
            LEFT JOIN eligible_with_key e ON e.wallet_key = w.wallet_key
            LEFT JOIN waitlist_points_ledger l ON l.signup_id = e.id
            GROUP BY w.canonical_signup_id, w.wallet_key, w.referral_code
          ),
          ranked AS (
            SELECT
              signup_id,
              primary_wallet,
              embedded_wallet,
              referral_code,
              total_points,
              invite_points,
              ROW_NUMBER() OVER (ORDER BY invite_points DESC, total_points DESC, signup_id ASC)::int AS rank
            FROM scored
          )
          SELECT rank, signup_id, primary_wallet, embedded_wallet, referral_code, total_points, invite_points
          FROM ranked
          ORDER BY rank ASC
          OFFSET ${offset}
          LIMIT ${limit};
        `

  const leaderboard: LeaderboardRow[] = Array.isArray(rows?.rows)
    ? rows.rows.map((r: any) => {
        const signupId = safeInt(r.signup_id)
        const wallet = shortAddr((typeof r.primary_wallet === 'string' ? r.primary_wallet : null) || (typeof r.embedded_wallet === 'string' ? r.embedded_wallet : null))
        const referralCode = typeof r.referral_code === 'string' ? String(r.referral_code) : null
        const display = referralCode ? referralCode : wallet ? wallet : `user#${signupId}`
        return {
          rank: safeInt(r.rank),
          signupId,
          display,
          referralCode,
          pointsTotal: safeInt(r.total_points),
          pointsInvite: safeInt(r.invite_points),
        }
      })
    : []

  const data: LeaderboardResponse = { page, limit, pointsType, totalPages, hasMore, leaderboard }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<LeaderboardResponse>)
}

