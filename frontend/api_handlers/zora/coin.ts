import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Address } from 'viem'

import {
  DEFAULT_CHAIN_ID,
  getNumberQuery,
  getStringQuery,
  handleOptions,
  isAddressLike,
  requireServerKey,
  setCache,
  setCors,
} from '../../server/zora/_shared.js'

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

  const address = getStringQuery(req, 'address')
  if (!address || !isAddressLike(address)) {
    return res.status(400).json({ success: false, error: 'Invalid address' })
  }

  const chain = getNumberQuery(req, 'chain') ?? DEFAULT_CHAIN_ID

  try {
    // Dynamic import to avoid TS export-resolution issues in some editor/lint configs.
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)
    const response = await sdk.getCoin({
      address: address as Address,
      chain,
    })

    // Coin stats can move quickly; keep this short so UI matches zora.co more closely.
    setCache(res, 60)
    return res.status(200).json({ success: true, data: response.data?.zora20Token ?? null })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500
    return res.status(status).json({
      success: false,
      error: e?.message || 'Failed to fetch coin',
    })
  }
}

