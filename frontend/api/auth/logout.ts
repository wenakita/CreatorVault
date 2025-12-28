import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, clearCookie, COOKIE_NONCE, COOKIE_SESSION, handleOptions, setCors, setNoStore } from './_shared'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  clearCookie(req, res, COOKIE_SESSION)
  clearCookie(req, res, COOKIE_NONCE)
  return res.status(200).json({ success: true, data: true } satisfies ApiEnvelope<boolean>)
}



