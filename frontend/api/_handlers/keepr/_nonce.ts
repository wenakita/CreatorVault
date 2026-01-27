import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getSessionAddress } from '../../../server/_lib/session.js'
import { buildKeeprJoinMessage, issueKeeprJoinNonce } from '../../../server/_lib/keeprProof.js'

type KeeprNonceResponse = {
  vaultAddress: `0x${string}`
  wallet: `0x${string}`
  nonce: string
  issuedAt: string
  expiresAt: string
  message: string
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const wallet = getSessionAddress(req)
  if (!wallet) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }

  const vaultRaw = typeof req.query?.vaultAddress === 'string' ? req.query.vaultAddress.trim() : ''
  const vaultAddress = isAddressLike(vaultRaw) ? (vaultRaw.toLowerCase() as `0x${string}`) : null
  if (!vaultAddress) {
    return res.status(400).json({ success: false, error: 'Missing vaultAddress' } satisfies ApiEnvelope<never>)
  }

  const { nonce, issuedAt, expiresAt } = await issueKeeprJoinNonce({ wallet, vaultAddress })
  const message = buildKeeprJoinMessage({ wallet, vaultAddress, nonce, issuedAt, expiresAt })

  return res.status(200).json({
    success: true,
    data: { vaultAddress, wallet, nonce, issuedAt, expiresAt, message } satisfies KeeprNonceResponse,
  } satisfies ApiEnvelope<KeeprNonceResponse>)
}

