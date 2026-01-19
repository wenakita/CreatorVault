import type { Address, Chain, PublicClient, Transport } from 'viem'
import { getAddress, isAddress } from 'viem'

import { CONTRACTS } from '@/config/contracts'

const addr = (hexWithout0x: string) => `0x${hexWithout0x}` as Address
const ZERO_ADDRESS = addr('0000000000000000000000000000000000000000')

// Minimal onchain view ABI for CreatorRegistry.
const CREATOR_REGISTRY_VIEW_ABI = [
  {
    type: 'function',
    name: 'getAllCreatorCoins',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getCreatorCoin',
    stateMutability: 'view',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [
      {
        name: 'info',
        type: 'tuple',
        components: [
          { name: 'token', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'vault', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'gaugeController', type: 'address' },
          { name: 'creator', type: 'address' },
          { name: 'pool', type: 'address' },
          { name: 'poolFee', type: 'uint24' },
          { name: 'primaryChainId', type: 'uint16' },
          { name: 'isActive', type: 'bool' },
          { name: 'registeredAt', type: 'uint256' },
        ],
      },
    ],
  },
] as const

// Minimal onchain view ABI for CreatorOVaultFactory.
const CREATOR_FACTORY_VIEW_ABI = [
  {
    type: 'function',
    name: 'deployments',
    stateMutability: 'view',
    inputs: [{ name: '_creatorCoin', type: 'address' }],
    outputs: [
      { name: 'creatorCoin', type: 'address' },
      { name: 'vault', type: 'address' },
      { name: 'wrapper', type: 'address' },
      { name: 'shareOFT', type: 'address' },
      { name: 'gaugeController', type: 'address' },
      { name: 'ccaStrategy', type: 'address' },
      { name: 'oracle', type: 'address' },
      { name: 'creator', type: 'address' },
      { name: 'deployedAt', type: 'uint256' },
      { name: 'exists', type: 'bool' },
    ],
  },
] as const

export type VaultDescriptor = {
  id: string
  name: string
  symbol: string
  token: Address
  vault: Address
  ccaStrategy: Address
}

export type FetchCreatorVaultIndexOptions = {
  /** Safety cap to avoid huge multicalls if the registry grows unexpectedly. Default: 250 */
  limit?: number
  /** If true, only include registry entries where `isActive == true`. Default: true */
  onlyActive?: boolean
}

/**
 * Build the canonical vault list from onchain provenance (registry + factory).
 *
 * - Registry provides token metadata + vault/wrapper/shareOFT/oracle/gauge addresses.
 * - Factory provides `ccaStrategy` (not stored in registry today).
 */
export async function fetchCreatorVaultIndex<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(
  publicClient: PublicClient<TTransport, TChain>,
  options: FetchCreatorVaultIndexOptions = {},
): Promise<VaultDescriptor[]> {
  const limit = typeof options.limit === 'number' && options.limit > 0 ? Math.floor(options.limit) : 250
  const onlyActive = options.onlyActive !== false

  const registry = CONTRACTS.registry as Address
  const factory = CONTRACTS.factory as Address

  const tokensRaw = (await publicClient.readContract({
    address: registry,
    abi: CREATOR_REGISTRY_VIEW_ABI,
    functionName: 'getAllCreatorCoins',
  })) as unknown

  const tokens = (Array.isArray(tokensRaw) ? tokensRaw : [])
    .filter((t): t is Address => isAddress(t))
    .map((t) => getAddress(t))

  const uniq: Address[] = []
  const seen = new Set<string>()
  for (const t of tokens) {
    const lc = t.toLowerCase()
    if (seen.has(lc)) continue
    seen.add(lc)
    uniq.push(t)
  }

  const bounded = uniq.slice(0, limit)
  if (bounded.length === 0) return []

  const results = await publicClient.multicall({
    contracts: bounded.flatMap((token) => [
      {
        address: registry,
        abi: CREATOR_REGISTRY_VIEW_ABI,
        functionName: 'getCreatorCoin',
        args: [token],
      },
      {
        address: factory,
        abi: CREATOR_FACTORY_VIEW_ABI,
        functionName: 'deployments',
        args: [token],
      },
    ]),
    allowFailure: true,
  })

  const out: VaultDescriptor[] = []

  for (let i = 0; i < bounded.length; i++) {
    const token = bounded[i]
    const infoRes = results[i * 2]
    const deployRes = results[i * 2 + 1]

    const info = infoRes?.status === 'success' ? (infoRes.result as any) : null
    const deployment = deployRes?.status === 'success' ? (deployRes.result as any) : null

    const isActive = onlyActive ? Boolean(info?.isActive) : true
    if (!isActive) continue

    const vaultRaw = info?.vault
    const vault = isAddress(vaultRaw) && vaultRaw !== ZERO_ADDRESS ? getAddress(vaultRaw) : null
    if (!vault) continue

    const ccaRaw = deployment?.ccaStrategy
    const ccaStrategy = isAddress(ccaRaw) && ccaRaw !== ZERO_ADDRESS ? getAddress(ccaRaw) : null
    if (!ccaStrategy) continue

    const symbol =
      typeof info?.symbol === 'string' && info.symbol.trim().length > 0 ? info.symbol.trim() : null
    const display = symbol ?? (typeof info?.name === 'string' && info.name.trim().length > 0 ? info.name.trim() : 'TOKEN')

    out.push({
      id: token.toLowerCase(),
      name: display,
      symbol: symbol ?? display,
      token,
      vault,
      ccaStrategy,
    })
  }

  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

