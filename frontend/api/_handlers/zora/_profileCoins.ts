import type { VercelRequest, VercelResponse } from '@vercel/node'
import { DEFAULT_CHAIN_ID, getNumberQuery, getStringQuery, handleOptions, requireServerKey, setCache, setCors } from '../../../server/zora/_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const key = requireServerKey()
  if (!key) {
    return res.status(501).json({ success: false, error: 'ZORA_SERVER_API_KEY is not configured' })
  }

  const identifier = getStringQuery(req, 'identifier')
  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Identifier is required' })
  }

  const count = Math.min(Math.max(getNumberQuery(req, 'count') ?? 20, 1), 50)
  const after = getStringQuery(req, 'after') ?? undefined

  // Default to Base-only coins for CreatorVault.
  const chainIds = [DEFAULT_CHAIN_ID]

  try {
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)
    const response = await sdk.getProfileCoins({
      identifier,
      count,
      after,
      chainIds,
    })

    setCache(res, 300)
    return res.status(200).json({
      success: true,
      data: response.data?.profile ?? null,
    })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500
    return res.status(status).json({
      success: false,
      error: e?.message || 'Failed to fetch profile coins',
    })
  }
}

