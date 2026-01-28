import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getStringQuery, handleOptions, requireServerKey, setCache, setCors } from '../../../server/zora/_shared.js'

type ExploreList =
  | 'NEW_CREATORS'
  | 'TOP_VOLUME_CREATORS_24H'

type MetricsScope = 'creators'

type MetricsResponse = {
  scope: MetricsScope
  updatedAt: string
  totals: {
    creatorsTotal: number | null
    creatorsNew24h: number | null
    creatorCoinsMarketCapUsd: number | null
    creatorCoinsVolume24hUsd: number | null
    partial: boolean
    sampledCreators: number
  }
}

function parseScope(v: string | null): MetricsScope {
  return v === 'creators' ? 'creators' : 'creators'
}

function toNumber(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  if (!Number.isFinite(n)) return null
  return n
}

function extractList(response: any): any {
  return response?.data?.exploreList ?? response?.data?.creatorCoins ?? response?.data?.coins ?? null
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

  const scope = parseScope(getStringQuery(req, 'scope'))

  try {
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)

    const BATCH = 50
    const MAX_ITEMS = 2000
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000

    async function fetchPage(list: ExploreList, after?: string) {
      const options = { count: BATCH, after }
      if (list === 'TOP_VOLUME_CREATORS_24H') return await sdk.getExploreTopVolumeCreators24h(options)
      return await sdk.getCreatorCoins(options) // NEW_CREATORS
    }

    // 1) Totals for creator coins (market cap + 24h volume) via top-volume list.
    let cursor: string | undefined = undefined
    let sumMarketCap = 0
    let sumVol24h = 0
    let sampledCreators = 0
    let creatorsTotal: number | null = null
    let partial = false

    while (sampledCreators < MAX_ITEMS) {
      const resp = await fetchPage('TOP_VOLUME_CREATORS_24H', cursor)
      const list = extractList(resp)
      if (!list) break

      if (creatorsTotal == null) {
        const count = toNumber(list?.count)
        creatorsTotal = count != null ? Math.max(0, Math.floor(count)) : null
      }

      const edges = Array.isArray(list?.edges) ? list.edges : []
      for (const e of edges) {
        const coin = e?.node
        if (!coin) continue
        const mc = toNumber(coin.marketCap)
        const v = toNumber(coin.volume24h)
        if (mc != null) sumMarketCap += mc
        if (v != null) sumVol24h += v
        sampledCreators++
        if (sampledCreators >= MAX_ITEMS) {
          partial = true
          break
        }
      }

      const hasNext = Boolean(list?.pageInfo?.hasNextPage)
      const next = typeof list?.pageInfo?.endCursor === 'string' ? list.pageInfo.endCursor : undefined
      if (!hasNext || !next || sampledCreators >= MAX_ITEMS) break
      cursor = next
    }

    // 2) New creators in last 24h via NEW_CREATORS list. Stop once we pass 24h.
    let newCursor: string | undefined = undefined
    let creatorsNew24h = 0
    let newCounted = 0
    let newPartial = false

    while (newCounted < MAX_ITEMS) {
      const resp = await fetchPage('NEW_CREATORS', newCursor)
      const list = extractList(resp)
      if (!list) break

      // If count exists and we never got creatorsTotal, use it as a fallback.
      if (creatorsTotal == null) {
        const count = toNumber(list?.count)
        creatorsTotal = count != null ? Math.max(0, Math.floor(count)) : null
      }

      const edges = Array.isArray(list?.edges) ? list.edges : []
      let sawOld = false
      for (const e of edges) {
        const coin = e?.node
        if (!coin) continue
        const createdAt = typeof coin.createdAt === 'string' ? Date.parse(coin.createdAt) : NaN
        if (!Number.isFinite(createdAt)) continue
        if (createdAt < dayAgo) {
          sawOld = true
          continue
        }
        creatorsNew24h++
        newCounted++
        if (newCounted >= MAX_ITEMS) {
          newPartial = true
          break
        }
      }

      const hasNext = Boolean(list?.pageInfo?.hasNextPage)
      const next = typeof list?.pageInfo?.endCursor === 'string' ? list.pageInfo.endCursor : undefined
      if (sawOld || !hasNext || !next || newCounted >= MAX_ITEMS) break
      newCursor = next
    }

    partial = partial || newPartial

    const payload: MetricsResponse = {
      scope,
      updatedAt: new Date().toISOString(),
      totals: {
        creatorsTotal,
        creatorsNew24h: creatorsNew24h,
        creatorCoinsMarketCapUsd: sampledCreators > 0 ? sumMarketCap : null,
        creatorCoinsVolume24hUsd: sampledCreators > 0 ? sumVol24h : null,
        partial,
        sampledCreators,
      },
    }

    setCache(res, 300)
    return res.status(200).json({ success: true, data: payload })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500
    return res.status(status).json({
      success: false,
      error: e?.message || 'Failed to compute metrics',
    })
  }
}

