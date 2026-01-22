import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { ensureCreatorAccessSchema, getDb, isDbConfigured } from '../../../server/_lib/postgres.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../server/_lib/supabaseAdmin.js'
import { getSessionAddress, isAdminAddress } from '../../../server/_lib/session.js'

type ApproveBody = {
  requestId: number
  note?: string
}

type ApproveResponse = {
  requestId: number
  wallet: string
  approved: true
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

  const body = await readJsonBody<ApproveBody>(req)
  const requestId = typeof body?.requestId === 'number' && Number.isFinite(body.requestId) ? Math.floor(body.requestId) : NaN
  const note = typeof body?.note === 'string' ? body.note.slice(0, 4000) : null
  if (!Number.isFinite(requestId) || requestId <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid requestId' } satisfies ApiEnvelope<never>)
  }

  if (isSupabaseAdminConfigured()) {
    try {
      const supabase = getSupabaseAdmin()
      const now = new Date().toISOString()

      const r = await supabase
        .from('creator_access_requests')
        .select('wallet_address')
        .eq('id', requestId)
        .limit(1)
      if (r.error) throw new Error(r.error.message)
      const wallet = Array.isArray(r.data) ? (r.data[0] as any)?.wallet_address : (r.data as any)?.wallet_address
      const walletLc = wallet ? String(wallet).toLowerCase() : ''
      if (!walletLc) {
        return res.status(404).json({ success: false, error: 'Request not found' } satisfies ApiEnvelope<never>)
      }

      const allowPayload: Record<string, any> = {
        address: walletLc,
        approved_by: admin,
        approved_at: now,
        revoked_at: null,
      }
      if (typeof note === 'string') allowPayload.note = note

      const up = await supabase.from('creator_allowlist').upsert(allowPayload, { onConflict: 'address' })
      if (up.error) throw new Error(up.error.message)

      const u = await supabase
        .from('creator_access_requests')
        .update({
          status: 'approved',
          reviewed_at: now,
          reviewed_by: admin,
          decision_note: note,
          updated_at: now,
        })
        .eq('id', requestId)
      if (u.error) throw new Error(u.error.message)

      return res.status(200).json({
        success: true,
        data: { requestId, wallet: walletLc, approved: true } satisfies ApproveResponse,
      } satisfies ApiEnvelope<ApproveResponse>)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Supabase approve failed'
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

  // Resolve wallet address from the request row.
  const r = await db.query(`SELECT wallet_address FROM creator_access_requests WHERE id = $1 LIMIT 1;`, [requestId])
  const wallet = r.rows?.[0]?.wallet_address ? String(r.rows[0].wallet_address).toLowerCase() : ''
  if (!wallet) {
    return res.status(404).json({ success: false, error: 'Request not found' } satisfies ApiEnvelope<never>)
  }

  // Upsert allowlist entry.
  await db.query(
    `INSERT INTO creator_allowlist (address, approved_by, approved_at, revoked_at, note)
     VALUES ($1, $2, NOW(), NULL, $3)
     ON CONFLICT (address)
     DO UPDATE SET
       approved_by = EXCLUDED.approved_by,
       approved_at = NOW(),
       revoked_at = NULL,
       note = EXCLUDED.note;`,
    [wallet, admin, note],
  )

  // Mark request as approved.
  await db.query(
    `UPDATE creator_access_requests
       SET status = 'approved',
           reviewed_at = NOW(),
           reviewed_by = $1,
           decision_note = $2,
           updated_at = NOW()
     WHERE id = $3;`,
    [admin, note, requestId],
  )

  return res.status(200).json({
    success: true,
    data: { requestId, wallet, approved: true } satisfies ApproveResponse,
  } satisfies ApiEnvelope<ApproveResponse>)
}


