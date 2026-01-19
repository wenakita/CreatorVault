import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Errors, createClient } from '@farcaster/quick-auth'

import { type ApiEnvelope, getFarcasterDomain, setCors, setNoStore, handleOptions } from './_shared.js'

type FarcasterMe = {
  fid: number
  tokenExp: number
  primaryAddress?: string | null
}

const client = createClient()

async function fetchPrimaryAddress(fid: number): Promise<string | null> {
  if (!Number.isFinite(fid) || fid <= 0) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4_000)
  try {
    const res = await fetch(
      `https://api.farcaster.xyz/fc/primary-address?fid=${encodeURIComponent(String(fid))}&protocol=ethereum`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      },
    )
    if (!res.ok) return null
    const json = (await res.json().catch(() => null)) as any
    const addr = json?.result?.address?.address
    return typeof addr === 'string' && addr.startsWith('0x') ? addr : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const domain = getFarcasterDomain()
  if (!domain) {
    return res
      .status(501)
      .json({ success: false, error: 'FARCASTER_DOMAIN is not configured' } satisfies ApiEnvelope<never>)
  }

  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : ''
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing token' } satisfies ApiEnvelope<never>)
  }

  const token = authorization.slice('bearer '.length).trim()
  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing token' } satisfies ApiEnvelope<never>)
  }

  try {
    const payload = await client.verifyJwt({ token, domain })
    const fid = payload.sub
    const tokenExp = payload.exp

    const primaryAddress = await fetchPrimaryAddress(fid)

    return res.status(200).json({
      success: true,
      data: {
        fid,
        tokenExp,
        primaryAddress,
      } satisfies FarcasterMe,
    } satisfies ApiEnvelope<FarcasterMe>)
  } catch (e: unknown) {
    if (e instanceof Errors.InvalidTokenError) {
      return res.status(401).json({ success: false, error: 'Invalid token' } satisfies ApiEnvelope<never>)
    }
    return res.status(500).json({ success: false, error: 'Failed to verify token' } satisfies ApiEnvelope<never>)
  }
}

