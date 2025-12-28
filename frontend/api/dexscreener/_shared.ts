import type { VercelRequest, VercelResponse } from '@vercel/node'

export function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
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


