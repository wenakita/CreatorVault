import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

import { getDb, isDbConfigured } from './postgres.js'

declare const process: { env: Record<string, string | undefined> }

export type DeploySessionStep =
  | 'created'
  | 'phase1_sent'
  | 'phase1_confirmed'
  | 'phase2_sent'
  | 'phase2_confirmed'
  | 'phase3_sent'
  | 'phase3_confirmed'
  | 'cleanup_sent'
  | 'cancelled'
  | 'completed'
  | 'failed'

export type DeploySessionRecord = {
  id: string
  tokenHash: string
  sessionAddress: `0x${string}`
  smartWallet: `0x${string}`
  sessionOwner: `0x${string}`
  deployToken: string
  sessionOwnerKeyEnc: string
  payload: any
  step: DeploySessionStep
  expiresAt: string
  createdAt: string
  updatedAt: string
  lastError: string | null
  lastUserOpHash: string | null
  lastTxHash: string | null
}

let deploySessionsSchemaEnsured = false

export async function ensureDeploySessionsSchema(): Promise<void> {
  if (!isDbConfigured()) return
  const db = await getDb()
  if (!db) return
  if (deploySessionsSchemaEnsured) return
  deploySessionsSchemaEnsured = true

  await db.sql`
    CREATE TABLE IF NOT EXISTS deploy_sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT UNIQUE NOT NULL,
      session_address TEXT NOT NULL,
      smart_wallet TEXT NOT NULL,
      session_owner TEXT NOT NULL,
      deploy_token TEXT NOT NULL,
      session_owner_key_enc TEXT NOT NULL,
      payload JSONB NOT NULL,
      step TEXT NOT NULL DEFAULT 'created',
      last_error TEXT,
      last_userop_hash TEXT,
      last_tx_hash TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `

  await db.sql`CREATE INDEX IF NOT EXISTS deploy_sessions_sender_idx ON deploy_sessions (smart_wallet);`
  await db.sql`CREATE INDEX IF NOT EXISTS deploy_sessions_session_address_idx ON deploy_sessions (session_address);`
  await db.sql`CREATE INDEX IF NOT EXISTS deploy_sessions_step_idx ON deploy_sessions (step);`
  await db.sql`CREATE INDEX IF NOT EXISTS deploy_sessions_expires_idx ON deploy_sessions (expires_at);`
}

function requireDeploySecret(): Buffer {
  const raw = (process.env.DEPLOY_SESSION_SECRET ?? '').trim()
  if (!raw) throw new Error('DEPLOY_SESSION_SECRET missing')
  // Derive a fixed 32-byte key from the secret.
  return createHash('sha256').update(raw, 'utf8').digest()
}

function encryptWithSecret(plaintext: string): string {
  const key = requireDeploySecret()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag()
  // v1:<iv>:<tag>:<ct> (base64url)
  const b64u = (b: Buffer) => b.toString('base64url')
  return `v1:${b64u(iv)}:${b64u(tag)}:${b64u(ct)}`
}

export function decryptWithSecret(enc: string): string {
  const key = requireDeploySecret()
  const parts = String(enc).split(':')
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('invalid_encryption_format')
  const iv = Buffer.from(parts[1], 'base64url')
  const tag = Buffer.from(parts[2], 'base64url')
  const ct = Buffer.from(parts[3], 'base64url')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return pt.toString('utf8')
}

export function randomId(prefix = 'ds_'): string {
  return `${prefix}${randomBytes(16).toString('hex')}`
}

export function randomDeployToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashDeployToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function signDeployToken(token: string): string {
  const raw = (process.env.DEPLOY_SESSION_TOKEN_HMAC_SECRET ?? '').trim()
  if (!raw) throw new Error('DEPLOY_SESSION_TOKEN_HMAC_SECRET missing')
  return createHmac('sha256', raw).update(token, 'utf8').digest('hex')
}

export async function insertDeploySession(params: {
  id: string
  tokenHash: string
  sessionAddress: string
  smartWallet: string
  sessionOwner: string
  deployToken: string
  sessionOwnerPrivateKey: string
  payload: any
  expiresAt: Date
}): Promise<DeploySessionRecord> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureDeploySessionsSchema()

  const sessionOwnerKeyEnc = encryptWithSecret(params.sessionOwnerPrivateKey)
  const payloadJson = params.payload ?? {}

  await db.sql`
    INSERT INTO deploy_sessions (
      id,
      token_hash,
      session_address,
      smart_wallet,
      session_owner,
      deploy_token,
      session_owner_key_enc,
      payload,
      step,
      expires_at
    ) VALUES (
      ${params.id},
      ${params.tokenHash},
      ${String(params.sessionAddress).toLowerCase()},
      ${String(params.smartWallet).toLowerCase()},
      ${String(params.sessionOwner).toLowerCase()},
      ${params.deployToken},
      ${sessionOwnerKeyEnc},
      ${payloadJson},
      ${'created'},
      ${params.expiresAt.toISOString()}
    );
  `

  const rec = await getDeploySessionById(params.id)
  if (!rec) throw new Error('deploy_session_create_failed')
  return rec
}

export async function getDeploySessionById(id: string): Promise<DeploySessionRecord | null> {
  const db = await getDb()
  if (!db) return null
  await ensureDeploySessionsSchema()
  const res = await db.sql`SELECT * FROM deploy_sessions WHERE id = ${id} LIMIT 1;`
  const row = (res.rows?.[0] ?? null) as any
  return row ? mapRow(row) : null
}

export async function getDeploySessionByTokenHash(tokenHash: string): Promise<DeploySessionRecord | null> {
  const db = await getDb()
  if (!db) return null
  await ensureDeploySessionsSchema()
  const res = await db.sql`SELECT * FROM deploy_sessions WHERE token_hash = ${tokenHash} LIMIT 1;`
  const row = (res.rows?.[0] ?? null) as any
  return row ? mapRow(row) : null
}

export async function getActiveDeploySessionForSender(params: {
  sessionAddress: string
  smartWallet: string
  /**
   * Allow selecting a session even if it is expired.
   * Intended for cleanup-only flows (removing the temporary owner).
   */
  includeExpired?: boolean
  /**
   * Allow selecting a session even if it is in the `failed` step.
   * Intended for cleanup-only flows (removing the temporary owner).
   */
  includeFailed?: boolean
}): Promise<DeploySessionRecord | null> {
  const db = await getDb()
  if (!db) return null
  await ensureDeploySessionsSchema()
  const includeExpired = params.includeExpired === true
  const includeFailed = params.includeFailed === true
  // NOTE: Avoid nested `db.sql` fragments here.
  // - `@vercel/postgres` supports flexible interpolation, but our `pg` fallback implements a minimal
  //   template-to-parameter conversion and treats interpolated fragments as values (→ `step $3` syntax errors).
  const sessionAddress = String(params.sessionAddress).toLowerCase()
  const smartWallet = String(params.smartWallet).toLowerCase()
  const res = includeExpired
    ? includeFailed
      ? await db.sql`
          SELECT * FROM deploy_sessions
          WHERE session_address = ${sessionAddress}
            AND smart_wallet = ${smartWallet}
            AND step != 'completed'
          ORDER BY created_at DESC
          LIMIT 1;
        `
      : await db.sql`
          SELECT * FROM deploy_sessions
          WHERE session_address = ${sessionAddress}
            AND smart_wallet = ${smartWallet}
            AND step NOT IN ('completed', 'failed')
          ORDER BY created_at DESC
          LIMIT 1;
        `
    : includeFailed
      ? await db.sql`
          SELECT * FROM deploy_sessions
          WHERE session_address = ${sessionAddress}
            AND smart_wallet = ${smartWallet}
            AND step != 'completed'
            AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1;
        `
      : await db.sql`
          SELECT * FROM deploy_sessions
          WHERE session_address = ${sessionAddress}
            AND smart_wallet = ${smartWallet}
            AND step NOT IN ('completed', 'failed')
            AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1;
        `
  const row = (res.rows?.[0] ?? null) as any
  return row ? mapRow(row) : null
}

export async function updateDeploySession(params: {
  id: string
  step?: DeploySessionStep
  lastError?: string | null
  lastUserOpHash?: string | null
  lastTxHash?: string | null
  payloadPatch?: any
}): Promise<void> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureDeploySessionsSchema()

  const patch = params.payloadPatch
  if (patch && typeof patch === 'object') {
    // Merge JSONB (right-biased).
    await db.sql`
      UPDATE deploy_sessions
      SET
        payload = COALESCE(payload, '{}'::jsonb) || ${patch},
        step = COALESCE(${params.step ?? null}, step),
        last_error = COALESCE(${params.lastError ?? null}, last_error),
        last_userop_hash = COALESCE(${params.lastUserOpHash ?? null}, last_userop_hash),
        last_tx_hash = COALESCE(${params.lastTxHash ?? null}, last_tx_hash),
        updated_at = NOW()
      WHERE id = ${params.id};
    `
    return
  }

  await db.sql`
    UPDATE deploy_sessions
    SET
      step = COALESCE(${params.step ?? null}, step),
      last_error = COALESCE(${params.lastError ?? null}, last_error),
      last_userop_hash = COALESCE(${params.lastUserOpHash ?? null}, last_userop_hash),
      last_tx_hash = COALESCE(${params.lastTxHash ?? null}, last_tx_hash),
      updated_at = NOW()
    WHERE id = ${params.id};
  `
}

function mapRow(r: any): DeploySessionRecord {
  return {
    id: String(r.id),
    tokenHash: String(r.token_hash),
    sessionAddress: String(r.session_address).toLowerCase() as `0x${string}`,
    smartWallet: String(r.smart_wallet).toLowerCase() as `0x${string}`,
    sessionOwner: String(r.session_owner).toLowerCase() as `0x${string}`,
    deployToken: String(r.deploy_token),
    sessionOwnerKeyEnc: String(r.session_owner_key_enc),
    payload: r.payload,
    step: String(r.step) as DeploySessionStep,
    expiresAt: new Date(r.expires_at).toISOString(),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    lastError: r.last_error ? String(r.last_error) : null,
    lastUserOpHash: r.last_userop_hash ? String(r.last_userop_hash) : null,
    lastTxHash: r.last_tx_hash ? String(r.last_tx_hash) : null,
  }
}

