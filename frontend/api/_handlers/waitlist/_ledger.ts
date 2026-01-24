import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { normalizeReferralCode } from '../../../server/_lib/referrals.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { ensureWaitlistPointsSchema } from '../../../server/_lib/waitlistPoints.js'

type LedgerEntry = {
  source: string
  sourceId: string | null
  amount: number
  createdAt: string
}

type WaitlistLedgerResponse = {
  signupId: number
  referralCode: string | null
  totalPoints: number
  entries: LedgerEntry[]
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function safeInt(v: any): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.floor(n) : 0
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const refParam = typeof (req.query as any)?.ref === 'string' ? String((req.query as any).ref) : ''
  const emailParam = typeof (req.query as any)?.email === 'string' ? String((req.query as any).email) : ''

  const referralCode = refParam ? normalizeReferralCode(refParam) : ''
  if (refParam && !referralCode) {
    return res.status(400).json({ success: false, error: 'Invalid referral code' } satisfies ApiEnvelope<never>)
  }

  const email = normalizeEmail(emailParam)
  if (!referralCode && !isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)
  await ensureWaitlistPointsSchema(db as any)

  const me = referralCode
    ? await db.sql`
        SELECT id, referral_code
        FROM waitlist_signups
        WHERE referral_code = ${referralCode}
        LIMIT 1;
      `
    : await db.sql`
        SELECT id, referral_code
        FROM waitlist_signups
        WHERE email = ${email}
        LIMIT 1;
      `

  const row = me?.rows?.[0] ?? null
  const signupId = typeof row?.id === 'number' ? (row.id as number) : null
  if (!signupId) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<WaitlistLedgerResponse | null>)
  }

  const referralCodeOut = typeof row?.referral_code === 'string' ? String(row.referral_code) : null

  const totalAgg = await db.sql`
    SELECT COALESCE(SUM(amount), 0)::int AS total
    FROM waitlist_points_ledger
    WHERE signup_id = ${signupId};
  `
  const totalPoints = safeInt(totalAgg?.rows?.[0]?.total)

  const ledger = await db.sql`
    SELECT source, source_id, amount, created_at
    FROM waitlist_points_ledger
    WHERE signup_id = ${signupId}
    ORDER BY created_at DESC
    LIMIT 200;
  `

  const entries: LedgerEntry[] = (ledger?.rows ?? []).map((row: any) => ({
    source: typeof row?.source === 'string' ? row.source : 'unknown',
    sourceId: typeof row?.source_id === 'string' ? row.source_id : null,
    amount: safeInt(row?.amount),
    createdAt: row?.created_at ? String(row.created_at) : '',
  }))

  const data: WaitlistLedgerResponse = { signupId, referralCode: referralCodeOut, totalPoints, entries }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistLedgerResponse>)
}
