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
type ContinueRequest = { sessionId: string }

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  { type: 'function', name: 'ownerCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerAtIndex', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
] as const

const COINBASE_SMART_WALLET_OWNER_MGMT_ABI = [
  { type: 'function', name: 'removeOwnerAtIndex', stateMutability: 'nonpayable', inputs: [{ name: 'index', type: 'uint256' }, { name: 'owner', type: 'bytes' }], outputs: [] },
] as const

function asOwnerBytes(owner: Address): Hex {
  // Coinbase Smart Wallet stores EOA owners as 32-byte left-padded address bytes.
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

async function findOwnerIndex(params: {
  publicClient: any
  smartWallet: Address
  ownerAddress: Address
  maxScan?: number
}): Promise<number | null> {
  const { publicClient, smartWallet, ownerAddress, maxScan = 64 } = params
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

  const body = await readJsonBody<ContinueRequest>(req)
  const sessionId = body?.sessionId ? String(body.sessionId).trim() : ''
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing sessionId' } satisfies ApiEnvelope<null>)

  const rec = await getDeploySessionById(sessionId)
  if (!rec) return res.status(404).json({ success: false, error: 'Not found' } satisfies ApiEnvelope<null>)

  const sessionAddress = getAddress(session.address)
  if (sessionAddress.toLowerCase() !== rec.sessionAddress.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Forbidden' } satisfies ApiEnvelope<null>)
  }

  try {
    // Server signs userops using the temporary owner key.
    const pk = decryptWithSecret(rec.sessionOwnerKeyEnc) as Hex
    const ownerAccount = privateKeyToAccount(pk)
    const smartWallet = getAddress(rec.smartWallet)
    const sessionOwner = getAddress(rec.sessionOwner)
    const ownerIndex = await findOwnerIndex({
      publicClient: createPublicClient({ chain: base, transport: http((process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim()) }),
      smartWallet,
      ownerAddress: sessionOwner,
      maxScan: 128,
    })
    if (ownerIndex === null) throw new Error('session_owner_not_installed')

    const publicClient = createPublicClient({
      chain: base,
      transport: http((process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim(), { timeout: 12_000 }),
    })

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

    const payload: any = rec.payload ?? {}
    const phase2Calls = Array.isArray(payload.phase2Calls) ? (payload.phase2Calls as any[]) : []
    const phase3Calls = Array.isArray(payload.phase3Calls) ? (payload.phase3Calls as any[]) : []

    if (phase2Calls.length === 0) throw new Error('missing_phase2_calls')

    // Decide whether we still need to run phase2/phase3. Keep it simple: run phase2 if not already confirmed.
    const shouldRunPhase2 = !['phase2_confirmed', 'phase3_sent', 'phase3_confirmed', 'cleanup_sent', 'completed'].includes(rec.step)
    const shouldRunPhase3 = phase3Calls.length > 0 && !['phase3_confirmed', 'cleanup_sent', 'completed'].includes(rec.step)

    // Cleanup call (remove the temporary owner). Attach it to the last UserOp we send.
    const removeOwnerCall = (() => {
      const ownerBytes = asOwnerBytes(sessionOwner)
      const data = encodeFunctionData({
        abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
        functionName: 'removeOwnerAtIndex',
        args: [BigInt(ownerIndex), ownerBytes],
      })
      return { to: smartWallet, value: 0n, data } as const
    })()

    let lastTx: Hex | null = null
    let lastUserOpHash: Hex | null = null

    if (shouldRunPhase2) {
      await updateDeploySession({ id: rec.id, step: 'phase2_sent' })
      const calls = [...phase2Calls.map((c) => ({ to: getAddress(c.to), value: BigInt(c.value ?? 0), data: c.data as Hex }))] as any[]
      if (!shouldRunPhase3) calls.push(removeOwnerCall)

      lastUserOpHash = await sendUserOperation(bundlerClient, {
        account,
        calls,
        paymaster: { getPaymasterData: paymasterClient.getPaymasterData, getPaymasterStubData: paymasterClient.getPaymasterStubData },
      })
      const receipt = await waitForUserOperationReceipt(bundlerClient, { hash: lastUserOpHash, timeout: 180_000 })
      lastTx = receipt.receipt.transactionHash as Hex
      await updateDeploySession({ id: rec.id, step: 'phase2_confirmed', lastUserOpHash, lastTxHash: lastTx })
    }

    if (shouldRunPhase3) {
      await updateDeploySession({ id: rec.id, step: 'phase3_sent' })
      const calls = [
        ...phase3Calls.map((c) => ({ to: getAddress(c.to), value: BigInt(c.value ?? 0), data: c.data as Hex })),
        removeOwnerCall,
      ] as any[]

      lastUserOpHash = await sendUserOperation(bundlerClient, {
        account,
        calls,
        paymaster: { getPaymasterData: paymasterClient.getPaymasterData, getPaymasterStubData: paymasterClient.getPaymasterStubData },
      })
      const receipt = await waitForUserOperationReceipt(bundlerClient, { hash: lastUserOpHash, timeout: 180_000 })
      lastTx = receipt.receipt.transactionHash as Hex
      await updateDeploySession({ id: rec.id, step: 'phase3_confirmed', lastUserOpHash, lastTxHash: lastTx })
    }

    await updateDeploySession({ id: rec.id, step: 'completed' })

    return res.status(200).json({
      success: true,
      data: {
        id: rec.id,
        step: 'completed',
        lastTxHash: lastTx,
        lastUserOpHash,
      },
    } satisfies ApiEnvelope<any>)
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : 'continue_failed'
    logger.error('deploy session continue failed', msg)
    try {
      await updateDeploySession({ id: rec.id, step: 'failed', lastError: msg })
    } catch {
      // ignore
    }
    return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<null>)
  }
}

