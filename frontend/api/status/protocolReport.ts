import type { VercelRequest, VercelResponse } from '@vercel/node'

import { CONTRACTS } from '../../src/config/contracts'

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

  const addr = (v: unknown) => (typeof v === 'string' ? v : '')
  const infra = [
    { id: 'registry', label: 'Registry', value: addr((CONTRACTS as any).registry) },
    { id: 'factory', label: 'Factory', value: addr((CONTRACTS as any).factory) },
    { id: 'vaultActivationBatcher', label: 'VaultActivationBatcher', value: addr((CONTRACTS as any).vaultActivationBatcher) },
    { id: 'create2Deployer', label: 'CREATE2Deployer', value: addr((CONTRACTS as any).create2Deployer) },
    { id: 'taxHook', label: 'TaxHook', value: addr((CONTRACTS as any).taxHook) },
    { id: 'poolManager', label: 'UniswapV4PoolManager', value: addr((CONTRACTS as any).poolManager) },
    { id: 'protocolTreasury', label: 'ProtocolTreasury', value: addr((CONTRACTS as any).protocolTreasury) },
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
      description: 'These affect /api/* data on creatorvault.fun (Status page, analytics, rewards).',
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
  return res.status(200).json({ chainId, generatedAt, sections })
}

