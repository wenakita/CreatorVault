import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomBytes } from 'node:crypto'
import { setCors as setCorsAllowlist } from '../auth/_shared'
import { readNonceToken } from '../auth/_shared'

declare const process: { env: Record<string, string | undefined> }

export type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

export const COOKIE_SIWF_NONCE = 'cv_farcaster_siwf_nonce'

export const SIWF_NONCE_TTL_SECONDS = 60 * 5 // 5m

export function setNoStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
}

export function setCors(req: VercelRequest, res: VercelResponse) {
  setCorsAllowlist(req, res)
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    setCors(req, res)
    res.status(200).end()
    return true
  }
  return false
}

export function parseCookies(req: VercelRequest): Record<string, string> {
  const header = req.headers?.cookie
  if (!header || typeof header !== 'string') return {}
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (!k) continue
    out[k] = decodeURIComponent(v)
  }
  return out
}

function isProbablyHttps(req: VercelRequest): boolean {
  const xfProto = req.headers?.['x-forwarded-proto']
  if (typeof xfProto === 'string' && xfProto.toLowerCase() === 'https') return true
  const host = typeof req.headers?.host === 'string' ? req.headers.host : ''
  // local dev / vite
  if (host.includes('localhost') || host.includes('127.0.0.1')) return false
  // assume https for deployed origins
  return host.length > 0
}

export function setCookie(
  req: VercelRequest,
  res: VercelResponse,
  name: string,
  value: string,
  opts: { maxAgeSeconds?: number; httpOnly?: boolean } = {},
) {
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax']
  if (opts.httpOnly ?? true) parts.push('HttpOnly')
  if (typeof opts.maxAgeSeconds === 'number') parts.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAgeSeconds))}`)
  if (isProbablyHttps(req)) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

export function clearCookie(req: VercelRequest, res: VercelResponse, name: string) {
  setCookie(req, res, name, '', { maxAgeSeconds: 0, httpOnly: true })
}

export async function readJsonBody<T>(req: VercelRequest): Promise<T | null> {
  // Vercel may populate req.body; our local dev middleware doesn't.
  const b: unknown = (req as any).body
  if (b && typeof b === 'object') return b as T

  const chunks: Buffer[] = []
  for await (const chunk of req as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) return null
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
  } catch {
    return null
  }
}

export function makeNonce(): string {
  // Farcaster docs require ≥8 alphanumeric; hex is fine.
  return randomBytes(16).toString('hex')
}

export function getFarcasterDomain(): string | null {
  const raw = (process.env.FARCASTER_DOMAIN || '').trim()
  // Default to the canonical production domain for CreatorVault (4626.fun).
  // This avoids shipping a broken deployment if env vars aren't configured yet,
  // while still allowing overrides for staging.
  if (!raw) return '4626.fun'
  return raw
}

export function getCanonicalOrigin(): string | null {
  const raw = (process.env.FARCASTER_CANONICAL_ORIGIN || '').trim()
  if (raw) return raw.replace(/\/+$/, '')
  const d = getFarcasterDomain()
  if (!d) return null
  return `https://${d}`
}

export function domainMatches(a: string, b: string): boolean {
  const an = String(a).toLowerCase().split(':')[0]
  const bn = String(b).toLowerCase().split(':')[0]
  return Boolean(an && bn && an === bn)
}

export type ParsedSiwf = { domain: string; nonce: string; issuedAt: string }

export function parseSiwfBasics(message: string): ParsedSiwf | null {
  if (typeof message !== 'string' || message.trim().length === 0) return null
  const lines = message.split('\n')
  const first = (lines[0] ?? '').trim()
  const marker = ' wants you to sign in with your Ethereum account:'
  const idx = first.indexOf(marker)
  if (idx <= 0) return null
  const domain = first.slice(0, idx).trim()

  const findField = (prefix: string): string | null => {
    const line = lines.find((l) => l.trim().toLowerCase().startsWith(prefix.toLowerCase()))
    if (!line) return null
    const raw = line.slice(prefix.length).trim()
    return raw.length > 0 ? raw : null
  }

  const nonce = findField('Nonce:')
  const issuedAt = findField('Issued At:')
  if (!domain || !nonce || !issuedAt) return null
  return { domain, nonce, issuedAt }
}

// Re-export nonce token validation for SIWF cookie fallback.
export { readNonceToken }

