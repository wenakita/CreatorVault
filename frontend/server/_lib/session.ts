import type { VercelRequest } from '@vercel/node'

import { readSessionFromRequest } from '../auth/_shared.js'

declare const process: { env: Record<string, string | undefined> }

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function getSessionAddress(req: VercelRequest): `0x${string}` | null {
  const session = readSessionFromRequest(req)
  const addr = session?.address ? String(session.address) : ''
  if (!isAddressLike(addr)) return null
  return addr.toLowerCase() as `0x${string}`
}

export function isAdminAddress(address: `0x${string}`): boolean {
  const raw = process.env.CREATOR_ACCESS_ADMIN_ADDRESSES
  if (!raw) return false
  const parts = raw
    .split(/[\s,]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
  const addrLc = address.toLowerCase()
  for (const p of parts) {
    if (!isAddressLike(p)) continue
    if (p.toLowerCase() === addrLc) return true
  }
  return false
}


