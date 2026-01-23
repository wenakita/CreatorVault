import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  readSessionFromRequest,
  setCors,
  setNoStore,
} from '../server/auth/_shared.js'
import { getDb } from '../server/_lib/postgres.js'
import { ensureCreatorWalletsSchema } from '../server/_lib/creatorWallets.js'
import { isAddressLike, resolveCoinPartiesAndOwner } from '../server/_lib/coinParties.js'

type ClaimBody = { coinAddress?: string }

type ClaimResponse = {
  coinAddress: string
  walletAddress: string
  walletRole: 'creator' | 'payout'
  creator: string | null
  payoutRecipient: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const session = readSessionFromRequest(req)
  const wallet = session?.address ? String(session.address).toLowerCase() : ''
  if (!wallet || !isAddressLike(wallet)) {
    return res.status(401).json({ success: false, error: 'Wallet not verified' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<ClaimBody>(req)
  const coinRaw = typeof body?.coinAddress === 'string' ? body.coinAddress.trim() : ''
  const coin = isAddressLike(coinRaw) ? (coinRaw.toLowerCase() as `0x${string}`) : null
  if (!coin) {
    return res.status(400).json({ success: false, error: 'Invalid coin address' } satisfies ApiEnvelope<never>)
  }

  const parties = await resolveCoinPartiesAndOwner(coin)
  const creator = parties.creator
  const payoutRecipient = parties.payoutRecipient
  const owner = parties.owner
  if (!creator && !payoutRecipient && !owner) {
    return res.status(404).json({ success: false, error: 'Coin not found' } satisfies ApiEnvelope<never>)
  }

  // Some coins expose an Ownable-style `owner()` that may not equal `creator()` or `payoutRecipient()`.
  // We treat `owner` as a valid "creator" claimant.
  const role = wallet === creator ? 'creator' : wallet === payoutRecipient ? 'payout' : wallet === owner ? 'creator' : null
  if (!role) {
    return res.status(403).json({
      success: false,
      error: 'Wallet does not match creator or payout recipient',
    } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  }
  await ensureCreatorWalletsSchema(db)

  await db.sql`
    INSERT INTO creator_wallets (
      coin_address,
      wallet_address,
      wallet_role,
      verified_via,
      verified_at,
      created_at
    )
    VALUES (
      ${coin},
      ${wallet},
      ${role},
      'siwe',
      NOW(),
      NOW()
    )
    ON CONFLICT (coin_address, wallet_address)
    DO UPDATE SET wallet_role = EXCLUDED.wallet_role, verified_via = 'siwe', verified_at = NOW();
  `

  const data: ClaimResponse = {
    coinAddress: coin,
    walletAddress: wallet,
    walletRole: role,
    creator,
    payoutRecipient,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ClaimResponse>)
}
