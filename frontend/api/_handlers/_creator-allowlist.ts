import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../server/auth/_shared.js'
import { ensureCreatorAccessSchema, getDb, getDbInitError, isDbConfigured } from '../../server/_lib/postgres.js'
import { ensureCreatorWalletsSchema } from '../../server/_lib/creatorWallets.js'
import { isAddressLike, resolveCoinParties } from '../../server/_lib/coinParties.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../server/_lib/supabaseAdmin.js'

declare const process: { env: Record<string, string | undefined> }

type AllowlistMode = 'disabled' | 'enforced'

type CreatorAllowlistResponse = {
  // Echoes `address=` input (lowercased), if provided.
  address: string | null
  // Echoes `coin=` input (lowercased), if provided.
  coin: string | null
  // When `coin=` is provided, we attempt to resolve the creator + payoutRecipient.
  creator: string | null
  payoutRecipient: string | null

  mode: AllowlistMode
  allowed: boolean
}

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set()
  const parts = raw
    .split(/[\s,]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
  const out = new Set<string>()
  for (const p of parts) {
    if (!isAddressLike(p)) continue
    out.add(p.toLowerCase())
  }
  return out
}

async function dbIsAllowlisted(
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> },
  addresses: string[],
): Promise<boolean> {
  if (addresses.length === 0) return false
  await ensureCreatorAccessSchema()

  // Query one-by-one (small list, keeps SQL simple and reliable).
  for (const a of addresses) {
    const addr = a.toLowerCase()
    if (!isAddressLike(addr)) continue
    const { rows } = await db.sql`SELECT address FROM creator_allowlist WHERE address = ${addr} AND revoked_at IS NULL LIMIT 1;`
    if (rows.length > 0) return true
  }
  return false
}

async function dbHasLinkedWallet(
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> },
  address: string | null,
): Promise<boolean> {
  if (!address || !isAddressLike(address)) return false
  try {
    await ensureCreatorWalletsSchema(db)
    const { rows } = await db.sql`
      SELECT wallet_address
      FROM creator_wallets
      WHERE wallet_address = ${address.toLowerCase()}
      LIMIT 1;
    `
    return rows.length > 0
  } catch {
    return false
  }
}

async function dbIsWaitlisted(
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> },
  address: string | null,
): Promise<boolean> {
  if (!address || !isAddressLike(address)) return false
  try {
    const addr = address.toLowerCase()
    const { rows } = await db.sql`
      SELECT id
      FROM waitlist_signups
      WHERE lower(primary_wallet) = ${addr} OR lower(embedded_wallet) = ${addr}
      LIMIT 1;
    `
    return rows.length > 0
  } catch {
    return false
  }
}

async function supabaseIsAllowlisted(addresses: string[]): Promise<boolean> {
  const addrs = (addresses ?? [])
    .map((a) => (typeof a === 'string' ? a.trim().toLowerCase() : ''))
    .filter((a) => isAddressLike(a))
  if (addrs.length === 0) return false

  const supabase = getSupabaseAdmin()
  const res = await supabase
    .from('creator_allowlist')
    .select('address')
    .in('address', addrs)
    .is('revoked_at', null)
    .limit(1)
  if (res.error) throw new Error(res.error.message)
  return Array.isArray(res.data) && res.data.length > 0
}

async function supabaseHasLinkedWallet(address: string | null): Promise<boolean> {
  if (!address || !isAddressLike(address)) return false
  const supabase = getSupabaseAdmin()
  try {
    const res = await supabase.from('creator_wallets').select('wallet_address').eq('wallet_address', address.toLowerCase()).limit(1)
    if (res.error) return false
    return Array.isArray(res.data) && res.data.length > 0
  } catch {
    return false
  }
}

async function supabaseIsWaitlisted(address: string | null): Promise<boolean> {
  if (!address || !isAddressLike(address)) return false
  const supabase = getSupabaseAdmin()
  try {
    const addr = address.toLowerCase()
    const res = await supabase
      .from('waitlist_signups')
      .select('id')
      .or(`primary_wallet.eq.${addr},embedded_wallet.eq.${addr}`)
      .limit(1)
    if (res.error) return false
    return Array.isArray(res.data) && res.data.length > 0
  } catch {
    return false
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const addressRaw = typeof req.query?.address === 'string' ? req.query.address.trim() : ''
  const coinRaw = typeof req.query?.coin === 'string' ? req.query.coin.trim() : ''

  const address = isAddressLike(addressRaw) ? addressRaw.toLowerCase() : null
  const coin = isAddressLike(coinRaw) ? coinRaw.toLowerCase() : null

  const parties = coin ? await resolveCoinParties(coin as `0x${string}`) : { creator: null, payoutRecipient: null }
  const creator = parties.creator
  const payoutRecipient = parties.payoutRecipient

  const addressesToCheck: string[] = []
  if (address) addressesToCheck.push(address)
  if (creator) addressesToCheck.push(creator)
  if (payoutRecipient) addressesToCheck.push(payoutRecipient)

  if (isSupabaseAdminConfigured()) {
    try {
      const mode: AllowlistMode = 'enforced'
      const [allowlisted, linked, waitlisted] = await Promise.all([
        supabaseIsAllowlisted(addressesToCheck),
        supabaseHasLinkedWallet(address),
        supabaseIsWaitlisted(address),
      ])
      const allowed = allowlisted || linked || waitlisted
      return res.status(200).json({
        success: true,
        data: { address, coin, creator, payoutRecipient, mode, allowed } satisfies CreatorAllowlistResponse,
      } satisfies ApiEnvelope<CreatorAllowlistResponse>)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Supabase allowlist check failed'
      return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
    }
  }

  if (isDbConfigured()) {
    const db = await getDb()
    if (!db) {
      return res
        .status(503)
        .json({ success: false, error: getDbInitError() || 'Database unavailable' } satisfies ApiEnvelope<never>)
    }
    const mode: AllowlistMode = 'enforced'
    const [allowlisted, linked, waitlisted] = await Promise.all([
      dbIsAllowlisted(db, addressesToCheck),
      dbHasLinkedWallet(db, address),
      dbIsWaitlisted(db, address),
    ])
    const allowed = allowlisted || linked || waitlisted
    return res.status(200).json({
      success: true,
      data: {
        address,
        coin,
        creator,
        payoutRecipient,
        mode,
        allowed,
      } satisfies CreatorAllowlistResponse,
    } satisfies ApiEnvelope<CreatorAllowlistResponse>)
  }

  // Fallback (no DB): env allowlist (legacy/simple).
  const allowlist = parseAllowlist(process.env.CREATOR_ALLOWLIST)
  const mode: AllowlistMode = allowlist.size > 0 ? 'enforced' : 'disabled'
  const allowed = mode === 'disabled' ? true : addressesToCheck.some((a) => allowlist.has(a.toLowerCase()))

  return res.status(200).json({
    success: true,
    data: {
      address,
      coin,
      creator,
      payoutRecipient,
      mode,
      allowed,
    } satisfies CreatorAllowlistResponse,
  } satisfies ApiEnvelope<CreatorAllowlistResponse>)
}

