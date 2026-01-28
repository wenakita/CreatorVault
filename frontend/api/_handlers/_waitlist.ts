import { type ApiEnvelope, handleOptions, readSessionFromRequest, setCors, setNoStore } from '../../server/auth/_shared.js'
import { getDb } from '../../server/_lib/postgres.js'
import { normalizeReferralCode, getClientIp, getUserAgent, hashForAttribution } from '../../server/_lib/referrals.js'
import { awardWaitlistPoints, ensureWaitlistPointsSchema, WAITLIST_POINTS } from '../../server/_lib/waitlistPoints.js'
import { ensureWaitlistSchema } from '../../server/_lib/waitlistSchema.js'

declare const process: { env: Record<string, string | undefined> }

type WaitlistRequestBody = {
  email?: string
  primaryWallet?: string | null
  solanaWallet?: string | null
  baseSubAccount?: string | null
  referralCode?: string | null
  claimReferralCode?: string | null
  contactPreference?: string | null
  verifications?: Array<{ method?: string; subject?: string; timestamp?: string }> | null
  intent?: {
    persona?: 'creator' | 'user' | null
    hasCreatorCoin?: boolean | null
    fid?: number | null
  } | null
}

type WaitlistResponse = {
  created: boolean
  email: string
  referralCode?: string | null
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function isSyntheticEmail(v: string): boolean {
  return v.endsWith('@noemail.4626.fun')
}

function buildDeterministicSyntheticEmail(seed?: string | null): string {
  const domain = 'noemail.4626.fun'
  const safeSeed = typeof seed === 'string' ? seed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) : ''
  const fnv1a32 = (input: string): number => {
    let h = 0x811c9dc5
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
  }
  const seedNorm = typeof seed === 'string' ? seed.trim().toLowerCase() : ''
  const token = fnv1a32(seedNorm || 'anon').toString(36).padStart(7, '0').slice(0, 12)
  const prefix = safeSeed.length > 0 ? safeSeed.toLowerCase() : 'anon'
  return `${prefix}+${token}@${domain}`
}

function normalizeAddress(v: string): string {
  return v.trim()
}

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

function isValidSolanaAddress(v: string): boolean {
  const s = String(v || '').trim()
  if (!s) return false
  if (s.length < 32 || s.length > 44) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

type ContactPreference = 'wallet' | 'farcaster' | 'email' | 'solana'
type VerificationClaim = { method: string; subject: string; timestamp: string }

function normalizeContactPreference(v: unknown): ContactPreference | null {
  const t = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (t === 'wallet' || t === 'farcaster' || t === 'email' || t === 'solana') return t
  return null
}

function sanitizeVerifications(input: unknown): VerificationClaim[] {
  if (!Array.isArray(input)) return []
  const out: VerificationClaim[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const method = typeof (raw as any).method === 'string' ? String((raw as any).method).trim() : ''
    const subject = typeof (raw as any).subject === 'string' ? String((raw as any).subject).trim() : ''
    const timestamp = typeof (raw as any).timestamp === 'string' ? String((raw as any).timestamp).trim() : ''
    if (!method || !subject) continue
    out.push({ method, subject, timestamp })
  }
  return out
}

function normalizeReferralCodeOrNull(v: string | null | undefined): string | null {
  if (typeof v !== 'string') return null
  const code = normalizeReferralCode(v)
  return code.length > 0 ? code : null
}

async function resolveCreatorCoinSymbolFromWallet(wallet: string): Promise<string | null> {
  const key = (process.env.ZORA_SERVER_API_KEY || '').trim()
  if (!key) return null
  try {
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)
    const profileResp = await sdk.getProfile({ identifier: wallet })
    const creatorCoinAddr = String((profileResp as any)?.data?.profile?.creatorCoin?.address ?? '').trim()
    if (!creatorCoinAddr) return null
    const coinResp = await sdk.getCoin({ address: creatorCoinAddr, chain: 8453 })
    const symbol = String((coinResp as any)?.data?.zora20Token?.symbol ?? '').trim()
    return symbol || null
  } catch {
    return null
  }
}

function getPrivyAuth(): { appId: string; appSecret: string } | null {
  const appId = (process.env.PRIVY_APP_ID || '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET || '').trim()
  if (!appId || !appSecret) return null
  return { appId, appSecret }
}

function isPrivyWaitlistEnabled(): boolean {
  const raw = String(
    process.env.PRIVY_WAITLIST_PREGENERATE ??
      process.env.PRIVY_WAITLIST_ENABLED ??
      process.env.VITE_PRIVY_WAITLIST_ENABLED ??
      '',
  )
    .trim()
    .toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function getBasicAuthHeader(appId: string, appSecret: string): string {
  return `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`
}

type EmbeddedWalletMeta = {
  address: string | null
  chainType: string | null
  walletClientType: string | null
}

function extractEmbeddedWalletMeta(user: any): EmbeddedWalletMeta {
  const wallets = Array.isArray(user?.wallets) ? user.wallets : []
  const primaryWallet = user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []
  const all = [...primaryWallet, ...wallets]
  const normalizeChain = (v: any): string | null => {
    const s = String(v ?? '').trim().toLowerCase()
    return s.length > 0 ? s : null
  }
  const normalizeClientType = (v: any): string | null => {
    const s = String(v ?? '').trim().toLowerCase()
    return s.length > 0 ? s : null
  }
  const parseWallet = (w: any): EmbeddedWalletMeta => {
    const addr = typeof w?.address === 'string' ? w.address : null
    const chainType = normalizeChain(w?.chain_type || w?.chainType)
    const walletClientType = normalizeClientType(w?.wallet_client_type || w?.walletClientType || w?.connector_type || w?.connectorType || w?.type)
    return {
      address: addr && isValidEvmAddress(addr) ? addr : null,
      chainType,
      walletClientType,
    }
  }
  const isEmbedded = (clientType: string | null) =>
    clientType ? clientType.includes('privy') || clientType.includes('embedded') : false

  for (const w of all) {
    const meta = parseWallet(w)
    if (meta.address && isEmbedded(meta.walletClientType)) return meta
  }

  for (const w of all) {
    const meta = parseWallet(w)
    if (!meta.address) continue
    if (!meta.chainType || meta.chainType === 'ethereum') return meta
  }

  return { address: null, chainType: null, walletClientType: null }
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

async function privyCreateOrGetWaitlistUser(email: string): Promise<{
  privyUserId: string | null
  embeddedWallet: string | null
  embeddedWalletChain: string | null
  embeddedWalletClientType: string | null
  created: boolean
}> {
  const auth = getPrivyAuth()
  if (!auth)
    return { privyUserId: null, embeddedWallet: null, embeddedWalletChain: null, embeddedWalletClientType: null, created: false }
  if (!isPrivyWaitlistEnabled())
    return { privyUserId: null, embeddedWallet: null, embeddedWalletChain: null, embeddedWalletClientType: null, created: false }

  const existing = await privyGetUserByEmail({ ...auth, email })
  const created = !existing
  const user = existing ?? (await privyCreateUserWithEthereumWallet({ ...auth, email }))

  const privyUserId =
    typeof user?.id === 'string'
      ? user.id
      : typeof user?.user?.id === 'string'
        ? user.user.id
        : null

  const embeddedMeta = extractEmbeddedWalletMeta(user?.user ?? user)
  return {
    privyUserId,
    embeddedWallet: embeddedMeta.address,
    embeddedWalletChain: embeddedMeta.chainType,
    embeddedWalletClientType: embeddedMeta.walletClientType,
    created,
  }
}

export default async function handler(req: any, res: any) {
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
  let email = normalizeEmail(emailRaw)
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }

  const walletRaw = typeof body.primaryWallet === 'string' ? body.primaryWallet : ''
  const primaryWalletInput = normalizeAddress(walletRaw)
  const session = readSessionFromRequest(req)
  const sessionWalletRaw = typeof session?.address === 'string' ? session.address : ''
  const sessionWallet = normalizeAddress(sessionWalletRaw)

  let primaryWallet = primaryWalletInput
  if (sessionWallet && isValidEvmAddress(sessionWallet)) {
    if (primaryWallet && primaryWallet.toLowerCase() !== sessionWallet.toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: 'Signed-in wallet does not match the provided wallet.',
      } satisfies ApiEnvelope<never>)
    }
    primaryWallet = sessionWallet
  }

  // If the client sent a synthetic email, normalize it deterministically from the wallet identity.
  // This ensures repeat submissions update the same row (email is UNIQUE) instead of creating duplicates.
  if (isSyntheticEmail(email)) {
    const seed = (primaryWallet && isValidEvmAddress(primaryWallet) ? primaryWallet : null) || null
    if (seed) {
      email = buildDeterministicSyntheticEmail(seed)
    }
  }

  if (primaryWallet.length > 0 && !isValidEvmAddress(primaryWallet)) {
    return res.status(400).json({ success: false, error: 'Invalid primary wallet address' } satisfies ApiEnvelope<never>)
  }

  const solRaw = typeof body.solanaWallet === 'string' ? body.solanaWallet : ''
  const solanaWallet = String(solRaw || '').trim()
  if (solanaWallet.length > 0 && !isValidSolanaAddress(solanaWallet)) {
    return res.status(400).json({ success: false, error: 'Invalid Solana wallet address' } satisfies ApiEnvelope<never>)
  }

  const subRaw = typeof body.baseSubAccount === 'string' ? body.baseSubAccount : ''
  const baseSubAccount = normalizeAddress(subRaw)
  if (baseSubAccount.length > 0 && !isValidEvmAddress(baseSubAccount)) {
    return res.status(400).json({ success: false, error: 'Invalid Base sub-account address' } satisfies ApiEnvelope<never>)
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
  const contactPreference = normalizeContactPreference(body.contactPreference)
  const verifications = sanitizeVerifications(body.verifications)

  const hasVerificationSignal =
    verifications.length > 0 ||
    (primaryWallet.length > 0 && isValidEvmAddress(primaryWallet)) ||
    (solanaWallet.length > 0 && isValidSolanaAddress(solanaWallet)) ||
    (typeof farcasterFid === 'number' && farcasterFid > 0)
  if (persona === 'creator' && !hasVerificationSignal) {
    return res.status(400).json({ success: false, error: 'Creator verification is required.' } satisfies ApiEnvelope<never>)
  }

  const referralFromBody = normalizeReferralCodeOrNull(body.referralCode)
  const claimReferralCode = normalizeReferralCodeOrNull(body.claimReferralCode)

  const db = await getDb()
  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Waitlist requires DB configuration (DATABASE_URL).',
    } satisfies ApiEnvelope<never>)
  }

  try {
    await ensureWaitlistSchema(db as any)
  } catch (e: any) {
    // If the DB is reachable but schema creation is blocked, fail with a clear operator error.
    const msg = e?.message ? String(e.message) : 'Failed to initialize waitlist schema'
    return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
  }
  // Keep points schema ensured even if this handler is hot-reloaded separately.
  await ensureWaitlistPointsSchema(db as any)

  const ipHash = hashForAttribution(getClientIp(req))
  const uaHash = hashForAttribution(getUserAgent(req))

  let privyUserId: string | null = null
  let embeddedWallet: string | null = null
  let embeddedWalletChain: string | null = null
  let embeddedWalletClientType: string | null = null
  if (!isSyntheticEmail(email)) {
    try {
      const privy = await privyCreateOrGetWaitlistUser(email)
      privyUserId = privy.privyUserId
      embeddedWallet = privy.embeddedWallet
      embeddedWalletChain = privy.embeddedWalletChain
      embeddedWalletClientType = privy.embeddedWalletClientType
      if (privyUserId || embeddedWallet) {
        console.info(
          'waitlist: privy user',
          JSON.stringify({
            email,
            privyUserId,
            embeddedWallet,
            embeddedWalletChain,
            embeddedWalletClientType,
            created: privy.created,
          }),
        )
      }
    } catch (e: any) {
      // Privy is optional. If it fails, we still accept the waitlist signup.
      // Surface a minimal warning in logs only (no PII beyond email already provided).
      console.warn('waitlist: privy error', e?.message ? String(e.message) : e)
    }
  }

  try {
    // Preferred schema (includes persona + has_creator_coin).
    const r = await db.sql`
      INSERT INTO waitlist_signups (
        email,
        primary_wallet,
        solana_wallet,
        privy_user_id,
        embedded_wallet,
        embedded_wallet_chain,
        embedded_wallet_client_type,
        base_sub_account,
        persona,
        has_creator_coin,
        farcaster_fid,
        contact_preference,
        verifications,
        created_at,
        updated_at
      )
      VALUES (
        ${email},
        ${primaryWallet.length > 0 ? primaryWallet : null},
        ${solanaWallet.length > 0 ? solanaWallet : null},
        ${privyUserId},
        ${embeddedWallet},
        ${embeddedWalletChain},
        ${embeddedWalletClientType},
        ${baseSubAccount.length > 0 ? baseSubAccount : null},
        ${persona},
        ${hasCreatorCoinRaw},
        ${farcasterFid},
        ${contactPreference},
        ${verifications.length > 0 ? JSON.stringify(verifications) : null},
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO UPDATE
        SET primary_wallet = COALESCE(EXCLUDED.primary_wallet, waitlist_signups.primary_wallet),
            solana_wallet = COALESCE(EXCLUDED.solana_wallet, waitlist_signups.solana_wallet),
            privy_user_id = COALESCE(EXCLUDED.privy_user_id, waitlist_signups.privy_user_id),
            embedded_wallet = COALESCE(EXCLUDED.embedded_wallet, waitlist_signups.embedded_wallet),
            embedded_wallet_chain = COALESCE(EXCLUDED.embedded_wallet_chain, waitlist_signups.embedded_wallet_chain),
            embedded_wallet_client_type = COALESCE(EXCLUDED.embedded_wallet_client_type, waitlist_signups.embedded_wallet_client_type),
            base_sub_account = COALESCE(EXCLUDED.base_sub_account, waitlist_signups.base_sub_account),
            persona = COALESCE(EXCLUDED.persona, waitlist_signups.persona),
            has_creator_coin = COALESCE(EXCLUDED.has_creator_coin, waitlist_signups.has_creator_coin),
            farcaster_fid = COALESCE(EXCLUDED.farcaster_fid, waitlist_signups.farcaster_fid),
            contact_preference = COALESCE(EXCLUDED.contact_preference, waitlist_signups.contact_preference),
            verifications = COALESCE(EXCLUDED.verifications, waitlist_signups.verifications),
            updated_at = NOW()
      RETURNING id, (xmax = 0) AS created, email, referral_code;
    `

    const row = (r?.rows?.[0] ?? null) as { id?: unknown; created?: unknown; email?: unknown; referral_code?: unknown } | null
    if (!row) throw new Error('Insert failed')

    const signupId = typeof row.id === 'number' ? (row.id as number) : null
    const created = Boolean(row.created)

    // Babylon-style: award points immediately on join (idempotent via ledger unique key).
    if (signupId && created) {
      await awardWaitlistPoints({
        db,
        signupId,
        source: 'waitlist_signup',
        sourceId: `email:${email}`,
        amount: WAITLIST_POINTS.signup,
      })
    }

    // Everyone gets a referral code (Babylon-style).
    let referralCodeOut: string | null = typeof row.referral_code === 'string' ? (row.referral_code as string) : null
    if (signupId && !referralCodeOut) {
      const desired =
        claimReferralCode ||
        (primaryWallet.length > 0 ? normalizeReferralCodeOrNull(await resolveCreatorCoinSymbolFromWallet(primaryWallet)) : null) ||
        `C${Number(signupId).toString(36).toUpperCase()}`
      try {
        const up = await db.sql`
          UPDATE waitlist_signups
          SET referral_code = ${desired}, referral_claimed_at = NOW()
          WHERE id = ${signupId} AND referral_code IS NULL
          RETURNING referral_code;
        `
        const claimed = typeof up?.rows?.[0]?.referral_code === 'string' ? String(up.rows[0].referral_code) : null
        referralCodeOut = claimed || referralCodeOut
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : ''
        if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicate')) {
          // If the user explicitly tried to claim a code and it collided, surface the error.
          if (claimReferralCode) {
            return res.status(409).json({
              success: false,
              error: 'Referral code is taken. Choose a different code.',
              code: 'REFERRAL_CODE_TAKEN',
              suggested: desired,
            } as any)
          }
          // Otherwise ignore (we'll just proceed without a code).
        }
      }
    }

    // If the signup came with a referral code, attribute conversion (best-effort).
    if (signupId && referralFromBody) {
      const ref = await db.sql`
        SELECT id
        FROM waitlist_signups
        WHERE referral_code = ${referralFromBody}
        LIMIT 1;
      `
      const referrerId = typeof ref?.rows?.[0]?.id === 'number' ? (ref.rows[0].id as number) : null
      if (referrerId && referrerId !== signupId) {
        // Link invitee to referrer (do not overwrite if already set).
        await db.sql`
          UPDATE waitlist_signups
          SET referred_by_code = ${referralFromBody}, referred_by_signup_id = ${referrerId}
          WHERE id = ${signupId} AND referred_by_signup_id IS NULL;
        `
        // Insert conversion (one per invitee). If it already exists, ignore.
        await db.sql`
          INSERT INTO referral_conversions (
            referral_code,
            referrer_signup_id,
            invitee_signup_id,
            ip_hash,
            ua_hash,
            session_id,
            attribution,
            is_valid,
            invalid_reason,
            status,
            created_at
          )
          VALUES (
            ${referralFromBody},
            ${referrerId},
            ${signupId},
            ${ipHash},
            ${uaHash},
            NULL,
            'last_click',
            TRUE,
            NULL,
            'signed_up',
            NOW()
          )
          ON CONFLICT (invitee_signup_id) DO NOTHING;
        `
      }
    }

    const data: WaitlistResponse = { created, email: String(row.email ?? ''), referralCode: referralCodeOut }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistResponse>)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Waitlist insert failed'
    const lower = String(msg).toLowerCase()

    // If the table didn't exist (or was dropped), try to recreate and retry once.
    if (lower.includes('relation') && lower.includes('waitlist_signups')) {
      try {
        await ensureWaitlistSchema(db as any)
        const rRetry = await db.sql`
          INSERT INTO waitlist_signups (
            email,
            primary_wallet,
            solana_wallet,
            privy_user_id,
            embedded_wallet,
            embedded_wallet_chain,
            embedded_wallet_client_type,
            base_sub_account,
            persona,
            has_creator_coin,
            farcaster_fid,
            contact_preference,
            verifications,
            created_at,
            updated_at
          )
          VALUES (
            ${email},
            ${primaryWallet.length > 0 ? primaryWallet : null},
            ${solanaWallet.length > 0 ? solanaWallet : null},
            ${privyUserId},
            ${embeddedWallet},
            ${embeddedWalletChain},
            ${embeddedWalletClientType},
            ${baseSubAccount.length > 0 ? baseSubAccount : null},
            ${persona},
            ${hasCreatorCoinRaw},
            ${farcasterFid},
            ${contactPreference},
            ${verifications.length > 0 ? JSON.stringify(verifications) : null},
            NOW(),
            NOW()
          )
          ON CONFLICT (email) DO UPDATE
            SET primary_wallet = COALESCE(EXCLUDED.primary_wallet, waitlist_signups.primary_wallet),
                solana_wallet = COALESCE(EXCLUDED.solana_wallet, waitlist_signups.solana_wallet),
                privy_user_id = COALESCE(EXCLUDED.privy_user_id, waitlist_signups.privy_user_id),
                embedded_wallet = COALESCE(EXCLUDED.embedded_wallet, waitlist_signups.embedded_wallet),
                embedded_wallet_chain = COALESCE(EXCLUDED.embedded_wallet_chain, waitlist_signups.embedded_wallet_chain),
                embedded_wallet_client_type = COALESCE(EXCLUDED.embedded_wallet_client_type, waitlist_signups.embedded_wallet_client_type),
                base_sub_account = COALESCE(EXCLUDED.base_sub_account, waitlist_signups.base_sub_account),
                persona = COALESCE(EXCLUDED.persona, waitlist_signups.persona),
                has_creator_coin = COALESCE(EXCLUDED.has_creator_coin, waitlist_signups.has_creator_coin),
                farcaster_fid = COALESCE(EXCLUDED.farcaster_fid, waitlist_signups.farcaster_fid),
                contact_preference = COALESCE(EXCLUDED.contact_preference, waitlist_signups.contact_preference),
                verifications = COALESCE(EXCLUDED.verifications, waitlist_signups.verifications),
                updated_at = NOW()
          RETURNING (xmax = 0) AS created, email;
        `
        const rowRetry = (rRetry?.rows?.[0] ?? null) as { created?: unknown; email?: unknown } | null
        if (!rowRetry) throw new Error('Insert failed')
        const dataRetry: WaitlistResponse = { created: Boolean(rowRetry.created), email: String(rowRetry.email ?? '') }
        return res.status(200).json({ success: true, data: dataRetry } satisfies ApiEnvelope<WaitlistResponse>)
      } catch (eRetry: any) {
        const msgRetry = eRetry instanceof Error ? eRetry.message : msg
        return res.status(500).json({ success: false, error: String(msgRetry) } satisfies ApiEnvelope<never>)
      }
    }

    // Back-compat: if the DB table exists but hasn't been migrated with new columns yet,
    // retry without persona columns so signups still work.
    if (
      lower.includes('column') &&
      (lower.includes('persona') ||
        lower.includes('has_creator_coin') ||
        lower.includes('farcaster_fid') ||
        lower.includes('embedded_wallet_chain') ||
        lower.includes('embedded_wallet_client_type') ||
        lower.includes('contact_preference') ||
        lower.includes('verifications') ||
        lower.includes('base_sub_account'))
    ) {
      try {
        const r2 = await db.sql`
          INSERT INTO waitlist_signups (email, primary_wallet, privy_user_id, embedded_wallet, created_at, updated_at)
          VALUES (${email}, ${primaryWallet.length > 0 ? primaryWallet : null}, ${privyUserId}, ${embeddedWallet}, NOW(), NOW())
          ON CONFLICT (email) DO UPDATE
            SET primary_wallet = COALESCE(EXCLUDED.primary_wallet, waitlist_signups.primary_wallet),
                privy_user_id = COALESCE(EXCLUDED.privy_user_id, waitlist_signups.privy_user_id),
                embedded_wallet = COALESCE(EXCLUDED.embedded_wallet, waitlist_signups.embedded_wallet),
                updated_at = NOW()
          RETURNING (xmax = 0) AS created, email;
        `
        const row2 = (r2?.rows?.[0] ?? null) as { created?: unknown; email?: unknown } | null
        if (!row2) throw new Error('Insert failed')
        const data2: WaitlistResponse = { created: Boolean(row2.created), email: String(row2.email ?? '') }
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
