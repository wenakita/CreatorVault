import type { Address } from 'viem'

declare const process: { env: Record<string, string | undefined> }

function normalizeRpcUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (!t.startsWith('http://') && !t.startsWith('https://')) return `https://${t}`
  return t
}

const DEFAULT_BASE_RPCS = [
  'https://base-mainnet.public.blastapi.io',
  'https://base.llamarpc.com',
  'https://mainnet.base.org',
] as const

function getBaseRpcUrls(): string[] {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  const parts = raw
    ? raw
        .split(/[\s,]+/g)
        .map(normalizeRpcUrl)
        .filter((x): x is string => Boolean(x))
    : []
  const urls = parts.length > 0 ? [...parts, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]
  return Array.from(new Set(urls))
}

export function getKeeprBaseRpcUrls(): string[] {
  return getBaseRpcUrls()
}

export type SharesEligibilityEvidence = {
  shareBalance: string
  threshold: string
  blockNumber: number | null
  rpcUrl: string | null
}

export type SharesEligibilityResult = {
  eligible: boolean
  reason: 'share_balance>=threshold' | 'share_balance<threshold' | 'onchain_read_failed'
  evidence: SharesEligibilityEvidence
}

export async function checkSharesEligibility(params: {
  wallet: Address
  shareToken: Address
  minShares: bigint
  rpcUrls?: string[]
}): Promise<SharesEligibilityResult> {
  const { createPublicClient, erc20Abi, http } = await import('viem')
  const { base } = await import('viem/chains')

  const urls = Array.isArray(params.rpcUrls) && params.rpcUrls.length > 0 ? params.rpcUrls : getBaseRpcUrls()
  let lastErr: unknown = null

  for (const url of urls) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(url, { timeout: 12_000 }),
      })

      // Evidence: capture a best-effort block number.
      let blockNumber: number | null = null
      try {
        const bn = await client.getBlockNumber()
        blockNumber = Number(bn)
      } catch {
        blockNumber = null
      }

      const bal = (await client.readContract({
        address: params.shareToken,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [params.wallet],
      })) as bigint

      const eligible = bal >= params.minShares
      return {
        eligible,
        reason: eligible ? 'share_balance>=threshold' : 'share_balance<threshold',
        evidence: {
          shareBalance: bal.toString(),
          threshold: params.minShares.toString(),
          blockNumber: Number.isFinite(blockNumber ?? NaN) ? blockNumber : null,
          rpcUrl: url,
        },
      }
    } catch (e) {
      lastErr = e
      continue
    }
  }

  void lastErr
  return {
    eligible: false,
    reason: 'onchain_read_failed',
    evidence: {
      shareBalance: '0',
      threshold: params.minShares.toString(),
      blockNumber: null,
      rpcUrl: null,
    },
  }
}

