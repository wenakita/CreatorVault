import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { ensureCreatorAccessSchema, getDb, isDbConfigured } from '../../../../server/_lib/postgres.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../../server/_lib/supabaseAdmin.js'
import { getSessionAddress, isAdminAddress } from '../../../../server/_lib/session.js'

type AllowlistedEntry = {
  address: string
  approvedAt: string | null
  approvedBy: string | null
  note: string | null
}

type AllowlistResponse = {
  admin: string
  allowlist: AllowlistedEntry[]
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  }

  const qRaw = typeof req.query?.q === 'string' ? req.query.q.trim().toLowerCase() : ''
  const q = qRaw.length > 0 ? qRaw : null

  if (isSupabaseAdminConfigured()) {
    try {
      const supabase = getSupabaseAdmin()

      // Filter by address (substring) if provided, but keep tight limit.
      const baseQuery = supabase
        .from('creator_allowlist')
        .select('address, approved_at, approved_by, note')
        .is('revoked_at', null)
        .order('approved_at', { ascending: false })
        .limit(200)

      const query = q ? baseQuery.ilike('address', `%${q}%`) : baseQuery
      const r = await query
      if (r.error) throw new Error(r.error.message)
      const rows = Array.isArray(r.data) ? r.data : []

      const allowlist: AllowlistedEntry[] = rows
        .map((row: any) => ({
          address: typeof row?.address === 'string' ? String(row.address).toLowerCase() : '',
          approvedAt: typeof row?.approved_at === 'string' ? row.approved_at : null,
          approvedBy: typeof row?.approved_by === 'string' ? String(row.approved_by).toLowerCase() : null,
          note: typeof row?.note === 'string' ? row.note : null,
        }))
        .filter((e: AllowlistedEntry) => isAddressLike(e.address))

      return res.status(200).json({
        success: true,
        data: { admin, allowlist } satisfies AllowlistResponse,
      } satisfies ApiEnvelope<AllowlistResponse>)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Supabase allowlist list failed'
      return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
    }
  }

  const db = isDbConfigured() ? await getDb() : null
  if (!db) {
    return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }

  await ensureCreatorAccessSchema()

  const like = q ? `%${q}%` : null
  if (!db.query) {
    return res.status(500).json({ success: false, error: 'Database driver missing query()' } satisfies ApiEnvelope<never>)
  }

  const r =
    q && like
      ? await db.query(
          `SELECT address, approved_at, approved_by, note
           FROM creator_allowlist
           WHERE revoked_at IS NULL AND address LIKE $1
           ORDER BY approved_at DESC NULLS LAST
           LIMIT 200;`,
          [like],
        )
      : await db.query(
          `SELECT address, approved_at, approved_by, note
           FROM creator_allowlist
           WHERE revoked_at IS NULL
           ORDER BY approved_at DESC NULLS LAST
           LIMIT 200;`,
          [],
        )

  const allowlist: AllowlistedEntry[] = r.rows
    .map((row: any) => ({
      address: row?.address ? String(row.address).toLowerCase() : '',
      approvedAt: row?.approved_at ? new Date(row.approved_at).toISOString() : null,
      approvedBy: row?.approved_by ? String(row.approved_by).toLowerCase() : null,
      note: row?.note ? String(row.note) : null,
    }))
    .filter((e: AllowlistedEntry) => isAddressLike(e.address))

  return res.status(200).json({
    success: true,
    data: { admin, allowlist } satisfies AllowlistResponse,
  } satisfies ApiEnvelope<AllowlistResponse>)
}

