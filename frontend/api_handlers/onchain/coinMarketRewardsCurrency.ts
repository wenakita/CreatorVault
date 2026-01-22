import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleOptions, setCors } from '../../server/auth/_shared.js'

declare const process: { env: Record<string, string | undefined> }

// Zora v4 coin hook on Base (from `uniswapV4PoolKey.hookAddress`).
const DEFAULT_HOOK = `0x${'c8d077444625eb300a427a6dfb2b1dbf9b159040'}`
// First Base block where the hook has bytecode (binary-searched via BASE_RPC_URL).
const DEFAULT_HOOK_DEPLOY_BLOCK = 36237338n

const ERC20_TRANSFER_EVENT = 'event Transfer(address indexed from,address indexed to,uint256 value)'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const recipient = getStringQuery(req, 'recipient')
  const currency = getStringQuery(req, 'currency')
  const hook = getStringQuery(req, 'hook') ?? DEFAULT_HOOK

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

  const rpcUrl = getLogsRpcUrl()

  try {
    const { createPublicClient, http, parseAbiItem } = await import('viem')
    const { base } = await import('viem/chains')
    const erc20TransferEvent = parseAbiItem(ERC20_TRANSFER_EVENT)

    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl, { timeout: 20_000 }),
    })

    const latest = await client.getBlockNumber()
    const fromBlock = DEFAULT_HOOK_DEPLOY_BLOCK
    const range = getRange(rpcUrl)
    const concurrency = getConcurrency()

    const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = []
    for (let start = fromBlock; start <= latest; start += range + 1n) {
      const end = start + range > latest ? latest : start + range
      ranges.push({ fromBlock: start, toBlock: end })
    }

    let idx = 0
    let total = 0n
    let logsCount = 0

    async function worker() {
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

        logsCount += logs.length
        for (const l of logs) total += (l as any).args.value as bigint
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()))

    // Transfers are final; cache longer.
    setCache(res, 60 * 10)
    return res.status(200).json({
      success: true,
      data: {
        currency: currency.toLowerCase(),
        recipient: recipient.toLowerCase(),
        hook: hook.toLowerCase(),
        fromBlock: fromBlock.toString(),
        toBlock: latest.toString(),
        amountRaw: total.toString(),
        transfersCount: logsCount,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to compute currency rewards' })
  }
}

