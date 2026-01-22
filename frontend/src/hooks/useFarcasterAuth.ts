import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMiniAppContext } from './useMiniAppContext'
import { apiAliasPath, apiFetch } from '@/lib/apiBase'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

export type FarcasterVerifiedSession = {
  fid: number
  tokenExp?: number
  primaryAddress?: string | null
}

type Status = 'idle' | 'loading' | 'verified' | 'unauthenticated' | 'error'

export function useFarcasterAuth() {
  const mini = useMiniAppContext()

  const [status, setStatus] = useState<Status>('idle')
  const [session, setSession] = useState<FarcasterVerifiedSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [capabilities, setCapabilities] = useState<string[] | null>(null)

  const fid = useMemo(() => (typeof session?.fid === 'number' ? session.fid : null), [session?.fid])

  const canQuickAuth = useMemo(() => {
    if (!capabilities) return null
    return capabilities.some((c) => String(c).toLowerCase().startsWith('quickauth.'))
  }, [capabilities])

  const canSiwf = useMemo(() => {
    if (!capabilities) return null
    return capabilities.includes('actions.signIn')
  }, [capabilities])

  const refresh = useCallback(async () => {
    if (mini.isMiniApp !== true) {
      setSession(null)
      setStatus(mini.isMiniApp === false ? 'idle' : 'idle')
      setError(null)
      return
    }

    setStatus('loading')
    setError(null)
    try {
      const { sdk } = await import('@farcaster/miniapp-sdk')

      const caps = await sdk.getCapabilities().catch(() => null)
      if (Array.isArray(caps)) setCapabilities(caps.map(String))
      else if (caps && typeof (caps as any)[Symbol.iterator] === 'function') setCapabilities(Array.from(caps as any).map(String))
      else setCapabilities(null)

      // Prefer Quick Auth (no user prompt).
      if (sdk.quickAuth?.fetch) {
        const res = await sdk.quickAuth.fetch(apiAliasPath('/api/farcaster/me'))
        const json = (await res.json().catch(() => null)) as ApiEnvelope<FarcasterVerifiedSession> | null
        if (res.ok && json?.success && typeof json?.data?.fid === 'number' && json.data.fid > 0) {
          setSession(json.data)
          setStatus('verified')
          return
        }
      }

      setSession(null)
      setStatus('unauthenticated')
    } catch (e: unknown) {
      setSession(null)
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Failed to authenticate')
    }
  }, [mini.isMiniApp])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(async () => {
    if (mini.isMiniApp !== true) return null
    setStatus('loading')
    setError(null)
    try {
      const { sdk } = await import('@farcaster/miniapp-sdk')

      const caps = capabilities ?? (await sdk.getCapabilities().catch(() => null))
      if (caps && !capabilities) {
        if (Array.isArray(caps)) setCapabilities(caps.map(String))
        else if (typeof (caps as any)[Symbol.iterator] === 'function') setCapabilities(Array.from(caps as any).map(String))
      }

      if (!sdk.actions?.signIn) {
        setStatus('unauthenticated')
        setError('Sign-in is not supported in this host')
        return null
      }

      // One-time nonce is stored server-side (HttpOnly cookie) and cleared after verify.
      const nonceRes = await apiFetch('/api/farcaster/nonce', { headers: { Accept: 'application/json' }, withCredentials: true })
      const nonceJson = (await nonceRes.json().catch(() => null)) as ApiEnvelope<{ nonce: string }> | null
      const nonce = typeof nonceJson?.data?.nonce === 'string' ? nonceJson.data.nonce : ''
      if (!nonceRes.ok || !nonceJson?.success || !nonce) {
        throw new Error(nonceJson?.error || 'Failed to start sign-in')
      }

      const { message, signature } = await sdk.actions.signIn({ nonce, acceptAuthAddress: true })

      const verifyRes = await apiFetch('/api/farcaster/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message, signature }),
        withCredentials: true,
      })
      const verifyJson = (await verifyRes.json().catch(() => null)) as ApiEnvelope<{ fid: number }> | null
      const outFid = verifyJson?.data?.fid
      if (!verifyRes.ok || !verifyJson?.success || typeof outFid !== 'number' || outFid <= 0) {
        throw new Error(verifyJson?.error || 'Sign-in failed')
      }

      // Re-run Quick Auth fetch (some hosts will now allow it) to fill tokenExp/primaryAddress.
      try {
        if (sdk.quickAuth?.fetch) {
          const res = await sdk.quickAuth.fetch(apiAliasPath('/api/farcaster/me'))
          const json = (await res.json().catch(() => null)) as ApiEnvelope<FarcasterVerifiedSession> | null
          if (res.ok && json?.success && typeof json?.data?.fid === 'number') {
            setSession(json.data)
            setStatus('verified')
            return json.data
          }
        }
      } catch {
        // ignore
      }

      setSession({ fid: outFid })
      setStatus('verified')
      return { fid: outFid }
    } catch (e: unknown) {
      setSession(null)
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Sign-in failed')
      return null
    }
  }, [capabilities, mini.isMiniApp])

  return { status, fid, session, error, refresh, signIn, canQuickAuth, canSiwf }
}

