import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
} from '../auth/_shared.js'
import { ensureCreatorAccessSchema, getDb, isDbConfigured } from '../_lib/postgres.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../_lib/supabaseAdmin.js'
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
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const sessionAddress = getSessionAddress(req)
  if (!sessionAddress) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }

  if (isSupabaseAdminConfigured()) {
    try {
      const supabase = getSupabaseAdmin()

      // If already allowlisted, short-circuit.
      const allow = await supabase
        .from('creator_allowlist')
        .select('address')
        .eq('address', sessionAddress)
        .is('revoked_at', null)
        .limit(1)
      if (allow.error) throw new Error(allow.error.message)
      if (Array.isArray(allow.data) && allow.data.length > 0) {
        return res.status(200).json({
          success: true,
          data: { address: sessionAddress, status: 'approved' } satisfies RequestAccessResponse,
        } satisfies ApiEnvelope<RequestAccessResponse>)
      }

      const body = (await readJsonBody<RequestBody>(req)) ?? {}
      const coinRaw = typeof body?.coin === 'string' ? body.coin.trim() : ''
      const coin = isAddressLike(coinRaw) ? (coinRaw.toLowerCase() as `0x${string}`) : null
      const now = new Date().toISOString()

      // Prefer "one pending request per wallet". If table constraint isn't present yet,
      // we still de-dupe by updating the latest pending request.
      const existing = await supabase
        .from('creator_access_requests')
        .select('id')
        .eq('wallet_address', sessionAddress)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
      if (existing.error) throw new Error(existing.error.message)

      const existingRow = Array.isArray(existing.data) ? existing.data[0] : null
      const existingId =
        existingRow && (existingRow as any).id !== null && (existingRow as any).id !== undefined
          ? Number((existingRow as any).id)
          : null

      if (existingId && Number.isFinite(existingId) && existingId > 0) {
        const u = await supabase
          .from('creator_access_requests')
          .update({ coin_address: coin, updated_at: now })
          .eq('id', existingId)
          .select('id')
          .limit(1)
        if (u.error) throw new Error(u.error.message)
        return res.status(200).json({
          success: true,
          data: { address: sessionAddress, status: 'pending', requestId: existingId } satisfies RequestAccessResponse,
        } satisfies ApiEnvelope<RequestAccessResponse>)
      }

      const inserted = await supabase
        .from('creator_access_requests')
        .insert({ wallet_address: sessionAddress, coin_address: coin, status: 'pending' })
        .select('id')
        .limit(1)
      if (inserted.error) throw new Error(inserted.error.message)

      const id = Array.isArray(inserted.data) ? (inserted.data[0] as any)?.id : (inserted.data as any)?.id
      const requestId = typeof id === 'number' ? id : typeof id === 'string' ? Number(id) : undefined

      return res.status(200).json({
        success: true,
        data: {
          address: sessionAddress,
          status: 'pending',
          requestId,
        } satisfies RequestAccessResponse,
      } satisfies ApiEnvelope<RequestAccessResponse>)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Supabase request failed'
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

  // If already allowlisted, short-circuit.
  const allow = await db.query(`SELECT address FROM creator_allowlist WHERE address = $1 AND revoked_at IS NULL LIMIT 1;`, [
    sessionAddress,
  ])
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
  const inserted = await db.query(
    `INSERT INTO creator_access_requests (wallet_address, coin_address, status)
     VALUES ($1, $2, 'pending')
     ON CONFLICT (wallet_address) WHERE status = 'pending'
     DO UPDATE SET
       coin_address = COALESCE(EXCLUDED.coin_address, creator_access_requests.coin_address),
       updated_at = NOW()
     RETURNING id;`,
    [sessionAddress, coin],
  )

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


