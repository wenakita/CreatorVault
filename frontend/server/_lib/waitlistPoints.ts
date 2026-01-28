type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let waitlistPointsSchemaEnsured = false

export const WAITLIST_POINTS = {
  // Core actions
  signup: 100,
  linkCsw: 250,
  
  // Referral points (awarded to referrer)
  referralSignup: 50,        // When referred user signs up
  referralCswLink: 100,      // When referred user links CSW
  
  // Social actions - verified
  farcaster: 75,
  baseApp: 50,
  zora: 50,
  x: 50,
  discord: 50,
  telegram: 50,
  
  // Bonus actions - honor system
  github: 10,
  tiktok: 10,
  instagram: 10,
  reddit: 10,
} as const

export type WaitlistPointSource = 
  | 'waitlist_signup'
  | 'csw_link'
  | 'referral_signup'
  | 'referral_csw_link'
  | 'social_farcaster'
  | 'social_base_app'
  | 'social_zora'
  | 'social_x'
  | 'social_discord'
  | 'social_telegram'
  | 'bonus_github'
  | 'bonus_tiktok'
  | 'bonus_instagram'
  | 'bonus_reddit'
  | 'task'  // Legacy

export async function ensureWaitlistPointsSchema(db: Db): Promise<void> {
  if (waitlistPointsSchemaEnsured) return
  try {
    // Profile completion (used to qualify referrals).
    try {
      await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ NULL;`
    } catch {
      // ignore (older Postgres or restricted perms)
    }

    // Referral conversion qualification state (backwards-compatible: NULL status treated as legacy-qualified by queries).
    try {
      await db.sql`ALTER TABLE referral_conversions ADD COLUMN IF NOT EXISTS status TEXT NULL;`
      await db.sql`ALTER TABLE referral_conversions ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ NULL;`
    } catch {
      // ignore
    }

    // Append-only points ledger (idempotent via unique key).
    await db.sql`
      CREATE TABLE IF NOT EXISTS waitlist_points_ledger (
        id BIGSERIAL PRIMARY KEY,
        signup_id BIGINT NOT NULL,
        source TEXT NOT NULL,
        source_id TEXT NULL,
        amount INT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS waitlist_points_ledger_unique_source
        ON waitlist_points_ledger (signup_id, source, source_id)
        WHERE source_id IS NOT NULL;
    `
    await db.sql`CREATE INDEX IF NOT EXISTS waitlist_points_ledger_signup_idx ON waitlist_points_ledger (signup_id, created_at DESC);`

    waitlistPointsSchemaEnsured = true
  } catch {
    waitlistPointsSchemaEnsured = false
    throw new Error('waitlist_points_schema_ensure_failed')
  }
}

export async function awardWaitlistPoints(params: {
  db: Db
  signupId: number
  source: string
  sourceId: string
  amount: number
}): Promise<void> {
  const { db, signupId, source, sourceId, amount } = params
  await db.sql`
    INSERT INTO waitlist_points_ledger (signup_id, source, source_id, amount, created_at)
    VALUES (${signupId}, ${source}, ${sourceId}, ${amount}, NOW())
    ON CONFLICT (signup_id, source, source_id) DO NOTHING;
  `
}

