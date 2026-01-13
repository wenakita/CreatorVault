import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from './auth/_shared.js'
import { getDb, getDbInitError, isDbConfigured } from './_lib/postgres.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from './_lib/supabaseAdmin.js'

declare const process: { env: Record<string, string | undefined> }

type HealthResponse = {
  ok: boolean
  time: string
  db: {
    configured: boolean
    ok: boolean
    latencyMs: number | null
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
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

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY || ''
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const supabaseConfigured = isSupabaseAdminConfigured()
  const supabaseStatus = supabaseConfigured ? await checkSupabase() : { ok: false, latencyMs: null, error: null }

  const data: HealthResponse = {
    ok: (Boolean(db) ? dbStatus.ok : false) || supabaseStatus.ok,
    time: new Date().toISOString(),
    db: {
      configured: dbConfigured,
      ok: dbStatus.ok,
      latencyMs: dbStatus.latencyMs,
      error: dbStatus.error,
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
