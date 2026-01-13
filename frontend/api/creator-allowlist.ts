import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from './auth/_shared.js'
import { ensureCreatorAccessSchema, getDb, getDbInitError, isDbConfigured } from './_lib/postgres.js'

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

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
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

function getBaseRpcUrl(): string {
  const env = process.env.BASE_RPC_URL
  if (env && env.length > 0) return env
  const vite = process.env.VITE_BASE_RPC
  if (vite && vite.length > 0) return vite
  return 'https://mainnet.base.org'
}

const COIN_VIEW_ABI = [
  { type: 'function', name: 'creator', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'payoutRecipient', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

async function resolveCoinParties(coin: `0x${string}`): Promise<{ creator: `0x${string}` | null; payoutRecipient: `0x${string}` | null }> {
  try {
    const { createPublicClient, http } = await import('viem')
    const { base } = await import('viem/chains')

    const client = createPublicClient({
      chain: base,
      transport: http(getBaseRpcUrl(), { timeout: 12_000 }),
    })

    const [creator, payoutRecipient] = await Promise.all([
      client.readContract({ address: coin, abi: COIN_VIEW_ABI, functionName: 'creator' }).catch(() => null),
      client.readContract({ address: coin, abi: COIN_VIEW_ABI, functionName: 'payoutRecipient' }).catch(() => null),
    ])

    const c = typeof creator === 'string' && isAddressLike(creator) ? (creator.toLowerCase() as `0x${string}`) : null
    const p = typeof payoutRecipient === 'string' && isAddressLike(payoutRecipient) ? (payoutRecipient.toLowerCase() as `0x${string}`) : null
    return { creator: c, payoutRecipient: p }
  } catch {
    return { creator: null, payoutRecipient: null }
  }
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
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

  if (isDbConfigured()) {
    const db = await getDb()
    if (!db) {
      return res
        .status(503)
        .json({ success: false, error: getDbInitError() || 'Database unavailable' } satisfies ApiEnvelope<never>)
    }
    const mode: AllowlistMode = 'enforced'
    const allowed = await dbIsAllowlisted(db, addressesToCheck)
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


