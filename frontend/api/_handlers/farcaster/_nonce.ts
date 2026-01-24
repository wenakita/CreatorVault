import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  COOKIE_SIWF_NONCE,
  SIWF_NONCE_TTL_SECONDS,
  handleOptions,
  makeNonce,
  setCookie,
  setCors,
  setNoStore,
} from '../../../server/farcaster/_shared.js'
import { makeNonceToken } from '../../../server/auth/_shared.js'

type NonceResponse = { nonce: string; nonceToken: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const nonce = makeNonce()
  const nonceToken = makeNonceToken({ nonce })
  setCookie(req, res, COOKIE_SIWF_NONCE, nonce, { httpOnly: true, maxAgeSeconds: SIWF_NONCE_TTL_SECONDS })

  return res.status(200).json({
    success: true,
    data: { nonce, nonceToken } satisfies NonceResponse,
  } satisfies ApiEnvelope<NonceResponse>)
}

