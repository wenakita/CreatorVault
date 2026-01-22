import type { VercelRequest, VercelResponse } from '@vercel/node'
import { logger } from '../../server/_lib/logger.js'
import { handleOptions, setCors } from '../../server/auth/_shared.js'

declare const process: { env: Record<string, string | undefined> }

const TALENT_API_BASE = 'https://api.talentprotocol.com'
// Server-only secret. Do NOT use client-exposed env vars here.
const TALENT_API_KEY = process.env.TALENT_API_KEY || ''

type Mode = 'passport' | 'socials'

function parseMode(value: unknown): Mode {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (s === 'socials') return 'socials'
  return 'passport'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  if (!TALENT_API_KEY) {
    return res.status(500).json({ success: false, error: 'Talent API not configured' })
  }

  const mode = parseMode(req.query.mode)
  const address = typeof req.query.address === 'string' ? req.query.address.trim() : ''

  if (!address) {
    return res.status(400).json({ success: false, error: 'address parameter is required' })
  }

  try {
    let url: string

    if (mode === 'socials') {
      const qs = new URLSearchParams({ id: address, account_source: 'wallet' })
      url = `${TALENT_API_BASE}/socials?${qs.toString()}`
    } else {
      const query = { walletAddresses: [address], exactMatch: true }
      const sort = { score: { order: 'desc' }, id: { order: 'desc' } }

      const queryString = Object.entries({
        query: JSON.stringify(query),
        sort: JSON.stringify(sort),
        page: '1',
        per_page: '1',
      })
        .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
        .join('&')

      url = `${TALENT_API_BASE}/search/advanced/profiles?${queryString}`
    }

    const response = await fetch(url, {
      headers: {
        'X-API-KEY': TALENT_API_KEY,
        Accept: 'application/json',
      },
    })

    // Cache briefly to reduce rate-limit risk while keeping UX fresh.
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300')

    // Treat "not found" as a soft miss (optional enrichment).
    if (response.status === 404) {
      return res.status(200).json({ success: true, data: null })
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      logger.error('[Talent API] Error', { status: response.status, mode, errorText })
      return res.status(response.status).json({ success: false, error: `Talent API error: ${response.statusText}` })
    }

    const data = (await response.json()) as unknown
    return res.status(200).json({ success: true, data })
  } catch (error) {
    logger.error('[Talent API] Failed', error)
    return res.status(500).json({ success: false, error: 'Failed to fetch Talent data' })
  }
}

