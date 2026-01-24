import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { ensureCreatorAccessSchema, getDb, isDbConfigured } from '../../../../server/_lib/postgres.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../../server/_lib/supabaseAdmin.js'
import { getSessionAddress, isAdminAddress } from '../../../../server/_lib/session.js'

type PendingRequest = {
  id: number
  wallet: string
  coin: string | null
  createdAt: string
  allowlisted: boolean
}

type ListResponse = {
  admin: string
  pending: PendingRequest[]
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

  if (isSupabaseAdminConfigured()) {
    try {
      const supabase = getSupabaseAdmin()
      const q = await supabase
        .from('creator_access_requests')
        .select('id, wallet_address, coin_address, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(200)
      if (q.error) throw new Error(q.error.message)

      const rows = Array.isArray(q.data) ? q.data : []
      const wallets = rows
        .map((r: any) => (r?.wallet_address ? String(r.wallet_address).toLowerCase() : ''))
        .filter((w: string) => w.length > 0)

      const allowRes =
        wallets.length > 0
          ? await supabase
              .from('creator_allowlist')
              .select('address')
              .in('address', wallets)
              .is('revoked_at', null)
          : { data: [], error: null as any }
      if ((allowRes as any).error) throw new Error((allowRes as any).error.message)

      const allowSet = new Set<string>(
        (Array.isArray((allowRes as any).data) ? (allowRes as any).data : [])
          .map((r: any) => (r?.address ? String(r.address).toLowerCase() : ''))
          .filter((a: string) => a.length > 0),
      )

      const pending: PendingRequest[] = rows.map((row: any) => ({
        id: typeof row.id === 'number' ? row.id : Number(row.id),
        wallet: String(row.wallet_address).toLowerCase(),
        coin: typeof row.coin_address === 'string' ? String(row.coin_address).toLowerCase() : null,
        createdAt: new Date(row.created_at).toISOString(),
        allowlisted: allowSet.has(String(row.wallet_address).toLowerCase()),
      }))

      return res.status(200).json({
        success: true,
        data: { admin, pending } satisfies ListResponse,
      } satisfies ApiEnvelope<ListResponse>)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Supabase list failed'
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

  const q = await db.query(
    `SELECT
       r.id,
       r.wallet_address,
       r.coin_address,
       r.created_at,
       CASE WHEN a.address IS NOT NULL THEN true ELSE false END AS allowlisted
     FROM creator_access_requests r
     LEFT JOIN creator_allowlist a
       ON a.address = r.wallet_address AND a.revoked_at IS NULL
     WHERE r.status = 'pending'
     ORDER BY r.created_at DESC
     LIMIT 200;`,
    [],
  )

  const pending: PendingRequest[] = q.rows.map((row: any) => ({
    id: typeof row.id === 'number' ? row.id : Number(row.id),
    wallet: String(row.wallet_address).toLowerCase(),
    coin: typeof row.coin_address === 'string' ? String(row.coin_address).toLowerCase() : null,
    createdAt: new Date(row.created_at).toISOString(),
    allowlisted: Boolean(row.allowlisted),
  }))

  return res.status(200).json({
    success: true,
    data: { admin, pending } satisfies ListResponse,
  } satisfies ApiEnvelope<ListResponse>)
}


