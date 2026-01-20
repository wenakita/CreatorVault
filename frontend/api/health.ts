import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from './auth/_shared.js'
import { getDb, getDbInitError, isDbConfigured } from './_lib/postgres.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from './_lib/supabaseAdmin.js'

declare const process: { env: Record<string, string | undefined> }

type HealthResponse = {
  ok: boolean
  time: string
  env: {
    isVercel: boolean
  }
  db: {
    configured: boolean
    ok: boolean
    latencyMs: number | null
    error: string | null
  }
  deploySessions: {
    secretConfigured: boolean
    tokenHmacConfigured: boolean
    ok: boolean
    error: string | null
  }
  siwe: {
    authSessionSecretConfigured: boolean
    ok: boolean
    error: string | null
  }
  paymaster: {
    endpointConfigured: boolean
    ok: boolean
    error: string | null
  }
  supabase: {
    urlConfigured: boolean
    anonConfigured: boolean
    serviceRoleConfigured: boolean
    ok: boolean
    latencyMs: number | null
    error: string | null
  }
}

async function checkDb(db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<any> }): Promise<{
  ok: boolean
  latencyMs: number | null
  error: string | null
}> {
  const start = Date.now()
  try {
    await db.sql`SELECT 1;`
    return { ok: true, latencyMs: Date.now() - start, error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database check failed'
    return { ok: false, latencyMs: Date.now() - start, error: message }
  }
}

async function checkSupabase(): Promise<{ ok: boolean; latencyMs: number | null; error: string | null }> {
  const start = Date.now()
  try {
    const supabase = getSupabaseAdmin()
    // Minimal query that validates connectivity + schema presence.
    const q = await supabase.from('creator_allowlist').select('address').limit(1)
    if (q.error) throw new Error(q.error.message)
    return { ok: true, latencyMs: Date.now() - start, error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Supabase check failed'
    return { ok: false, latencyMs: Date.now() - start, error: message }
  }
}

function hasMinSecret(v: string | undefined, min = 16): boolean {
  return typeof v === 'string' && v.trim().length >= min
}

function getCdpEndpointConfigured(): boolean {
  const v =
    (process.env.CDP_PAYMASTER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT ?? '').trim() ||
    // Back-compat with repo root .env.example naming
    (process.env.PAYMASTER_URL ?? '').trim() ||
    (process.env.BUNDLER_URL ?? '').trim()
  return v.length > 0
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const dbConfigured = isDbConfigured()
  const db = await getDb()
  const dbStatus = db
    ? await checkDb(db)
    : { ok: false, latencyMs: null, error: getDbInitError() || 'Database not configured' }

  const deploySessionSecretOk = hasMinSecret(process.env.DEPLOY_SESSION_SECRET, 1)
  const deploySessionTokenHmacOk = hasMinSecret(process.env.DEPLOY_SESSION_TOKEN_HMAC_SECRET, 1)
  const deploySessionsOk = Boolean(db) && dbStatus.ok && deploySessionSecretOk && deploySessionTokenHmacOk
  const deploySessionsError = deploySessionsOk
    ? null
    : !dbConfigured
      ? 'Database connection string not configured'
      : !db
        ? (getDbInitError() || 'Database unavailable')
        : !dbStatus.ok
          ? (dbStatus.error || 'Database check failed')
          : !deploySessionSecretOk
            ? 'DEPLOY_SESSION_SECRET is not configured'
            : !deploySessionTokenHmacOk
              ? 'DEPLOY_SESSION_TOKEN_HMAC_SECRET is not configured'
              : 'Deploy sessions unavailable'

  // SIWE session signing secret: required for stable auth in production serverless.
  const isVercel = Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV)
  const authSessionSecretConfigured = hasMinSecret(process.env.AUTH_SESSION_SECRET, 16)
  const siweOk = !isVercel || authSessionSecretConfigured
  const siweError = siweOk ? null : 'AUTH_SESSION_SECRET is not configured (required on Vercel)'

  const paymasterConfigured = getCdpEndpointConfigured()
  const paymasterOk = paymasterConfigured
  const paymasterError = paymasterOk ? null : 'CDP paymaster/bundler endpoint is not configured'

  // Server-only config. Do NOT use client-exposed env vars in API routes.
  const supabaseUrl = process.env.SUPABASE_URL || ''
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || ''
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const supabaseConfigured = isSupabaseAdminConfigured()
  const supabaseStatus = supabaseConfigured ? await checkSupabase() : { ok: false, latencyMs: null, error: null }

  const data: HealthResponse = {
    // Overall service health: allowlist is satisfied by either DB or Supabase.
    // Deploy sessions require DB + secrets and are reported separately.
    ok: (Boolean(db) ? dbStatus.ok : false) || supabaseStatus.ok,
    time: new Date().toISOString(),
    env: { isVercel },
    db: {
      configured: dbConfigured,
      ok: dbStatus.ok,
      latencyMs: dbStatus.latencyMs,
      error: dbStatus.error,
    },
    deploySessions: {
      secretConfigured: deploySessionSecretOk,
      tokenHmacConfigured: deploySessionTokenHmacOk,
      ok: deploySessionsOk,
      error: deploySessionsError,
    },
    siwe: {
      authSessionSecretConfigured,
      ok: siweOk,
      error: siweError,
    },
    paymaster: {
      endpointConfigured: paymasterConfigured,
      ok: paymasterOk,
      error: paymasterError,
    },
    supabase: {
      urlConfigured: supabaseUrl.length > 0,
      anonConfigured: supabaseAnon.length > 0,
      serviceRoleConfigured: supabaseServiceRole.length > 0,
      ok: supabaseStatus.ok,
      latencyMs: supabaseStatus.latencyMs,
      error: supabaseStatus.error,
    },
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<HealthResponse>)
}
