import { createHash, randomBytes } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'

import { readSessionFromRequest } from '../auth/_shared.js'
import { ensureKeeprSchema } from './keeprSchema.js'
import { getDb } from './postgres.js'

declare const process: { env: Record<string, string | undefined> }

const JOIN_NONCE_TTL_SECONDS = 60 * 10 // 10m

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function nowIso(): string {
  return new Date().toISOString()
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

function normalizeRpcUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (!t.startsWith('http://') && !t.startsWith('https://')) return `https://${t}`
  return t
}

const DEFAULT_BASE_RPCS = [
  'https://base-mainnet.public.blastapi.io',
  'https://base.llamarpc.com',
  'https://mainnet.base.org',
] as const

function getBaseRpcUrls(): string[] {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  const parts = raw
    ? raw
        .split(/[\s,]+/g)
        .map(normalizeRpcUrl)
        .filter((x): x is string => Boolean(x))
    : []
  const urls = parts.length > 0 ? [...parts, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]
  return Array.from(new Set(urls))
}

const EIP1271_MAGICVALUE = '0x1626ba7e' as const
const eip1271Abi = [
  {
    type: 'function',
    name: 'isValidSignature',
    stateMutability: 'view',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'magicValue', type: 'bytes4' }],
  },
] as const

async function verifyEip1271(params: {
  contract: `0x${string}`
  message: string
  signature: `0x${string}`
}): Promise<boolean> {
  const { createPublicClient, hashMessage, http } = await import('viem')
  const { base } = await import('viem/chains')

  const urls = getBaseRpcUrls()
  const digest = hashMessage(params.message)

  for (const url of urls) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(url, { timeout: 12_000 }),
      })

      const code = await client.getBytecode({ address: params.contract })
      if (!code || code === '0x') return false

      const magic = await client.readContract({
        address: params.contract,
        abi: eip1271Abi,
        functionName: 'isValidSignature',
        args: [digest, params.signature],
      })
      return String(magic).toLowerCase() === EIP1271_MAGICVALUE
    } catch {
      continue
    }
  }

  return false
}

async function verifyWalletSignature(params: { address: `0x${string}`; message: string; signature: `0x${string}` }): Promise<boolean> {
  try {
    const { verifyMessage } = await import('viem')
    const ok = await verifyMessage({
      address: params.address,
      message: params.message,
      signature: params.signature,
    })
    if (ok) return true
  } catch {
    // fall through to EIP-1271 attempt
  }

  try {
    return await verifyEip1271({
      contract: params.address,
      message: params.message,
      signature: params.signature,
    })
  } catch {
    return false
  }
}

export type KeeprJoinMessageFields = {
  wallet: `0x${string}`
  vaultAddress: `0x${string}`
  nonce: string
  issuedAt: string
  expiresAt: string
}

export function buildKeeprJoinMessage(fields: KeeprJoinMessageFields): string {
  return [
    'CreatorVault Keepr Join',
    '',
    `Wallet: ${fields.wallet}`,
    `Vault: ${fields.vaultAddress}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
    `Expires At: ${fields.expiresAt}`,
  ].join('\n')
}

export function parseKeeprJoinMessage(message: string): KeeprJoinMessageFields | null {
  if (typeof message !== 'string' || message.trim().length === 0) return null
  const lines = message.split('\n').map((l) => l.trim())
  if (lines[0] !== 'CreatorVault Keepr Join') return null

  const readField = (prefix: string): string | null => {
    const line = lines.find((l) => l.toLowerCase().startsWith(prefix.toLowerCase()))
    if (!line) return null
    const raw = line.slice(prefix.length).trim()
    return raw.length > 0 ? raw : null
  }

  const wallet = readField('Wallet:')
  const vault = readField('Vault:')
  const nonce = readField('Nonce:')
  const issuedAt = readField('Issued At:')
  const expiresAt = readField('Expires At:')
  if (!wallet || !vault || !nonce || !issuedAt || !expiresAt) return null
  if (!isAddressLike(wallet) || !isAddressLike(vault)) return null
  return {
    wallet: wallet.toLowerCase() as `0x${string}`,
    vaultAddress: vault.toLowerCase() as `0x${string}`,
    nonce,
    issuedAt,
    expiresAt,
  }
}

export async function issueKeeprJoinNonce(params: { wallet: `0x${string}`; vaultAddress: `0x${string}` }): Promise<{
  nonce: string
  issuedAt: string
  expiresAt: string
}> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureKeeprSchema()

  // Rate-limit + idempotency: reuse the most recent unexpired unused join nonce.
  // This prevents nonce spam and makes "retry" UX stable.
  try {
    const existing = await db.sql`
      SELECT nonce, issued_at, expires_at
      FROM keepr_nonces
      WHERE purpose = 'join'
        AND wallet_address = ${params.wallet.toLowerCase()}
        AND vault_address = ${params.vaultAddress.toLowerCase()}
        AND used_at IS NULL
        AND expires_at >= NOW()
      ORDER BY issued_at DESC
      LIMIT 1;
    `
    const row: any = existing.rows?.[0]
    if (row?.nonce && row?.expires_at) {
      const nonce = String(row.nonce)
      const issuedAt = row.issued_at ? new Date(row.issued_at).toISOString() : nowIso()
      const expiresAt = row.expires_at ? new Date(row.expires_at).toISOString() : new Date(Date.now() + JOIN_NONCE_TTL_SECONDS * 1000).toISOString()
      return { nonce, issuedAt, expiresAt }
    }
  } catch {
    // ignore and fall back to issuing a new nonce
  }

  const nonce = randomBytes(16).toString('hex')
  const issuedAt = nowIso()
  const expiresAt = new Date(Date.now() + JOIN_NONCE_TTL_SECONDS * 1000).toISOString()

  await db.sql`
    INSERT INTO keepr_nonces (nonce, purpose, wallet_address, vault_address, expires_at)
    VALUES (
      ${nonce},
      ${'join'},
      ${params.wallet.toLowerCase()},
      ${params.vaultAddress.toLowerCase()},
      ${expiresAt}
    );
  `

  return { nonce, issuedAt, expiresAt }
}

async function consumeKeeprNonce(params: {
  wallet: `0x${string}`
  vaultAddress: `0x${string}`
  nonce: string
  expiresAt: string
}): Promise<void> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureKeeprSchema()

  // Use an atomic update to prevent replay.
  const res = await db.sql`
    UPDATE keepr_nonces
      SET used_at = NOW()
    WHERE nonce = ${params.nonce}
      AND purpose = 'join'
      AND wallet_address = ${params.wallet.toLowerCase()}
      AND vault_address = ${params.vaultAddress.toLowerCase()}
      AND used_at IS NULL
      AND expires_at >= NOW()
    RETURNING nonce;
  `
  if (!res.rows?.[0]?.nonce) throw new Error('nonce_invalid_or_used')

  // Extra check: bind the message's expiry window too (defense-in-depth).
  const expMs = Date.parse(params.expiresAt)
  if (!Number.isFinite(expMs) || expMs < Date.now()) throw new Error('message_expired')
}

export async function verifyKeeprJoinProof(params: {
  req: VercelRequest
  message: string
  signature: string
  expectedVaultAddress: `0x${string}`
}): Promise<{ wallet: `0x${string}`; messageHash: string }> {
  const parsed = parseKeeprJoinMessage(params.message)
  if (!parsed) throw new Error('invalid_message')
  if (parsed.vaultAddress.toLowerCase() !== params.expectedVaultAddress.toLowerCase()) throw new Error('vault_mismatch')

  // Best-effort bind to an existing signed-in session if available (helps in embedded contexts).
  const session = readSessionFromRequest(params.req)
  if (session?.address && session.address.toLowerCase() !== parsed.wallet.toLowerCase()) {
    throw new Error('session_wallet_mismatch')
  }

  const issuedAtMs = Date.parse(parsed.issuedAt)
  if (!Number.isFinite(issuedAtMs) || Date.now() - issuedAtMs > 1000 * 60 * 15) throw new Error('message_too_old')

  const sig = params.signature
  if (typeof sig !== 'string' || !sig.startsWith('0x')) throw new Error('invalid_signature')

  const ok = await verifyWalletSignature({
    address: parsed.wallet,
    message: params.message,
    signature: sig as `0x${string}`,
  })
  if (!ok) throw new Error('signature_invalid')

  await consumeKeeprNonce({
    wallet: parsed.wallet,
    vaultAddress: parsed.vaultAddress,
    nonce: parsed.nonce,
    expiresAt: parsed.expiresAt,
  })

  return { wallet: parsed.wallet, messageHash: sha256Hex(params.message) }
}

