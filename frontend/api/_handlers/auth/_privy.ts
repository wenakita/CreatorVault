import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  COOKIE_SESSION,
  handleOptions,
  setCookie,
  setCors,
  setNoStore,
  makeSessionToken,
} from '../../../server/auth/_shared.js'

import { PrivyClient } from '@privy-io/server-auth'

declare const process: { env: Record<string, string | undefined> }

type PrivyVerifyResponse = {
  address: string
  sessionToken: string
  privyUserId: string
}

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

function normalizeLower(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : ''
}

function extractBaseAccountAddress(user: any): string | null {
  const linked = Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
  const primaryWallet = user?.wallet && typeof user.wallet === 'object' ? [{ ...user.wallet, type: 'wallet' }] : []
  const all = [...primaryWallet, ...linked]

  for (const raw of all) {
    const type = normalizeLower((raw as any)?.type)
    if (type !== 'wallet') continue

    const addr = typeof (raw as any)?.address === 'string' ? String((raw as any).address).trim() : ''
    if (!isValidEvmAddress(addr)) continue

    const chainType = normalizeLower((raw as any)?.chainType ?? (raw as any)?.chain_type)
    if (chainType && chainType !== 'ethereum') continue

    const walletClientType = normalizeLower(
      (raw as any)?.walletClientType ??
        (raw as any)?.wallet_client_type ??
        (raw as any)?.walletType ??
        (raw as any)?.wallet_type ??
        (raw as any)?.connectorType ??
        (raw as any)?.connector_type,
    )

    // Base Account / Coinbase Smart Wallet path.
    if (walletClientType === 'base_account' || walletClientType.includes('base_account')) {
      return addr.toLowerCase()
    }
  }

  return null
}

function getPrivyServerAuth(): { appId: string; appSecret: string } | null {
  const appId = (process.env.PRIVY_APP_ID || '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET || '').trim()
  if (!appId || !appSecret) return null
  return { appId, appSecret }
}

function getBearerToken(req: VercelRequest): string | null {
  const h = req.headers?.authorization
  const raw = typeof h === 'string' ? h.trim() : ''
  if (!raw) return null
  if (!raw.toLowerCase().startsWith('bearer ')) return null
  const token = raw.slice('bearer '.length).trim()
  return token.length > 0 ? token : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const auth = getPrivyServerAuth()
  if (!auth) {
    return res.status(503).json({
      success: false,
      error: 'Privy server auth is not configured (missing PRIVY_APP_ID / PRIVY_APP_SECRET).',
    } satisfies ApiEnvelope<never>)
  }

  const token = getBearerToken(req)
  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing Privy auth token' } satisfies ApiEnvelope<never>)
  }

  try {
    const client = new PrivyClient(auth.appId, auth.appSecret)
    const claims = await client.verifyAuthToken(token)
    const user = await client.getUserById(claims.userId)

    const baseAccount = extractBaseAccountAddress(user)
    if (!baseAccount) {
      return res.status(400).json({
        success: false,
        error: 'No Base Account wallet is linked. Link Coinbase Smart Wallet (Base Account) to continue.',
      } satisfies ApiEnvelope<never>)
    }

    const sessionToken = makeSessionToken({ address: baseAccount })
    setCookie(req, res, COOKIE_SESSION, sessionToken, { httpOnly: true, maxAgeSeconds: 60 * 60 * 24 * 7 })

    return res.status(200).json({
      success: true,
      data: { address: baseAccount, sessionToken, privyUserId: claims.userId } satisfies PrivyVerifyResponse,
    } satisfies ApiEnvelope<PrivyVerifyResponse>)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Privy verification failed'
    // Avoid leaking details; keep message generic unless it’s clearly a client issue.
    const lower = String(msg || '').toLowerCase()
    const isAuthish =
      lower.includes('jwt') ||
      lower.includes('token') ||
      lower.includes('signature') ||
      lower.includes('unauthorized') ||
      lower.includes('forbidden')
    return res.status(isAuthish ? 401 : 500).json({
      success: false,
      error: isAuthish ? 'Invalid Privy auth token' : 'Privy verification failed',
    } satisfies ApiEnvelope<never>)
  }
}

