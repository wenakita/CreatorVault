import type { VercelRequest, VercelResponse } from '@vercel/node'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>

function getApiSubpath(req: VercelRequest): string {
  const rawUrl = typeof req.url === 'string' ? req.url : ''
  const pathname = (rawUrl.split('?')[0] ?? '').trim()
  if (!pathname) return ''
  if (pathname === '/api') return ''
  if (pathname === '/api/') return ''
  if (!pathname.startsWith('/api/')) return ''
  return pathname.slice('/api/'.length)
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

async function loadHandler(subpath: string): Promise<ApiHandler | null> {
  const modPath = `../api_handlers/${subpath}.js`
  try {
    const mod = (await import(modPath)) as { default?: unknown }
    return typeof mod?.default === 'function' ? (mod.default as ApiHandler) : null
  } catch (e: any) {
    // Node's ESM loader uses different error codes across versions; treat all module-not-found as 404.
    const code = typeof e?.code === 'string' ? e.code : ''
    const msg = e?.message ? String(e.message) : ''
    const isNotFound = code === 'ERR_MODULE_NOT_FOUND' || msg.includes('Cannot find module')
    if (isNotFound) return null
    throw e
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const subpath = getApiSubpath(req)
  if (!isSafeSubpath(subpath)) {
    return res.status(404).json({ success: false, error: 'Not found' })
  }

  const h = await loadHandler(subpath)
  if (!h) {
    return res.status(404).json({ success: false, error: 'Not found' })
  }

  return await h(req, res)
}

