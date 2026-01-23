import { createHmac } from 'node:crypto'

declare const process: { env: Record<string, string | undefined> }

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let referralsSchemaEnsured = false

export function normalizeReferralCode(input: string): string {
  const raw = String(input || '')
    .trim()
    .toUpperCase()
  // Keep it URL-safe and readable: A-Z0-9 only.
  // (Many coin symbols include unicode like "■" which we strip.)
  const cleaned = raw.replace(/[^A-Z0-9]/g, '')
  // Keep short (helps sharing and reduces typo rate).
  return cleaned.slice(0, 16)
}

export function getClientIp(req: { headers?: Record<string, any> }): string {
  const h = req?.headers ?? {}
  const xf = h['x-forwarded-for']
  if (typeof xf === 'string' && xf.trim()) {
    // x-forwarded-for can be a list: client, proxy1, proxy2
    return xf.split(',')[0]?.trim() || ''
  }
  if (Array.isArray(xf) && xf.length > 0) {
    const first = String(xf[0] ?? '').trim()
    if (first) return first
  }
  return ''
}

export function getUserAgent(req: { headers?: Record<string, any> }): string {
  const ua = req?.headers?.['user-agent']
  return typeof ua === 'string' ? ua : Array.isArray(ua) ? String(ua[0] ?? '') : ''
}

export function hashForAttribution(value: string): string | null {
  const secret = (process.env.REFERRAL_HASH_SECRET || '').trim()
  if (!secret) return null
  const v = String(value || '').trim()
  if (!v) return null
  return createHmac('sha256', secret).update(v).digest('hex')
}

export async function ensureReferralsSchema(db: Db): Promise<void> {
  if (referralsSchemaEnsured) return
  referralsSchemaEnsured = true

  // Waitlist signup referral metadata.
  try {
    await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS referral_code TEXT NULL;`
    await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS referred_by_code TEXT NULL;`
    await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS referred_by_signup_id BIGINT NULL;`
    await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS referral_claimed_at TIMESTAMPTZ NULL;`
  } catch {
    // ignore (older Postgres or restricted perms)
  }

  // Enforce uniqueness of referral codes (ignore NULLs).
  await db.sql`
    CREATE UNIQUE INDEX IF NOT EXISTS waitlist_signups_referral_code_unique
      ON waitlist_signups (referral_code)
      WHERE referral_code IS NOT NULL;
  `
  await db.sql`CREATE INDEX IF NOT EXISTS waitlist_signups_referred_by_signup_id_idx ON waitlist_signups (referred_by_signup_id);`

  // Click events (best-effort; used for analytics and basic anti-abuse).
  await db.sql`
    CREATE TABLE IF NOT EXISTS referral_clicks (
      id BIGSERIAL PRIMARY KEY,
      referral_code TEXT NOT NULL,
      referrer_signup_id BIGINT NOT NULL,
      ip_hash TEXT NULL,
      ua_hash TEXT NULL,
      session_id TEXT NULL,
      landing_url TEXT NULL,
      is_bot_suspected BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  await db.sql`CREATE INDEX IF NOT EXISTS referral_clicks_referrer_created_idx ON referral_clicks (referrer_signup_id, created_at DESC);`
  await db.sql`CREATE INDEX IF NOT EXISTS referral_clicks_code_created_idx ON referral_clicks (referral_code, created_at DESC);`

  // Conversions (one per invitee signup).
  await db.sql`
    CREATE TABLE IF NOT EXISTS referral_conversions (
      id BIGSERIAL PRIMARY KEY,
      referral_code TEXT NOT NULL,
      referrer_signup_id BIGINT NOT NULL,
      invitee_signup_id BIGINT NOT NULL UNIQUE,
      ip_hash TEXT NULL,
      ua_hash TEXT NULL,
      session_id TEXT NULL,
      attribution TEXT NOT NULL DEFAULT 'last_click',
      is_valid BOOLEAN NOT NULL DEFAULT TRUE,
      invalid_reason TEXT NULL,
      status TEXT NULL,
      qualified_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  await db.sql`CREATE INDEX IF NOT EXISTS referral_conversions_referrer_created_idx ON referral_conversions (referrer_signup_id, created_at DESC);`
  await db.sql`CREATE INDEX IF NOT EXISTS referral_conversions_code_created_idx ON referral_conversions (referral_code, created_at DESC);`
}

