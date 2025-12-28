import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getCoinsLastTraded,
  getCoinsLastTradedUnique,
  getCoinsMostValuable,
  getCoinsNew,
  getCoinsTopGainers,
  getCoinsTopVolume24h,
} from '@zoralabs/coins-sdk'

import { getNumberQuery, getStringQuery, handleOptions, requireServerKey, setCache, setCors } from './_shared'

type ExploreList =
  | 'TOP_GAINERS'
  | 'TOP_VOLUME_24H'
  | 'MOST_VALUABLE'
  | 'NEW'
  | 'LAST_TRADED'
  | 'LAST_TRADED_UNIQUE'

function parseList(value: string | null): ExploreList {
  switch (value) {
    case 'TOP_VOLUME_24H':
    case 'MOST_VALUABLE':
    case 'NEW':
    case 'LAST_TRADED':
    case 'LAST_TRADED_UNIQUE':
      return value
    default:
      return 'TOP_GAINERS'
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  if (!requireServerKey()) {
    return res.status(501).json({ success: false, error: 'ZORA_SERVER_API_KEY is not configured' })
  }

  const list = parseList(getStringQuery(req, 'list'))
  const count = Math.min(Math.max(getNumberQuery(req, 'count') ?? 20, 1), 50)
  const after = getStringQuery(req, 'after') ?? undefined

  try {
    const options = { count, after }
    const response =
      list === 'TOP_GAINERS'
        ? await getCoinsTopGainers(options)
        : list === 'TOP_VOLUME_24H'
          ? await getCoinsTopVolume24h(options)
          : list === 'MOST_VALUABLE'
            ? await getCoinsMostValuable(options)
            : list === 'NEW'
              ? await getCoinsNew(options)
              : list === 'LAST_TRADED'
                ? await getCoinsLastTraded(options)
                : await getCoinsLastTradedUnique(options)

    setCache(res, 300)
    return res.status(200).json({
      success: true,
      data: response.data?.exploreList ?? null,
    })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500
    return res.status(status).json({
      success: false,
      error: e?.message || 'Failed to fetch explore list',
    })
  }
}


