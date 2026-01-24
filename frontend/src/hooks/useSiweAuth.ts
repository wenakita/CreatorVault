import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { base } from 'wagmi/chains'
import { apiFetch } from '@/lib/apiBase'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type MeResponse = { address: string } | null

const SESSION_TOKEN_KEY = 'cv_siwe_session_token'

function coerceErrorMessage(e: unknown, fallback: string): string {
  if (typeof e === 'string' && e.trim().length > 0) return e
  if (e instanceof Error && typeof e.message === 'string' && e.message.trim().length > 0) return e.message
  const maybeObj = e as any
  const shortMessage = typeof maybeObj?.shortMessage === 'string' ? maybeObj.shortMessage.trim() : ''
  if (shortMessage) return shortMessage
  const message = typeof maybeObj?.message === 'string' ? maybeObj.message.trim() : ''
  if (message) return message
  try {
    const s = JSON.stringify(e)
    if (typeof s === 'string' && s.length > 0 && s !== '{}' && s !== 'null') return s
  } catch {
    // ignore
  }
  return fallback
}

function getStoredSessionToken(): string | null {
  try {
    const v = sessionStorage.getItem(SESSION_TOKEN_KEY)
    const t = typeof v === 'string' ? v.trim() : ''
    return t.length > 0 ? t : null
  } catch {
    return null
  }
}

function setStoredSessionToken(token: string | null) {
  try {
    if (!token) {
      sessionStorage.removeItem(SESSION_TOKEN_KEY)
      return
    }
    sessionStorage.setItem(SESSION_TOKEN_KEY, token)
  } catch {
    // ignore
  }
}

export function useSiweAuth() {
  // IMPORTANT:
  // This hook implements an app-local SIWE session ("Sign in with Ethereum") used for:
  // - creator access requests (/api/creator-access/*)
  // - admin gating (/api/admin/*)
  //
  // It is NOT a Farcaster identity signal. Do not treat `isSignedIn` as equivalent to a verified Farcaster FID.
  // Farcaster identity verification lives in `useFarcasterAuth()` (/api/farcaster/*).
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const [authAddress, setAuthAddress] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSignedIn = useMemo(() => {
    if (!address || !authAddress) return false
    return address.toLowerCase() === authAddress.toLowerCase()
  }, [address, authAddress])

  const refresh = useCallback(async () => {
    if (!isConnected) {
      setAuthAddress(null)
      return
    }
    try {
      const token = getStoredSessionToken()
      const res = await apiFetch('/api/auth/me', {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : null),
        },
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<MeResponse> | null
      const a = json?.data && typeof (json.data as any)?.address === 'string' ? String((json.data as any).address) : null
      setAuthAddress(a)
    } catch {
      setAuthAddress(null)
    }
  }, [isConnected])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(async (): Promise<string | null> => {
    if (!address) return null
    setBusy(true)
    setError(null)
    try {
      const nonceRes = await apiFetch('/api/auth/nonce', { headers: { Accept: 'application/json' } })
      if (!nonceRes.ok) {
        const errJson = (await nonceRes.json().catch(() => null)) as ApiEnvelope<unknown> | null
        const apiErr = coerceErrorMessage((errJson as any)?.error, '')
        throw new Error(apiErr || `Failed to start sign-in (HTTP ${nonceRes.status})`)
      }
      const nonceJson = (await nonceRes.json().catch(() => null)) as
        | ApiEnvelope<{ nonce: string; nonceToken: string; issuedAt: string; domain: string; uri: string; chainId: number }>
        | null

      const nonce = typeof nonceJson?.data?.nonce === 'string' ? nonceJson.data.nonce : ''
      const nonceToken = typeof nonceJson?.data?.nonceToken === 'string' ? nonceJson.data.nonceToken : ''
      const issuedAt = typeof nonceJson?.data?.issuedAt === 'string' ? nonceJson.data.issuedAt : new Date().toISOString()
      const domain = typeof nonceJson?.data?.domain === 'string' ? nonceJson.data.domain : window.location.host
      const uri = typeof nonceJson?.data?.uri === 'string' ? nonceJson.data.uri : window.location.origin
      const chainId = typeof nonceJson?.data?.chainId === 'number' ? nonceJson.data.chainId : base.id

      if (!nonce) throw new Error('Failed to start sign-in (missing nonce)')
      if (!nonceToken) throw new Error('Failed to start sign-in (missing nonce token)')

      const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to Creator Vaults.\n\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`
      const signature = await signMessageAsync({ message })

      const verifyRes = await apiFetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message, signature, nonceToken }),
      })
      const verifyJson = (await verifyRes.json().catch(() => null)) as ApiEnvelope<{ address: string; sessionToken: string }> | null
      if (!verifyRes.ok || !verifyJson?.success) {
        const apiErr = coerceErrorMessage((verifyJson as any)?.error, '')
        throw new Error(apiErr || 'Sign-in failed')
      }

      const signed = verifyJson?.data?.address
      const sessionToken = verifyJson?.data?.sessionToken
      if (typeof sessionToken === 'string' && sessionToken.trim().length > 0) {
        setStoredSessionToken(sessionToken.trim())
      }
      const resolved = typeof signed === 'string' ? signed : null
      setAuthAddress(resolved)
      return resolved
    } catch (e: unknown) {
      setError(coerceErrorMessage(e, 'Sign-in failed'))
      return null
    } finally {
      setBusy(false)
    }
  }, [address, signMessageAsync])

  const signOut = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', headers: { Accept: 'application/json' } })
      setStoredSessionToken(null)
      setAuthAddress(null)
    } finally {
      setBusy(false)
    }
  }, [])

  return { authAddress, isSignedIn, busy, error, signIn, signOut, refresh }
}

