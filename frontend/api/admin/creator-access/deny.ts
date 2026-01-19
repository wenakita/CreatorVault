import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../auth/_shared.js'
import { ensureCreatorAccessSchema, getDb, isDbConfigured } from '../../_lib/postgres.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../_lib/supabaseAdmin.js'
import { getSessionAddress, isAdminAddress } from '../../_lib/session.js'

type DenyBody = {
  requestId: number
  note?: string
}

type DenyResponse = {
  requestId: number
  denied: true
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<DenyBody>(req)
  const requestId = typeof body?.requestId === 'number' && Number.isFinite(body.requestId) ? Math.floor(body.requestId) : NaN
  const note = typeof body?.note === 'string' ? body.note.slice(0, 4000) : null
  if (!Number.isFinite(requestId) || requestId <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid requestId' } satisfies ApiEnvelope<never>)
  }

  if (isSupabaseAdminConfigured()) {
    try {
      const supabase = getSupabaseAdmin()
      const now = new Date().toISOString()
      const u = await supabase
        .from('creator_access_requests')
        .update({
          status: 'denied',
          reviewed_at: now,
          reviewed_by: admin,
          decision_note: note,
          updated_at: now,
        })
        .eq('id', requestId)
        .select('id')
        .limit(1)
      if (u.error) throw new Error(u.error.message)
      if (!Array.isArray(u.data) || u.data.length === 0) {
        return res.status(404).json({ success: false, error: 'Request not found' } satisfies ApiEnvelope<never>)
      }

      return res.status(200).json({
        success: true,
        data: { requestId, denied: true } satisfies DenyResponse,
      } satisfies ApiEnvelope<DenyResponse>)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Supabase deny failed'
      return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
    }
  }

  const db = isDbConfigured() ? await getDb() : null
  if (!db) {
    return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }

  await ensureCreatorAccessSchema()
  if (!db.query) {
    return res.status(500).json({ success: false, error: 'Database driver missing query()' } satisfies ApiEnvelope<never>)
  }

  const u = await db.query(
    `UPDATE creator_access_requests
       SET status = 'denied',
           reviewed_at = NOW(),
           reviewed_by = $1,
           decision_note = $2,
           updated_at = NOW()
     WHERE id = $3
     RETURNING id;`,
    [admin, note, requestId],
  )

  if (u.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Request not found' } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: { requestId, denied: true } satisfies DenyResponse,
  } satisfies ApiEnvelope<DenyResponse>)
}


