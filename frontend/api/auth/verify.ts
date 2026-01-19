import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  clearCookie,
  COOKIE_NONCE,
  COOKIE_SESSION,
  handleOptions,
  hostMatchesDomain,
  makeNonceToken,
  makeSessionToken,
  parseCookies,
  parseSiweMessage,
  readNonceToken,
  readJsonBody,
  setCookie,
  setCors,
  setNoStore,
  verifySiweSignature,
} from './_shared.js'

type VerifyBody = { message?: string; signature?: string; nonceToken?: string }

type VerifyResponse = {
  address: string
  sessionToken: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<VerifyBody>(req)
  const message = typeof body?.message === 'string' ? body.message : ''
  const signature = typeof body?.signature === 'string' ? body.signature : ''
  const nonceTokenRaw = typeof body?.nonceToken === 'string' ? body.nonceToken : ''
  if (!message || !signature) {
    return res.status(400).json({ success: false, error: 'Missing message or signature' } satisfies ApiEnvelope<never>)
  }

  const parsed = parseSiweMessage(message)
  if (!parsed) {
    return res.status(400).json({ success: false, error: 'Invalid message' } satisfies ApiEnvelope<never>)
  }

  const host = typeof req.headers?.host === 'string' ? req.headers.host : ''
  if (!hostMatchesDomain(host, parsed.domain)) {
    return res.status(400).json({ success: false, error: 'Domain mismatch' } satisfies ApiEnvelope<never>)
  }

  const cookies = parseCookies(req)
  const cookieNonce = cookies[COOKIE_NONCE] ?? ''
  const cookieMatches = cookieNonce && cookieNonce === parsed.nonce
  if (!cookieMatches) {
    // Fallback for embedded contexts where cookies may be blocked: validate the signed nonce token.
    const nonceToken = nonceTokenRaw ? readNonceToken(nonceTokenRaw) : null
    if (!nonceToken || nonceToken.nonce !== parsed.nonce) {
      return res.status(400).json({ success: false, error: 'Nonce mismatch' } satisfies ApiEnvelope<never>)
    }
  }

  // Best-effort replay window: message must be recent.
  const issuedAtMs = Date.parse(parsed.issuedAt)
  if (!Number.isFinite(issuedAtMs) || Date.now() - issuedAtMs > 1000 * 60 * 15) {
    return res.status(400).json({ success: false, error: 'Message expired' } satisfies ApiEnvelope<never>)
  }

  const verified = await verifySiweSignature({ message, signature })
  if (!verified) {
    return res.status(401).json({ success: false, error: 'Signature invalid' } satisfies ApiEnvelope<never>)
  }

  const token = makeSessionToken({ address: verified.address })
  setCookie(req, res, COOKIE_SESSION, token, { httpOnly: true, maxAgeSeconds: 60 * 60 * 24 * 7 })
  clearCookie(req, res, COOKIE_NONCE)

  return res.status(200).json({
    success: true,
    data: { address: verified.address, sessionToken: token } satisfies VerifyResponse,
  } satisfies ApiEnvelope<VerifyResponse>)
}



