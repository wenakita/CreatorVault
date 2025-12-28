import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getNumberQuery, getStringQuery, handleOptions, requireServerKey, setCache, setCors } from './_shared.js'

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

  const key = requireServerKey()
  if (!key) {
    return res.status(501).json({ success: false, error: 'ZORA_SERVER_API_KEY is not configured' })
  }

  const list = parseList(getStringQuery(req, 'list'))
  const count = Math.min(Math.max(getNumberQuery(req, 'count') ?? 20, 1), 50)
  const after = getStringQuery(req, 'after') ?? undefined

  try {
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)

    const options = { count, after }
    const response =
      list === 'TOP_GAINERS'
        ? await sdk.getCoinsTopGainers(options)
        : list === 'TOP_VOLUME_24H'
          ? await sdk.getCoinsTopVolume24h(options)
          : list === 'MOST_VALUABLE'
            ? await sdk.getCoinsMostValuable(options)
            : list === 'NEW'
              ? await sdk.getCoinsNew(options)
              : list === 'LAST_TRADED'
                ? await sdk.getCoinsLastTraded(options)
                : await sdk.getCoinsLastTradedUnique(options)

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


