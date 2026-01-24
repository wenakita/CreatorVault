import type { VercelRequest, VercelResponse } from '@vercel/node'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>

function getApiSubpath(req: VercelRequest): string {
  // Prefer Vercel's catch-all param mapping.
  // For `api/[...path].ts`, Vercel populates `req.query.path`.
  const qp = (req as any)?.query?.path as unknown
  if (typeof qp === 'string' && qp.trim()) return qp.trim()
  if (Array.isArray(qp) && qp.length > 0) {
    return qp
      .map((s) => (typeof s === 'string' ? s : String(s)))
      .filter(Boolean)
      .join('/')
  }

  const rawUrl = typeof req.url === 'string' ? req.url : ''
  const pathname = (rawUrl.split('?')[0] ?? '').trim()
  if (!pathname) return ''
  if (pathname === '/api' || pathname === '/api/') return ''
  if (pathname.startsWith('/api/')) return pathname.slice('/api/'.length)
  if (pathname.startsWith('/')) return pathname.slice(1)
  return pathname
}

function isSafeSubpath(p: string): boolean {
  // We only allow expected filesystem-style paths:
  // - a-z A-Z 0-9 _ - /
  // - no backslashes, dots, percent-escapes, or traversal
  if (!p) return false
  if (p.includes('\\')) return false
  if (p.includes('..')) return false
  if (p.includes('%')) return false
  if (p.includes('\0')) return false
  return /^[a-zA-Z0-9/_-]+$/.test(p)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const subpath = getApiSubpath(req)
    if (!isSafeSubpath(subpath)) {
      return res.status(404).json({ success: false, error: 'Not found' })
    }

    const { getApiHandler } = await import('./_handlers/_routes.js')
    const h = (await getApiHandler(subpath)) as ApiHandler | null
    if (!h) {
      return res.status(404).json({ success: false, error: 'Not found' })
    }

    return await h(req, res)
  } catch (e: unknown) {
    // Prevent Vercel from treating thrown exceptions as a hard crash.
    // Surface a minimal, actionable message for debugging.
    const message = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack : null
    try {
      if (!res.headersSent) res.setHeader('Cache-Control', 'no-store')
    } catch {
      // ignore
    }
    return res.status(500).json({
      success: false,
      error: message || 'Unhandled API error',
      ...(stack ? { stack } : null),
    })
  }
}

