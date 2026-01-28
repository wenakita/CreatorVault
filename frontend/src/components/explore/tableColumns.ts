export type ExploreTableVariant = 'creators' | 'content'

export type ExploreSortKey = 'volume' | 'marketCap' | 'priceChange' | 'new'

export type ExploreTableGroupId = 'identity' | 'market' | 'fees' | 'payout'

export type ExploreTableColumnId =
  | 'rank'
  | 'name'
  | 'feeBadge'
  | 'holders'
  | 'marketCap'
  | 'volume'
  | 'priceChange'
  | 'creatorFee'
  | 'platformFee'
  | 'lpLock'
  | 'zoraFee'
  | 'dopplerFee'
  | 'payoutTo'

export type ExploreColumnAlign = 'left' | 'right' | 'center'

export type ExploreTableColumn = {
  id: ExploreTableColumnId
  label: string
  group: ExploreTableGroupId
  /** Fixed pixel width for DeFiLlama-style dense tables. */
  widthPx: number
  align?: ExploreColumnAlign
  /** If set, clicking the header should map to this sort key. */
  sortKey?: ExploreSortKey
  /** Sticky-left column (rank/name only). */
  sticky?: boolean
}

export type ExploreTableGroup = {
  id: ExploreTableGroupId
  label: string
}

export const EXPLORE_TABLE_GROUPS: ExploreTableGroup[] = [
  { id: 'identity', label: 'Identity' },
  { id: 'market', label: 'Market' },
  { id: 'fees', label: 'Fees' },
  { id: 'payout', label: 'Payout' },
] as const

function getVolumeLabel(timeframe: string): string {
  const labels: Record<string, string> = {
    '1h': 'Vol 1H',
    '1d': 'Vol 24H',
    '1w': 'Vol 7D',
    '1m': 'Vol 30D',
    '1y': 'Vol 1Y',
  }
  return labels[timeframe] || 'Vol 24H'
}

export function getExploreColumns(opts: { variant: ExploreTableVariant; timeframe?: string }): ExploreTableColumn[] {
  const timeframe = opts.timeframe ?? '1d'
  const nameLabel = opts.variant === 'content' ? 'Content' : 'Token'

  // A DeFiLlama-like table is intentionally dense and fixed-width, with horizontal scroll.
  return [
    { id: 'rank', label: '#', group: 'identity', widthPx: 48, align: 'right', sticky: true },
    { id: 'name', label: nameLabel, group: 'identity', widthPx: 300, align: 'left', sticky: true },
    { id: 'feeBadge', label: 'Fee', group: 'identity', widthPx: 56, align: 'center' },

    { id: 'holders', label: 'Holders', group: 'market', widthPx: 96, align: 'right' },
    { id: 'marketCap', label: 'MCap', group: 'market', widthPx: 120, align: 'right', sortKey: 'marketCap' },
    { id: 'volume', label: getVolumeLabel(timeframe), group: 'market', widthPx: 120, align: 'right', sortKey: 'volume' },
    { id: 'priceChange', label: 'Δ 24H', group: 'market', widthPx: 92, align: 'right', sortKey: 'priceChange' },

    { id: 'creatorFee', label: 'Creator', group: 'fees', widthPx: 96, align: 'right' },
    { id: 'platformFee', label: 'Platform', group: 'fees', widthPx: 96, align: 'right' },
    { id: 'lpLock', label: 'LP Lock', group: 'fees', widthPx: 96, align: 'right' },
    { id: 'zoraFee', label: 'Zora', group: 'fees', widthPx: 84, align: 'right' },
    { id: 'dopplerFee', label: 'Doppler', group: 'fees', widthPx: 92, align: 'right' },

    { id: 'payoutTo', label: 'Payout To', group: 'payout', widthPx: 132, align: 'left' },
  ]
}

export function getGridTemplateColumns(columns: ExploreTableColumn[]): string {
  return columns.map((c) => `${c.widthPx}px`).join(' ')
}

export function getStickyLeftMap(columns: ExploreTableColumn[]): Record<ExploreTableColumnId, number> {
  // Computes the left offsets (in px) for sticky columns, based on the fixed widths.
  let acc = 0
  const out: Partial<Record<ExploreTableColumnId, number>> = {}
  for (const c of columns) {
    if (c.sticky) out[c.id] = acc
    acc += c.widthPx
  }
  return out as Record<ExploreTableColumnId, number>
}

