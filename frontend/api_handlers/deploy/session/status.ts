import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getAddress } from 'viem'

import { handleOptions, readJsonBody, readSessionFromRequest, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDeploySessionById } from '../../../server/_lib/deploySessions.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type StatusRequest = { sessionId: string }

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

  const body = await readJsonBody<StatusRequest>(req)
  const sessionId = body?.sessionId ? String(body.sessionId).trim() : ''
  if (!sessionId) return res.status(400).json({ success: false, error: 'Missing sessionId' } satisfies ApiEnvelope<null>)

  const rec = await getDeploySessionById(sessionId)
  if (!rec) return res.status(404).json({ success: false, error: 'Not found' } satisfies ApiEnvelope<null>)

  // Ensure the SIWE session matches the recorded sessionAddress.
  const sessionAddress = getAddress(session.address)
  if (sessionAddress.toLowerCase() !== rec.sessionAddress.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Forbidden' } satisfies ApiEnvelope<null>)
  }

  return res.status(200).json({
    success: true,
    data: {
      id: rec.id,
      step: rec.step,
      expiresAt: rec.expiresAt,
      lastError: rec.lastError,
      lastUserOpHash: rec.lastUserOpHash,
      lastTxHash: rec.lastTxHash,
      smartWallet: rec.smartWallet,
      sessionOwner: rec.sessionOwner,
    },
  } satisfies ApiEnvelope<any>)
}

