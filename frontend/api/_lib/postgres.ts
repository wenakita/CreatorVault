declare const process: { env: Record<string, string | undefined> }

function isProbablyPostgresUrl(value: string | null | undefined): boolean {
  const v = typeof value === 'string' ? value.trim() : ''
  if (!v) return false
  return /^postgres(ql)?:\/\//i.test(v)
}

type DbSource = 'vercel_postgres' | 'database_url'

function getDbConfig(): { source: DbSource; connectionString: string } | null {
  const fromDatabaseUrl = process.env.DATABASE_URL
  // In production on Vercel, do NOT read DATABASE_URL here.
  // - Many projects set DATABASE_URL for external providers (e.g. Supabase) that are incompatible with @vercel/postgres.
  // - Vercel Postgres sets POSTGRES_URL / POSTGRES_URL_NON_POOLING automatically.
  // We still allow DATABASE_URL for local dev.
  const isVercel = Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV)
  const fromVercelPool = process.env.POSTGRES_URL
  if (isProbablyPostgresUrl(fromVercelPool)) return { source: 'vercel_postgres', connectionString: (fromVercelPool ?? '').trim() }

  const fromVercelDirect = process.env.POSTGRES_URL_NON_POOLING
  if (isProbablyPostgresUrl(fromVercelDirect)) return { source: 'vercel_postgres', connectionString: (fromVercelDirect ?? '').trim() }

  // Fallback: if Vercel Postgres is not configured, accept DATABASE_URL even on Vercel.
  // This enables running against external Postgres providers (e.g. Supabase) without requiring POSTGRES_URL.
  // Only accept actual Postgres connection strings; it's common for other providers to set DATABASE_URL.
  if (isProbablyPostgresUrl(fromDatabaseUrl)) return { source: 'database_url', connectionString: (fromDatabaseUrl ?? '').trim() }

  return null
}

function withRequiredSsl(connectionString: string): string {
  const cs = (connectionString ?? '').trim()
  if (!cs) return cs
  const lower = cs.toLowerCase()
  if (lower.includes('sslmode=')) return cs
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return cs
  return `${cs}${cs.includes('?') ? '&' : '?'}sslmode=require`
}

function requiresSsl(connectionString: string): boolean {
  const cs = (connectionString ?? '').trim().toLowerCase()
  if (!cs) return false
  if (cs.includes('localhost') || cs.includes('127.0.0.1')) return false
  // If explicitly disabled, respect it (useful for local tunnels / unusual setups).
  if (cs.includes('sslmode=disable')) return false
  return true
}

function sslOptionsForConnection(connectionString: string): any | undefined {
  if (!requiresSsl(connectionString)) return undefined
  // Many hosted Postgres providers require TLS. Some libraries ignore `sslmode=require`
  // in the URL, so pass an explicit ssl option too.
  //
  // We use `rejectUnauthorized: false` for compatibility across providers and managed cert chains.
  // If your provider has a standard CA chain, you can tighten this to `true`.
  return { rejectUnauthorized: false }
}

type DbResult = { rows: any[] }
type DbPool = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<DbResult>
  // Preferred: explicit query API (helps satisfy scanners and is unambiguous parameterization).
  query?: (text: string, params?: any[]) => Promise<DbResult>
}

let cachedDb: DbPool | null = null
let initError: string | null = null
let initPromise: Promise<DbPool | null> | null = null

/**
 * Returns true if a Postgres connection string appears to be configured in env.
 * Note: this doesn't guarantee connectivity.
 */
export function isDbConfigured(): boolean {
  return Boolean(getDbConfig())
}

export function getDbInitError(): string | null {
  return initError
}

export async function getDb(): Promise<DbPool | null> {
  if (cachedDb) return cachedDb
  if (initError) return null
  const cfg = getDbConfig()
  if (!cfg?.connectionString) return null

  if (!initPromise) {
    initPromise = (async () => {
      try {
        // Re-read env at init time (still deterministic in serverless).
        const cfg2 = getDbConfig()
        const cs = cfg2?.connectionString ? withRequiredSsl(cfg2.connectionString) : null
        if (!cfg2 || !cs) return null
        const ssl = sslOptionsForConnection(cs)

        // Vercel Postgres (Neon): use @vercel/postgres.
        if (cfg2.source === 'vercel_postgres') {
          const mod: any = await import('@vercel/postgres')
          const createPool: any = mod?.createPool
          const createClient: any = mod?.createClient
          if (typeof createPool !== 'function' && typeof createClient !== 'function') {
            initError = 'Missing createPool/createClient exports from @vercel/postgres'
            return null
          }

          // Prefer pooled connections when possible (recommended for serverless),
          // but fall back to a direct client if the provided connection string is direct-only.
          try {
            if (typeof createPool === 'function') {
              const pool = createPool({ connectionString: cs, ssl })
              // Some drivers only surface "invalid_connection_string" on first query.
              // If this happens, fall back to createClient() below.
              try {
                await pool.sql`SELECT 1;`
                cachedDb = pool
                return cachedDb
              } catch (e: any) {
                const msg = e?.message ? String(e.message) : ''
                const isDirectOnly =
                  msg.toLowerCase().includes('invalid_connection_string') && msg.toLowerCase().includes('direct connection')
                if (!isDirectOnly) throw e
                console.warn('Pool connection string appears to be direct-only; falling back to createClient')
              }
            }
          } catch (e: any) {
            const msg = e?.message ? String(e.message) : ''
            // fall through to createClient
            console.warn('createPool failed, trying createClient', msg)
          }

          if (typeof createClient !== 'function') {
            initError = 'createPool failed and createClient is unavailable'
            return null
          }

          const client = createClient({ connectionString: cs, ssl })
          try {
            if (typeof client?.connect === 'function') await client.connect()
          } catch {
            // ignore connect errors here; first query will surface it.
          }

          cachedDb = client
          return cachedDb
        }

        // External Postgres (e.g. Supabase): use node-postgres (pg), not @vercel/postgres.
        const pg: any = await import('pg')
        const Pool: any = pg?.Pool
        if (typeof Pool !== 'function') {
          initError = 'Missing Pool export from pg'
          return null
        }
        const pool = new Pool({ connectionString: cs, ssl })
        // Provide a minimal `sql` tagged template wrapper compatible with callsites.
        const db: DbPool = {
          sql: async (strings: TemplateStringsArray, ...values: any[]) => {
            // Convert a tagged template into a parameterized query: $1, $2, ...
            let text = ''
            for (let i = 0; i < strings.length; i++) {
              text += strings[i]
              if (i < values.length) text += `$${i + 1}`
            }
            const res = await pool.query(text, values)
            return { rows: res.rows ?? [] }
          },
          query: async (text: string, params?: any[]) => {
            const res = await pool.query(text, params)
            return { rows: res.rows ?? [] }
          },
        }
        // Sanity check connectivity.
        await db.sql`SELECT 1;`
        cachedDb = db
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


