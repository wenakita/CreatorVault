import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getAddress, type Address, type Hex } from 'viem'
import { createPublicClient, encodeAbiParameters, encodeFunctionData, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { createBundlerClient, createPaymasterClient, sendUserOperation, toCoinbaseSmartAccount, waitForUserOperationReceipt } from 'viem/account-abstraction'

import { handleOptions, readJsonBody, readSessionFromRequest, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { logger } from '../../../server/_lib/logger.js'
import { decryptWithSecret, getDeploySessionById, signDeployToken, updateDeploySession } from '../../../server/_lib/deploySessions.js'

declare const process: { env: Record<string, string | undefined> }

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type CancelRequest = { sessionId: string }

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
] as const

const COINBASE_SMART_WALLET_OWNER_MGMT_ABI = [
  { type: 'function', name: 'removeOwnerAtIndex', stateMutability: 'nonpayable', inputs: [{ name: 'index', type: 'uint256' }, { name: 'owner', type: 'bytes' }], outputs: [] },
] as const

function asOwnerBytes(owner: Address): Hex {
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

async function findOwnerIndex(params: {
  publicClient: any
  smartWallet: Address
  ownerAddress: Address
  maxScan?: number
}): Promise<number | null> {
  const { publicClient, smartWallet, ownerAddress, maxScan = 128 } = params
  const countRaw = (await publicClient.readContract({
    address: smartWallet,
    abi: COINBASE_SMART_WALLET_OWNERS_ABI,
    functionName: 'ownerCount',
  })) as bigint
  const count = Number(countRaw)
  if (!Number.isFinite(count) || count <= 0) return null

  const expected = asOwnerBytes(ownerAddress).toLowerCase()
  const limit = Math.min(count, Math.max(1, maxScan))
  for (let i = 0; i < limit; i++) {
    const b = (await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'ownerAtIndex',
      args: [BigInt(i)],
    })) as Hex
    if (String(b).toLowerCase() === expected) return i
  }
  return null
}

function getOrigin(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] ?? 'https') as string
  const host = (req.headers['x-forwarded-host'] ?? req.headers.host ?? '') as string
  const safeProto = String(proto).toLowerCase().includes('http') ? String(proto).toLowerCase() : 'https'
  if (!host) throw new Error('missing_host')
  return `${safeProto}://${host}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<null>)
  }

  const session = readSessionFromRequest(req)
  if (!session?.address) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<null>)
  }

  const body = await readJsonBody<CancelRequest>(req)
  const sessionId = body?.sessionId ? String(body.sessionId).trim() : ''
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing sessionId' } satisfies ApiEnvelope<null>)

  const rec = await getDeploySessionById(sessionId)
  if (!rec) return res.status(404).json({ success: false, error: 'Not found' } satisfies ApiEnvelope<null>)

  const sessionAddress = getAddress(session.address)
  if (sessionAddress.toLowerCase() !== rec.sessionAddress.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Forbidden' } satisfies ApiEnvelope<null>)
  }

  try {
    const pk = decryptWithSecret(rec.sessionOwnerKeyEnc) as Hex
    const ownerAccount = privateKeyToAccount(pk)
    const smartWallet = getAddress(rec.smartWallet)
    const sessionOwner = getAddress(rec.sessionOwner)

    const publicClient = createPublicClient({
      chain: base,
      transport: http((process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim(), { timeout: 12_000 }),
    })

    const ownerIndex = await findOwnerIndex({
      publicClient,
      smartWallet,
      ownerAddress: sessionOwner,
      maxScan: 256,
    })
    if (ownerIndex === null) {
      await updateDeploySession({ id: rec.id, step: 'cancelled', lastError: null })
      return res.status(200).json({ success: true, data: { id: rec.id, step: 'cancelled' } } satisfies ApiEnvelope<any>)
    }

    const origin = getOrigin(req)
    const bundlerUrl = `${origin}/api/paymaster`

    const deployToken = rec.deployToken
    const deploySig = signDeployToken(deployToken)
    const transport = http(bundlerUrl, {
      fetchOptions: {
        headers: {
          'X-CV-Deploy-Session': deployToken,
          'X-CV-Deploy-Session-Signature': deploySig,
        },
      },
    })

    const paymasterClient = createPaymasterClient({ transport })
    const bundlerClient = createBundlerClient({ client: publicClient as any, transport })

    const account = await toCoinbaseSmartAccount({
      client: publicClient as any,
      address: smartWallet,
      owners: [ownerAccount],
      ownerIndex,
      version: '1',
    })

    const ownerBytes = asOwnerBytes(sessionOwner)
    const data = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
      functionName: 'removeOwnerAtIndex',
      args: [BigInt(ownerIndex), ownerBytes],
    })

    await updateDeploySession({ id: rec.id, step: 'cleanup_sent' })
    const hash = await sendUserOperation(bundlerClient, {
      account,
      calls: [{ to: smartWallet, value: 0n, data }],
      paymaster: { getPaymasterData: paymasterClient.getPaymasterData, getPaymasterStubData: paymasterClient.getPaymasterStubData },
    })
    const receipt = await waitForUserOperationReceipt(bundlerClient, { hash, timeout: 180_000 })
    const txHash = receipt.receipt.transactionHash as Hex
    await updateDeploySession({ id: rec.id, step: 'cancelled', lastUserOpHash: hash, lastTxHash: txHash, lastError: null })

    return res.status(200).json({ success: true, data: { id: rec.id, step: 'cancelled', lastTxHash: txHash } } satisfies ApiEnvelope<any>)
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : 'cancel_failed'
    logger.error('deploy session cancel failed', msg)
    try {
      await updateDeploySession({ id: rec.id, step: 'failed', lastError: msg })
    } catch {
      // ignore
    }
    return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<null>)
  }
}

