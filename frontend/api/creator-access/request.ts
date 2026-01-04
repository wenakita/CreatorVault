import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
} from '../auth/_shared.js'
import { db, ensureCreatorAccessSchema, isDbConfigured } from '../_lib/postgres.js'
import { getSessionAddress } from '../_lib/session.js'

type RequestBody = {
  coin?: string
}

type RequestAccessResponse = {
  address: string
  status: 'approved' | 'pending'
  requestId?: number
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const sessionAddress = getSessionAddress(req)
  if (!sessionAddress) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured() || !db) {
    return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }

  await ensureCreatorAccessSchema()

  // If already allowlisted, short-circuit.
  const allow = await db.sql`
    SELECT address FROM creator_allowlist WHERE address = ${sessionAddress} AND revoked_at IS NULL LIMIT 1;
  `
  if (allow.rows.length > 0) {
    return res.status(200).json({
      success: true,
      data: { address: sessionAddress, status: 'approved' } satisfies RequestAccessResponse,
    } satisfies ApiEnvelope<RequestAccessResponse>)
  }

  const body = (await readJsonBody<RequestBody>(req)) ?? {}
  const coinRaw = typeof body?.coin === 'string' ? body.coin.trim() : ''
  const coin = isAddressLike(coinRaw) ? (coinRaw.toLowerCase() as `0x${string}`) : null

  // Create (or update) a pending request.
  const inserted = await db.sql`
    INSERT INTO creator_access_requests (wallet_address, coin_address, status)
    VALUES (${sessionAddress}, ${coin}, 'pending')
    ON CONFLICT (wallet_address) WHERE status = 'pending'
    DO UPDATE SET
      coin_address = COALESCE(EXCLUDED.coin_address, creator_access_requests.coin_address),
      updated_at = NOW()
    RETURNING id;
  `

  const id = inserted.rows?.[0]?.id
  const requestId = typeof id === 'number' ? id : typeof id === 'string' ? Number(id) : undefined

  return res.status(200).json({
    success: true,
    data: {
      address: sessionAddress,
      status: 'pending',
      requestId,
    } satisfies RequestAccessResponse,
  } satisfies ApiEnvelope<RequestAccessResponse>)
}


