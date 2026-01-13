import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../auth/_shared.js'
import { ensureCreatorAccessSchema, getDb, isDbConfigured } from '../_lib/postgres.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../_lib/supabaseAdmin.js'
import { getSessionAddress } from '../_lib/session.js'

type CreatorAccessStatus =
  | {
      address: string
      approved: boolean
      request:
        | null
        | {
            id: number
            coin: string | null
            status: 'pending' | 'approved' | 'denied'
            createdAt: string
            reviewedAt: string | null
            decisionNote: string | null
          }
    }
  | null

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const sessionAddress = getSessionAddress(req)
  if (!sessionAddress) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<CreatorAccessStatus>)
  }

  if (isSupabaseAdminConfigured()) {
    try {
      const supabase = getSupabaseAdmin()
      const allowRes = await supabase
        .from('creator_allowlist')
        .select('address')
        .eq('address', sessionAddress)
        .is('revoked_at', null)
        .limit(1)
      if (allowRes.error) throw new Error(allowRes.error.message)
      const approved = Array.isArray(allowRes.data) && allowRes.data.length > 0

      const reqRes = await supabase
        .from('creator_access_requests')
        .select('id, coin_address, status, created_at, reviewed_at, decision_note')
        .eq('wallet_address', sessionAddress)
        .order('created_at', { ascending: false })
        .limit(1)
      if (reqRes.error) throw new Error(reqRes.error.message)

      const row = Array.isArray(reqRes.data) ? reqRes.data[0] : null
      const request =
        row && (row as any).id != null
          ? {
              id: typeof (row as any).id === 'number' ? (row as any).id : Number((row as any).id),
              coin: typeof (row as any).coin_address === 'string' ? String((row as any).coin_address) : null,
              status: String((row as any).status) as 'pending' | 'approved' | 'denied',
              createdAt: (row as any).created_at ? new Date((row as any).created_at).toISOString() : new Date().toISOString(),
              reviewedAt: (row as any).reviewed_at ? new Date((row as any).reviewed_at).toISOString() : null,
              decisionNote: typeof (row as any).decision_note === 'string' ? String((row as any).decision_note) : null,
            }
          : null

      return res.status(200).json({
        success: true,
        data: { address: sessionAddress, approved, request } satisfies Exclude<CreatorAccessStatus, null>,
      } satisfies ApiEnvelope<CreatorAccessStatus>)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Supabase status lookup failed'
      return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
    }
  }

  const db = isDbConfigured() ? await getDb() : null
  if (!db) {
    return res.status(200).json({
      success: true,
      data: { address: sessionAddress, approved: false, request: null } satisfies Exclude<CreatorAccessStatus, null>,
    } satisfies ApiEnvelope<CreatorAccessStatus>)
  }

  await ensureCreatorAccessSchema()

  const allow = await db.sql`
    SELECT address FROM creator_allowlist WHERE address = ${sessionAddress} AND revoked_at IS NULL LIMIT 1;
  `
  const approved = allow.rows.length > 0

  const r = await db.sql`
    SELECT id, coin_address, status, created_at, reviewed_at, decision_note
    FROM creator_access_requests
    WHERE wallet_address = ${sessionAddress}
    ORDER BY created_at DESC
    LIMIT 1;
  `

  const row = r.rows?.[0] as any
  const request =
    row && row.id != null
      ? {
          id: typeof row.id === 'number' ? row.id : Number(row.id),
          coin: typeof row.coin_address === 'string' ? row.coin_address : null,
          status: row.status as 'pending' | 'approved' | 'denied',
          createdAt: new Date(row.created_at).toISOString(),
          reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
          decisionNote: typeof row.decision_note === 'string' ? row.decision_note : null,
        }
      : null

  return res.status(200).json({
    success: true,
    data: { address: sessionAddress, approved, request } satisfies Exclude<CreatorAccessStatus, null>,
  } satisfies ApiEnvelope<CreatorAccessStatus>)
}


