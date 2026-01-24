import type { Address, Hex } from 'viem'
import { encodeAbiParameters, http } from 'viem'
import { toAccount } from 'viem/accounts'
import {
  createBundlerClient,
  createPaymasterClient,
  sendUserOperation,
  toCoinbaseSmartAccount,
  waitForUserOperationReceipt,
} from 'viem/account-abstraction'

// NOTE: Avoid tight coupling to a specific `viem` client instance/type.
// wagmi and other libs can surface structurally-compatible clients that TypeScript may treat as distinct.
export type PublicClientLike = {
  chain: { id: number }
  readContract: (args: any) => Promise<any>
} & Record<string, any>

export type WalletClientLike = {
  request: (args: any) => Promise<any>
  signMessage: (args: any) => Promise<any>
  signTypedData: (args: any) => Promise<any>
  signTransaction?: (args: any) => Promise<any>
} & Record<string, any>

const SESSION_TOKEN_KEY = 'cv_siwe_session_token'

function getStoredSessionToken(): string | null {
  try {
    const v = sessionStorage.getItem(SESSION_TOKEN_KEY)
    const t = typeof v === 'string' ? v.trim() : ''
    return t.length > 0 ? t : null
  } catch {
    return null
  }
}

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
] as const

function asOwnerBytes(owner: Address): Hex {
  // Coinbase Smart Wallet stores EOA owners as 32-byte left-padded address bytes.
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

async function findCoinbaseSmartWalletOwnerIndex(params: {
  publicClient: PublicClientLike
  smartWallet: Address
  ownerAddress: Address
  maxScan?: number
}): Promise<{ ownerIndex: number | null; ownerCount: number }> {
  const { publicClient, smartWallet, ownerAddress, maxScan = 64 } = params
  const countRaw = (await publicClient.readContract({
    address: smartWallet,
    abi: COINBASE_SMART_WALLET_OWNERS_ABI,
    functionName: 'ownerCount',
  })) as bigint
  const count = Number(countRaw)
  if (!Number.isFinite(count) || count <= 0) return { ownerIndex: null, ownerCount: 0 }

  const expected = asOwnerBytes(ownerAddress).toLowerCase()
  const limit = Math.min(count, Math.max(1, maxScan))
  for (let i = 0; i < limit; i++) {
    const b = (await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'ownerAtIndex',
      args: [BigInt(i)],
    })) as Hex
    if (String(b).toLowerCase() === expected) return { ownerIndex: i, ownerCount: count }
  }
  return { ownerIndex: null, ownerCount: count }
}

type UserOpSignMode = 'eth_sign' | 'signMessage' | 'auto'

function createWalletBackedLocalAccount(params: {
  walletClient: WalletClientLike
  address: Address
  userOpSignMode?: UserOpSignMode
}) {
  const { walletClient, address, userOpSignMode = 'auto' } = params

  return toAccount({
    address,
    // Required for Coinbase Smart Wallet userOp signatures (sign raw digest).
    sign: async ({ hash }) => {
      // Coinbase Smart Wallet UserOps are signed over the 32-byte UserOp hash.
      //
      // - Prefer `eth_sign` when available (no EIP-191 prefix).
      // - Some wallets (notably Rabby) block `eth_sign`. In that case, try `personal_sign` via `signMessage({ raw })`
      //   which produces an EIP-191 signature. If the account implementation does not accept that, the bundler
      //   simulation will reject the UserOp (no onchain tx), and callers can fall back to other paths.
      const tryEthSign = async () => {
        const sig = await (walletClient as any).request({ method: 'eth_sign', params: [address, hash] })
        return sig as Hex
      }
      const tryPersonalSign = async () => {
        return (await walletClient.signMessage({
          account: address,
          // `raw` signs the 32-byte payload (still EIP-191 prefixed at the JSON-RPC layer).
          message: { raw: hash },
        })) as Hex
      }

      if (userOpSignMode === 'eth_sign') return await tryEthSign()
      if (userOpSignMode === 'signMessage') return await tryPersonalSign()

      try {
        return await tryEthSign()
      } catch {
        return await tryPersonalSign()
      }
    },
    signMessage: async ({ message }) => {
      return (await walletClient.signMessage({ account: address, message })) as Hex
    },
    signTypedData: async (typedData: any) => {
      return (await walletClient.signTypedData({ account: address, ...(typedData as any) })) as Hex
    },
    signTransaction: async (tx, options) => {
      const wc: any = walletClient as any
      if (typeof wc.signTransaction !== 'function') throw new Error('Wallet does not support signTransaction')
      return (await wc.signTransaction({ ...tx, ...options, account: address })) as Hex
    },
  })
}

export async function sendCoinbaseSmartWalletUserOperation(params: {
  publicClient: PublicClientLike
  walletClient: WalletClientLike
  bundlerUrl: string
  smartWallet: Address
  ownerAddress: Address
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>
  version?: '1' | '1.1'
  userOpSignMode?: UserOpSignMode
}): Promise<{ userOpHash: Hex; transactionHash: Hex }> {
  const { publicClient, walletClient, bundlerUrl, smartWallet, ownerAddress, calls, version = '1', userOpSignMode = 'auto' } = params
  if (!bundlerUrl) throw new Error('Missing bundler URL')

  const { ownerIndex, ownerCount } = await findCoinbaseSmartWalletOwnerIndex({
    publicClient,
    smartWallet,
    ownerAddress,
  })
  const resolvedOwnerIndex = ownerIndex ?? (ownerCount === 1 ? 0 : null)
  if (resolvedOwnerIndex === null) {
    throw new Error('Connected wallet is not an onchain owner of this Coinbase Smart Wallet.')
  }

  const owner = createWalletBackedLocalAccount({ walletClient, address: ownerAddress, userOpSignMode })
  const account = await toCoinbaseSmartAccount({
    client: publicClient as any,
    address: smartWallet,
    owners: [owner],
    ownerIndex: resolvedOwnerIndex,
    version,
  })

  // CDP uses a single endpoint for bundler + paymaster JSON-RPC methods.
  // If `bundlerUrl` is our same-origin proxy (`/api/paymaster`), we MUST include cookies
  // so the backend can validate the SIWE session (`cv_auth_session`).
  const sessionToken = typeof window !== 'undefined' ? getStoredSessionToken() : null
  const transport = http(bundlerUrl, {
    fetchOptions: {
      credentials: 'include',
      headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
    },
  })
  const paymasterClient = createPaymasterClient({ transport })
  const bundlerClient = createBundlerClient({
    client: publicClient as any,
    transport,
  })

  const userOpHash = await sendUserOperation(bundlerClient, {
    account,
    calls,
    paymaster: {
      getPaymasterData: paymasterClient.getPaymasterData,
      getPaymasterStubData: paymasterClient.getPaymasterStubData,
    },
  })

  const receipt = await waitForUserOperationReceipt(bundlerClient, { hash: userOpHash, timeout: 120_000 })
  return { userOpHash, transactionHash: receipt.receipt.transactionHash as Hex }
}
