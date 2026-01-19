import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleOptions, setCors } from '../auth/_shared.js'

declare const process: { env: Record<string, string | undefined> }

// Default start block (safe-ish for v4 era). Used when we can't estimate from createdAt.
const DEFAULT_FROM_BLOCK = 30_000_000n
const DEFAULT_BLOCK_TIME_SECONDS = 2n
// Margin blocks around createdAt-based estimate. Keep this small to avoid slow eth_getLogs on public RPCs.
const DEFAULT_MARGIN_BLOCKS = 20_000n

// Coin contract event (emitted on the coin itself)
const COIN_TRADE_REWARDS_EVENT =
  'event CoinTradeRewards(address indexed payoutRecipient,address indexed platformReferrer,address indexed tradeReferrer,address protocolRewardRecipient,uint256 creatorReward,uint256 platformReferrerReward,uint256 traderReferrerReward,uint256 protocolReward,address currency)'

function setCache(res: VercelResponse, seconds: number = 300) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getStringQuery(req: VercelRequest, key: string): string | null {
  const val = req.query?.[key]
  if (typeof val === 'string' && val.trim().length > 0) return val.trim()
  return null
}

function getLogsRpcUrl(): string {
  const logs = process.env.BASE_LOGS_RPC_URL
  if (logs && logs.length > 0) return logs
  const rpc = process.env.BASE_RPC_URL
  if (rpc && rpc.length > 0) return rpc
  return 'https://base.meowrpc.com'
}

function getRange(rpcUrl: string): bigint {
  const raw = process.env.BASE_LOGS_RPC_RANGE
  if (raw && raw.length > 0) {
    try {
      const n = BigInt(raw)
      return n > 0n ? n : 100000n
    } catch {
      return 100000n
    }
  }
  if (rpcUrl.includes('matrixed') || rpcUrl.includes('endpoints.matrixed.link')) return 100000n
  return 300000n
}

function getConcurrency(): number {
  const raw = process.env.BASE_LOGS_RPC_CONCURRENCY
  const n = raw ? Number(raw) : NaN
  if (Number.isFinite(n) && n >= 1 && n <= 20) return Math.floor(n)
  return 6
}

function parsePairs(raw: string): Array<{ coin: string; currency: string; createdAt?: string }> {
  // pairs=0xcoin:0xcurrency[:createdAtSeconds],...
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [coin, currency, createdAt] = pair.split(':').map((x) => x.trim())
      return { coin, currency, createdAt }
    })
    .filter((p) => !!p.coin && !!p.currency)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const recipient = getStringQuery(req, 'recipient')
  const pairsRaw = getStringQuery(req, 'pairs')

  if (!recipient || !pairsRaw) {
    return res.status(400).json({ success: false, error: 'recipient and pairs are required' })
  }
  if (!isAddressLike(recipient)) {
    return res.status(400).json({ success: false, error: `Invalid recipient: ${recipient}` })
  }
  const pairs = parsePairs(pairsRaw)
  if (pairs.length === 0) {
    return res.status(400).json({ success: false, error: 'pairs is empty or invalid' })
  }
  for (const p of pairs) {
    if (!isAddressLike(p.coin)) return res.status(400).json({ success: false, error: `Invalid coin: ${p.coin}` })
    if (!isAddressLike(p.currency)) {
      return res.status(400).json({ success: false, error: `Invalid currency: ${p.currency}` })
    }
    if (p.createdAt) {
      const n = Number(p.createdAt)
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({ success: false, error: `Invalid createdAtSeconds for ${p.coin}` })
      }
    }
  }

  const rpcUrl = getLogsRpcUrl()

  try {
    const { createPublicClient, http, parseAbiItem } = await import('viem')
    const { base } = await import('viem/chains')
    const coinTradeRewardsEvent = parseAbiItem(COIN_TRADE_REWARDS_EVENT)

    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl, { timeout: 25_000 }),
    })

    const latest = await client.getBlockNumber()
    const latestBlock = await client.getBlock({ blockNumber: latest })
    const latestTs = BigInt((latestBlock as any).timestamp ?? 0n)
    const range = getRange(rpcUrl)
    const _concurrency = getConcurrency()

    // --- 2) For each coin, sum CoinTradeRewards.creatorReward for the requested payout currency ---
    const totalsByCoin: Record<string, string> = {}
    const eventsCountByCoin: Record<string, number> = {}
    const blockTime = process.env.BASE_BLOCK_TIME_SECONDS ? BigInt(process.env.BASE_BLOCK_TIME_SECONDS) : DEFAULT_BLOCK_TIME_SECONDS
    const marginBlocks = process.env.COIN_REWARDS_FROM_MARGIN_BLOCKS
      ? BigInt(process.env.COIN_REWARDS_FROM_MARGIN_BLOCKS)
      : DEFAULT_MARGIN_BLOCKS
    const fallbackLookbackBlocks = process.env.COIN_REWARDS_FALLBACK_LOOKBACK_BLOCKS
      ? BigInt(process.env.COIN_REWARDS_FALLBACK_LOOKBACK_BLOCKS)
      : 80_000n

    // Group pairs by coin (one currency per coin in our UI)
    const perCoin: Array<{ coin: string; currency: string; createdAtSeconds?: bigint }> = []
    const seenCoin = new Set<string>()
    for (const p of pairs) {
      const coin = p.coin.toLowerCase()
      if (seenCoin.has(coin)) continue
      seenCoin.add(coin)
      let createdAtSeconds: bigint | undefined
      if (p.createdAt) {
        try {
          createdAtSeconds = BigInt(Math.floor(Number(p.createdAt)))
        } catch {
          createdAtSeconds = undefined
        }
      }
      perCoin.push({ coin, currency: p.currency.toLowerCase(), createdAtSeconds })
    }

    // Compute per-coin fromBlock estimates; we’ll query logs across ALL coins in a single getLogs call
    // (small address-array batches) to avoid very slow eth_getLogs on some public RPCs when address arrays are large.
    const wantedCurrencyByCoin = new Map<string, string>()
    const fromBlockByCoin = new Map<string, bigint>()
    const coinAddresses = perCoin.map((p) => {
      const coin = p.coin.toLowerCase()
      wantedCurrencyByCoin.set(coin, p.currency.toLowerCase())

      let fromBlock = latest > fallbackLookbackBlocks ? latest - fallbackLookbackBlocks : 0n
      if (p.createdAtSeconds && latestTs > 0n && blockTime > 0n) {
        const ageSeconds = latestTs > p.createdAtSeconds ? latestTs - p.createdAtSeconds : 0n
        const ageBlocks = ageSeconds / blockTime
        const estimate = latest > ageBlocks ? latest - ageBlocks : 0n
        fromBlock = estimate > marginBlocks ? estimate - marginBlocks : 0n
      }

      fromBlockByCoin.set(coin, fromBlock)
      return coin as any
    })

    // Initialize output maps
    for (const coin of coinAddresses) {
      totalsByCoin[String(coin).toLowerCase()] = '0'
      eventsCountByCoin[String(coin).toLowerCase()] = 0
    }

    const addressBatchSize = process.env.COIN_REWARDS_ADDRESS_BATCH_SIZE
      ? Math.max(1, Math.min(10, Number(process.env.COIN_REWARDS_ADDRESS_BATCH_SIZE)))
      : 3

    for (let offset = 0; offset < coinAddresses.length; offset += addressBatchSize) {
      const batch = coinAddresses.slice(offset, offset + addressBatchSize)
      let minFrom = latest > fallbackLookbackBlocks ? latest - fallbackLookbackBlocks : 0n
      for (const a of batch) {
        const fb = fromBlockByCoin.get(String(a).toLowerCase())
        if (fb !== undefined && fb < minFrom) minFrom = fb
      }

      const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = []
      for (let start = minFrom; start <= latest; start += range + 1n) {
        const end = start + range > latest ? latest : start + range
        ranges.push({ fromBlock: start, toBlock: end })
      }

      for (const r of ranges) {
        const logs = await client.getLogs({
          address: batch as any,
          event: coinTradeRewardsEvent as any,
          args: { payoutRecipient: recipient as any } as any,
          fromBlock: r.fromBlock,
          toBlock: r.toBlock,
        })

        for (const l of logs as any[]) {
          const coin = String(l.address ?? '').toLowerCase()
          if (!coin) continue
          const wantedCurrency = wantedCurrencyByCoin.get(coin)
          if (!wantedCurrency) continue
          const args = l.args as any
          const logCurrency = String(args?.currency ?? '').toLowerCase()
          if (logCurrency !== wantedCurrency) continue
          const prev = BigInt(totalsByCoin[coin] ?? '0')
          totalsByCoin[coin] = (prev + BigInt(args?.creatorReward ?? 0n)).toString()
          eventsCountByCoin[coin] = (eventsCountByCoin[coin] ?? 0) + 1
        }
      }
    }

    setCache(res, 60 * 10)
    return res.status(200).json({
      success: true,
      data: {
        recipient: recipient.toLowerCase(),
        fromBlock: DEFAULT_FROM_BLOCK.toString(),
        toBlock: latest.toString(),
        usedCreatedAtEstimates: true,
        blockTimeSeconds: blockTime.toString(),
        marginBlocks: marginBlocks.toString(),
        coinCount: coinAddresses.length,
        addressBatchSize,
        totalsByCoin,
        eventsCountByCoin,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to compute coin trade rewards' })
  }
}

