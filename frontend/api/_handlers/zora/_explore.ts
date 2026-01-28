import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getNumberQuery, getStringQuery, handleOptions, requireServerKey, setCache, setCors } from '../../../server/zora/_shared.js'

type ExploreList =
  | 'TOP_GAINERS'
  | 'TOP_VOLUME_24H'
  | 'MOST_VALUABLE'
  | 'NEW'
  | 'LAST_TRADED'
  | 'LAST_TRADED_UNIQUE'
  // Creator-specific
  | 'NEW_CREATORS'
  | 'MOST_VALUABLE_CREATORS'
  | 'TOP_VOLUME_CREATORS_24H'
  | 'FEATURED_CREATORS'

function parseList(value: string | null): ExploreList {
  switch (value) {
    case 'TOP_VOLUME_24H':
    case 'MOST_VALUABLE':
    case 'NEW':
    case 'LAST_TRADED':
    case 'LAST_TRADED_UNIQUE':
    case 'NEW_CREATORS':
    case 'MOST_VALUABLE_CREATORS':
    case 'TOP_VOLUME_CREATORS_24H':
    case 'FEATURED_CREATORS':
      return value
    default:
      return 'TOP_GAINERS'
  }
}

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

  const list = parseList(getStringQuery(req, 'list'))
  const count = Math.min(Math.max(getNumberQuery(req, 'count') ?? 20, 1), 50)
  const after = getStringQuery(req, 'after') ?? undefined

  try {
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)

    const options = { count, after }
    
    // Map list type to SDK function
    const sdkFunctions: Record<ExploreList, () => Promise<any>> = {
      'TOP_GAINERS': () => sdk.getCoinsTopGainers(options),
      'TOP_VOLUME_24H': () => sdk.getCoinsTopVolume24h(options),
      'MOST_VALUABLE': () => sdk.getCoinsMostValuable(options),
      'NEW': () => sdk.getCoinsNew(options),
      'LAST_TRADED': () => sdk.getCoinsLastTraded(options),
      'LAST_TRADED_UNIQUE': () => sdk.getCoinsLastTradedUnique(options),
      // Creator-specific
      'NEW_CREATORS': () => sdk.getCreatorCoins(options),
      'MOST_VALUABLE_CREATORS': () => sdk.getMostValuableCreatorCoins(options),
      'TOP_VOLUME_CREATORS_24H': () => sdk.getExploreTopVolumeCreators24h(options),
      'FEATURED_CREATORS': () => sdk.getExploreFeaturedCreators(options),
    }
    
    const fn = sdkFunctions[list] || (() => sdk.getCoinsTopGainers(options))
    const response = await fn()

    // Handle different response structures
    const data = response.data?.exploreList ?? response.data?.creatorCoins ?? response.data?.coins ?? null

    setCache(res, 300)
    return res.status(200).json({
      success: true,
      data,
    })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500
    return res.status(status).json({
      success: false,
      error: e?.message || 'Failed to fetch explore list',
    })
  }
}


