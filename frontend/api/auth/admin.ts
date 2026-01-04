import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from './_shared.js'
import { getSessionAddress, isAdminAddress } from '../_lib/session.js'

type AdminResponse = { address: string; isAdmin: boolean } | null

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const address = getSessionAddress(req)
  if (!address) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<AdminResponse>)
  }

  return res.status(200).json({
    success: true,
    data: { address, isAdmin: isAdminAddress(address) } satisfies NonNullable<AdminResponse>,
  } satisfies ApiEnvelope<AdminResponse>)
}


