import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, COOKIE_NONCE, handleOptions, makeNonce, makeNonceToken, setCookie, setCors, setNoStore } from '../../server/auth/_shared'

type NonceResponse = {
  nonce: string
  nonceToken: string
  issuedAt: string
  domain: string
  uri: string
  chainId: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const nonce = makeNonce()
  const nonceToken = makeNonceToken({ nonce })
  const issuedAt = new Date().toISOString()
  const host = typeof req.headers?.host === 'string' ? req.headers.host : ''
  const domain = host || 'localhost'
  const proto = typeof req.headers?.['x-forwarded-proto'] === 'string' ? req.headers['x-forwarded-proto'] : 'http'
  const uri = `${proto === 'https' ? 'https' : 'http'}://${domain}`

  // Store nonce in an HttpOnly cookie so the verify step can bind signature → browser session.
  setCookie(req, res, COOKIE_NONCE, nonce, { httpOnly: true, maxAgeSeconds: 60 * 15 })

  return res.status(200).json({
    success: true,
    data: {
      nonce,
      nonceToken,
      issuedAt,
      domain,
      uri,
      chainId: 8453,
    } satisfies NonceResponse,
  } satisfies ApiEnvelope<NonceResponse>)
}


