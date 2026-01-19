import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../auth/_shared.js'
import { ensureCreatorAccessSchema, getDb, getDbInitError, isDbConfigured } from '../_lib/postgres.js'

type DebugResponse = {
  ok: boolean
  message?: string
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ])
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const db = isDbConfigured() ? await getDb() : null
  if (!db) {
    return res.status(500).json({
      success: false,
      error: getDbInitError() || 'Database not configured',
    } satisfies ApiEnvelope<never>)
  }

  try {
    await withTimeout(db.sql`SELECT 1`, 5000, 'DB ping')
    await withTimeout(ensureCreatorAccessSchema(), 8000, 'Schema check')
    return res.status(200).json({
      success: true,
      data: { ok: true } satisfies DebugResponse,
    } satisfies ApiEnvelope<DebugResponse>)
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : 'Database connection failed'
    return res.status(500).json({
      success: false,
      error: msg,
      data: { ok: false, message: msg } satisfies DebugResponse,
    } satisfies ApiEnvelope<DebugResponse>)
  }
}
