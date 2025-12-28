export type ZoraPreviewImage = {
  small?: string
  medium?: string
  blurhash?: string
}

export type ZoraMediaContent = {
  mimeType?: string
  originalUri?: string
  previewImage?: ZoraPreviewImage
}

export type ZoraCreatorProfile = {
  id?: string
  handle?: string
  avatar?: {
    previewImage?: ZoraPreviewImage
  }
}

export type ZoraEarnings = {
  amount?: {
    currencyAddress?: string
    amountRaw?: string
    amountDecimal?: number
  }
  amountUsd?: string
}

export type ZoraPoolCurrencyToken = {
  address?: string
  name?: string
  decimals?: number
}

export type ZoraTokenPrice = {
  priceInUsdc?: string
  currencyAddress?: string
  priceInPoolToken?: string
}

export type ZoraCoin = {
  id?: string
  platformBlocked?: boolean
  name?: string
  description?: string
  address?: string
  symbol?: string
  coinType?: 'CREATOR' | 'CONTENT' | string
  totalSupply?: string
  totalVolume?: string
  volume24h?: string
  createdAt?: string
  creatorAddress?: string
  creatorProfile?: ZoraCreatorProfile
  creatorEarnings?: ZoraEarnings[]
  poolCurrencyToken?: ZoraPoolCurrencyToken
  tokenPrice?: ZoraTokenPrice
  marketCap?: string
  marketCapDelta24h?: string
  chainId?: number
  uniqueHolders?: number
  tokenUri?: string
  platformReferrerAddress?: string
  payoutRecipientAddress?: string
  mediaContent?: ZoraMediaContent
}

export type ZoraEdge<T> = { node?: T; cursor?: string }

export type ZoraPageInfo = {
  hasNextPage?: boolean
  endCursor?: string
}

export type ZoraConnection<T> = {
  edges?: Array<ZoraEdge<T>>
  pageInfo?: ZoraPageInfo
}

export type ZoraExploreList = ZoraConnection<ZoraCoin> & { count?: number }

export type ZoraProfile = {
  id?: string
  handle?: string
  platformBlocked?: boolean
  displayName?: string
  bio?: string
  username?: string
  website?: string
  avatar?: {
    small?: string
    medium?: string
    blurhash?: string
  }
  publicWallet?: { walletAddress?: string }
  creatorCoin?: {
    address?: string
    marketCap?: string
    marketCapDelta24h?: string
  }
  createdCoins?: (ZoraConnection<ZoraCoin> & { count?: number })
}

export type ZoraExploreListType =
  | 'TOP_GAINERS'
  | 'TOP_VOLUME_24H'
  | 'MOST_VALUABLE'
  | 'NEW'
  | 'LAST_TRADED'
  | 'LAST_TRADED_UNIQUE'


