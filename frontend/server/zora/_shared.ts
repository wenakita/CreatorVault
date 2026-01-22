import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors as setCorsAllowlist } from '../auth/_shared'

declare const process: { env: Record<string, string | undefined> }

export const DEFAULT_CHAIN_ID = 8453 // Base mainnet

export function setCors(req: VercelRequest, res: VercelResponse) {
  setCorsAllowlist(req, res)
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    setCors(req, res)
    res.status(200).end()
    return true
  }
  return false
}

export function setCache(res: VercelResponse, seconds: number = 300) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

export function requireServerKey(): string | null {
  const key = process.env.ZORA_SERVER_API_KEY
  if (!key) return null
  return key
}

export function getStringQuery(req: VercelRequest, key: string): string | null {
  const val = req.query?.[key]
  if (typeof val === 'string' && val.trim().length > 0) return val.trim()
  return null
}

export function getNumberQuery(req: VercelRequest, key: string): number | null {
  const raw = getStringQuery(req, key)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}


