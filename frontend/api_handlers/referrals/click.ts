import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../server/auth/_shared.js'
import { getDb } from '../../server/_lib/postgres.js'
import {
  ensureReferralsSchema,
  getClientIp,
  getUserAgent,
  hashForAttribution,
  normalizeReferralCode,
} from '../../server/_lib/referrals.js'

type ClickBody = {
  referralCode?: string
  sessionId?: string | null
  landingUrl?: string | null
}

type ClickResponse = { recorded: boolean }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<ClickBody>(req)
  const codeRaw = typeof body?.referralCode === 'string' ? body.referralCode : ''
  const referralCode = normalizeReferralCode(codeRaw)
  if (!referralCode) {
    return res.status(200).json({ success: true, data: { recorded: false } satisfies ClickResponse } satisfies ApiEnvelope<ClickResponse>)
  }

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureReferralsSchema(db)

  // Look up referrer by code.
  const ref = await db.sql`
    SELECT id
    FROM waitlist_signups
    WHERE referral_code = ${referralCode}
    LIMIT 1;
  `
  const referrerId = typeof ref?.rows?.[0]?.id === 'number' ? (ref.rows[0].id as number) : null
  if (!referrerId) {
    return res.status(200).json({ success: true, data: { recorded: false } satisfies ClickResponse } satisfies ApiEnvelope<ClickResponse>)
  }

  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''
  const landingUrl = typeof body?.landingUrl === 'string' ? body.landingUrl.trim() : ''

  const uaRaw = getUserAgent(req)
  const ipHash = hashForAttribution(getClientIp(req))
  const uaHash = hashForAttribution(uaRaw)
  const uaLower = String(uaRaw || '').toLowerCase()
  const isBotSuspected =
    !uaLower ||
    /(bot|crawler|spider|headless|pingdom|uptime|monitor|curl|wget|httpclient)/i.test(uaLower)

  // Rate limit: ignore repeated clicks from same session within 10 seconds.
  if (sessionId) {
    const last = await db.sql`
      SELECT created_at
      FROM referral_clicks
      WHERE referral_code = ${referralCode} AND session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT 1;
    `
    const lastAt = last?.rows?.[0]?.created_at ? new Date(String(last.rows[0].created_at)).getTime() : 0
    if (lastAt && Date.now() - lastAt < 10_000) {
      return res.status(200).json({ success: true, data: { recorded: false } satisfies ClickResponse } satisfies ApiEnvelope<ClickResponse>)
    }
  }

  await db.sql`
    INSERT INTO referral_clicks (
      referral_code,
      referrer_signup_id,
      ip_hash,
      ua_hash,
      session_id,
      landing_url,
      is_bot_suspected,
      created_at
    )
    VALUES (
      ${referralCode},
      ${referrerId},
      ${ipHash},
      ${uaHash},
      ${sessionId || null},
      ${landingUrl || null},
      ${isBotSuspected},
      NOW()
    );
  `

  return res.status(200).json({ success: true, data: { recorded: true } satisfies ClickResponse } satisfies ApiEnvelope<ClickResponse>)
}

