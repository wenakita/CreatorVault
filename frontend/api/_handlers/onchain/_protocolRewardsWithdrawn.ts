import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleOptions, setCors } from '../../../server/auth/_shared.js'

declare const process: { env: Record<string, string | undefined> }

const PROTOCOL_REWARDS_ADDRESS = `0x${'7777777F279eba3d3Ad8F4E708545291A6fDBA8B'}`
// keccak256("Withdraw(address,address,uint256)")
const WITHDRAW_TOPIC0 = `0x${'9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb'}`
// Base mainnet first block where ProtocolRewards bytecode exists (binary-searched via BASE_RPC_URL).
// Using this avoids scanning pre-deploy ranges.
const BASE_PROTOCOL_REWARDS_DEPLOY_BLOCK = 2336418n
const WITHDRAW_EVENT = 'event Withdraw(address indexed from, address indexed to, uint256 amount)'

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

function padTopicAddress(address: string): `0x${string}` {
  return `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}` as `0x${string}`
}

function getLogsRpcUrl(): string {
  // Prefer a dedicated logs RPC (can be rate-limited / tuned separately).
  const logs = process.env.BASE_LOGS_RPC_URL
  if (logs && logs.length > 0) return logs

  // Next: generic Base RPC (server-only; may include auth).
  const rpc = process.env.BASE_RPC_URL
  if (rpc && rpc.length > 0) return rpc

  // Fallback: public RPC (may be flaky for eth_getLogs on some providers).
  return 'https://base.meowrpc.com'
}

function getLogsRange(rpcUrl: string): bigint {
  const raw = process.env.BASE_LOGS_RPC_RANGE
  if (!raw) return 300000n
  try {
    const n = BigInt(raw)
    return n > 0n ? n : 300000n
  } catch {
    return 300000n
  }
}

function getLogsConcurrency(): number {
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

  const recipientsRaw = getStringQuery(req, 'recipients') ?? getStringQuery(req, 'recipient')
  if (!recipientsRaw) {
    return res.status(400).json({ success: false, error: 'recipients is required' })
  }

  const recipients = recipientsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (recipients.length === 0) {
    return res.status(400).json({ success: false, error: 'recipients is required' })
  }

  for (const r of recipients) {
    if (!isAddressLike(r)) {
      return res.status(400).json({ success: false, error: `Invalid recipient: ${r}` })
    }
  }

  try {
    const { createPublicClient, http, parseAbiItem } = await import('viem')
    const { base } = await import('viem/chains')

    const rpcUrl = getLogsRpcUrl()

    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl, { timeout: 20_000 }),
    })

    const withdrawEvent = parseAbiItem(WITHDRAW_EVENT)

    const latest = await client.getBlockNumber()
    const fromBlock = BASE_PROTOCOL_REWARDS_DEPLOY_BLOCK
    // Some RPCs (including your Matrixed endpoint) enforce a strict max block range (e.g. 100,000).
    // If not explicitly configured, pick a safe default based on URL.
    const range =
      process.env.BASE_LOGS_RPC_RANGE && process.env.BASE_LOGS_RPC_RANGE.length > 0
        ? getLogsRange(rpcUrl)
        : rpcUrl.includes('matrixed') || rpcUrl.includes('endpoints.matrixed.link')
          ? 100000n
          : 300000n
    const concurrency = getLogsConcurrency()

    const withdrawnByRecipientWei: Record<string, bigint> = {}
    const withdrawalsCountByRecipient: Record<string, number> = {}
    for (const r of recipients) {
      withdrawnByRecipientWei[r.toLowerCase()] = 0n
      withdrawalsCountByRecipient[r.toLowerCase()] = 0
    }

    // Use OR-topic filtering when possible (viem supports arrays in args for indexed params).
    const fromFilter =
      recipients.length === 1 ? (recipients[0] as any) : (recipients.map((r) => r as any) as any)

    // Precompute ranges. NOTE: many RPCs enforce max (toBlock - fromBlock) per request.
    const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = []
    for (let start = fromBlock; start <= latest; start += range + 1n) {
      const end = start + range > latest ? latest : start + range
      ranges.push({ fromBlock: start, toBlock: end })
    }

    let idx = 0

    async function worker() {
      while (true) {
        const i = idx++
        if (i >= ranges.length) return
        const r = ranges[i]
        const logs = await client.getLogs({
          address: PROTOCOL_REWARDS_ADDRESS as any,
          event: withdrawEvent as any,
          fromBlock: r.fromBlock,
          toBlock: r.toBlock,
          args: { from: fromFilter } as any,
        })

        for (const l of logs) {
          const fromAddr = (l as any).args?.from as string | undefined
          const amount = (l as any).args?.amount as bigint | undefined
          if (!fromAddr || typeof amount !== 'bigint') continue
          const key = fromAddr.toLowerCase()
          if (!(key in withdrawnByRecipientWei)) continue
          withdrawnByRecipientWei[key] += amount
          withdrawalsCountByRecipient[key] = (withdrawalsCountByRecipient[key] ?? 0) + 1
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()))

    const withdrawnByRecipient: Record<string, string> = {}
    for (const [k, v] of Object.entries(withdrawnByRecipientWei)) {
      withdrawnByRecipient[k] = v.toString()
    }

    // Withdraw history changes only when the creator withdraws; cache longer.
    setCache(res, 60 * 10)
    return res.status(200).json({
      success: true,
      data: {
        protocolRewards: PROTOCOL_REWARDS_ADDRESS,
        withdrawnByRecipient,
        withdrawalsCountByRecipient,
        source: 'rpc_logs',
        logsRpcConfigured: true,
        fromBlock: fromBlock.toString(),
        toBlock: latest.toString(),
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (e: any) {
    const msg = e?.message || 'Failed to fetch withdrawn rewards'
    return res.status(500).json({ success: false, error: msg })
  }
}

