import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getProfile } from '@zoralabs/coins-sdk'

import { getStringQuery, handleOptions, requireServerKey, setCache, setCors } from './_shared'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  if (!requireServerKey()) {
    return res.status(501).json({ success: false, error: 'ZORA_SERVER_API_KEY is not configured' })
  }

  const identifier = getStringQuery(req, 'identifier')
  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Missing identifier' })
  }

  try {
    const response = await getProfile({ identifier })

    setCache(res, 300)
    // Docs note profile types are WIP in the SDK; pass-through for now.
    return res.status(200).json({ success: true, data: (response as any)?.data?.profile ?? null })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500
    return res.status(status).json({
      success: false,
      error: e?.message || 'Failed to fetch profile',
    })
  }
}


