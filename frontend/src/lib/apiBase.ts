// Centralized API URL helper.
//
// Some privacy/adblock extensions block requests to `/api/*` by pattern.
// We expose a stable alias `/__api/*` and prefer it, with a fallback to `/api/*`
// for local dev or older deployments.

export type ApiFetchInit = RequestInit & { withCredentials?: boolean }

export function apiAliasPath(path: string): string {
  if (typeof path !== 'string') return path as any
  if (!path.startsWith('/api/')) return path
  return `/__api/${path.slice('/api/'.length)}`
}

function joinBase(base: string, path: string): string {
  const b = String(base || '').replace(/\/+$/, '')
  if (!b) return path
  return `${b}${path}`
}

function isProbablyHtml(res: Response): boolean {
  const ct = (res.headers.get('content-type') ?? '').toLowerCase()
  return ct.includes('text/html')
}

/**
 * Fetch an API route with a best-effort alias fallback:
 * - try `/__api/*` first (to avoid extension blocks on `/api/*`)
 * - then fall back to `/api/*`
 *
 * If `bases` is provided, the function will try each base origin in order.
 */
export async function apiFetch(path: string, init: ApiFetchInit = {}, bases?: string[]): Promise<Response> {
  const withCreds = Boolean(init.withCredentials)
  // Best-effort: attach our SIWE session token when present.
  // This allows authenticated routes to work even when cookies are unavailable.
  const headers = new Headers(init.headers ?? undefined)
  if (typeof window !== 'undefined' && path.startsWith('/api/') && !headers.has('Authorization')) {
    try {
      const token = sessionStorage.getItem('cv_siwe_session_token')
      if (token && token.trim()) headers.set('Authorization', `Bearer ${token.trim()}`)
    } catch {
      // ignore
    }
  }

  const baseInit: RequestInit = {
    ...init,
    headers,
    ...(withCreds ? { credentials: 'include' as const } : null),
  }
  delete (baseInit as any).withCredentials

  const tryPaths = path.startsWith('/api/') ? [apiAliasPath(path), path] : [path]
  const baseList = Array.isArray(bases) && bases.length > 0 ? bases : ['']
  const alias = path.startsWith('/api/') ? apiAliasPath(path) : null

  let lastErr: unknown = null
  for (const base of baseList) {
    for (const p of tryPaths) {
      const url = joinBase(base, p)
      try {
        const res = await fetch(url, baseInit)
        // In dev, Vite may serve index.html for unknown paths; treat that as a miss.
        if (isProbablyHtml(res)) continue
        // If the alias route isn't present yet, Vercel returns 404; fall back to next path/base.
        if (res.status === 404) continue
        // Some deployments serve `/__api/*` as static content, which returns 405 on POST.
        // Treat that as a miss so we fall back to the real `/api/*` handlers.
        if (alias && p === alias && res.status === 405) continue
        return res
      } catch (e: unknown) {
        lastErr = e
        continue
      }
    }
  }
  throw lastErr ?? new Error('Request failed')
}
