import type { VercelRequest, VercelResponse } from '@vercel/node'

declare const process: { env: Record<string, string | undefined> }

// Zora v4 coin hook on Base (from `uniswapV4PoolKey.hookAddress`).
const DEFAULT_HOOK = '0xc8d077444625eb300a427a6dfb2b1dbf9b159040'
// First Base block where the hook has bytecode (binary-searched via BASE_RPC_URL).
const DEFAULT_HOOK_DEPLOY_BLOCK = 36237338n

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const ERC20_TRANSFER_EVENT = 'event Transfer(address indexed from,address indexed to,uint256 value)'

// This is emitted by the hook (topicsLen = 1, i.e. no indexed args).
const COIN_MARKET_REWARDS_V4_EVENT =
  'event CoinMarketRewardsV4(address coin,address currency,address payoutRecipient,address platformReferrer,address tradeReferrer,address protocolRewardRecipient,address dopplerRecipient,(uint256 creatorPayoutAmountCurrency,uint256 creatorPayoutAmountCoin,uint256 platformReferrerAmountCurrency,uint256 platformReferrerAmountCoin,uint256 tradeReferrerAmountCurrency,uint256 tradeReferrerAmountCoin,uint256 protocolAmountCurrency,uint256 protocolAmountCoin,uint256 dopplerAmountCurrency,uint256 dopplerAmountCoin) marketRewards)'

const COIN_MARKET_REWARDS_V4_TOPIC0 =
  '0x35b5031218696db1dfd903223a47f38e66a1998e14a942a5d60fddaa49a685fc'

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 300) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  return false
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getStringQuery(req: VercelRequest, key: string): string | null {
  const val = req.query?.[key]
  if (typeof val === 'string' && val.trim().length > 0) return val.trim()
  return null
}

function getNumberQuery(req: VercelRequest, key: string): number | null {
  const v = getStringQuery(req, key)
  if (!v) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return n
}

function getBigIntQuery(req: VercelRequest, key: string): bigint | null {
  const v = getStringQuery(req, key)
  if (!v) return null
  try {
    const n = BigInt(v)
    return n >= 0n ? n : null
  } catch {
    return null
  }
}

function getLogsRpcUrl(): string | null {
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

  // Matrixed endpoint enforces 100k max range.
  if (rpcUrl.includes('matrixed') || rpcUrl.includes('endpoints.matrixed.link')) return 100000n

  return 300000n
}

function getConcurrency(): number {
  const raw = process.env.BASE_LOGS_RPC_CONCURRENCY
  const n = raw ? Number(raw) : NaN
  if (Number.isFinite(n) && n >= 1 && n <= 20) return Math.floor(n)
  return 6
}

function getReceiptConcurrency(): number {
  const raw = process.env.BASE_RECEIPT_CONCURRENCY
  const n = raw ? Number(raw) : NaN
  if (Number.isFinite(n) && n >= 1 && n <= 25) return Math.floor(n)
  return 10
}

// Estimated block time in seconds for Base
const BASE_BLOCK_TIME_SECONDS = 2
// Margin in blocks to add to createdAt to ensure we don't miss events due to timestamp drift
const CREATED_AT_BLOCK_MARGIN = 20_000
// Some RPCs enforce a max number of logs returned per eth_getLogs. Keep this small.
const DEFAULT_HOOK_LOGS_RANGE = 4_000n

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const recipient = getStringQuery(req, 'recipient')
  const currency = getStringQuery(req, 'currency')
  const hook = getStringQuery(req, 'hook') ?? DEFAULT_HOOK
  const coinFilter = getStringQuery(req, 'coin') // optional: return only this coin's total
  const createdAtSeconds = getNumberQuery(req, 'createdAtSeconds') // optional: to narrow fromBlock
  const fromBlockParam = getBigIntQuery(req, 'fromBlock') // optional: explicit fromBlock override

  if (!recipient || !currency) {
    return res.status(400).json({ success: false, error: 'recipient and currency are required' })
  }
  if (!isAddressLike(recipient)) {
    return res.status(400).json({ success: false, error: `Invalid recipient: ${recipient}` })
  }
  if (!isAddressLike(currency)) {
    return res.status(400).json({ success: false, error: `Invalid currency: ${currency}` })
  }
  if (!isAddressLike(hook)) {
    return res.status(400).json({ success: false, error: `Invalid hook: ${hook}` })
  }

  // Native ETH payouts (currency=0x0) are not detectable via ERC-20 Transfer logs.
  // We’ll support ERC-20 currencies first.
  if (currency.toLowerCase() === ZERO_ADDRESS) {
    return res.status(400).json({
      success: false,
      error: 'currency=0x0 (ETH) is not supported by this endpoint yet. Use an ERC-20 pool currency.',
    })
  }

  const recipientLc = recipient.toLowerCase()
  const currencyLc = currency.toLowerCase()
  const hookLc = hook.toLowerCase()

  const rpcUrl = getLogsRpcUrl()
  if (!rpcUrl) {
    return res.status(501).json({ success: false, error: 'BASE_RPC_URL is not configured (server-side).' })
  }

  try {
    const { createPublicClient, decodeEventLog, http, parseAbiItem } = await import('viem')
    const { base } = await import('viem/chains')
    const erc20TransferEvent = parseAbiItem(ERC20_TRANSFER_EVENT)
    const coinMarketRewardsV4Event = parseAbiItem(COIN_MARKET_REWARDS_V4_EVENT)

    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl, { timeout: 25_000 }),
    })

    const latest = await client.getBlockNumber()
    let fromBlock = DEFAULT_HOOK_DEPLOY_BLOCK
    if (fromBlockParam !== null) {
      fromBlock = fromBlockParam
    } else if (createdAtSeconds !== null && createdAtSeconds > 0) {
      const nowSeconds = Math.floor(Date.now() / 1000)
      const ageSeconds = Math.max(0, nowSeconds - Math.floor(createdAtSeconds))
      const approxBlocks = Math.floor(ageSeconds / BASE_BLOCK_TIME_SECONDS)
      const estFrom = latest - BigInt(approxBlocks)
      const margin = BigInt(CREATED_AT_BLOCK_MARGIN)
      fromBlock = estFrom > margin ? estFrom - margin : 0n
    }
    if (fromBlock < DEFAULT_HOOK_DEPLOY_BLOCK) fromBlock = DEFAULT_HOOK_DEPLOY_BLOCK
    const range = getRange(rpcUrl)
    const concurrency = getConcurrency()

    const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = []
    for (let start = fromBlock; start <= latest; start += range + 1n) {
      const end = start + range > latest ? latest : start + range
      ranges.push({ fromBlock: start, toBlock: end })
    }

    let idx = 0
    let transfersCount = 0
    let transfersTotal = 0n
    const txSet = new Set<string>()

    async function logsWorker() {
      while (true) {
        const i = idx++
        if (i >= ranges.length) return
        const r = ranges[i]

        const logs = await client.getLogs({
          address: currency as any,
          event: erc20TransferEvent as any,
          args: { from: hook as any, to: recipient as any } as any,
          fromBlock: r.fromBlock,
          toBlock: r.toBlock,
        })

        transfersCount += logs.length
        for (const l of logs) {
          txSet.add(String((l as any).transactionHash))
          transfersTotal += (l as any).args.value as bigint
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => logsWorker()))

    const amountByCoin: Record<string, bigint> = {}
    const eventsCountByCoin: Record<string, number> = {}
    let rewardsEventsCount = 0
    let rewardsTotal = 0n

    // Optimization: avoid fetching receipts for every tx by scanning hook logs once and filtering by tx hash.
    // Since CoinMarketRewardsV4 has no indexed args, we can't query by recipient/currency directly, but we can:
    // 1) Find tx hashes via ERC-20 transfers from hook -> recipient
    // 2) Fetch CoinMarketRewardsV4 logs from the hook over the same block range
    // 3) Keep only logs whose transactionHash is in txSet
    const hookRange = (() => {
      const raw = process.env.BASE_HOOK_LOGS_RANGE
      if (raw && raw.length > 0) {
        try {
          const n = BigInt(raw)
          return n > 0n ? n : DEFAULT_HOOK_LOGS_RANGE
        } catch {
          return DEFAULT_HOOK_LOGS_RANGE
        }
      }
      return DEFAULT_HOOK_LOGS_RANGE
    })()

    const hookRanges: Array<{ fromBlock: bigint; toBlock: bigint }> = []
    for (let start = fromBlock; start <= latest; start += hookRange + 1n) {
      const end = start + hookRange > latest ? latest : start + hookRange
      hookRanges.push({ fromBlock: start, toBlock: end })
    }

    let hookIdx = 0
    async function hookLogsWorker() {
      while (true) {
        const i = hookIdx++
        if (i >= hookRanges.length) return
        const r = hookRanges[i]

        const hookLogs = await client.getLogs({
          address: hook as any,
          event: coinMarketRewardsV4Event as any,
          fromBlock: r.fromBlock,
          toBlock: r.toBlock,
        })

        for (const l of hookLogs as any[]) {
          const txHash = String(l.transactionHash ?? '')
          if (!txHash || !txSet.has(txHash)) continue

          const args = (l as any).args
            ? (l as any).args
            : (decodeEventLog({
                abi: [coinMarketRewardsV4Event],
                data: l.data,
                topics: l.topics,
              }).args as any)

          const logCurrency = String(args.currency).toLowerCase()
          const logRecipient = String(args.payoutRecipient).toLowerCase()

          if (logCurrency !== currencyLc) continue
          if (logRecipient !== recipientLc) continue

          const coin = String(args.coin).toLowerCase()
          if (coinFilter && isAddressLike(coinFilter) && coin !== coinFilter.toLowerCase()) continue
          const amt = BigInt(args.marketRewards?.creatorPayoutAmountCurrency ?? 0n)

          rewardsEventsCount++
          rewardsTotal += amt
          amountByCoin[coin] = (amountByCoin[coin] ?? 0n) + amt
          eventsCountByCoin[coin] = (eventsCountByCoin[coin] ?? 0) + 1
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, hookRanges.length) }, () => hookLogsWorker()))

    // JSON stringify bigint safely
    const amountByCoinStr: Record<string, string> = {}
    for (const [coin, amt] of Object.entries(amountByCoin)) {
      amountByCoinStr[coin] = amt.toString()
    }

    setCache(res, 60 * 10)
    return res.status(200).json({
      success: true,
      data: {
        currency: currencyLc,
        recipient: recipientLc,
        hook: hookLc,
        fromBlock: fromBlock.toString(),
        toBlock: latest.toString(),
        coinFilter: coinFilter ? coinFilter.toLowerCase() : null,
        transfersCount,
        transfersTotal: transfersTotal.toString(),
        txCount: txSet.size,
        rewardsEventsCount,
        rewardsTotal: rewardsTotal.toString(),
        amountByCoin: amountByCoinStr,
        eventsCountByCoin,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to compute per-coin rewards' })
  }
}

