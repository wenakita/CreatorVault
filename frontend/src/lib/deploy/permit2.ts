import type { Address, Hex } from 'viem'
import { encodeFunctionData, getAddress, isAddress } from 'viem'

// NOTE: Structural type to avoid `viem` instance mismatches between wagmi/app.
export type PublicClientLike = {
  chain?: { id: number }
  readContract: (args: any) => Promise<any>
}

// Minimal Permit2 view ABI (unordered nonces bitmap)
export const PERMIT2_VIEW_ABI = [
  {
    type: 'function',
    name: 'nonceBitmap',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'wordPos', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

// Minimal Permit2 signature-transfer ABI (used for executeBatch top-ups)
export const PERMIT2_SIGNATURE_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'permitTransferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'permit',
        type: 'tuple',
        components: [
          {
            name: 'permitted',
            type: 'tuple',
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      {
        name: 'transferDetails',
        type: 'tuple',
        components: [
          { name: 'to', type: 'address' },
          { name: 'requestedAmount', type: 'uint256' },
        ],
      },
      { name: 'owner', type: 'address' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

export type Permit2PermitTransferFrom = {
  permitted: { token: Address; amount: bigint }
  nonce: bigint
  deadline: bigint
}

export function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!isAddress(v)) return null
  return getAddress(v)
}

export async function findUnusedPermit2Nonce(params: {
  publicClient: PublicClientLike
  permit2: Address
  owner: Address
  wordPos?: bigint
}): Promise<bigint> {
  const wordPos = typeof params.wordPos === 'bigint' ? params.wordPos : 0n
  const bitmap = (await params.publicClient.readContract({
    address: params.permit2,
    abi: PERMIT2_VIEW_ABI,
    functionName: 'nonceBitmap',
    args: [params.owner, wordPos],
  })) as bigint

  let bitPos = -1
  for (let i = 0; i < 256; i++) {
    const used = (bitmap >> BigInt(i)) & 1n
    if (used === 0n) {
      bitPos = i
      break
    }
  }
  if (bitPos < 0) throw new Error('Permit2 nonce bitmap is full for this word position.')

  // nonce = wordPos*256 + bitPos ; since wordPos is uint256, we pack as wordPos<<8 | bitPos
  return (wordPos << 8n) | BigInt(bitPos)
}

export async function buildPermit2PermitTransferFrom(params: {
  publicClient: PublicClientLike
  permit2: Address
  token: Address
  amount: bigint
  owner: Address
  spender: Address
  ttlSeconds?: number
}): Promise<{
  permit: Permit2PermitTransferFrom
  signTypedDataArgs: {
    domain: { name: string; version: string; chainId: number; verifyingContract: Address }
    types: Record<string, Array<{ name: string; type: string }>>
    primaryType: 'PermitTransferFrom'
    message: {
      permitted: { token: Address; amount: bigint }
      spender: Address
      nonce: bigint
      deadline: bigint
    }
  }
}> {
  const ttlSeconds = typeof params.ttlSeconds === 'number' && params.ttlSeconds > 0 ? Math.floor(params.ttlSeconds) : 20 * 60
  const deadline = BigInt(Math.floor(Date.now() / 1000) + ttlSeconds)
  const nonce = await findUnusedPermit2Nonce({
    publicClient: params.publicClient,
    permit2: params.permit2,
    owner: params.owner,
    wordPos: 0n,
  })

  const signTypedDataArgs = {
    domain: { name: 'Permit2', version: '1', chainId: Number(params.publicClient.chain?.id ?? 0), verifyingContract: params.permit2 },
    types: {
      TokenPermissions: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      PermitTransferFrom: [
        { name: 'permitted', type: 'TokenPermissions' },
        { name: 'spender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'PermitTransferFrom' as const,
    message: {
      permitted: { token: params.token, amount: params.amount },
      spender: params.spender,
      nonce,
      deadline,
    },
  }

  return {
    permit: { permitted: { token: params.token, amount: params.amount }, nonce, deadline },
    signTypedDataArgs,
  }
}

export function encodePermit2TransferCall(params: {
  permit2: Address
  permit: Permit2PermitTransferFrom
  to: Address
  requestedAmount: bigint
  owner: Address
  signature: Hex
}): { to: Address; data: Hex; value: 0n } {
  return {
    to: params.permit2,
    value: 0n,
    data: encodeFunctionData({
      abi: PERMIT2_SIGNATURE_TRANSFER_ABI,
      functionName: 'permitTransferFrom',
      args: [
        { permitted: { token: params.permit.permitted.token, amount: params.permit.permitted.amount }, nonce: params.permit.nonce, deadline: params.permit.deadline },
        { to: params.to, requestedAmount: params.requestedAmount },
        params.owner,
        params.signature,
      ],
    }),
  }
}

