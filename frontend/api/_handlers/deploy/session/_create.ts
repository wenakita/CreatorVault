import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomBytes } from 'node:crypto'

import { getAddress, isAddress, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { handleOptions, readJsonBody, readSessionFromRequest, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { ensureDeploySessionsSchema, hashDeployToken, insertDeploySession, randomDeployToken, randomId } from '../../../../server/_lib/deploySessions.js'
import { isDbConfigured } from '../../../../server/_lib/postgres.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type Call = { to: Address; value?: bigint; data: Hex }

type CreateDeploySessionRequest = {
  smartWallet: Address
  creatorToken: Address
  ownerAddress: Address
  // Calls that the server will submit after the user signs the first UserOp.
  // These are executed by the Coinbase Smart Wallet via ERC-4337.
  phase2Calls: Call[]
  phase3Calls?: Call[]
  // Optional metadata for debugging/UI.
  version?: string
}

type CreateDeploySessionResponse = {
  sessionId: string
  sessionOwner: Address
  expiresAt: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<null>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'Deploy sessions require DB configuration' } satisfies ApiEnvelope<null>)
  }

  const session = readSessionFromRequest(req)
  if (!session?.address) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<null>)
  }

  const body = await readJsonBody<CreateDeploySessionRequest>(req)
  if (!body) return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<null>)

  try {
    const sessionAddress = getAddress(session.address as Address)
    const smartWallet = getAddress(body.smartWallet)
    const creatorToken = getAddress(body.creatorToken)
    const ownerAddress = getAddress(body.ownerAddress)

    if (!isAddress(smartWallet) || !isAddress(creatorToken) || !isAddress(ownerAddress)) {
      return res.status(400).json({ success: false, error: 'Invalid addresses' } satisfies ApiEnvelope<null>)
    }

    const phase2Calls = Array.isArray(body.phase2Calls) ? body.phase2Calls : []
    const phase3Calls = Array.isArray(body.phase3Calls) ? body.phase3Calls : []
    if (phase2Calls.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing phase2Calls' } satisfies ApiEnvelope<null>)
    }

    // Generate ephemeral session owner (EOA) used as a temporary Coinbase Smart Wallet owner.
    const pk = (`0x${randomBytes(32).toString('hex')}`) as Hex
    const acct = privateKeyToAccount(pk)
    const sessionOwner = getAddress(acct.address)

    const deployToken = randomDeployToken()
    const tokenHash = hashDeployToken(deployToken)
    const id = randomId()

    const now = Date.now()
    const expiresAt = new Date(now + 10 * 60 * 1000) // 10 minutes

    await ensureDeploySessionsSchema()
    await insertDeploySession({
      id,
      tokenHash,
      sessionAddress: sessionAddress,
      smartWallet,
      sessionOwner,
      deployToken,
      sessionOwnerPrivateKey: pk,
      payload: {
        creatorToken,
        ownerAddress,
        smartWallet,
        sessionOwner,
        version: String(body.version ?? ''),
        phase2Calls,
        phase3Calls,
      },
      expiresAt,
    })

    const out: CreateDeploySessionResponse = { sessionId: id, sessionOwner, expiresAt: expiresAt.toISOString() }
    return res.status(200).json({ success: true, data: out } satisfies ApiEnvelope<CreateDeploySessionResponse>)
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message ? String(e.message) : 'create_failed' } satisfies ApiEnvelope<null>)
  }
}

