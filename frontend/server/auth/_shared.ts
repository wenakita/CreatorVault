import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

declare const process: { env: Record<string, string | undefined> }

export type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

export const COOKIE_NONCE = 'cv_auth_nonce'
export const COOKIE_SESSION = 'cv_auth_session'

const NONCE_TTL_SECONDS = 60 * 15 // 15m
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7d

const EIP1271_MAGICVALUE = '0x1626ba7e' as const

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

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

const DEFAULT_BASE_RPCS = [
  // Public community RPCs (best-effort)
  'https://base-mainnet.public.blastapi.io',
  'https://base.llamarpc.com',
  // Official public endpoint (rate limited)
  'https://mainnet.base.org',
] as const

function normalizeRpcUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  // Accept bare hostnames pasted by accident.
  if (!t.startsWith('http://') && !t.startsWith('https://')) return `https://${t}`
  return t
}

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

async function verifyEip1271(params: { contract: `0x${string}`; message: string; signature: `0x${string}` }): Promise<boolean> {
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

      // If there is no code, we can't verify EIP-1271 (counterfactual wallets would need EIP-6492).
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
      // Try next RPC (handles 429/rate-limits and transient upstream issues).
      continue
    }
  }

  return false
}

export function setNoStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
}

function addVary(res: VercelResponse, value: string) {
  const existing = res.getHeader('Vary')
  const cur = typeof existing === 'string' ? existing : Array.isArray(existing) ? existing.join(',') : ''
  const parts = cur
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!parts.includes(value)) parts.push(value)
  res.setHeader('Vary', parts.join(', '))
}

function getAllowedOrigins(): Set<string> {
  const vercelUrl = (process.env.VERCEL_URL ?? '').trim()
  const extra = (process.env.CORS_ALLOWED_ORIGINS ?? '').trim()
  const cacheKey = `${vercelUrl}||${extra}`

  const g: any = globalThis as any
  const cached: { key: string; value: Set<string> } | undefined = g.__creatorvault_allowed_origins_cache
  if (cached && cached.key === cacheKey) return cached.value

  const out = new Set<string>([
    // Production
    'https://creatorvault.fun',
    'https://www.creatorvault.fun',
    'https://4626.fun',
    'https://www.4626.fun',
    // Local dev
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ])

  if (vercelUrl) out.add(`https://${vercelUrl}`)

  if (extra) {
    for (const raw of extra.split(/[\s,]+/g)) {
      if (!raw) continue
      try {
        out.add(new URL(raw).origin)
      } catch {
        // ignore invalid
      }
    }
  }

  g.__creatorvault_allowed_origins_cache = { key: cacheKey, value: out }
  return out
}

export function setCors(req: VercelRequest, res: VercelResponse) {
  // Allow Authorization so embedded contexts can pass a session token when cookies are blocked.
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  const originHeader = typeof req.headers?.origin === 'string' ? req.headers.origin : ''
  const origin = originHeader ? (() => {
    try {
      return new URL(originHeader).origin
    } catch {
      return null
    }
  })() : null

  const allowed = getAllowedOrigins()
  if (origin && allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    addVary(res, 'Origin')
  }
}

export function readSessionFromRequest(req: VercelRequest): { address: string } | null {
  // Primary: HttpOnly cookie session (preferred when available).
  const cookies = parseCookies(req)
  const cookieToken = cookies[COOKIE_SESSION]
  const cookieSession = readSessionToken(cookieToken)
  if (cookieSession) return cookieSession

  // Fallback: Authorization bearer token (helps in embedded/mini-app contexts where cookies may be blocked).
  const h = req.headers?.authorization
  const auth = typeof h === 'string' ? h.trim() : ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice('bearer '.length).trim()
    const headerSession = readSessionToken(token)
    if (headerSession) return headerSession
  }

  return null
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
    try {
      out[k] = decodeURIComponent(v)
    } catch {
      // Malformed percent-encoding shouldn't crash the request; treat as raw.
      out[k] = v
    }
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

function appendSetCookie(res: VercelResponse, value: string) {
  const existing = res.getHeader('Set-Cookie')
  if (!existing) {
    res.setHeader('Set-Cookie', value)
    return
  }
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, value])
    return
  }
  res.setHeader('Set-Cookie', [String(existing), value])
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
  // Support setting multiple cookies in a single response.
  appendSetCookie(res, parts.join('; '))
}

export function clearCookie(req: VercelRequest, res: VercelResponse, name: string) {
  setCookie(req, res, name, '', { maxAgeSeconds: 0, httpOnly: true })
}

export async function readJsonBody<T>(req: VercelRequest, opts: { maxBytes?: number } = {}): Promise<T | null> {
  // Vercel may populate req.body; our local dev middleware doesn't.
  const b: unknown = (req as any).body
  if (b && typeof b === 'object') return b as T

  const chunks: Buffer[] = []
  const maxBytes = typeof opts.maxBytes === 'number' && Number.isFinite(opts.maxBytes) ? Math.max(1, Math.floor(opts.maxBytes)) : 1_000_000
  let total = 0
  for await (const chunk of req as any) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > maxBytes) return null
    chunks.push(buf)
  }
  if (chunks.length === 0) return null
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
  } catch {
    return null
  }
}

export function makeNonce(): string {
  return randomBytes(16).toString('hex')
}

function base64UrlEncode(input: string | Buffer): string {
  const b = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecodeToString(input: string): string | null {
  try {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '==='.slice((b64.length + 3) % 4)
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return null
  }
}

function hmacSha256(secret: string, payload: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest()
}

function getSessionSecret(): string {
  const env = process.env.AUTH_SESSION_SECRET
  if (typeof env === 'string' && env.trim().length >= 16) return env.trim()

  const g: any = globalThis as any
  if (!g.__creatorvault_auth_secret) g.__creatorvault_auth_secret = randomBytes(32).toString('hex')
  return String(g.__creatorvault_auth_secret)
}

export function makeSessionToken(params: { address: string; now?: number }): string {
  const now = typeof params.now === 'number' ? params.now : Date.now()
  const payload = {
    a: params.address.toLowerCase(),
    iat: now,
    exp: now + SESSION_TTL_SECONDS * 1000,
  }
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const sigB64 = base64UrlEncode(hmacSha256(getSessionSecret(), payloadB64))
  return `${payloadB64}.${sigB64}`
}

export function readSessionToken(token: string | null | undefined): { address: string } | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts
  if (!payloadB64 || !sigB64) return null

  const expected = base64UrlEncode(hmacSha256(getSessionSecret(), payloadB64))
  try {
    const a = Buffer.from(sigB64, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    // timingSafeEqual requires equal length
    if (a.length !== b.length) return null
    if (!timingSafeEqual(a, b)) return null
  } catch {
    return null
  }

  const payloadRaw = base64UrlDecodeToString(payloadB64)
  if (!payloadRaw) return null
  let parsed: any
  try {
    parsed = JSON.parse(payloadRaw)
  } catch {
    return null
  }

  const address = typeof parsed?.a === 'string' ? parsed.a : ''
  const exp = typeof parsed?.exp === 'number' ? parsed.exp : 0
  if (!address || !isAddressLike(address)) return null
  if (!exp || exp < Date.now()) return null
  return { address: address.toLowerCase() }
}

type NonceTokenPayload = {
  n: string
  iat: number
  exp: number
}

/**
 * A signed nonce token used when cookies are blocked (embedded contexts).
 * This mirrors the cookie nonce but is passed back explicitly by the client.
 */
export function makeNonceToken(params: { nonce: string; now?: number }): string {
  const now = typeof params.now === 'number' ? params.now : Date.now()
  const payload: NonceTokenPayload = {
    n: params.nonce,
    iat: now,
    exp: now + NONCE_TTL_SECONDS * 1000,
  }
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const sigB64 = base64UrlEncode(hmacSha256(getSessionSecret(), payloadB64))
  return `${payloadB64}.${sigB64}`
}

export function readNonceToken(token: string | null | undefined): { nonce: string } | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts
  if (!payloadB64 || !sigB64) return null

  const expected = base64UrlEncode(hmacSha256(getSessionSecret(), payloadB64))
  try {
    const a = Buffer.from(sigB64, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length !== b.length) return null
    if (!timingSafeEqual(a, b)) return null
  } catch {
    return null
  }

  const payloadRaw = base64UrlDecodeToString(payloadB64)
  if (!payloadRaw) return null
  let parsed: any
  try {
    parsed = JSON.parse(payloadRaw)
  } catch {
    return null
  }

  const nonce = typeof parsed?.n === 'string' ? parsed.n : ''
  const exp = typeof parsed?.exp === 'number' ? parsed.exp : 0
  if (!nonce) return null
  if (!exp || exp < Date.now()) return null
  return { nonce }
}

export type ParsedSiwe = {
  domain: string
  address: string
  uri: string
  chainId: number
  nonce: string
  issuedAt: string
}

export function parseSiweMessage(message: string): ParsedSiwe | null {
  if (typeof message !== 'string' || message.trim().length === 0) return null
  const lines = message.split('\n')
  const first = lines[0]?.trim() ?? ''
  const marker = ' wants you to sign in with your Ethereum account:'
  const idx = first.indexOf(marker)
  if (idx <= 0) return null

  const domain = first.slice(0, idx).trim()
  const address = (lines[1]?.trim() ?? '').trim()
  if (!domain || !isAddressLike(address)) return null

  const findField = (prefix: string): string | null => {
    const line = lines.find((l) => l.trim().toLowerCase().startsWith(prefix.toLowerCase()))
    if (!line) return null
    const raw = line.slice(prefix.length).trim()
    return raw.length > 0 ? raw : null
  }

  const uri = findField('URI:')
  const chainIdRaw = findField('Chain ID:')
  const nonce = findField('Nonce:')
  const issuedAt = findField('Issued At:')

  const chainId = chainIdRaw ? Number(chainIdRaw) : NaN
  if (!uri || !Number.isFinite(chainId) || !nonce || !issuedAt) return null

  return { domain, address, uri, chainId: Math.floor(chainId), nonce, issuedAt }
}

export function hostMatchesDomain(host: string, domain: string): boolean {
  const h = String(host || '').toLowerCase()
  const d = String(domain || '').toLowerCase()
  if (!h || !d) return false
  const hn = h.split(':')[0]
  const dn = d.split(':')[0]
  return hn === dn
}

export async function verifySiweSignature(params: { message: string; signature: string }): Promise<{ address: string } | null> {
  const parsed = parseSiweMessage(params.message)
  if (!parsed) return null
  const addr = parsed.address.toLowerCase()
  const sig = params.signature
  if (!sig.startsWith('0x')) return null
  try {
    const { verifyMessage } = await import('viem')
    const ok = await verifyMessage({
      address: addr as `0x${string}`,
      message: params.message,
      signature: sig as `0x${string}`,
    })
    if (ok) return { address: addr }
  } catch {
    // fall through to EIP-1271 attempt
  }

  // If this is a smart wallet, the signature is usually EIP-1271 (contract validation).
  // Try verifying onchain on Base.
  try {
    const ok1271 = await verifyEip1271({
      contract: addr as `0x${string}`,
      message: params.message,
      signature: sig as `0x${string}`,
    })
    return ok1271 ? { address: addr } : null
  } catch {
    return null
  }
}


