import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getNumberQuery, getStringQuery, handleOptions, isAddressLike, setCache, setCors } from '../../../server/zora/_shared.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type ExploreList = {
  edges?: Array<{ node?: any; cursor?: string }>
  pageInfo?: { hasNextPage?: boolean; endCursor?: string }
}

type TopCreatorsGqlResponse = {
  data?: {
    exploreList?: ExploreList
  }
  errors?: Array<{ message?: string }>
}

const TOP_CREATORS_QUERY_HASH = 'e716b6981e0642afe76cf2001296d4bc'
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

async function fetchJson<T>(url: string, body: unknown, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`Zora HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return undefined
}

function mapPreviewImageFromDownloadableUri(url: unknown, blurhash: unknown) {
  const u = typeof url === 'string' && url.trim().length > 0 ? url.trim() : null
  const b = typeof blurhash === 'string' && blurhash.trim().length > 0 ? blurhash.trim() : undefined
  if (!u) return undefined
  return { small: u, medium: u, ...(b ? { blurhash: b } : {}) }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const count = Math.min(Math.max(getNumberQuery(req, 'count') ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
  const after = getStringQuery(req, 'after') ?? null

  try {
    // Uses Zora's persisted query hash. No user auth required for this endpoint.
    const body = {
      operationName: 'TopCreatorsQuery',
      variables: { listType: 'MOST_VALUABLE_CREATORS', first: count, after },
      hash: TOP_CREATORS_QUERY_HASH,
    }

    const raw = await fetchJson<TopCreatorsGqlResponse>('https://api.zora.co/universal/graphql', body, 10_000)
    const list = raw?.data?.exploreList ?? null
    if (!list) {
      const msg = raw?.errors?.[0]?.message
      return res.status(502).json({ success: false, error: msg || 'Failed to load creators' } satisfies ApiEnvelope<never>)
    }

    const edges = (list.edges ?? [])
      .map((edge) => {
        const n = edge?.node
        const addr = typeof n?.address === 'string' ? n.address : ''
        if (!addr || !isAddressLike(addr)) return null

        const title = typeof n?.title === 'string' && n.title.trim().length > 0 ? n.title.trim() : undefined
        const handle =
          typeof n?.creatorProfile?.handle === 'string' && n.creatorProfile.handle.trim().length > 0
            ? n.creatorProfile.handle.trim()
            : undefined

        const displayName = handle ?? title ?? addr
        const chainId = typeof n?.chainId === 'number' && Number.isFinite(n.chainId) ? n.chainId : undefined

        const creatorProfileId = asString(n?.creatorProfile?.id)
        const creatorAvatar = mapPreviewImageFromDownloadableUri(n?.creatorProfile?.avatar?.downloadableUri, n?.creatorProfile?.avatar?.blurhash)

        const mediaPreview =
          mapPreviewImageFromDownloadableUri(n?.mediaContent?.previewImage?.downloadableUri, n?.mediaContent?.previewImage?.blurhash) ??
          mapPreviewImageFromDownloadableUri(n?.mediaContent?.downloadableUri, n?.mediaContent?.blurhash)

        const mediaContent =
          mediaPreview || typeof n?.mediaContent?.originalUri === 'string'
            ? {
                mimeType: asString(n?.mediaContent?.mimeType),
                originalUri: asString(n?.mediaContent?.originalUri),
                previewImage: mediaPreview,
              }
            : undefined

        return {
          cursor: typeof edge?.cursor === 'string' ? edge.cursor : undefined,
          node: {
            id: asString(n?.id),
            name: displayName,
            symbol: displayName,
            address: addr,
            coinType: 'CREATOR',
            chainId,
            createdAt: asString(n?.createdAt),
            totalSupply: asString(n?.totalSupply),
            totalVolume: asString(n?.totalVolume),
            marketCap: asString(n?.marketCap),
            marketCapDelta24h: asString(n?.marketCapDelta24h),
            uniqueHolders: typeof n?.uniqueHolders === 'number' && Number.isFinite(n.uniqueHolders) ? n.uniqueHolders : undefined,
            creatorProfile:
              handle || creatorAvatar
                ? {
                    id: creatorProfileId,
                    handle,
                    avatar: creatorAvatar ? { previewImage: creatorAvatar } : undefined,
                  }
                : undefined,
            mediaContent,
          },
        }
      })
      .filter(Boolean)

    setCache(res, 300)
    return res.status(200).json({
      success: true,
      data: {
        edges,
        pageInfo: list.pageInfo ?? null,
        count,
      },
    } satisfies ApiEnvelope<any>)
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500
    return res.status(status).json({ success: false, error: e?.message || 'Failed to fetch creators' } satisfies ApiEnvelope<never>)
  }
}


