import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from './auth/_shared.js'
import { getDb } from './_lib/postgres.js'

declare const process: { env: Record<string, string | undefined> }

type WaitlistRequestBody = {
  email?: string
  primaryWallet?: string | null
  intent?: {
    persona?: 'creator' | 'user' | null
    hasCreatorCoin?: boolean | null
    fid?: number | null
  } | null
}

type WaitlistResponse = {
  created: boolean
  email: string
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function normalizeAddress(v: string): string {
  return v.trim()
}

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

function getPrivyAuth(): { appId: string; appSecret: string } | null {
  const appId = (process.env.PRIVY_APP_ID || '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET || '').trim()
  if (!appId || !appSecret) return null
  return { appId, appSecret }
}

function isPrivyWaitlistEnabled(): boolean {
  const v = (process.env.PRIVY_WAITLIST_PREGENERATE || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function getBasicAuthHeader(appId: string, appSecret: string): string {
  return `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`
}

function extractFirstEthereumWalletAddress(user: any): string | null {
  // Prefer explicit wallets array if present.
  const wallets = Array.isArray(user?.wallets) ? user.wallets : []
  for (const w of wallets) {
    const chainType = String(w?.chain_type || w?.chainType || '').toLowerCase()
    const addr = typeof w?.address === 'string' ? w.address : null
    if (addr && (chainType === '' || chainType === 'ethereum') && isValidEvmAddress(addr)) return addr
  }

  // Fallback: search linked_accounts for a wallet-like object.
  const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : []
  for (const a of linked) {
    const t = String(a?.type || '').toLowerCase()
    const chainType = String(a?.chain_type || a?.chainType || '').toLowerCase()
    const addr = typeof a?.address === 'string' ? a.address : null
    if (!addr) continue
    if (t.includes('wallet') || t === 'ethereum' || chainType === 'ethereum') {
      if (isValidEvmAddress(addr)) return addr
    }
  }

  return null
}

async function privyGetUserByEmail(params: { appId: string; appSecret: string; email: string }): Promise<any | null> {
  const { appId, appSecret, email } = params
  const url = `https://auth.privy.io/api/v1/apps/${encodeURIComponent(appId)}/users/email/${encodeURIComponent(email)}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: getBasicAuthHeader(appId, appSecret),
      'privy-app-id': appId,
      'Content-Type': 'application/json',
    },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Privy get-user failed: HTTP ${res.status}${text ? ` (${text})` : ''}`)
  }
  return await res.json()
}

async function privyCreateUserWithEthereumWallet(params: {
  appId: string
  appSecret: string
  email: string
}): Promise<any> {
  const { appId, appSecret, email } = params
  const url = `https://auth.privy.io/api/v1/apps/${encodeURIComponent(appId)}/users`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: getBasicAuthHeader(appId, appSecret),
      'privy-app-id': appId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      linked_accounts: [{ type: 'email', address: email }],
      wallets: [{ chain_type: 'ethereum' }],
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Privy create-user failed: HTTP ${res.status}${text ? ` (${text})` : ''}`)
  }
  return await res.json()
}

async function privyCreateOrGetWaitlistUser(email: string): Promise<{ privyUserId: string | null; embeddedWallet: string | null }> {
  const auth = getPrivyAuth()
  if (!auth) return { privyUserId: null, embeddedWallet: null }
  if (!isPrivyWaitlistEnabled()) return { privyUserId: null, embeddedWallet: null }

  const existing = await privyGetUserByEmail({ ...auth, email })
  const user = existing ?? (await privyCreateUserWithEthereumWallet({ ...auth, email }))

  const privyUserId =
    typeof user?.id === 'string'
      ? user.id
      : typeof user?.user?.id === 'string'
        ? user.user.id
        : null

  const embeddedWallet = extractFirstEthereumWalletAddress(user?.user ?? user)
  return { privyUserId, embeddedWallet }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  let body: WaitlistRequestBody = {}
  try {
    body =
      typeof req.body === 'string'
        ? (JSON.parse(req.body) as WaitlistRequestBody)
        : (req.body as WaitlistRequestBody) || {}
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  const emailRaw = typeof body.email === 'string' ? body.email : ''
  const email = normalizeEmail(emailRaw)
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }

  const walletRaw = typeof body.primaryWallet === 'string' ? body.primaryWallet : ''
  const primaryWallet = normalizeAddress(walletRaw)
  if (primaryWallet.length > 0 && !isValidEvmAddress(primaryWallet)) {
    return res.status(400).json({ success: false, error: 'Invalid primary wallet address' } satisfies ApiEnvelope<never>)
  }

  const persona =
    body.intent && typeof body.intent === 'object' && (body.intent as any).persona === 'creator'
      ? 'creator'
      : body.intent && typeof body.intent === 'object' && (body.intent as any).persona === 'user'
        ? 'user'
        : null
  const hasCreatorCoinRaw =
    body.intent && typeof body.intent === 'object' && typeof (body.intent as any).hasCreatorCoin === 'boolean'
      ? Boolean((body.intent as any).hasCreatorCoin)
      : null
  const farcasterFidRaw =
    body.intent && typeof body.intent === 'object' && typeof (body.intent as any).fid === 'number'
      ? Math.floor(Number((body.intent as any).fid))
      : null
  const farcasterFid = farcasterFidRaw && Number.isFinite(farcasterFidRaw) && farcasterFidRaw > 0 ? farcasterFidRaw : null

  const db = await getDb()
  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Waitlist requires DB configuration (DATABASE_URL).',
    } satisfies ApiEnvelope<never>)
  }

  let privyUserId: string | null = null
  let embeddedWallet: string | null = null
  try {
    const privy = await privyCreateOrGetWaitlistUser(email)
    privyUserId = privy.privyUserId
    embeddedWallet = privy.embeddedWallet
  } catch (e: any) {
    // Privy is optional. If it fails, we still accept the waitlist signup.
    // Surface a minimal warning in logs only (no PII beyond email already provided).
    console.warn('waitlist: privy error', e?.message ? String(e.message) : e)
  }

  try {
    // Preferred schema (includes persona + has_creator_coin).
    const r = await db.sql<{
      created: boolean
      email: string
    }>`
      INSERT INTO waitlist_signups (
        email,
        primary_wallet,
        privy_user_id,
        embedded_wallet,
        persona,
        has_creator_coin,
        farcaster_fid,
        created_at,
        updated_at
      )
      VALUES (
        ${email},
        ${primaryWallet.length > 0 ? primaryWallet : null},
        ${privyUserId},
        ${embeddedWallet},
        ${persona},
        ${hasCreatorCoinRaw},
        ${farcasterFid},
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO UPDATE
        SET primary_wallet = COALESCE(EXCLUDED.primary_wallet, waitlist_signups.primary_wallet),
            privy_user_id = COALESCE(EXCLUDED.privy_user_id, waitlist_signups.privy_user_id),
            embedded_wallet = COALESCE(EXCLUDED.embedded_wallet, waitlist_signups.embedded_wallet),
            persona = COALESCE(EXCLUDED.persona, waitlist_signups.persona),
            has_creator_coin = COALESCE(EXCLUDED.has_creator_coin, waitlist_signups.has_creator_coin),
            farcaster_fid = COALESCE(EXCLUDED.farcaster_fid, waitlist_signups.farcaster_fid),
            updated_at = NOW()
      RETURNING (xmax = 0) AS created, email;
    `

    const row = r?.rows?.[0]
    if (!row) throw new Error('Insert failed')

    const data: WaitlistResponse = { created: Boolean(row.created), email: row.email }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistResponse>)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Waitlist insert failed'
    const lower = String(msg).toLowerCase()

    // Back-compat: if the DB table exists but hasn't been migrated with new columns yet,
    // retry without persona columns so signups still work.
    if (
      lower.includes('column') &&
      (lower.includes('persona') || lower.includes('has_creator_coin') || lower.includes('farcaster_fid'))
    ) {
      try {
        const r2 = await db.sql<{ created: boolean; email: string }>`
          INSERT INTO waitlist_signups (email, primary_wallet, privy_user_id, embedded_wallet, created_at, updated_at)
          VALUES (${email}, ${primaryWallet.length > 0 ? primaryWallet : null}, ${privyUserId}, ${embeddedWallet}, NOW(), NOW())
          ON CONFLICT (email) DO UPDATE
            SET primary_wallet = COALESCE(EXCLUDED.primary_wallet, waitlist_signups.primary_wallet),
                privy_user_id = COALESCE(EXCLUDED.privy_user_id, waitlist_signups.privy_user_id),
                embedded_wallet = COALESCE(EXCLUDED.embedded_wallet, waitlist_signups.embedded_wallet),
                updated_at = NOW()
          RETURNING (xmax = 0) AS created, email;
        `
        const row2 = r2?.rows?.[0]
        if (!row2) throw new Error('Insert failed')
        const data2: WaitlistResponse = { created: Boolean(row2.created), email: row2.email }
        return res.status(200).json({ success: true, data: data2 } satisfies ApiEnvelope<WaitlistResponse>)
      } catch (e2: any) {
        const msg2 = e2 instanceof Error ? e2.message : msg
        return res.status(500).json({ success: false, error: String(msg2) } satisfies ApiEnvelope<never>)
      }
    }

    // Helpful hint if the table hasn't been created yet.
    const hint =
      lower.includes('relation') && lower.includes('waitlist_signups')
        ? 'Missing table. Create `waitlist_signups` (see docs) and retry.'
        : null
    return res.status(500).json({ success: false, error: hint ? `${msg}. ${hint}` : msg } satisfies ApiEnvelope<never>)
  }
}

