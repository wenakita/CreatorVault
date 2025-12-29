import type { VercelRequest, VercelResponse } from '@vercel/node'

declare const process: { env: Record<string, string | undefined> }

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 60) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  return false
}

function getReadRpcUrl(): string {
  const read = process.env.BASE_READ_RPC_URL
  if (read && read.length > 0) return read

  const rpc = process.env.BASE_RPC_URL
  if (rpc && rpc.length > 0) return rpc

  return 'https://mainnet.base.org'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const rpcUrl = getReadRpcUrl()

  try {
    const { createPublicClient, http, isAddress } = await import('viem')
    const { base } = await import('viem/chains')

    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl, { timeout: 20_000 }),
    })

    const addrs: Array<{ id: string; label: string; addr: `0x${string}` }> = [
      { id: 'registry', label: 'Registry', addr: '0x777e28d7617ADb6E2fE7b7C49864A173e36881EF' },
      { id: 'factory', label: 'Factory', addr: '0x6205c91941A207A622fD00481b92cA04308a2819' },
      { id: 'create2Factory', label: 'Universal CREATE2 factory', addr: '0x4e59b44847b379578588920cA78FbF26c0B4956C' },
      { id: 'create2Deployer', label: 'AA CREATE2 deployer', addr: '0xaBf645362104F34D9C3FE48440bE7c99aaDE58E7' },
      { id: 'vaultActivationBatcher', label: 'Vault activation batcher', addr: '0x6d796554698f5Ddd74Ff20d745304096aEf93CB6' },
      { id: 'poolManager', label: 'Uniswap V4 PoolManager', addr: '0x498581fF718922c3f8e6A244956aF099B2652b2b' },
      { id: 'taxHook', label: 'Tax hook', addr: '0xca975B9dAF772C71161f3648437c3616E5Be0088' },
      { id: 'chainlinkEthUsd', label: 'Chainlink ETH/USD feed', addr: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70' },
      { id: 'usdc', label: 'USDC', addr: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
      { id: 'ajnaErc20Factory', label: 'Ajna ERC20 pool factory', addr: '0x214f62B5836D83f3D6c4f71F174209097B1A779C' },
    ]

    const checks = await Promise.all(
      addrs.map(async (a) => {
        const okAddr = isAddress(a.addr)
        const code = okAddr ? await client.getBytecode({ address: a.addr as any }) : null
        const hasCode = !!code && code !== '0x'
        return {
          id: a.id,
          label: a.label,
          status: hasCode ? 'pass' : 'fail',
          details: a.addr,
          href: `https://basescan.org/address/${a.addr}`,
        }
      }),
    )

    setCache(res, 300)
    return res.status(200).json({
      success: true,
      data: {
        chainId: base.id,
        generatedAt: new Date().toISOString(),
        sections: [
          {
            id: 'global',
            title: 'Protocol dependencies (Base)',
            description: 'Quick sanity checks that core protocol contracts exist onchain.',
            checks,
          },
        ],
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to build protocol report' })
  }
}


