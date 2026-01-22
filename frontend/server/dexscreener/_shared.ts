import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors as setCorsAllowlist } from '../auth/_shared.js'

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

export function setCache(res: VercelResponse, seconds: number = 60) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

export function getStringQuery(req: VercelRequest, key: string): string | null {
  const val = req.query?.[key]
  if (typeof val === 'string' && val.trim().length > 0) return val.trim()
  return null
}

export function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}


