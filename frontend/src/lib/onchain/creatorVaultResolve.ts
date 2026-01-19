import type { Address, Chain, PublicClient, Transport } from 'viem'
import { getAddress, isAddress } from 'viem'

import { CONTRACTS } from '@/config/contracts'

const addrHex = (hexWithout0x: string) => `0x${hexWithout0x}` as Address
const ZERO_ADDRESS = addrHex('0000000000000000000000000000000000000000')

const CREATOR_REGISTRY_RESOLVE_ABI = [
  { type: 'function', name: 'vaultToToken', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'wrapperToToken', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'shareOFTToToken', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'oracleToToken', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'gaugeControllerToToken', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'address' }] },
] as const

const CREATOR_REGISTRY_COIN_ABI = [
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

export type CreatorCoinInfo = {
  token: Address
  name: string
  symbol: string
  vault: Address | null
  shareOFT: Address | null
  wrapper: Address | null
  oracle: Address | null
  gaugeController: Address | null
  creator: Address | null
  isActive: boolean
  registeredAt: bigint | null
}

export type CreatorVaultResolved = {
  token: Address
  info: CreatorCoinInfo
  ccaStrategy: Address | null
}

function asAddress(value: unknown): Address | null {
  if (!isAddress(value as any)) return null
  const checksummed = getAddress(value as Address)
  if (checksummed === ZERO_ADDRESS) return null
  return checksummed
}

export async function resolveCreatorTokenFromAnyAddress<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(
  publicClient: PublicClient<TTransport, TChain>,
  addr: Address,
): Promise<Address | null> {
  const registry = CONTRACTS.registry as Address

  const results = await publicClient.multicall({
    contracts: [
      { address: registry, abi: CREATOR_REGISTRY_RESOLVE_ABI, functionName: 'vaultToToken', args: [addr] },
      { address: registry, abi: CREATOR_REGISTRY_RESOLVE_ABI, functionName: 'wrapperToToken', args: [addr] },
      { address: registry, abi: CREATOR_REGISTRY_RESOLVE_ABI, functionName: 'shareOFTToToken', args: [addr] },
      { address: registry, abi: CREATOR_REGISTRY_RESOLVE_ABI, functionName: 'oracleToToken', args: [addr] },
      { address: registry, abi: CREATOR_REGISTRY_RESOLVE_ABI, functionName: 'gaugeControllerToToken', args: [addr] },
    ],
    allowFailure: true,
  })

  for (const res of results) {
    if (res?.status !== 'success') continue
    const token = asAddress(res.result)
    if (token) return token
  }

  return null
}

export async function fetchCreatorCoinInfo<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(publicClient: PublicClient<TTransport, TChain>, token: Address): Promise<CreatorCoinInfo | null> {
  const registry = CONTRACTS.registry as Address
  const infoRaw = await publicClient.readContract({
    address: registry,
    abi: CREATOR_REGISTRY_COIN_ABI,
    functionName: 'getCreatorCoin',
    args: [token],
  })

  const info = infoRaw as any
  const out: CreatorCoinInfo = {
    token,
    name: typeof info?.name === 'string' ? info.name : '',
    symbol: typeof info?.symbol === 'string' ? info.symbol : '',
    vault: asAddress(info?.vault),
    shareOFT: asAddress(info?.shareOFT),
    wrapper: asAddress(info?.wrapper),
    oracle: asAddress(info?.oracle),
    gaugeController: asAddress(info?.gaugeController),
    creator: asAddress(info?.creator),
    isActive: Boolean(info?.isActive),
    registeredAt: typeof info?.registeredAt === 'bigint' ? (info.registeredAt as bigint) : null,
  }

  return out
}

export async function fetchCcaStrategyForToken<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(publicClient: PublicClient<TTransport, TChain>, token: Address): Promise<Address | null> {
  const factory = CONTRACTS.factory as Address
  const deploymentRaw = await publicClient.readContract({
    address: factory,
    abi: CREATOR_FACTORY_VIEW_ABI,
    functionName: 'deployments',
    args: [token],
  })
  const deployment = deploymentRaw as any
  if (!deployment || deployment?.exists === false) return null
  return asAddress(deployment?.ccaStrategy)
}

export async function resolveCreatorVaultByAnyAddress<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(
  publicClient: PublicClient<TTransport, TChain>,
  addressLike: string,
): Promise<CreatorVaultResolved | null> {
  if (!isAddress(addressLike)) return null
  const addr = getAddress(addressLike as Address)

  const token = await resolveCreatorTokenFromAnyAddress(publicClient, addr)
  if (!token) return null

  const [info, ccaStrategy] = await Promise.all([
    fetchCreatorCoinInfo(publicClient, token),
    fetchCcaStrategyForToken(publicClient, token),
  ])

  if (!info) return null

  return { token, info, ccaStrategy }
}

