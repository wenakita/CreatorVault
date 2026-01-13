declare const process: { env: Record<string, string | undefined> }

function isProbablyPostgresUrl(value: string | null | undefined): boolean {
  const v = typeof value === 'string' ? value.trim() : ''
  if (!v) return false
  return /^postgres(ql)?:\/\//i.test(v)
}

function getConnectionString(): string | null {
  const fromDatabaseUrl = process.env.DATABASE_URL
  // Only accept actual Postgres connection strings; it's common for other providers to set DATABASE_URL.
  if (isProbablyPostgresUrl(fromDatabaseUrl)) return fromDatabaseUrl.trim()

  const fromVercelPool = process.env.POSTGRES_URL
  if (isProbablyPostgresUrl(fromVercelPool)) return fromVercelPool.trim()

  const fromVercelDirect = process.env.POSTGRES_URL_NON_POOLING
  if (isProbablyPostgresUrl(fromVercelDirect)) return fromVercelDirect.trim()

  return null
}

type DbPool = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let cachedDb: DbPool | null = null
let initError: string | null = null
let initPromise: Promise<DbPool | null> | null = null

/**
 * Returns true if a Postgres connection string appears to be configured in env.
 * Note: this doesn't guarantee connectivity.
 */
export function isDbConfigured(): boolean {
  return Boolean(getConnectionString())
}

export function getDbInitError(): string | null {
  return initError
}

export async function getDb(): Promise<DbPool | null> {
  if (cachedDb) return cachedDb
  if (initError) return null
  const connectionString = getConnectionString()
  if (!connectionString) return null

  if (!initPromise) {
    initPromise = (async () => {
      try {
        const mod: any = await import('@vercel/postgres')
        const createPool: any = mod?.createPool
        if (typeof createPool !== 'function') {
          initError = 'Missing createPool export from @vercel/postgres'
          return null
        }

        // Re-read env at init time (still deterministic in serverless).
        const cs = getConnectionString()
        if (!cs) return null

        const pool = createPool({ connectionString: cs })
        cachedDb = pool
        return cachedDb
      } catch (err) {
        initError = err instanceof Error ? err.message : 'Failed to initialize Postgres pool'
        console.error('Failed to initialize Postgres pool', err)
        return null
      }
    })()
  }

  return await initPromise
}

let creatorAccessSchemaEnsured = false

export async function ensureCreatorAccessSchema(): Promise<void> {
  const db = await getDb()
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


