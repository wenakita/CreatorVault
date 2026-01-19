import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createAppClient, viemConnector } from '@farcaster/auth-client'

import {
  type ApiEnvelope,
  COOKIE_SIWF_NONCE,
  SIWF_NONCE_TTL_SECONDS,
  clearCookie,
  domainMatches,
  getFarcasterDomain,
  handleOptions,
  parseCookies,
  parseSiwfBasics,
  readJsonBody,
  setCors,
  setNoStore,
} from './_shared.js'

declare const process: { env: Record<string, string | undefined> }

type VerifyBody = { message?: string; signature?: string }
type VerifyResponse = { fid: number }

const relay = 'https://relay.farcaster.xyz'
const rpcUrl = (process.env.FARCASTER_AUTH_RPC_URL || '').trim() || 'https://mainnet.optimism.io'
const appClient = createAppClient({
  relay,
  ethereum: viemConnector({ rpcUrl }),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const domain = getFarcasterDomain()
  if (!domain) {
    return res
      .status(501)
      .json({ success: false, error: 'FARCASTER_DOMAIN is not configured' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<VerifyBody>(req)
  const message = typeof body?.message === 'string' ? body.message : ''
  const signatureRaw = typeof body?.signature === 'string' ? body.signature : ''
  const signature = signatureRaw.startsWith('0x') ? (signatureRaw as `0x${string}`) : null
  if (!message || !signature) {
    return res.status(400).json({ success: false, error: 'Missing message or signature' } satisfies ApiEnvelope<never>)
  }

  const parsed = parseSiwfBasics(message)
  if (!parsed) {
    return res.status(400).json({ success: false, error: 'Invalid message' } satisfies ApiEnvelope<never>)
  }

  if (!domainMatches(parsed.domain, domain)) {
    return res.status(400).json({ success: false, error: 'Domain mismatch' } satisfies ApiEnvelope<never>)
  }

  const cookies = parseCookies(req)
  const cookieNonce = cookies[COOKIE_SIWF_NONCE] ?? ''
  if (!cookieNonce || cookieNonce !== parsed.nonce) {
    return res.status(400).json({ success: false, error: 'Nonce mismatch' } satisfies ApiEnvelope<never>)
  }

  // Best-effort replay window: message must be recent.
  const issuedAtMs = Date.parse(parsed.issuedAt)
  if (!Number.isFinite(issuedAtMs) || Date.now() - issuedAtMs > SIWF_NONCE_TTL_SECONDS * 1000) {
    return res.status(400).json({ success: false, error: 'Message expired' } satisfies ApiEnvelope<never>)
  }

  try {
    const result = await appClient.verifySignInMessage({
      domain,
      nonce: parsed.nonce,
      message,
      signature,
      acceptAuthAddress: true,
    })

    if (!result?.success || typeof result?.fid !== 'number' || result.fid <= 0) {
      return res.status(401).json({ success: false, error: 'Signature invalid' } satisfies ApiEnvelope<never>)
    }

    // One-time nonce: clear after successful verification.
    clearCookie(req, res, COOKIE_SIWF_NONCE)

    return res.status(200).json({
      success: true,
      data: { fid: result.fid } satisfies VerifyResponse,
    } satisfies ApiEnvelope<VerifyResponse>)
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to verify sign-in' } satisfies ApiEnvelope<never>)
  }
}

