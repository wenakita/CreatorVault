import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleOptions, setCors } from '../auth/_shared.js'

declare const process: { env: Record<string, string | undefined> }

const PROTOCOL_REWARDS_ADDRESS = `0x${'7777777F279eba3d3Ad8F4E708545291A6fDBA8B'}`

const protocolRewardsAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

function setCache(res: VercelResponse, seconds: number = 60) {
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

function getReadRpcUrl(): string {
  // Dedicated read RPC if you want it.
  const read = process.env.BASE_READ_RPC_URL
  if (read && read.length > 0) return read

  // Otherwise use your authenticated Base RPC (server-only).
  const rpc = process.env.BASE_RPC_URL
  if (rpc && rpc.length > 0) return rpc

  // Fallback: public RPC.
  return 'https://mainnet.base.org'
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

  const rpcUrl = getReadRpcUrl()

  try {
    const { createPublicClient, http } = await import('viem')
    const { base } = await import('viem/chains')

    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl, { timeout: 20_000 }),
    })

    const balances: Record<string, string> = {}
    for (const recipient of recipients) {
      const bal = await client.readContract({
        address: PROTOCOL_REWARDS_ADDRESS as any,
        abi: protocolRewardsAbi as any,
        functionName: 'balanceOf',
        args: [recipient as any],
      })
      balances[recipient.toLowerCase()] = (bal as bigint).toString()
    }

    // claimable changes frequently; keep cache short
    setCache(res, 60)
    return res.status(200).json({
      success: true,
      data: {
        protocolRewards: PROTOCOL_REWARDS_ADDRESS,
        claimableByRecipient: balances,
        chainId: base.id,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to fetch claimable rewards' })
  }
}

