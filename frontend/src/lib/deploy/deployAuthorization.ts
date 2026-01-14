import type { Address, Hex } from 'viem'
import { encodeAbiParameters, encodeFunctionData, getAddress, isAddress, keccak256, parseAbiParameters, toBytes } from 'viem'

// NOTE: We intentionally use a structural type here (instead of `viem.PublicClient`)
// to avoid TS type mismatches when `wagmi` and the app resolve different `viem` instances.
export type PublicClientLike = {
  readContract: (args: any) => Promise<any>
}

export const CREATOR_VAULT_BATCHER_VIEW_ABI = [
  {
    type: 'function',
    name: 'deployNonces',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

// ERC-1271 signature validation (contract wallets)
export const ERC1271_ABI = [
  {
    type: 'function',
    name: 'isValidSignature',
    stateMutability: 'view',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ type: 'bytes4' }],
  },
] as const

export const ERC1271_MAGIC_VALUE = '0x1626ba7e' as const

export type DeployAuthorization = {
  owner: Address
  operator: Address
  leftoverRecipient: Address
  fundingModel: 0 | 1
  paramsHash: Hex
  nonce: bigint
  deadline: bigint
}

export type CreatorVaultBatcherCodeIds = {
  vault: Hex
  wrapper: Hex
  shareOFT: Hex
  gauge: Hex
  cca: Hex
  oracle: Hex
  oftBootstrap: Hex
}

export function computeDeployParamsHash(params: {
  creatorToken: Address
  owner: Address
  creatorTreasury: Address
  payoutRecipient: Address
  vaultName: string
  vaultSymbol: string
  shareName: string
  shareSymbol: string
  version: string
  depositAmount: bigint
  auctionPercent: number
  requiredRaise: bigint
  floorPriceQ96: bigint
  auctionSteps: Hex
  codeIds: CreatorVaultBatcherCodeIds
  leftoverRecipient: Address
  fundingModel: 0 | 1
}): Hex {
  const vaultNameHash = keccak256(toBytes(params.vaultName))
  const vaultSymbolHash = keccak256(toBytes(params.vaultSymbol))
  const shareNameHash = keccak256(toBytes(params.shareName))
  const shareSymbolHash = keccak256(toBytes(params.shareSymbol))
  const versionHash = keccak256(toBytes(params.version))
  const auctionStepsHash = keccak256(params.auctionSteps)

  const encoded = encodeAbiParameters(
    parseAbiParameters(
      'address, address, address, address, bytes32, bytes32, bytes32, bytes32, bytes32, uint256, uint8, uint128, uint256, bytes32, bytes32, bytes32, bytes32, bytes32, bytes32, bytes32, bytes32, address, uint8',
    ),
    [
      params.creatorToken,
      params.owner,
      params.creatorTreasury,
      params.payoutRecipient,
      vaultNameHash,
      vaultSymbolHash,
      shareNameHash,
      shareSymbolHash,
      versionHash,
      params.depositAmount,
      params.auctionPercent,
      params.requiredRaise,
      params.floorPriceQ96,
      auctionStepsHash,
      params.codeIds.vault,
      params.codeIds.wrapper,
      params.codeIds.shareOFT,
      params.codeIds.gauge,
      params.codeIds.cca,
      params.codeIds.oracle,
      params.codeIds.oftBootstrap,
      params.leftoverRecipient,
      params.fundingModel,
    ],
  )

  return keccak256(encoded)
}

export function buildDeployAuthorizationTypedData(params: {
  chainId: number
  verifyingContract: Address
  auth: DeployAuthorization
}): {
  domain: { name: string; version: string; chainId: number; verifyingContract: Address }
  types: Record<string, Array<{ name: string; type: string }>>
  primaryType: 'DeployAuthorization'
  message: DeployAuthorization
} {
  return {
    domain: {
      name: 'CreatorVaultBatcher',
      version: '1',
      chainId: params.chainId,
      verifyingContract: params.verifyingContract,
    },
    types: {
      DeployAuthorization: [
        { name: 'owner', type: 'address' },
        { name: 'operator', type: 'address' },
        { name: 'leftoverRecipient', type: 'address' },
        { name: 'fundingModel', type: 'uint8' },
        { name: 'paramsHash', type: 'bytes32' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'DeployAuthorization' as const,
    message: params.auth,
  }
}

export async function fetchDeployNonce(params: {
  publicClient: PublicClientLike
  batcher: Address
  owner: Address
}): Promise<bigint> {
  const nonce = (await params.publicClient.readContract({
    address: params.batcher,
    abi: CREATOR_VAULT_BATCHER_VIEW_ABI,
    functionName: 'deployNonces',
    args: [params.owner],
  })) as bigint
  return nonce
}

export async function preflightErc1271Signature(params: {
  publicClient: PublicClientLike
  contract: Address
  digest: Hex
  signature: Hex
}): Promise<boolean> {
  try {
    const out = (await params.publicClient.readContract({
      address: params.contract,
      abi: ERC1271_ABI,
      functionName: 'isValidSignature',
      args: [params.digest, params.signature],
    })) as Hex
    return String(out).toLowerCase() === ERC1271_MAGIC_VALUE
  } catch {
    return false
  }
}

export function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!isAddress(v)) return null
  return getAddress(v)
}

export function encodeBatcherDeployAuthorizationDigest(params: {
  typedDataDigest: Hex
}): Hex {
  // Placeholder helper for explicitness; we already use the digest returned by signTypedData flows.
  return params.typedDataDigest
}

export function encodeDeployAuthorizationReadForDebug(params: { auth: DeployAuthorization }): Hex {
  // Produces a stable encoding that can be logged or hashed by the caller if needed.
  return encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'noop',
        stateMutability: 'pure',
        inputs: [
          {
            name: 'auth',
            type: 'tuple',
            components: [
              { name: 'owner', type: 'address' },
              { name: 'operator', type: 'address' },
              { name: 'leftoverRecipient', type: 'address' },
              { name: 'fundingModel', type: 'uint8' },
              { name: 'paramsHash', type: 'bytes32' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          },
        ],
        outputs: [],
      },
    ] as const,
    functionName: 'noop',
    args: [params.auth],
  })
}

