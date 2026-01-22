import { AnimatePresence, motion } from 'framer-motion'
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getAppBaseUrl } from '@/lib/host'
import { SignInButton, useProfile, useSignInMessage } from '@farcaster/auth-kit'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { ConnectButtonWeb3 } from '@/components/ConnectButtonWeb3'
import { isPrivyClientEnabled } from '@/lib/flags'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { Check, CheckCircle2, ChevronDown } from 'lucide-react'
import { useMiniAppContext } from '@/hooks'
import { apiAliasPath } from '@/lib/apiBase'
import { fetchZoraCoin, fetchZoraProfile } from '@/lib/zora/client'
import { REFERRAL_BADGES, REFERRAL_TWEET_TEMPLATES, fillTweetTemplate, INVITE_COPY } from '@/components/waitlist/referralsCopy'

type Persona = 'creator' | 'user'
type Variant = 'page' | 'embedded'
type ActionKey = 'shareX' | 'copyLink' | 'share' | 'follow' | 'saveApp'

const ACTION_POINTS: Record<ActionKey, number> = {
  shareX: 10,
  copyLink: 5,
  share: 7,
  follow: 4,
  saveApp: 6,
}

const EMPTY_ACTION_STATE: Record<ActionKey, boolean> = {
  shareX: false,
  copyLink: false,
  share: false,
  follow: false,
  saveApp: false,
}

export function WaitlistFlow(props: { variant?: Variant; sectionId?: string }) {
  const variant: Variant = props.variant ?? 'page'
  const sectionId = props.sectionId ?? 'waitlist'

  const location = useLocation()
  const [persona, setPersona] = useState<Persona | null>(null)
  const [step, setStep] = useState<'persona' | 'verify' | 'email' | 'done'>('persona')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneEmail, setDoneEmail] = useState<string | null>(null)
  const [verifiedFid, setVerifiedFid] = useState<number | null>(null)
  const [verifiedWallet, setVerifiedWallet] = useState<string | null>(null)
  const [siwfNonce, setSiwfNonce] = useState<string | null>(null)
  const [siwfNonceToken, setSiwfNonceToken] = useState<string | null>(null)
  const [siwfBusy, setSiwfBusy] = useState(false)
  const [siwfError, setSiwfError] = useState<string | null>(null)
  const [useWalletSig, setUseWalletSig] = useState(false)
  const [walletSigStarted, setWalletSigStarted] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareToast, setShareToast] = useState<string | null>(null)
  const [userWallet, setUserWallet] = useState('')
  const [showUserWallet, setShowUserWallet] = useState(false)
  const [creatorCoin, setCreatorCoin] = useState<{ address: string; symbol: string | null; coinType: string | null } | null>(null)
  const [creatorCoinBusy, setCreatorCoinBusy] = useState(false)
  const [creatorCoinError, setCreatorCoinError] = useState<string | null>(null)
  const creatorCoinForWalletRef = useRef<string | null>(null)
  const [referralCodeTaken, setReferralCodeTaken] = useState(false)
  const [claimReferralCode, setClaimReferralCode] = useState('')
  const [inviteToast, setInviteToast] = useState<string | null>(null)
  const [inviteTemplateIdx, setInviteTemplateIdx] = useState(0)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [weeklyConversions, setWeeklyConversions] = useState<number | null>(null)
  const [allTimeConversions, setAllTimeConversions] = useState<number | null>(null)
  const [weeklyRank, setWeeklyRank] = useState<number | null>(null)
  const [allTimeRank, setAllTimeRank] = useState<number | null>(null)
  const [referralFetchBusy, setReferralFetchBusy] = useState(false)

  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const referralSessionIdRef = useRef<string | null>(null)

  const appUrl = useMemo(() => getAppBaseUrl(), [])
  const siwe = useSiweAuth()
  const miniApp = useMiniAppContext()
  const { message: siwfMessage, signature: siwfSignature } = useSignInMessage()
  const { isAuthenticated: isFarcasterAuthed, profile } = useProfile()

  const privyStatus = usePrivyClientStatus()
  const showPrivy = isPrivyClientEnabled()
  const PrivySocialConnect = useMemo(
    () =>
      lazy(async () => {
        const m = await import('@/components/waitlist/PrivySocialConnect')
        return { default: m.PrivySocialConnect }
      }),
    [],
  )

  function normalizeEmail(v: string): string {
    return v.trim().toLowerCase()
  }
  function isValidEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  }
  function normalizeAddress(v: string): string {
    return v.trim()
  }
  function isValidEvmAddress(v: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(v)
  }

  const emailTrimmed = useMemo(() => normalizeEmail(email), [email])
  const userWalletTrimmed = useMemo(() => normalizeAddress(userWallet), [userWallet])
  const userWalletOk = useMemo(
    () => userWalletTrimmed.length === 0 || isValidEvmAddress(userWalletTrimmed),
    [userWalletTrimmed],
  )

  const forcedPersona = useMemo(() => {
    const q = new URLSearchParams(location.search)
    const raw = (q.get('persona') ?? '').trim().toLowerCase()
    return raw === 'creator' ? ('creator' as const) : raw === 'user' ? ('user' as const) : null
  }, [location.search])

  const refParam = useMemo(() => {
    const q = new URLSearchParams(location.search)
    const raw = (q.get('ref') ?? '').trim()
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
    return cleaned.length > 0 ? cleaned : null
  }, [location.search])

  function getOrCreateReferralSessionId(): string {
    if (referralSessionIdRef.current) return referralSessionIdRef.current
    try {
      const k = 'cv_ref_session'
      const existing = localStorage.getItem(k)
      if (existing && existing.trim()) {
        referralSessionIdRef.current = existing.trim()
        return referralSessionIdRef.current
      }
      const v = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)
      localStorage.setItem(k, v)
      referralSessionIdRef.current = v
      return v
    } catch {
      const v = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)
      referralSessionIdRef.current = v
      return v
    }
  }

  function getStoredReferralCode(): string | null {
    try {
      const v = localStorage.getItem('cv_ref_code')
      const t = typeof v === 'string' ? v.trim().toUpperCase() : ''
      return t ? t : null
    } catch {
      return null
    }
  }

  function storeReferralCode(code: string | null) {
    try {
      if (!code) {
        localStorage.removeItem('cv_ref_code')
        return
      }
      localStorage.setItem('cv_ref_code', code)
    } catch {
      // ignore
    }
  }

  // If user arrives with ?ref=CODE, store it and record a click.
  useEffect(() => {
    if (!refParam) return
    storeReferralCode(refParam)
    void (async () => {
      try {
        await apiFetch('/api/referrals/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            referralCode: refParam,
            sessionId: getOrCreateReferralSessionId(),
            landingUrl: typeof window !== 'undefined' ? window.location.href : null,
          }),
        })
      } catch {
        // ignore
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refParam])

  // Keep persona preselection lightweight: on first load, if persona is set via query params,
  // jump straight into the right step.
  useEffect(() => {
    if (!forcedPersona) return
    // If user already progressed, don't override their choice mid-flow.
    if (step !== 'persona') return
    setPersona(forcedPersona)
    if (forcedPersona === 'creator') {
      setUseWalletSig(false)
      setSiwfError(null)
      setStep('verify')
    } else {
      setStep('email')
    }
  }, [forcedPersona, step])

  const totalSteps = useMemo(() => {
    // persona + (verify for creators) + email + done
    return persona === 'creator' ? 4 : 3
  }, [persona])

  const stepIndex = useMemo(() => {
    if (step === 'persona') return 1
    if (step === 'verify') return 2
    if (step === 'email') return persona === 'creator' ? 3 : 2
    return totalSteps
  }, [persona, step, totalSteps])

  const progressPct = useMemo(() => {
    if (!totalSteps) return 0
    return Math.max(0, Math.min(100, Math.round((stepIndex / totalSteps) * 100)))
  }, [stepIndex, totalSteps])

  useEffect(() => {
    if (step === 'email') {
      requestAnimationFrame(() => emailInputRef.current?.focus())
    }
  }, [step])

  async function apiFetch(path: string, init: RequestInit & { withCredentials?: boolean } = {}) {
    const bases: string[] = []
    if (typeof window !== 'undefined') bases.push(window.location.origin)
    bases.push(appUrl)

    const withCreds = Boolean(init.withCredentials)
    const headers = init.headers ?? {}
    const baseInit: RequestInit = {
      ...init,
      headers,
      ...(withCreds ? { credentials: 'include' as const } : null),
    }
    delete (baseInit as any).withCredentials

    let lastErr: unknown = null
    for (const base of bases) {
      const b = base.replace(/\/+$/, '')
      // Prefer alias to avoid extension blocks on `/api/*`, then fall back to the canonical path.
      const paths = path.startsWith('/api/') ? [apiAliasPath(path), path] : [path]
      for (const p of paths) {
        const url = `${b}${p}`
        try {
          const res = await fetch(url, baseInit)
          const ct = (res.headers.get('content-type') ?? '').toLowerCase()
          // In dev, a missing alias may return index.html; treat that as a miss and continue.
          if (ct.includes('text/html')) continue
          if (res.status === 404) continue
          return res
        } catch (e: unknown) {
          lastErr = e
          continue
        }
      }
    }
    throw lastErr ?? new Error('Request failed')
  }

  function primaryWalletForSubmit(): string | null {
    // Creators: verified wallet only (from SIWF profile or SIWE).
    if (persona === 'creator') {
      const pw = typeof verifiedWallet === 'string' && isValidEvmAddress(verifiedWallet) ? verifiedWallet : null
      return pw
    }
    // Users: optional wallet input (hidden by default). Only send if valid.
    const pw = userWalletTrimmed.length > 0 && isValidEvmAddress(userWalletTrimmed) ? userWalletTrimmed : null
    return pw
  }

  async function submitWaitlist(params: { email: string }) {
    setError(null)
    setReferralCodeTaken(false)
    setBusy(true)
    try {
      // Creators must verify before email submission.
      if (persona === 'creator' && !verifiedFid && !verifiedWallet) {
        throw new Error('Verify your identity first.')
      }
      if (persona !== 'creator' && persona !== 'user') {
        throw new Error('Select Creator or User first.')
      }
      if (persona === 'user' && showUserWallet && !userWalletOk) {
        throw new Error('Wallet address must be a valid 0x… address (or leave it blank).')
      }

      const storedRef = getStoredReferralCode()
      const claim =
        persona === 'creator'
          ? String(claimReferralCode || '')
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, '')
              .slice(0, 16)
          : ''

      const res = await apiFetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email,
          primaryWallet: primaryWalletForSubmit(),
          referralCode: storedRef,
          claimReferralCode: claim.length > 0 ? claim : null,
          intent: {
            persona,
            fid: verifiedFid,
            hasCreatorCoin: creatorCoinBusy ? null : Boolean(creatorCoin?.address),
          },
        }),
      })
      const text = await res.text().catch(() => '')
      let json: any = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = null
      }
      if (res.status === 409 && json && json.code === 'REFERRAL_CODE_TAKEN') {
        setReferralCodeTaken(true)
        setClaimReferralCode(String(json?.suggested ?? claim ?? ''))
        throw new Error('That referral code is taken. Pick another and resubmit.')
      }
      if (!res.ok || !json || json.success !== true) {
        const msg =
          json && typeof json.error === 'string'
            ? json.error
            : res.ok
              ? 'Waitlist request failed'
              : `Waitlist request failed (HTTP ${res.status})`
        throw new Error(msg)
      }
      setDoneEmail(String(json?.data?.email || params.email))
      setReferralCode(typeof json?.data?.referralCode === 'string' ? String(json.data.referralCode) : null)
      setStep('done')
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Waitlist request failed')
    } finally {
      setBusy(false)
    }
  }

  function resetFlow() {
    setStep('persona')
    setPersona(null)
    setEmail('')
    setError(null)
    setDoneEmail(null)
    setVerifiedFid(null)
    setVerifiedWallet(null)
    setSiwfNonce(null)
    setSiwfNonceToken(null)
    setSiwfBusy(false)
    setSiwfError(null)
    setUseWalletSig(false)
    setWalletSigStarted(false)
    setUserWallet('')
    setShowUserWallet(false)
    setCreatorCoin(null)
    setCreatorCoinBusy(false)
    setCreatorCoinError(null)
    creatorCoinForWalletRef.current = null
    setReferralCodeTaken(false)
    setClaimReferralCode('')
    setInviteToast(null)
    setInviteTemplateIdx(0)
    setReferralCode(null)
    setWeeklyConversions(null)
    setAllTimeConversions(null)
    setWeeklyRank(null)
    setAllTimeRank(null)
    setReferralFetchBusy(false)
  }

  // Fetch referral counters/ranks once we have a code to show.
  useEffect(() => {
    if (step !== 'done') return
    if (!referralCode) return
    if (referralFetchBusy) return
    setReferralFetchBusy(true)
    void (async () => {
      try {
        const res = await apiFetch(`/api/referrals/me?referralCode=${encodeURIComponent(referralCode)}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        const text = await res.text().catch(() => '')
        const json = text ? JSON.parse(text) : null
        if (!res.ok || !json || json.success !== true) return
        const data = json?.data ?? null
        if (!data) return
        setReferralCode(typeof data.referralCode === 'string' ? String(data.referralCode) : referralCode)
        setWeeklyConversions(typeof data.weeklyConversions === 'number' ? data.weeklyConversions : null)
        setAllTimeConversions(typeof data.allTimeConversions === 'number' ? data.allTimeConversions : null)
        setWeeklyRank(typeof data.weeklyRank === 'number' ? data.weeklyRank : null)
        setAllTimeRank(typeof data.allTimeRank === 'number' ? data.allTimeRank : null)
      } catch {
        // ignore
      } finally {
        setReferralFetchBusy(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referralCode, step])

  // When the creator chooses "Use wallet signature", once SIWE completes we can proceed.
  useEffect(() => {
    if (step !== 'verify') return
    if (persona !== 'creator') return
    if (!useWalletSig) return
    // Important: if the user is already signed-in from a previous session,
    // we should NOT auto-advance just because `siwe.isSignedIn` is true.
    // Only advance after the user explicitly clicks "Sign with wallet" in this flow.
    if (!walletSigStarted) return
    if (!siwe.isSignedIn || !siwe.authAddress) return
    setVerifiedWallet(siwe.authAddress)
    setStep('email')
  }, [persona, siwe.authAddress, siwe.isSignedIn, step, useWalletSig, walletSigStarted])

  // Auto-start SIWF nonce fetch so the button is the primary action.
  useEffect(() => {
    if (step !== 'verify') return
    if (persona !== 'creator') return
    if (useWalletSig) return
    if (siwfNonce) return
    if (siwfBusy) return
    void startSiwf()
  }, [persona, siwfBusy, siwfNonce, step, useWalletSig])

  // When Farcaster auth-kit has a profile, capture a best-effort wallet.
  useEffect(() => {
    if (!isFarcasterAuthed || !profile) return
    const custody = typeof (profile as any)?.custody === 'string' ? String((profile as any).custody) : null
    const verifs = Array.isArray((profile as any)?.verifications) ? ((profile as any).verifications as any[]) : []
    const first =
      verifs.find((a) => typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/.test(a)) ??
      (custody && /^0x[a-fA-F0-9]{40}$/.test(custody) ? custody : null)
    if (first && typeof first === 'string') setVerifiedWallet(first)
  }, [isFarcasterAuthed, profile])

  // Best-effort: detect the user's Zora Creator Coin (if any) from the verified wallet.
  useEffect(() => {
    const w = typeof verifiedWallet === 'string' && isValidEvmAddress(verifiedWallet) ? verifiedWallet : null
    if (!w) {
      setCreatorCoin(null)
      setCreatorCoinBusy(false)
      setCreatorCoinError(null)
      creatorCoinForWalletRef.current = null
      return
    }
    if (creatorCoinForWalletRef.current === w) return
    creatorCoinForWalletRef.current = w

    let cancelled = false
    setCreatorCoinBusy(true)
    setCreatorCoinError(null)
    ;(async () => {
      try {
        const profile = await fetchZoraProfile(w)
        const coinAddrRaw = profile?.creatorCoin?.address ? String(profile.creatorCoin.address) : ''
        const coinAddr = isValidEvmAddress(coinAddrRaw) ? coinAddrRaw : null
        if (!coinAddr) {
          if (!cancelled) setCreatorCoin(null)
          return
        }

        // Resolve metadata (symbol/type) for display. If it fails, still show the address.
        let symbol: string | null = null
        let coinType: string | null = null
        try {
          const coin = await fetchZoraCoin(coinAddr as any)
          symbol = coin?.symbol ? String(coin.symbol) : null
          coinType = coin?.coinType ? String(coin.coinType) : null
        } catch {
          // ignore
        }

        if (!cancelled) setCreatorCoin({ address: coinAddr, symbol, coinType })
      } catch (e: any) {
        if (!cancelled) {
          setCreatorCoin(null)
          setCreatorCoinError(e?.message ? String(e.message) : 'Failed to detect creator coin')
        }
      } finally {
        if (!cancelled) setCreatorCoinBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [verifiedWallet])

  async function startSiwf() {
    setSiwfError(null)
    setSiwfBusy(true)
    try {
      const res = await apiFetch('/api/farcaster/nonce', {
        headers: { Accept: 'application/json' },
      })
      const json = (await res.json().catch(() => null)) as any
      const nonce = typeof json?.data?.nonce === 'string' ? json.data.nonce : ''
      const nonceToken = typeof json?.data?.nonceToken === 'string' ? json.data.nonceToken : ''
      if (!res.ok || !json?.success || !nonce) {
        const msg =
          json?.error ||
          (res.ok ? 'Failed to start Farcaster sign-in (missing nonce)' : `Failed to start Farcaster sign-in (HTTP ${res.status})`)
        throw new Error(msg)
      }
      setSiwfNonce(nonce)
      setSiwfNonceToken(nonceToken || null)
    } catch (e: any) {
      setSiwfError(e?.message ? String(e.message) : 'Failed to start Farcaster sign-in')
    } finally {
      setSiwfBusy(false)
    }
  }

  async function verifySiwfOnServer() {
    if (!siwfMessage || !siwfSignature) {
      setSiwfError('Missing Farcaster signature')
      return
    }
    setSiwfError(null)
    setSiwfBusy(true)
    try {
      const res = await apiFetch('/api/farcaster/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message: siwfMessage, signature: siwfSignature, nonceToken: siwfNonceToken }),
      })
      const json = (await res.json().catch(() => null)) as any
      const fid = typeof json?.data?.fid === 'number' ? json.data.fid : null
      if (!res.ok || !json?.success || !fid) {
        const msg =
          json?.error || (res.ok ? 'Farcaster verification failed (missing fid)' : `Farcaster verification failed (HTTP ${res.status})`)
        throw new Error(msg)
      }
      setVerifiedFid(fid)
      setStep('email')
    } catch (e: any) {
      setSiwfError(e?.message ? String(e.message) : 'Farcaster verification failed')
    } finally {
      setSiwfBusy(false)
    }
  }

  const shareBaseUrl = useMemo(() => appUrl.replace(/\/+$/, ''), [appUrl])
  const referralLink = useMemo(() => {
    if (referralCode) {
      return `${shareBaseUrl}/?ref=${encodeURIComponent(referralCode)}#waitlist`
    }
    return `${shareBaseUrl}/#waitlist`
  }, [referralCode, shareBaseUrl])
  const shareMessage = 'Creator vaults on Base — join the waitlist.'
  const miniAppHostLabel = useMemo(() => {
    if (!miniApp.isMiniApp) return null
    return miniApp.isBaseApp ? 'Base app' : 'Farcaster'
  }, [miniApp.isBaseApp, miniApp.isMiniApp])
  const actionStorageKey = useMemo(
    () => (referralCode ? `cv_waitlist_actions_${referralCode}` : 'cv_waitlist_actions'),
    [referralCode],
  )
  const [actionsDone, setActionsDone] = useState<Record<ActionKey, boolean>>(() => ({ ...EMPTY_ACTION_STATE }))
  const markAction = useCallback(
    (action: ActionKey) => {
      setActionsDone((prev) => {
        if (prev[action]) return prev
        const next = { ...prev, [action]: true }
        try {
          localStorage.setItem(actionStorageKey, JSON.stringify(next))
        } catch {
          // ignore
        }
        return next
      })
    },
    [actionStorageKey],
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(actionStorageKey)
      if (!raw) {
        setActionsDone({ ...EMPTY_ACTION_STATE })
        return
      }
      const parsed = JSON.parse(raw) as Partial<Record<ActionKey, boolean>> | null
      setActionsDone({ ...EMPTY_ACTION_STATE, ...(parsed || {}) })
    } catch {
      setActionsDone({ ...EMPTY_ACTION_STATE })
    }
  }, [actionStorageKey])

  useEffect(() => {
    if (miniApp.added !== true) return
    markAction('saveApp')
  }, [markAction, miniApp.added])

  const [miniAppAddSupported, setMiniAppAddSupported] = useState<boolean | null>(null)
  useEffect(() => {
    if (!miniApp.isMiniApp) {
      setMiniAppAddSupported(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk')
        const ok = typeof sdk?.actions?.addMiniApp === 'function'
        if (!cancelled) setMiniAppAddSupported(ok)
      } catch {
        if (!cancelled) setMiniAppAddSupported(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [miniApp.isMiniApp])

  async function shareOrCompose() {
    if (shareBusy) return
    setShareBusy(true)
    setShareToast(null)
    const shareLink = referralLink
    try {
      if (miniApp.isMiniApp) {
        try {
          const { sdk } = await import('@farcaster/miniapp-sdk')
          if (sdk?.actions?.composeCast) {
            await sdk.actions.composeCast({
              text: shareMessage,
              embeds: [shareLink],
            } as any)
            markAction('share')
            setShareToast('Opened Farcaster composer.')
            return
          }
        } catch {
          // fall through
        }
      }

      if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
        await (navigator as any).share({
          title: 'Creator Vaults',
          text: shareMessage,
          url: shareLink,
        })
        markAction('share')
        setShareToast('Shared.')
        return
      }

      try {
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareMessage)}&embeds[]=${encodeURIComponent(
          shareLink,
        )}`
        if (miniApp.isMiniApp) {
          try {
            const { sdk } = await import('@farcaster/miniapp-sdk')
            if (sdk?.actions?.openUrl) {
              await sdk.actions.openUrl(warpcastUrl)
              markAction('share')
              setShareToast('Opened Warpcast.')
              return
            }
          } catch {
            // fall through
          }
        }
        const opened = window.open(warpcastUrl, '_blank', 'noopener,noreferrer')
        if (opened) {
          markAction('share')
          setShareToast('Opened Warpcast.')
          return
        }
      } catch {
        // fall through
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareLink)
        markAction('share')
        setShareToast('Link copied.')
        return
      }

      setShareToast(`Open: ${shareBaseUrl.replace(/^https?:\/\//, '')}`)
    } finally {
      setTimeout(() => setShareToast(null), 2500)
      setShareBusy(false)
    }
  }

  async function addMiniApp() {
    if (shareBusy) return
    setShareBusy(true)
    setShareToast(null)
    try {
      const { sdk } = await import('@farcaster/miniapp-sdk')
      if (!sdk?.actions?.addMiniApp) {
        setShareToast('Add is not supported in this host.')
        return
      }
      await sdk.actions.addMiniApp()
      markAction('saveApp')
      setShareToast('Added to your Mini Apps.')
    } catch {
      setShareToast('Add failed.')
    } finally {
      setTimeout(() => setShareToast(null), 2500)
      setShareBusy(false)
    }
  }

  const containerClass =
    variant === 'page'
      ? 'min-h-[100svh] flex items-center justify-center px-4 sm:px-6 py-10 sm:py-14'
      : 'cinematic-section'

  const innerWrapClass = variant === 'page' ? 'w-full max-w-lg' : 'max-w-3xl mx-auto px-6 py-14'

  const cardWrapClass =
    variant === 'page'
      ? 'rounded-2xl bg-black/30 backdrop-blur-sm p-4 sm:p-6 shadow-void'
      : 'rounded-2xl border border-zinc-900/70 bg-black/30 backdrop-blur-sm p-5 sm:p-6'

  const showPersonaStep = !forcedPersona

  function renderActionBadge(action: ActionKey) {
    const done = actionsDone[action]
    const points = ACTION_POINTS[action]
    return (
      <span
        className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] ${
          done ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200' : 'border-white/5 bg-black/20 text-zinc-600'
        }`}
      >
        {done ? `✓${points}` : `•${points}`}
      </span>
    )
  }

  return (
    <section id={variant === 'embedded' ? sectionId : undefined} className={containerClass}>
      <div className={innerWrapClass}>
        {variant === 'page' ? (
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600">4626.fun · Creator Vaults</div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-700">
              {stepIndex}/{totalSteps}
            </div>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            <span className="label">Waitlist</span>
            <div className="headline text-4xl sm:text-5xl leading-tight">Early access</div>
            <div className="text-sm text-zinc-600 font-light">Creators verify · users email.</div>
          </div>
        )}

        <div className={cardWrapClass}>
          <div className="mb-5 sm:mb-6">
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-brand-primary/20 via-brand-primary/50 to-brand-primary/20"
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === 'persona' ? (
              <motion.div
                key="persona"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <div className="headline text-2xl sm:text-3xl leading-tight">Select</div>
                <div className="space-y-3">
                  <button
                    type="button"
                    className="group w-full rounded-xl border border-white/10 bg-black/40 hover:bg-black/50 hover:border-brand-primary/30 p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    onClick={() => {
                      setPersona('creator')
                      setError(null)
                      setUseWalletSig(false)
                      setSiwfError(null)
                      setStep('verify')
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-zinc-100 font-medium">Creator</div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-6 h-6 rounded-full border border-brand-primary/20 bg-brand-primary/10 inline-flex items-center justify-center">
                          <Check className="w-4 h-4 text-brand-accent" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-zinc-600 font-light">Launch a vault · verify</div>
                  </button>
                  <button
                    type="button"
                    className="group w-full rounded-xl border border-white/10 bg-black/40 hover:bg-black/50 hover:border-brand-primary/30 p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    onClick={() => {
                      setPersona('user')
                      setError(null)
                      setStep('email')
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-zinc-100 font-medium">User</div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-6 h-6 rounded-full border border-brand-primary/20 bg-brand-primary/10 inline-flex items-center justify-center">
                          <Check className="w-4 h-4 text-brand-accent" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-zinc-600 font-light">Join early · email</div>
                  </button>
                </div>
              </motion.div>
            ) : null}

            {step === 'verify' ? (
              <motion.div
                key="verify"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <div className="headline text-2xl sm:text-3xl leading-tight">Verify</div>
                <div className="text-sm text-zinc-600 font-light">Verify to continue.</div>

                {/* Primary: SIWF via Farcaster Auth Kit */}
                {!useWalletSig ? (
                  <div className="space-y-3">
                    <div className="w-full flex justify-center">
                      {siwfNonce ? (
                        <SignInButton
                          nonce={siwfNonce}
                          onSuccess={() => void verifySiwfOnServer()}
                          onError={(e: any) => setSiwfError(e?.message ? String(e.message) : 'Farcaster sign-in failed')}
                        />
                      ) : (
                        <button className="btn-accent opacity-60 cursor-not-allowed" disabled>
                          Loading…
                        </button>
                      )}
                    </div>

                    {siwfError ? <div className="text-xs text-red-400 text-center">{siwfError}</div> : null}

                    <button
                      type="button"
                      className="w-full text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                      onClick={() => {
                        setUseWalletSig(true)
                        setWalletSigStarted(false)
                        // Prevent any prior session state from immediately skipping the step.
                        setVerifiedWallet(null)
                      }}
                    >
                      Use wallet instead
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <ConnectButtonWeb3 />
                    <button
                      type="button"
                      className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={siwe.busy}
                      onClick={() => {
                        setWalletSigStarted(true)
                        void siwe.signIn()
                      }}
                    >
                      {siwe.busy ? 'Signing…' : 'Sign with wallet'}
                    </button>
                    {siwe.error ? <div className="text-xs text-red-400">{siwe.error}</div> : null}
                    {creatorCoinBusy ? (
                      <div className="text-[11px] text-zinc-600">Detecting Creator Coin…</div>
                    ) : creatorCoin ? (
                      <div className="text-[11px] text-zinc-600">
                        Creator Coin:{' '}
                        <a
                          className="font-mono text-zinc-300 hover:text-zinc-100 transition-colors"
                          href={`${appUrl.replace(/\/+$/, '')}/deploy?token=${encodeURIComponent(creatorCoin.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          title={creatorCoin.symbol ? `${creatorCoin.symbol} · ${creatorCoin.address}` : creatorCoin.address}
                        >
                          {creatorCoin.symbol ? `${creatorCoin.symbol} · ` : ''}
                          {creatorCoin.address.slice(0, 6)}…{creatorCoin.address.slice(-4)}
                        </a>
                      </div>
                    ) : creatorCoinError ? (
                      <div className="text-[11px] text-amber-300/80">{creatorCoinError}</div>
                    ) : verifiedWallet ? (
                      <div className="text-[11px] text-zinc-700">No Creator Coin detected for this wallet.</div>
                    ) : null}
                    <button
                      type="button"
                      className="w-full text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                      onClick={() => {
                        setUseWalletSig(false)
                        setWalletSigStarted(false)
                      }}
                    >
                      Back
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                    disabled={busy || siwfBusy || siwe.busy}
                    onClick={() => {
                      if (busy || siwfBusy || siwe.busy) return
                      setError(null)
                      setSiwfError(null)
                      setStep(showPersonaStep ? 'persona' : 'persona')
                      // If persona was forced via query, allow back to persona selection only when not forced.
                      if (!showPersonaStep) {
                        // keep them on verify (can't go back to persona if preselected)
                        setStep('verify')
                      }
                    }}
                  >
                    Back
                  </button>
                </div>
              </motion.div>
            ) : null}

            {step === 'email' ? (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <div className="headline text-2xl sm:text-3xl leading-tight">Email</div>
                <div className="text-sm text-zinc-600 font-light">We’ll email you.</div>

                {persona === 'creator' && verifiedWallet && creatorCoin ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600 mb-1">Creator Coin</div>
                    <div className="text-sm text-zinc-300 font-mono">
                      {creatorCoin.symbol ? `${creatorCoin.symbol} · ` : ''}
                      {creatorCoin.address}
                    </div>
                  </div>
                ) : null}

                {persona === 'creator' && referralCodeTaken ? (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-amber-300/80 mb-2">Code</div>
                    <div className="text-xs text-zinc-600 mb-3">Code taken. Choose another.</div>
                    <div className="flex items-center gap-2">
                      <input
                        value={claimReferralCode}
                        onChange={(e) => setClaimReferralCode(e.target.value)}
                        placeholder="CODE"
                        inputMode="text"
                        autoComplete="off"
                        className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 font-mono"
                      />
                      <button
                        type="button"
                        className="btn-accent"
                        disabled={busy || !isValidEmail(emailTrimmed)}
                        onClick={() => void submitWaitlist({ email: emailTrimmed })}
                      >
                        Claim
                      </button>
                    </div>
                    <div className="mt-2 text-[11px] text-zinc-700">A–Z 0–9 · 16 max</div>
                  </div>
                ) : null}

                {showPrivy ? (
                  <div className="space-y-3">
                    {privyStatus === 'ready' ? (
                      <Suspense
                        fallback={
                          <button className="btn-primary w-full opacity-60 cursor-not-allowed" disabled>
                            Continue
                          </button>
                        }
                      >
                        <PrivySocialConnect
                          disabled={busy}
                          onEmail={(e) => {
                            setEmail(e)
                            void submitWaitlist({ email: normalizeEmail(e) })
                          }}
                          onError={(msg) => setError(msg)}
                        />
                      </Suspense>
                    ) : (
                      <button className="btn-primary w-full opacity-60 cursor-not-allowed" disabled>
                        Continue
                      </button>
                    )}

                    <div className="flex items-center gap-3 pt-1">
                      <div className="h-px bg-white/10 flex-1" />
                      <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-700">or</div>
                      <div className="h-px bg-white/10 flex-1" />
                    </div>
                  </div>
                ) : null}

                <div>
                  <div className="flex items-center gap-3">
                    <input
                      ref={emailInputRef}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com"
                      inputMode="email"
                      autoComplete="email"
                      className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return
                        const v = emailTrimmed
                        if (!isValidEmail(v)) {
                          setError('Enter a valid email address.')
                          return
                        }
                        void submitWaitlist({ email: v })
                      }}
                    />
                    <div className="kbd-hint">Enter ↵</div>
                  </div>
                  {emailTrimmed.length > 0 && !isValidEmail(emailTrimmed) ? (
                    <div className="mt-2 text-xs text-amber-300/80">That doesn’t look like a valid email.</div>
                  ) : null}
                </div>

                {persona === 'user' ? (
                  <div className="rounded-xl border border-white/10 bg-black/30">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                      onClick={() => setShowUserWallet((v) => !v)}
                    >
                      <div className="text-sm text-zinc-300">Add wallet (optional)</div>
                      <ChevronDown
                        className={`w-4 h-4 text-zinc-500 transition-transform ${showUserWallet ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {showUserWallet ? (
                      <div className="px-4 pb-4">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600 mb-2">Wallet</div>
                        <input
                          value={userWallet}
                          onChange={(e) => setUserWallet(e.target.value)}
                          placeholder="0x0000000000000000000000000000000000000000"
                          inputMode="text"
                          autoComplete="off"
                          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                        />
                        {!userWalletOk ? (
                          <div className="mt-2 text-xs text-amber-300/80">Must be a valid 0x… address (or leave blank).</div>
                        ) : (
                          <div className="mt-2 text-xs text-zinc-700">We’ll verify later.</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {error ? (
                  <div className="text-xs text-red-400" role="status" aria-live="polite">
                    {error}
                  </div>
                ) : null}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                    disabled={busy}
                    onClick={() => {
                      if (busy) return
                      const target = persona === 'creator' ? 'verify' : showPersonaStep ? 'persona' : 'email'
                      setError(null)
                      setSiwfError(null)
                      setStep(target)
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn-accent"
                    disabled={busy || !isValidEmail(emailTrimmed) || (persona === 'user' && showUserWallet && !userWalletOk)}
                    onClick={() => void submitWaitlist({ email: emailTrimmed })}
                  >
                    {busy ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </motion.div>
            ) : null}

            {step === 'done' ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="flex items-center gap-3"
                >
                  <div className="relative w-9 h-9 rounded-full border border-brand-primary/20 bg-brand-primary/10 inline-flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border border-brand-primary/20 animate-pulse-ring" />
                    <CheckCircle2 className="w-5 h-5 text-brand-accent" />
                  </div>
                  <div className="headline text-2xl sm:text-3xl leading-tight">Invite</div>
                </motion.div>

                <div className="text-sm text-zinc-600 font-light">
                  {doneEmail ? (
                    <>
                      You’re in as <span className="font-mono text-zinc-300">{doneEmail}</span>. Share to move up.
                    </>
                  ) : (
                    <>You’re in. Share to move up.</>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600 mb-1">{INVITE_COPY.counterLabel}</div>
                      <div className="text-2xl text-zinc-200">
                        {typeof allTimeConversions === 'number' ? allTimeConversions : '—'}
                      </div>
                      <div className="text-[11px] text-zinc-700">
                        {typeof weeklyConversions === 'number' ? `${weeklyConversions} this week` : 'Loading'}
                        {weeklyRank ? ` · #${weeklyRank} weekly` : ''}
                        {allTimeRank ? ` · #${allTimeRank} all‑time` : ''}
                      </div>
                    </div>
                    <a
                      className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors pt-1"
                      href="/leaderboard"
                    >
                      Leaderboard
                    </a>
                  </div>

                  <div className="pt-2">
                    {(() => {
                      const count = typeof allTimeConversions === 'number' ? allTimeConversions : 0
                      return (
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {REFERRAL_BADGES.map((b) => {
                            const unlocked = count >= b.threshold
                            return (
                              <div
                                key={b.threshold}
                                className={`text-[11px] rounded-full px-2 py-1 border ${
                                  unlocked ? 'border-brand-primary/30 bg-brand-primary/10 text-zinc-300' : 'border-white/10 bg-black/30 text-zinc-700'
                                }`}
                                title={unlocked ? 'Unlocked' : `Need ${b.threshold} converted invites`}
                              >
                                {b.label} · {b.threshold}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {referralCode ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 space-y-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600 mb-1">{INVITE_COPY.linkLabel}</div>
                      <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[12px] text-zinc-300 break-all">
                        {referralLink}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="btn-primary w-full flex items-center justify-between gap-2"
                        onClick={() => {
                          const template = REFERRAL_TWEET_TEMPLATES[inviteTemplateIdx % REFERRAL_TWEET_TEMPLATES.length] || REFERRAL_TWEET_TEMPLATES[0]
                          const text = fillTweetTemplate(template, referralLink)
                          const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
                          window.open(url, '_blank', 'noopener,noreferrer')
                          markAction('shareX')
                        }}
                      >
                        <span>{INVITE_COPY.shareButton}</span>
                        {renderActionBadge('shareX')}
                      </button>
                      <button
                        type="button"
                        className="btn-accent w-full flex items-center justify-between gap-2"
                        onClick={() => {
                          void (async () => {
                            try {
                              await navigator.clipboard.writeText(referralLink)
                              markAction('copyLink')
                              setInviteToast(INVITE_COPY.copiedToast)
                              window.setTimeout(() => setInviteToast(null), 1800)
                            } catch {
                              setInviteToast('Copy failed.')
                              window.setTimeout(() => setInviteToast(null), 1800)
                            }
                          })()
                        }}
                      >
                        <span>{INVITE_COPY.copyButton}</span>
                        {renderActionBadge('copyLink')}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                        onClick={() => setInviteTemplateIdx((v) => (v + 1) % REFERRAL_TWEET_TEMPLATES.length)}
                      >
                        New copy ({(inviteTemplateIdx % REFERRAL_TWEET_TEMPLATES.length) + 1}/{REFERRAL_TWEET_TEMPLATES.length})
                      </button>
                      {inviteToast ? <div className="text-[11px] text-zinc-600">{inviteToast}</div> : null}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-700">Link appears when ready.</div>
                )}

                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                      onClick={resetFlow}
                    >
                      Reset
                    </button>
                    {shareToast ? <div className="text-[11px] text-zinc-600">{shareToast}</div> : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <a
                      className="btn-primary w-full flex items-center justify-between gap-2"
                      href="https://x.com/4626fun"
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => markAction('follow')}
                    >
                      <span>Follow @4626fun</span>
                      {renderActionBadge('follow')}
                    </a>
                    <button
                      type="button"
                      className="btn-accent w-full flex items-center justify-between gap-2"
                      disabled={shareBusy}
                      onClick={() => void shareOrCompose()}
                    >
                      <span>{shareBusy ? 'Working…' : 'Share'}</span>
                      {renderActionBadge('share')}
                    </button>
                  </div>

                  {miniApp.isMiniApp && miniAppAddSupported !== false ? (
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-2 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-60"
                      disabled={shareBusy || miniAppAddSupported === null || miniApp.added === true}
                      onClick={() => void addMiniApp()}
                      title={
                        miniAppAddSupported === null
                          ? 'Checking host capabilities…'
                          : miniApp.added === true
                            ? `Already saved in ${miniAppHostLabel ?? 'Mini Apps'}`
                            : `Save this Mini App in ${miniAppHostLabel ?? 'Mini Apps'}`
                      }
                    >
                      <span>
                        {miniAppAddSupported === null
                          ? 'Checking Mini App support…'
                          : miniApp.added === true
                            ? `Saved in ${miniAppHostLabel ?? 'Mini Apps'}`
                            : `Save in ${miniAppHostLabel ?? 'Mini Apps'}`}
                      </span>
                      {renderActionBadge('saveApp')}
                    </button>
                  ) : (
                    <div className="text-[11px] text-zinc-700">
                      Bookmark <span className="font-mono text-zinc-500">4626.fun</span>.
                    </div>
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

