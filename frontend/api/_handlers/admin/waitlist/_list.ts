import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { getDb, isDbConfigured } from '../../../../server/_lib/postgres.js'
import { getSessionAddress, isAdminAddress } from '../../../../server/_lib/session.js'
import { ensureWaitlistSchema } from '../../../../server/_lib/waitlistSchema.js'

type WaitlistListItem = {
  id: number
  email: string
  persona: string | null
  primaryWallet: string | null
  solanaWallet: string | null
  embeddedWallet: string | null
  embeddedWalletChain: string | null
  embeddedWalletClientType: string | null
  referralCode: string | null
  contactPreference: string | null
  createdAt: string
  updatedAt: string
}

type ListResponse = {
  admin: string
  items: WaitlistListItem[]
}

function toIso(value: any): string {
  if (!value) return ''
  try {
    return new Date(value).toISOString()
  } catch {
    return ''
  }
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

  const db = isDbConfigured() ? await getDb() : null
  if (!db) {
    return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }

  await ensureWaitlistSchema(db as any)

  if (!db.query) {
    return res.status(500).json({ success: false, error: 'Database driver missing query()' } satisfies ApiEnvelope<never>)
  }

  const qRaw = typeof (req.query as any)?.q === 'string' ? String((req.query as any).q) : ''
  const q = qRaw.trim()
  const where = q
    ? `WHERE email ILIKE $1
       OR primary_wallet ILIKE $1
       OR solana_wallet ILIKE $1
       OR referral_code ILIKE $1
       OR embedded_wallet ILIKE $1
       OR privy_user_id ILIKE $1`
    : ''
  const params = q ? [`%${q}%`] : []

  const result = await db.query(
    `SELECT
       id,
       email,
       persona,
       primary_wallet,
       solana_wallet,
       embedded_wallet,
       embedded_wallet_chain,
       embedded_wallet_client_type,
       referral_code,
       contact_preference,
       created_at,
       updated_at
     FROM waitlist_signups
     ${where}
     ORDER BY created_at DESC
     LIMIT 200;`,
    params,
  )

  const items: WaitlistListItem[] = (result.rows ?? []).map((row: any) => ({
    id: typeof row.id === 'number' ? row.id : Number(row.id),
    email: typeof row.email === 'string' ? row.email : String(row.email || ''),
    persona: typeof row.persona === 'string' ? row.persona : null,
    primaryWallet: typeof row.primary_wallet === 'string' ? row.primary_wallet : null,
    solanaWallet: typeof row.solana_wallet === 'string' ? row.solana_wallet : null,
    embeddedWallet: typeof row.embedded_wallet === 'string' ? row.embedded_wallet : null,
    embeddedWalletChain: typeof row.embedded_wallet_chain === 'string' ? row.embedded_wallet_chain : null,
    embeddedWalletClientType: typeof row.embedded_wallet_client_type === 'string' ? row.embedded_wallet_client_type : null,
    referralCode: typeof row.referral_code === 'string' ? row.referral_code : null,
    contactPreference: typeof row.contact_preference === 'string' ? row.contact_preference : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }))

  return res.status(200).json({
    success: true,
    data: { admin, items } satisfies ListResponse,
  } satisfies ApiEnvelope<ListResponse>)
}
