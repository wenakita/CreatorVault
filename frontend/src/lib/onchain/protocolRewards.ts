import { Address, createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const PROTOCOL_REWARDS_ADDRESS = '0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B' as Address

const protocolRewardsAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

function getBaseRpcUrl(): string {
  const url = import.meta.env.VITE_BASE_RPC
  return typeof url === 'string' && url.length > 0 ? url : 'https://mainnet.base.org'
}

function getBasePublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(getBaseRpcUrl()),
  })
}

export async function fetchProtocolRewardsBalance(account: Address): Promise<bigint> {
  const client = getBasePublicClient()
  return await client.readContract({
    address: PROTOCOL_REWARDS_ADDRESS,
    abi: protocolRewardsAbi,
    functionName: 'balanceOf',
    args: [account],
  })
}

export async function fetchProtocolRewardsBalances(accounts: Address[]): Promise<Record<string, bigint>> {
  const client = getBasePublicClient()
  const balances: Record<string, bigint> = {}

  // Small list in practice (unique payoutRecipients), so a simple loop is fine.
  for (const account of accounts) {
    balances[account] = await client.readContract({
      address: PROTOCOL_REWARDS_ADDRESS,
      abi: protocolRewardsAbi,
      functionName: 'balanceOf',
      args: [account],
    })
  }

  return balances
}

type ApiEnvelope<T> = {
  success: boolean
  data: T | null
  error?: string
}

export async function fetchProtocolRewardsBalancesFromApi(accounts: Address[]): Promise<Record<string, bigint>> {
  const qs = new URLSearchParams({
    recipients: accounts.join(','),
  })

  const res = await fetch(`/api/onchain/protocolRewardsClaimable?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiEnvelope<any> | null
    const msg = body?.error || `HTTP ${res.status}`
    const err: any = new Error(msg)
    err.status = res.status
    throw err
  }

  const body = (await res.json()) as ApiEnvelope<{
    claimableByRecipient: Record<string, string>
  }>

  if (!body.success) throw new Error(body.error || 'Failed to fetch claimable rewards')

  const map: Record<string, bigint> = {}
  const raw = body.data?.claimableByRecipient ?? {}
  for (const [k, v] of Object.entries(raw)) {
    try {
      map[k.toLowerCase()] = BigInt(v)
    } catch {
      map[k.toLowerCase()] = 0n
    }
  }
  return map
}

export async function fetchProtocolRewardsWithdrawnFromApi(accounts: Address[]): Promise<Record<string, bigint>> {
  const qs = new URLSearchParams({
    recipients: accounts.join(','),
  })

  const res = await fetch(`/api/onchain/protocolRewardsWithdrawn?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiEnvelope<any> | null
    const msg = body?.error || `HTTP ${res.status}`
    const err: any = new Error(msg)
    err.status = res.status
    throw err
  }

  const body = (await res.json()) as ApiEnvelope<{
    withdrawnByRecipient: Record<string, string>
  }>

  if (!body.success) throw new Error(body.error || 'Failed to fetch withdrawn rewards')
  const map: Record<string, bigint> = {}
  const raw = body.data?.withdrawnByRecipient ?? {}
  for (const [k, v] of Object.entries(raw)) {
    try {
      map[k.toLowerCase()] = BigInt(v)
    } catch {
      map[k.toLowerCase()] = 0n
    }
  }
  return map
}


