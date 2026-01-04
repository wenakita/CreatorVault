import { createPool } from '@vercel/postgres'

declare const process: { env: Record<string, string | undefined> }

function getConnectionString(): string | null {
  const fromDatabaseUrl = process.env.DATABASE_URL
  if (fromDatabaseUrl && fromDatabaseUrl.trim().length > 0) return fromDatabaseUrl.trim()

  const fromVercelPool = process.env.POSTGRES_URL
  if (fromVercelPool && fromVercelPool.trim().length > 0) return fromVercelPool.trim()

  const fromVercelDirect = process.env.POSTGRES_URL_NON_POOLING
  if (fromVercelDirect && fromVercelDirect.trim().length > 0) return fromVercelDirect.trim()

  return null
}

const connectionString = getConnectionString()

export const db = connectionString ? createPool({ connectionString }) : null

export function isDbConfigured(): boolean {
  return db !== null
}

let creatorAccessSchemaEnsured = false

export async function ensureCreatorAccessSchema(): Promise<void> {
  if (!db) return
  if (creatorAccessSchemaEnsured) return
  creatorAccessSchemaEnsured = true

  await db.sql`
    CREATE TABLE IF NOT EXISTS creator_allowlist (
      address TEXT PRIMARY KEY,
      approved_by TEXT,
      approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      note TEXT
    );
  `

  await db.sql`CREATE INDEX IF NOT EXISTS creator_allowlist_revoked_at_idx ON creator_allowlist (revoked_at);`

  await db.sql`
    CREATE TABLE IF NOT EXISTS creator_access_requests (
      id BIGSERIAL PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      coin_address TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT,
      decision_note TEXT
    );
  `

  // Keep it simple: don't create a postgres enum; enforce via a CHECK constraint.
  // If it already exists, Postgres will throw; that's fine.
  try {
    await db.sql`
      ALTER TABLE creator_access_requests
        ADD CONSTRAINT creator_access_requests_status_check
        CHECK (status IN ('pending', 'approved', 'denied'));
    `
  } catch {
    // ignore
  }

  await db.sql`CREATE INDEX IF NOT EXISTS creator_access_requests_status_created_idx ON creator_access_requests (status, created_at DESC);`
  await db.sql`CREATE INDEX IF NOT EXISTS creator_access_requests_wallet_idx ON creator_access_requests (wallet_address);`

  // Prevent multiple concurrent pending requests per wallet.
  await db.sql`
    CREATE UNIQUE INDEX IF NOT EXISTS creator_access_requests_wallet_pending_unique
      ON creator_access_requests (wallet_address)
      WHERE status = 'pending';
  `
}


