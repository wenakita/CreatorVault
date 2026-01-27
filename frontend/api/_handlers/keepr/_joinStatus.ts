import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { ensureKeeprSchema } from '../../../server/_lib/keeprSchema.js'
import { getDb } from '../../../server/_lib/postgres.js'

type JoinStatusResponse =
  | {
      status: 'none'
      vaultAddress: `0x${string}`
      wallet: `0x${string}`
    }
  | {
      status: 'watching' | 'queued' | 'added' | 'failed' | 'cancelled'
      vaultAddress: `0x${string}`
      wallet: `0x${string}`
      lastReason: string | null
      lastCheckedAt: string | null
      nextCheckAt: string | null
      updatedAt: string | null
      action:
        | null
        | {
            id: number
            status: string
            lastError: string | null
            updatedAt: string | null
          }
    }

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getQueryString(req: VercelRequest, key: string): string {
  const v = (req as any)?.query?.[key] as unknown
  if (typeof v === 'string') return v
  if (Array.isArray(v) && v.length > 0) return typeof v[0] === 'string' ? v[0] : String(v[0])
  return ''
}

function asIso(value: any): string | null {
  try {
    if (!value) return null
    const d = new Date(value)
    return Number.isFinite(d.getTime()) ? d.toISOString() : null
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const vaultRaw = getQueryString(req, 'vaultAddress').trim()
  const walletRaw = getQueryString(req, 'wallet').trim()
  const vaultAddress = isAddressLike(vaultRaw) ? (vaultRaw.toLowerCase() as `0x${string}`) : null
  const wallet = isAddressLike(walletRaw) ? (walletRaw.toLowerCase() as `0x${string}`) : null
  if (!vaultAddress || !wallet) {
    return res.status(400).json({ success: false, error: 'Missing vaultAddress or wallet' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(200).json({
      success: true,
      data: { status: 'none', vaultAddress, wallet } satisfies JoinStatusResponse,
    } satisfies ApiEnvelope<JoinStatusResponse>)
  }
  await ensureKeeprSchema()

  const r = await db.sql`
    SELECT
      jr.status AS jr_status,
      jr.last_reason AS jr_last_reason,
      jr.last_checked_at AS jr_last_checked_at,
      jr.next_check_at AS jr_next_check_at,
      jr.updated_at AS jr_updated_at,
      jr.action_id AS jr_action_id,
      a.status AS action_status,
      a.last_error AS action_last_error,
      a.updated_at AS action_updated_at
    FROM keepr_join_requests jr
    LEFT JOIN keepr_actions a ON a.id = jr.action_id
    WHERE jr.vault_address = ${vaultAddress}
      AND jr.wallet_address = ${wallet}
    ORDER BY jr.updated_at DESC
    LIMIT 1;
  `

  const row = (r.rows ?? [])[0] as any
  if (!row) {
    return res.status(200).json({
      success: true,
      data: { status: 'none', vaultAddress, wallet } satisfies JoinStatusResponse,
    } satisfies ApiEnvelope<JoinStatusResponse>)
  }

  const baseStatus = String(row.jr_status ?? 'watching') as 'watching' | 'queued' | 'added' | 'failed' | 'cancelled'
  const actionId = row.jr_action_id !== null && row.jr_action_id !== undefined ? Number(row.jr_action_id) : null
  const actionStatus = typeof row.action_status === 'string' ? row.action_status : null

  // Derived UI-friendly status.
  const derivedStatus: 'watching' | 'queued' | 'added' | 'failed' | 'cancelled' = actionStatus === 'executed' ? 'added' : baseStatus

  return res.status(200).json({
    success: true,
    data: {
      status: derivedStatus,
      vaultAddress,
      wallet,
      lastReason: typeof row.jr_last_reason === 'string' ? row.jr_last_reason : null,
      lastCheckedAt: asIso(row.jr_last_checked_at),
      nextCheckAt: asIso(row.jr_next_check_at),
      updatedAt: asIso(row.jr_updated_at),
      action: actionId
        ? {
            id: actionId,
            status: actionStatus ?? 'unknown',
            lastError: typeof row.action_last_error === 'string' ? row.action_last_error : null,
            updatedAt: asIso(row.action_updated_at),
          }
        : null,
    } satisfies JoinStatusResponse,
  } satisfies ApiEnvelope<JoinStatusResponse>)
}

