import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from './auth/_shared.js'

type AllowlistMode = 'disabled' | 'enforced'

type CreatorAllowlistResponse = {
  address: string | null
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const allowlist = parseAllowlist(process.env.CREATOR_ALLOWLIST)
  const mode: AllowlistMode = allowlist.size > 0 ? 'enforced' : 'disabled'

  const addressRaw = typeof req.query?.address === 'string' ? req.query.address.trim() : ''
  const address = isAddressLike(addressRaw) ? addressRaw.toLowerCase() : null

  const allowed = mode === 'disabled' ? true : Boolean(address && allowlist.has(address))

  return res.status(200).json({
    success: true,
    data: {
      address,
      mode,
      allowed,
    } satisfies CreatorAllowlistResponse,
  } satisfies ApiEnvelope<CreatorAllowlistResponse>)
}


