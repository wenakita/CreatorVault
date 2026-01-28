import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

type Body = { currentEmail?: string; newEmail?: string }

type UpdateEmailResponse = {
  email: string
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function isSyntheticEmail(v: string): boolean {
  return v.endsWith('@noemail.4626.fun')
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<Body>(req)
  const currentEmail = normalizeEmail(typeof body?.currentEmail === 'string' ? body.currentEmail : '')
  const newEmail = normalizeEmail(typeof body?.newEmail === 'string' ? body.newEmail : '')

  if (!isValidEmail(currentEmail) || !isValidEmail(newEmail)) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }

  if (!isSyntheticEmail(currentEmail)) {
    return res.status(400).json({ success: false, error: 'Email update is not available.' } satisfies ApiEnvelope<never>)
  }

  if (currentEmail === newEmail) {
    const data: UpdateEmailResponse = { email: newEmail }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<UpdateEmailResponse>)
  }

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)

  const existing = await db.sql`
    SELECT id
    FROM waitlist_signups
    WHERE email = ${newEmail}
    LIMIT 1;
  `
  if (existing?.rows?.[0]) {
    return res.status(409).json({ success: false, error: 'Email already in use.' } satisfies ApiEnvelope<never>)
  }

  const updated = await db.sql`
    UPDATE waitlist_signups
    SET email = ${newEmail}, contact_preference = 'email', updated_at = NOW()
    WHERE email = ${currentEmail}
    RETURNING id, email;
  `
  const row = updated?.rows?.[0] ?? null
  if (!row?.id) {
    return res.status(404).json({ success: false, error: 'Signup not found.' } satisfies ApiEnvelope<never>)
  }

  const data: UpdateEmailResponse = { email: String(row.email ?? newEmail) }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<UpdateEmailResponse>)
}
