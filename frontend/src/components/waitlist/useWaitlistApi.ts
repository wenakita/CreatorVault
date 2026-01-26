import { useCallback, useRef } from 'react'
import { apiAliasPath } from '@/lib/apiBase'

type ApiFetchInit = RequestInit & { withCredentials?: boolean }

type ApiRouteCache = { base: string; useAlias: boolean } | null

export function useWaitlistApi(appUrl: string) {
  const apiRouteCacheRef = useRef<ApiRouteCache>(null)

  const apiFetch = useCallback(
    async (path: string, init: ApiFetchInit = {}) => {
      const bases: string[] = []
      if (typeof window !== 'undefined') bases.push(window.location.origin)
      bases.push(appUrl)

      const withCreds = Boolean(init.withCredentials)
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

      const tryOnce = async (base: string, useAlias: boolean) => {
        const b = base.replace(/\/+$/, '')
        const p = path.startsWith('/api/') && useAlias ? apiAliasPath(path) : path
        const url = `${b}${p}`
        const res = await fetch(url, baseInit)
        const ct = (res.headers.get('content-type') ?? '').toLowerCase()
        // In dev, a missing alias may return index.html; treat that as a miss and continue.
        if (ct.includes('text/html')) return null
        if (res.status === 404) return null
        if (useAlias && res.status === 405) return null
        return res
      }

      const cached = apiRouteCacheRef.current
      if (cached) {
        const res = await tryOnce(cached.base, cached.useAlias)
        if (res) return res
        apiRouteCacheRef.current = null
      }

      let lastErr: unknown = null
      const aliasModes = path.startsWith('/api/') ? [true, false] : [false]
      for (const base of bases) {
        for (const useAlias of aliasModes) {
          try {
            const res = await tryOnce(base, useAlias)
            if (res) {
              apiRouteCacheRef.current = { base, useAlias }
              return res
            }
          } catch (e: unknown) {
            lastErr = e
          }
        }
      }
      throw lastErr ?? new Error('Request failed')
    },
    [appUrl],
  )

  return { apiFetch }
}
