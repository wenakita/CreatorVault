import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { getDb, isDbConfigured } from '../../../../server/_lib/postgres.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../../server/_lib/supabaseAdmin.js'
import { getSessionAddress, isAdminAddress } from '../../../../server/_lib/session.js'

type RevokeBody = {
  address: string
  note?: string
}

type RevokeResponse = {
  address: string
  revoked: true
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

async function revokeViaSupabase(params: { address: `0x${string}`; note: string | null }) {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = { revoked_at: now }
  if (typeof params.note === 'string') payload.note = params.note

  const updateRes = await supabase
    .from('creator_allowlist')
    .update(payload)
    .eq('address', params.address)
    .select('address')
    .limit(1)
  if (updateRes.error) throw new Error(updateRes.error.message)
  const updated = Array.isArray(updateRes.data) ? updateRes.data[0] : updateRes.data
  const addr = updated && (updated as any).address ? String((updated as any).address).toLowerCase() : ''
  if (!addr) throw new Error('Address not found')
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

  const body = await readJsonBody<RevokeBody>(req)
  const address = typeof body?.address === 'string' ? body.address.trim().toLowerCase() : ''
  const note = typeof body?.note === 'string' ? body.note.slice(0, 4000) : null
  if (!isAddressLike(address)) {
    return res.status(400).json({ success: false, error: 'Invalid address' } satisfies ApiEnvelope<never>)
  }

  if (isSupabaseAdminConfigured()) {
    try {
      await revokeViaSupabase({ address: address as `0x${string}`, note })
      return res.status(200).json({
        success: true,
        data: { address, revoked: true } satisfies RevokeResponse,
      } satisfies ApiEnvelope<RevokeResponse>)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Supabase revoke failed'
      const status = msg.toLowerCase().includes('not found') ? 404 : 500
      return res.status(status).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
    }
  }

  const db = isDbConfigured() ? await getDb() : null
  if (!db) {
    return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }
  if (!db.query) {
    return res.status(500).json({ success: false, error: 'Database driver missing query()' } satisfies ApiEnvelope<never>)
  }

  const out = await db.query(
    `UPDATE creator_allowlist
       SET revoked_at = NOW(),
           note = $1
     WHERE address = $2
     RETURNING address;`,
    [note, address],
  )

  if (out.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Address not found' } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: { address, revoked: true } satisfies RevokeResponse,
  } satisfies ApiEnvelope<RevokeResponse>)
}
