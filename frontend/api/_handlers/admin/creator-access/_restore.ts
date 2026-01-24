import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { getDb, isDbConfigured } from '../../../../server/_lib/postgres.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../../server/_lib/supabaseAdmin.js'
import { getSessionAddress, isAdminAddress } from '../../../../server/_lib/session.js'

type RestoreBody = {
  address: string
  note?: string
}

type RestoreResponse = {
  address: string
  restored: true
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

async function restoreViaSupabase(params: { address: `0x${string}`; admin: `0x${string}`; note: string | null }) {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  const existing = await supabase
    .from('creator_allowlist')
    .select('address, note')
    .eq('address', params.address)
    .limit(1)
  if (existing.error) throw new Error(existing.error.message)

  const payload: Record<string, unknown> = {
    address: params.address,
    approved_by: params.admin,
    approved_at: now,
    revoked_at: null,
  }
  if (typeof params.note === 'string') payload.note = params.note
  else if ((existing.data ?? []).length > 0 && (existing.data as any)[0]?.note) payload.note = (existing.data as any)[0].note

  const upsertRes = await supabase.from('creator_allowlist').upsert(payload, { onConflict: 'address' })
  if (upsertRes.error) throw new Error(upsertRes.error.message)
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

  const body = await readJsonBody<RestoreBody>(req)
  const address = typeof body?.address === 'string' ? body.address.trim().toLowerCase() : ''
  const note = typeof body?.note === 'string' ? body.note.slice(0, 4000) : null
  if (!isAddressLike(address)) {
    return res.status(400).json({ success: false, error: 'Invalid address' } satisfies ApiEnvelope<never>)
  }

  if (isSupabaseAdminConfigured()) {
    try {
      await restoreViaSupabase({ address: address as `0x${string}`, admin, note })
      return res.status(200).json({
        success: true,
        data: { address, restored: true } satisfies RestoreResponse,
      } satisfies ApiEnvelope<RestoreResponse>)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Supabase restore failed'
      return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
    }
  }

  const db = isDbConfigured() ? await getDb() : null
  if (!db) {
    return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }
  if (!db.query) {
    return res.status(500).json({ success: false, error: 'Database driver missing query()' } satisfies ApiEnvelope<never>)
  }

  await db.query(
    `INSERT INTO creator_allowlist (address, approved_by, approved_at, revoked_at, note)
     VALUES ($1, $2, NOW(), NULL, $3)
     ON CONFLICT (address)
     DO UPDATE SET
       approved_by = EXCLUDED.approved_by,
       approved_at = NOW(),
       revoked_at = NULL,
       note = COALESCE(EXCLUDED.note, creator_allowlist.note);`,
    [address, admin, note],
  )

  return res.status(200).json({
    success: true,
    data: { address, restored: true } satisfies RestoreResponse,
  } satisfies ApiEnvelope<RestoreResponse>)
}
