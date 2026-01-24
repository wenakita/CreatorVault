import { ensureReferralsSchema } from './referrals.js'
import { ensureWaitlistPointsSchema } from './waitlistPoints.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let waitlistSchemaEnsured = false

export async function ensureWaitlistSchema(db: Db): Promise<void> {
  if (waitlistSchemaEnsured) return
  try {
    // Create a minimal, durable waitlist schema. Safe to run repeatedly.
    await db.sql`
      CREATE TABLE IF NOT EXISTS waitlist_signups (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        primary_wallet TEXT NULL,
        solana_wallet TEXT NULL,
        privy_user_id TEXT NULL,
        embedded_wallet TEXT NULL,
        base_sub_account TEXT NULL,
        persona TEXT NULL,
        has_creator_coin BOOLEAN NULL,
        farcaster_fid BIGINT NULL,
        contact_preference TEXT NULL,
        verifications JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `

    // Backfill/migrate older tables that were created without newer columns.
    // `IF NOT EXISTS` is supported on modern Postgres versions; if it throws, we ignore.
    try {
      await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS persona TEXT NULL;`
      await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS has_creator_coin BOOLEAN NULL;`
      await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS farcaster_fid BIGINT NULL;`
      await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS privy_user_id TEXT NULL;`
      await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS embedded_wallet TEXT NULL;`
      await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS base_sub_account TEXT NULL;`
      await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS primary_wallet TEXT NULL;`
      await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS solana_wallet TEXT NULL;`
      await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS contact_preference TEXT NULL;`
      await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS verifications JSONB NULL;`
      await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`
      await db.sql`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`
    } catch {
      // ignore (older Postgres or restricted perms)
    }

    await db.sql`CREATE INDEX IF NOT EXISTS waitlist_signups_created_at_idx ON waitlist_signups (created_at DESC);`

    // Referral schema depends on waitlist_signups existing.
    await ensureReferralsSchema(db)

    // Points + profile completion schema.
    await ensureWaitlistPointsSchema(db)

    waitlistSchemaEnsured = true
  } catch {
    waitlistSchemaEnsured = false
    throw new Error('waitlist_schema_ensure_failed')
  }
}
