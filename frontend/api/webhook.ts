import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from './auth/_shared.js'

type WebhookOk = { ok: true }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  // This webhook is optional. It’s included to satisfy Base/Farcaster preview tooling and to
  // support future Mini App events/notifications. For now, we accept and no-op.
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({ success: true, data: { ok: true } satisfies WebhookOk } satisfies ApiEnvelope<WebhookOk>)
}


