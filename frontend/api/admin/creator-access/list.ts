import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../auth/_shared.js'
import { db, ensureCreatorAccessSchema, isDbConfigured } from '../../_lib/postgres.js'
import { getSessionAddress, isAdminAddress } from '../../_lib/session.js'

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
  setCors(res)
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

  if (!isDbConfigured() || !db) {
    return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }

  await ensureCreatorAccessSchema()

  const q = await db.sql`
    SELECT
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
    LIMIT 200;
  `

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


