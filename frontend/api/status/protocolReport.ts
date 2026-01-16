import type { VercelRequest, VercelResponse } from '@vercel/node'

declare const process: { env: Record<string, string | undefined> }

type CheckStatus = 'pass' | 'fail' | 'warn' | 'info'

type Check = {
  id: string
  label: string
  status: CheckStatus
  details?: string
  href?: string
}

type CheckSection = {
  id: string
  title: string
  description?: string
  checks: Check[]
}

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

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function basescanAddressHref(addr: string) {
  return `https://basescan.org/address/${addr}`
}

function getReadRpcUrl(): string {
  const read = process.env.BASE_READ_RPC_URL
  if (read && read.length > 0) return read
  const rpc = process.env.BASE_RPC_URL
  if (rpc && rpc.length > 0) return rpc
  return 'https://mainnet.base.org'
}

function pickAddress(envKey: string, fallback: string): string {
  const raw = process.env[envKey]
  if (raw && raw.length > 0) return raw
  return fallback
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const generatedAt = new Date().toISOString()
  const chainId = 8453

  const readRpc = getReadRpcUrl()

  const envChecks: Check[] = [
    {
      id: 'base_rpc',
      label: 'BASE_RPC_URL',
      status: process.env.BASE_RPC_URL ? 'pass' : 'warn',
      details: process.env.BASE_RPC_URL ? 'Configured' : `Not set (using fallback for reads: ${readRpc})`,
    },
    {
      id: 'base_read_rpc',
      label: 'BASE_READ_RPC_URL',
      status: process.env.BASE_READ_RPC_URL ? 'pass' : 'info',
      details: process.env.BASE_READ_RPC_URL ? 'Configured' : `Not set (reads use: ${readRpc})`,
    },
    {
      id: 'base_logs_rpc',
      label: 'BASE_LOGS_RPC_URL',
      status: process.env.BASE_LOGS_RPC_URL ? 'pass' : 'warn',
      details: process.env.BASE_LOGS_RPC_URL
        ? 'Configured'
        : 'Not set (log-heavy endpoints may be slower / rate-limited on public RPCs)',
    },
    {
      id: 'zora_server_key',
      label: 'ZORA_SERVER_API_KEY',
      status: process.env.ZORA_SERVER_API_KEY ? 'pass' : 'info',
      details: process.env.ZORA_SERVER_API_KEY ? 'Configured' : 'Not set (Zora API may be rate limited)',
    },
    {
      id: 'debank_key',
      label: 'DEBANK_ACCESS_KEY',
      status: process.env.DEBANK_ACCESS_KEY ? 'pass' : 'info',
      details: process.env.DEBANK_ACCESS_KEY ? 'Configured' : 'Not set (creator net worth features disabled)',
    },
  ]

  // NOTE: Keep these aligned with `frontend/src/config/contracts.ts`.
  // We inline them here to avoid any cross-bundling issues in Vercel serverless functions.
  const infra = [
    { id: 'registry', label: 'Registry', value: pickAddress('CREATOR_REGISTRY', '0x02c8031c39E10832A831b954Df7a2c1bf9Df052D') },
    { id: 'factory', label: 'Factory', value: pickAddress('CREATOR_FACTORY', '0xcCa08f9b94dD478266D0D1D2e9B7758414280FfD') },
    { id: 'vaultActivationBatcher', label: 'VaultActivationBatcher', value: pickAddress('VAULT_ACTIVATION_BATCHER', '0x4b67e3a4284090e5191c27B8F24248eC82DF055D') },
    { id: 'create2Deployer', label: 'CREATE2Deployer', value: pickAddress('CREATE2_DEPLOYER', '0xaBf645362104F34D9C3FE48440bE7c99aaDE58E7') },
    { id: 'taxHook', label: 'TaxHook', value: pickAddress('TAX_HOOK', '0xca975B9dAF772C71161f3648437c3616E5Be0088') },
    { id: 'poolManager', label: 'UniswapV4PoolManager', value: pickAddress('POOL_MANAGER', '0x498581fF718922c3f8e6A244956aF099B2652b2b') },
    { id: 'protocolTreasury', label: 'ProtocolTreasury', value: pickAddress('PROTOCOL_TREASURY', '0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3') },
  ]

  const infraChecks: Check[] = infra.map((item) => {
    const ok = isAddressLike(item.value) && item.value !== '0x0000000000000000000000000000000000000000'
    return {
      id: item.id,
      label: item.label,
      status: ok ? 'pass' : 'fail',
      details: ok ? item.value : `Missing/invalid address: ${item.value || '(empty)'}`,
      href: ok ? basescanAddressHref(item.value) : undefined,
    }
  })

  const sections: CheckSection[] = [
    {
      id: 'server-env',
      title: 'Server environment',
      description: 'These affect /api/* data on 4626.fun (Status page, analytics, rewards).',
      checks: envChecks,
    },
    {
      id: 'shared-infra',
      title: 'Shared infrastructure (Base mainnet)',
      description: 'Hardcoded addresses used by the frontend for deterministic per-creator deployments.',
      checks: infraChecks,
    },
  ]

  setCache(res, 60)
  return res.status(200).json({ success: true, data: { chainId, generatedAt, sections } })
}

