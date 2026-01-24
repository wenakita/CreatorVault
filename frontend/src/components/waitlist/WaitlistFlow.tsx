import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getAppBaseUrl } from '@/lib/host'
import { SignInButton, useProfile, useSignInMessage } from '@farcaster/auth-kit'
import { useAccount } from 'wagmi'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { ConnectButtonWeb3 } from '@/components/ConnectButtonWeb3'
import { isPrivyClientEnabled } from '@/lib/flags'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { Check, CheckCircle2, ChevronDown, ArrowLeft } from 'lucide-react'
import { useMiniAppContext } from '@/hooks'
import { apiAliasPath } from '@/lib/apiBase'
import { fetchZoraCoin, fetchZoraProfile } from '@/lib/zora/client'
import { REFERRAL_TWEET_TEMPLATES, fillTweetTemplate, INVITE_COPY } from '@/components/waitlist/referralsCopy'
import { Logo } from '@/components/brand/Logo'

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

const SIGNUP_POINTS = 1

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
  const [showWalletOption, setShowWalletOption] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneEmail, setDoneEmail] = useState<string | null>(null)
  const [verifiedFid, setVerifiedFid] = useState<number | null>(null)
  const [verifiedWallet, setVerifiedWallet] = useState<string | null>(null)
  const [verifiedSolana, setVerifiedSolana] = useState<string | null>(null)
  const [siwfNonce, setSiwfNonce] = useState<string | null>(null)
  const [siwfNonceToken, setSiwfNonceToken] = useState<string | null>(null)
  const [siwfBusy, setSiwfBusy] = useState(false)
  const [siwfError, setSiwfError] = useState<string | null>(null)
  const [siwfStarted, setSiwfStarted] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareToast, setShareToast] = useState<string | null>(null)
  const [creatorCoin, setCreatorCoin] = useState<{
    address: string
    symbol: string | null
    coinType: string | null
    imageUrl: string | null
    marketCapUsd: number | null
    volume24hUsd: number | null
    holders: number | null
    priceUsd: number | null
  } | null>(null)
  const [creatorCoinBusy, setCreatorCoinBusy] = useState(false)
  const [claimCoinBusy, setClaimCoinBusy] = useState(false)
  const [claimCoinError, setClaimCoinError] = useState<string | null>(null)
  const creatorCoinForWalletRef = useRef<string | null>(null)
  const claimCoinForWalletRef = useRef<string | null>(null)
  const [referralCodeTaken, setReferralCodeTaken] = useState(false)
  const [claimReferralCode, setClaimReferralCode] = useState('')
  const [inviteToast, setInviteToast] = useState<string | null>(null)
  const [inviteTemplateIdx, setInviteTemplateIdx] = useState(0)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [waitlistPosition, setWaitlistPosition] = useState<{
    points: { total: number; invite: number; signup: number; tasks: number }
    rank: { invite: number | null; total: number | null }
    totalCount: number
    totalAheadInvite: number | null
    percentileInvite: number | null
    referrals: { qualifiedCount: number; pendingCount: number; pendingCountCapped: number; pendingCap: number }
  } | null>(null)
  const [waitlistPositionBusy, setWaitlistPositionBusy] = useState(false)

  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const referralSessionIdRef = useRef<string | null>(null)

  const appUrl = useMemo(() => getAppBaseUrl(), [])
  const { isConnected: isWalletConnected } = useAccount()
  const siwe = useSiweAuth()
  const miniApp = useMiniAppContext()
  const { message: siwfMessage, signature: siwfSignature } = useSignInMessage()
  const { isAuthenticated: isFarcasterAuthed, profile } = useProfile()

  const privyStatus = usePrivyClientStatus()
  const showPrivy = isPrivyClientEnabled()
  const {
    ready: privyReady,
    authenticated: privyAuthed,
    user: privyUser,
    logout: privyLogout,
    connectWallet: privyConnectWallet,
  } = usePrivy()
  const { wallets: privyWallets } = useWallets()
  const [privyVerifyBusy, setPrivyVerifyBusy] = useState(false)
  const [privyVerifyError, setPrivyVerifyError] = useState<string | null>(null)
  const privyPendingWalletLoginRef = useRef<{ walletList: any[] } | null>(null)
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

  function isValidSolanaAddress(v: string): boolean {
    const s = String(v || '').trim()
    if (!s) return false
    // Base58-ish, 32–44 chars (covers most standard pubkeys)
    if (s.length < 32 || s.length > 44) return false
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
  }

  function extractPrivyWalletAddress(user: any, walletsOverride?: any[]): string | null {
    const wallets = Array.isArray(walletsOverride) ? walletsOverride : Array.isArray(user?.wallets) ? user.wallets : []
    const primaryWallet = user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []
    const all = [...primaryWallet, ...wallets]
    // Prefer Base Account / Coinbase Smart Wallet if present.
    for (const w of all) {
      const addr = typeof w?.address === 'string' ? w.address : null
      if (!addr || !isValidEvmAddress(addr)) continue
      const clientType = String(w?.wallet_client_type || w?.walletClientType || '').toLowerCase()
      const connectorType = String(w?.connector_type || w?.connectorType || '').toLowerCase()
      if (clientType.includes('base') || clientType.includes('smart') || connectorType.includes('base')) return addr
    }
    // Fallback: first EVM wallet.
    for (const w of all) {
      const addr = typeof w?.address === 'string' ? w.address : null
      if (addr && isValidEvmAddress(addr)) return addr
    }
    const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
    for (const a of linked) {
      const addr = typeof a?.address === 'string' ? a.address : null
      if (addr && isValidEvmAddress(addr)) return addr
    }
    return null
  }

  function extractPrivySolanaAddress(user: any, walletsOverride?: any[]): string | null {
    const wallets = Array.isArray(walletsOverride) ? walletsOverride : Array.isArray(user?.wallets) ? user.wallets : []
    const primaryWallet = user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []
    const all = [...primaryWallet, ...wallets]
    for (const w of all) {
      const chainType = String(w?.chain_type || w?.chainType || '').toLowerCase()
      const addr = typeof w?.address === 'string' ? w.address : null
      if (addr && chainType.includes('solana') && isValidSolanaAddress(addr)) return addr
    }
    const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
    for (const a of linked) {
      const t = String(a?.type || '').toLowerCase()
      const chainType = String(a?.chain_type || a?.chainType || '').toLowerCase()
      const addr = typeof a?.address === 'string' ? a.address : null
      if (!addr) continue
      if (t.includes('solana') || chainType.includes('solana')) {
        if (isValidSolanaAddress(addr)) return addr
      }
    }
    return null
  }

  const emailTrimmed = useMemo(() => normalizeEmail(email), [email])
  const forcedPersona = useMemo(() => {
    const q = new URLSearchParams(location.search)
    const raw = (q.get('persona') ?? '').trim().toLowerCase()
    return raw === 'creator' ? ('creator' as const) : raw === 'user' ? ('user' as const) : null
  }, [location.search])
  const forcedPersonaAppliedRef = useRef(false)

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
    if (forcedPersonaAppliedRef.current) return
    // If user already progressed, don't override their choice mid-flow.
    if (step !== 'persona') return
    forcedPersonaAppliedRef.current = true
    setPersona(forcedPersona)
    if (forcedPersona === 'creator') {
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

  const apiFetch = useCallback(
    async (path: string, init: RequestInit & { withCredentials?: boolean } = {}) => {
      const bases: string[] = []
      if (typeof window !== 'undefined') bases.push(window.location.origin)
      bases.push(appUrl)

      const withCreds = Boolean(init.withCredentials)
      const headers = new Headers(init.headers ?? undefined)
      if (typeof window !== 'undefined' && path.startsWith('/api/') && !headers.has('Authorization')) {
        try {
          const token = localStorage.getItem('cv_siwe_session_token')
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

      let lastErr: unknown = null
      for (const base of bases) {
        const b = base.replace(/\/+$/, '')
        // Prefer alias to avoid extension blocks on `/api/*`, then fall back to the canonical path.
        const paths = path.startsWith('/api/') ? [apiAliasPath(path), path] : [path]
        const alias = path.startsWith('/api/') ? apiAliasPath(path) : null
        for (const p of paths) {
          const url = `${b}${p}`
          try {
            const res = await fetch(url, baseInit)
            const ct = (res.headers.get('content-type') ?? '').toLowerCase()
            // In dev, a missing alias may return index.html; treat that as a miss and continue.
            if (ct.includes('text/html')) continue
            if (res.status === 404) continue
            if (alias && p === alias && res.status === 405) continue
            return res
          } catch (e: unknown) {
            lastErr = e
            continue
          }
        }
      }
      throw lastErr ?? new Error('Request failed')
    },
    [appUrl],
  )

  async function claimCreatorCoin(coinAddress: string, source: 'auto' | 'manual') {
    if (claimCoinBusy) return
    const coin = normalizeAddress(coinAddress).toLowerCase()
    if (!isValidEvmAddress(coin)) {
      setClaimCoinError('Enter a valid coin address.')
      return
    }
    setClaimCoinBusy(true)
    setClaimCoinError(null)
    try {
      const res = await apiFetch('/api/creator-wallets/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ coinAddress: coin }),
      })
      const text = await res.text().catch(() => '')
      const json = text ? JSON.parse(text) : null
      if (!res.ok || !json || json.success !== true) {
        const msg = json && typeof json.error === 'string' ? json.error : `Claim failed (HTTP ${res.status})`
        throw new Error(msg)
      }

      if (source === 'manual') {
        try {
          const fetched = await fetchZoraCoin(coin as any)
          if (fetched) {
            const imageUrl =
              (fetched?.mediaContent?.previewImage?.medium as string | undefined) ||
              (fetched?.mediaContent?.previewImage?.small as string | undefined) ||
              null
            const asNumber = (v: any): number | null => {
              const n = Number(v)
              return Number.isFinite(n) ? n : null
            }
            setCreatorCoin({
              address: coin,
              symbol: fetched?.symbol ? String(fetched.symbol) : null,
              coinType: fetched?.coinType ? String(fetched.coinType) : null,
              imageUrl,
              marketCapUsd: asNumber(fetched?.marketCap),
              volume24hUsd: asNumber(fetched?.volume24h),
              holders: typeof fetched?.uniqueHolders === 'number' ? fetched.uniqueHolders : null,
              priceUsd: asNumber(fetched?.tokenPrice?.priceInUsdc),
            })
          }
        } catch {
          // ignore
        }
      }

      setStep('email')
    } catch (e: any) {
      setClaimCoinError(e?.message ? String(e.message) : 'Claim failed')
    } finally {
      setClaimCoinBusy(false)
    }
  }

  function primaryWalletForSubmit(): string | null {
    // Creators: verified wallet only (from SIWF profile or SIWE).
    if (persona === 'creator') {
      const pw = typeof verifiedWallet === 'string' && isValidEvmAddress(verifiedWallet) ? verifiedWallet : null
      return pw
    }
    return null
  }

  function solanaWalletForSubmit(): string | null {
    // Creators: allow Solana-only verification (day 1).
    if (persona === 'creator') {
      const sw = typeof verifiedSolana === 'string' && isValidSolanaAddress(verifiedSolana) ? verifiedSolana : null
      return sw
    }
    return null
  }

  async function submitWaitlist(params: { email: string }) {
    setError(null)
    setReferralCodeTaken(false)
    setBusy(true)
    try {
      // Creators must verify before email submission.
      if (persona === 'creator' && !verifiedFid && !verifiedWallet && !verifiedSolana) {
        throw new Error('Verify your identity first.')
      }
      if (persona !== 'creator' && persona !== 'user') {
        throw new Error('Select Creator or User first.')
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
          solanaWallet: solanaWalletForSubmit(),
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

      // Best-effort: mark profile complete + qualify referral.
      // Do not block the UI; points awards are idempotent server-side.
      void (async () => {
        try {
          const emailForSync = String(json?.data?.email || params.email)
          await apiFetch('/api/waitlist/profile-complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ email: emailForSync }),
          })

          // Refresh position after awarding.
          const posRes = await apiFetch(`/api/waitlist/position?email=${encodeURIComponent(emailForSync)}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          })
          const posJson = (await posRes.json().catch(() => null)) as any
          const data = posJson?.success ? posJson?.data : null
          if (posRes.ok && data) {
            setWaitlistPosition({
              points: {
                total: typeof data?.points?.total === 'number' ? data.points.total : 0,
                invite: typeof data?.points?.invite === 'number' ? data.points.invite : 0,
                signup: typeof data?.points?.signup === 'number' ? data.points.signup : 0,
                tasks: typeof data?.points?.tasks === 'number' ? data.points.tasks : 0,
              },
              rank: {
                invite: typeof data?.rank?.invite === 'number' ? data.rank.invite : null,
                total: typeof data?.rank?.total === 'number' ? data.rank.total : null,
              },
              totalCount: typeof data?.totalCount === 'number' ? data.totalCount : 0,
              totalAheadInvite: typeof data?.totalAheadInvite === 'number' ? data.totalAheadInvite : null,
              percentileInvite: typeof data?.percentileInvite === 'number' ? data.percentileInvite : null,
              referrals: {
                qualifiedCount: typeof data?.referrals?.qualifiedCount === 'number' ? data.referrals.qualifiedCount : 0,
                pendingCount: typeof data?.referrals?.pendingCount === 'number' ? data.referrals.pendingCount : 0,
                pendingCountCapped: typeof data?.referrals?.pendingCountCapped === 'number' ? data.referrals.pendingCountCapped : 0,
                pendingCap: typeof data?.referrals?.pendingCap === 'number' ? data.referrals.pendingCap : 10,
              },
            })
          }
        } catch {
          // ignore
        }
      })()
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
    setVerifiedSolana(null)
    setSiwfNonce(null)
    setSiwfNonceToken(null)
    setSiwfBusy(false)
    setSiwfError(null)
    setSiwfStarted(false)
    setCreatorCoin(null)
    setCreatorCoinBusy(false)
    creatorCoinForWalletRef.current = null
    claimCoinForWalletRef.current = null
    setClaimCoinBusy(false)
    setClaimCoinError(null)
    setReferralCodeTaken(false)
    setClaimReferralCode('')
    setInviteToast(null)
    setInviteTemplateIdx(0)
    setReferralCode(null)
  }

  async function signOutWallet() {
    try {
      if (showPrivy && privyAuthed) {
        await privyLogout()
      }
      const maybe = siwe as any
      if (typeof maybe?.signOut === 'function') {
        await maybe.signOut()
      }
    } catch {
      // ignore
    } finally {
      setVerifiedWallet(null)
      setVerifiedSolana(null)
      setPrivyVerifyBusy(false)
      setPrivyVerifyError(null)
      setCreatorCoin(null)
      setCreatorCoinBusy(false)
      creatorCoinForWalletRef.current = null
      claimCoinForWalletRef.current = null
      setClaimCoinBusy(false)
      setClaimCoinError(null)
    }
  }

  // Fetch waitlist points + position once we're in.
  useEffect(() => {
    if (step !== 'done') return
    if (!doneEmail) return
    if (waitlistPositionBusy) return
    setWaitlistPositionBusy(true)
    void (async () => {
      try {
        const res = await apiFetch(`/api/waitlist/position?email=${encodeURIComponent(doneEmail)}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        const text = await res.text().catch(() => '')
        const json = text ? JSON.parse(text) : null
        if (!res.ok || !json || json.success !== true) return
        const data = json?.data ?? null
        if (!data) return
        setWaitlistPosition({
          points: {
            total: typeof data?.points?.total === 'number' ? data.points.total : 0,
            invite: typeof data?.points?.invite === 'number' ? data.points.invite : 0,
            signup: typeof data?.points?.signup === 'number' ? data.points.signup : 0,
            tasks: typeof data?.points?.tasks === 'number' ? data.points.tasks : 0,
          },
          rank: {
            invite: typeof data?.rank?.invite === 'number' ? data.rank.invite : null,
            total: typeof data?.rank?.total === 'number' ? data.rank.total : null,
          },
          totalCount: typeof data?.totalCount === 'number' ? data.totalCount : 0,
          totalAheadInvite: typeof data?.totalAheadInvite === 'number' ? data.totalAheadInvite : null,
          percentileInvite: typeof data?.percentileInvite === 'number' ? data.percentileInvite : null,
          referrals: {
            qualifiedCount: typeof data?.referrals?.qualifiedCount === 'number' ? data.referrals.qualifiedCount : 0,
            pendingCount: typeof data?.referrals?.pendingCount === 'number' ? data.referrals.pendingCount : 0,
            pendingCountCapped: typeof data?.referrals?.pendingCountCapped === 'number' ? data.referrals.pendingCountCapped : 0,
            pendingCap: typeof data?.referrals?.pendingCap === 'number' ? data.referrals.pendingCap : 10,
          },
        })
      } catch {
        // ignore
      } finally {
        setWaitlistPositionBusy(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneEmail, step])

  // Auto-start SIWF nonce fetch so the button is the primary action.
  useEffect(() => {
    if (step !== 'verify') return
    if (persona !== 'creator') return
    if (siwfNonce) return
    if (siwfBusy) return
    void startSiwf()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, siwfBusy, siwfNonce, step])

  // Only verify after the user explicitly clicks the SIWF button in this flow.
  useEffect(() => {
    if (!siwfStarted) return
    if (step !== 'verify') return
    if (persona !== 'creator') return
    if (siwfBusy) return
    if (!siwfMessage || !siwfSignature) return
    void verifySiwfOnServer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, siwfBusy, siwfMessage, siwfSignature, siwfStarted, step])

  // If SIWE has established an authenticated address, treat it as the verified wallet for this flow.
  useEffect(() => {
    if (step !== 'verify') return
    if (persona !== 'creator') return
    if (!siwe.isSignedIn) return
    if (verifiedWallet) return
    const a = typeof siwe.authAddress === 'string' && isValidEvmAddress(siwe.authAddress) ? siwe.authAddress : null
    if (!a) return
    setVerifiedWallet(a)
  }, [persona, siwe.authAddress, siwe.isSignedIn, step, verifiedWallet])

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

  useEffect(() => {
    claimCoinForWalletRef.current = null
    setClaimCoinError(null)
  }, [verifiedWallet])

  // Best-effort: detect the user's Zora Creator Coin (if any) from the verified wallet.
  useEffect(() => {
    const w = typeof verifiedWallet === 'string' && isValidEvmAddress(verifiedWallet) ? verifiedWallet : null
    if (!w) {
      setCreatorCoin(null)
      setCreatorCoinBusy(false)
      creatorCoinForWalletRef.current = null
      return
    }
    if (creatorCoinForWalletRef.current === w) return
    creatorCoinForWalletRef.current = w

    let cancelled = false
    setCreatorCoinBusy(true)
    ;(async () => {
      try {
        const profile = await fetchZoraProfile(w)
        const coinAddrRaw = profile?.creatorCoin?.address ? String(profile.creatorCoin.address) : ''
        const coinAddr = isValidEvmAddress(coinAddrRaw) ? coinAddrRaw : null
        if (!coinAddr) {
          if (!cancelled) setCreatorCoin(null)
          return
        }

        // Resolve metadata (symbol/type/stats) for display. If it fails, still show the address.
        let symbol: string | null = null
        let coinType: string | null = null
        let imageUrl: string | null = null
        let marketCapUsd: number | null = null
        let volume24hUsd: number | null = null
        let holders: number | null = null
        let priceUsd: number | null = null
        try {
          const coin = await fetchZoraCoin(coinAddr as any)
          symbol = coin?.symbol ? String(coin.symbol) : null
          coinType = coin?.coinType ? String(coin.coinType) : null
          imageUrl =
            (coin?.mediaContent?.previewImage?.medium as string | undefined) ||
            (coin?.mediaContent?.previewImage?.small as string | undefined) ||
            null
          const asNumber = (v: any): number | null => {
            const n = Number(v)
            return Number.isFinite(n) ? n : null
          }
          marketCapUsd = asNumber(coin?.marketCap)
          volume24hUsd = asNumber(coin?.volume24h)
          holders = typeof coin?.uniqueHolders === 'number' ? coin.uniqueHolders : null
          priceUsd = asNumber(coin?.tokenPrice?.priceInUsdc)
        } catch {
          // ignore
        }

        if (!cancelled) {
          setCreatorCoin({ address: coinAddr, symbol, coinType, imageUrl, marketCapUsd, volume24hUsd, holders, priceUsd })
        }
      } catch (e: any) {
        if (!cancelled) {
          setCreatorCoin(null)
        }
      } finally {
        if (!cancelled) setCreatorCoinBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [verifiedWallet])

  useEffect(() => {
    if (step !== 'verify') return
    if (persona !== 'creator') return
    if (!siwe.isSignedIn) return
    if (!verifiedWallet) return
    if (!creatorCoin?.address) return
    if (claimCoinBusy) return
    const key = `${verifiedWallet.toLowerCase()}:${creatorCoin.address.toLowerCase()}`
    if (claimCoinForWalletRef.current === key) return
    claimCoinForWalletRef.current = key
    void claimCreatorCoin(creatorCoin.address, 'auto')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimCoinBusy, creatorCoin?.address, persona, siwe.isSignedIn, step, verifiedWallet])

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
        // Best-effort: sync task completion to server points ledger (idempotent).
        // We key by email so all waitlist users can participate (not just wallet-auth users).
        if (doneEmail) {
          void (async () => {
            try {
              await apiFetch('/api/waitlist/task-claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ email: doneEmail, taskKey: action }),
              })

              const posRes = await apiFetch(`/api/waitlist/position?email=${encodeURIComponent(doneEmail)}`, {
                method: 'GET',
                headers: { Accept: 'application/json' },
              })
              const posJson = (await posRes.json().catch(() => null)) as any
              const data = posJson?.success ? posJson?.data : null
              if (posRes.ok && data) {
                setWaitlistPosition({
                  points: {
                    total: typeof data?.points?.total === 'number' ? data.points.total : 0,
                    invite: typeof data?.points?.invite === 'number' ? data.points.invite : 0,
                    signup: typeof data?.points?.signup === 'number' ? data.points.signup : 0,
                    tasks: typeof data?.points?.tasks === 'number' ? data.points.tasks : 0,
                  },
                  rank: {
                    invite: typeof data?.rank?.invite === 'number' ? data.rank.invite : null,
                    total: typeof data?.rank?.total === 'number' ? data.rank.total : null,
                  },
                  totalCount: typeof data?.totalCount === 'number' ? data.totalCount : 0,
                  totalAheadInvite: typeof data?.totalAheadInvite === 'number' ? data.totalAheadInvite : null,
                  percentileInvite: typeof data?.percentileInvite === 'number' ? data.percentileInvite : null,
                  referrals: {
                    qualifiedCount: typeof data?.referrals?.qualifiedCount === 'number' ? data.referrals.qualifiedCount : 0,
                    pendingCount: typeof data?.referrals?.pendingCount === 'number' ? data.referrals.pendingCount : 0,
                    pendingCountCapped: typeof data?.referrals?.pendingCountCapped === 'number' ? data.referrals.pendingCountCapped : 0,
                    pendingCap: typeof data?.referrals?.pendingCap === 'number' ? data.referrals.pendingCap : 10,
                  },
                })
              }
            } catch {
              // ignore
            }
          })()
        }
        return next
      })
    },
    [actionStorageKey, apiFetch, doneEmail],
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

  // Privy-first: when Privy has an authenticated wallet, treat it as verified for creators.
  useEffect(() => {
    if (!showPrivy || privyStatus !== 'ready') return
    if (step !== 'verify') return
    if (persona !== 'creator') return
    if (!privyReady || !privyAuthed) return
    if (verifiedWallet || verifiedSolana) return
    const evm = extractPrivyWalletAddress(privyUser, privyWallets)
    const sol = extractPrivySolanaAddress(privyUser, privyWallets)
    if (evm) {
      setVerifiedWallet(evm)
    } else if (sol) {
      setVerifiedSolana(sol)
    } else {
      // User completed Privy auth but has no wallet attached (common for email-only login).
      // Make the next step explicit instead of silently doing nothing.
      setPrivyVerifyBusy(false)
      const msg = 'Connect Base Account to verify.'
      setPrivyVerifyError((prev) => (prev === msg ? prev : msg))
      return
    }
    setPrivyVerifyError(null)
    setPrivyVerifyBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, privyAuthed, privyReady, privyStatus, privyUser, privyWallets, showPrivy, step, verifiedWallet, verifiedSolana])

  // When we explicitly trigger a "connect wallet" prompt, follow it with `loginOrLink()`
  // to authenticate (or link) the connected wallet. This keeps the UI wallet-first.
  useEffect(() => {
    if (!privyPendingWalletLoginRef.current) return
    if (!showPrivy || privyStatus !== 'ready') return
    if (step !== 'verify') return
    if (persona !== 'creator') return
    if (!privyReady) return

    const wallets = Array.isArray(privyWallets) ? privyWallets : []
    const latest = [...wallets].reverse().find((w) => typeof (w as any)?.loginOrLink === 'function') as any
    if (!latest) return

    // Consume the pending intent so we don't loop on wallet list updates.
    privyPendingWalletLoginRef.current = null

    Promise.resolve(latest.loginOrLink())
      .catch((e: any) => {
        setPrivyVerifyError(e?.message ? String(e.message) : 'Wallet verification failed')
      })
      .finally(() => {
        setPrivyVerifyBusy(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, privyReady, privyStatus, privyWallets, showPrivy, step])

  // UX: once creators are verified, immediately advance to email (no extra "Continue" click).
  useEffect(() => {
    if (step !== 'verify') return
    if (persona !== 'creator') return
    if (verifiedFid || verifiedWallet || verifiedSolana) {
      setStep('email')
    }
  }, [persona, step, verifiedFid, verifiedSolana, verifiedWallet])

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

  const goBack = useCallback(() => {
    setError(null)
    setSiwfError(null)
    setSiwfStarted(false)
    if (step === 'verify') {
      setStep('persona')
      return
    }
    if (step === 'email') {
      if (persona === 'creator') {
        setStep('verify')
      } else {
        setStep('persona')
      }
    }
  }, [persona, step])

  const compactNumber = useMemo(
    () => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }),
    [],
  )

  function formatUsd(value: number | null): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
    return `$${compactNumber.format(value)}`
  }

  function formatCount(value: number | null): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
    return compactNumber.format(value)
  }

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
          <div className="flex items-center justify-between mb-5 sm:mb-7">
            <div className="flex items-center gap-3">
              <Logo width={36} height={36} showText={false} />
              <div>
                <div className="text-[11px] text-zinc-200">Creator Vaults</div>
                <div className="text-[10px] text-zinc-600">Waitlist</div>
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] text-zinc-500">
              Step {stepIndex} / {totalSteps}
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
          {step !== 'persona' ? (
            <div className="flex items-center justify-between mb-4">
              {step !== 'done' ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  disabled={busy || siwfBusy || siwe.busy}
                  onClick={() => {
                    if (busy || siwfBusy || siwe.busy) return
                    goBack()
                  }}
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  onClick={resetFlow}
                >
                  Reset
                </button>
              )}
              <div className="w-8" />
            </div>
          ) : null}
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
                <div className="headline text-2xl sm:text-3xl leading-tight">Choose your path</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="group rounded-xl border border-white/10 bg-black/40 hover:bg-black/50 hover:border-brand-primary/30 p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    onClick={() => {
                      setPersona('creator')
                      setError(null)
                      setSiwfError(null)
                      setStep('verify')
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-zinc-100 font-medium">Creator</div>
                        <div className="mt-1 text-sm text-zinc-600 font-light">Launch a vault</div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-6 h-6 rounded-full border border-brand-primary/20 bg-brand-primary/10 inline-flex items-center justify-center">
                          <Check className="w-4 h-4 text-brand-accent" />
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="group rounded-xl border border-white/10 bg-black/40 hover:bg-black/50 hover:border-brand-primary/30 p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    onClick={() => {
                      setPersona('user')
                      setError(null)
                      setStep('email')
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-zinc-100 font-medium">User</div>
                        <div className="mt-1 text-sm text-zinc-600 font-light">Join early access</div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-6 h-6 rounded-full border border-brand-primary/20 bg-brand-primary/10 inline-flex items-center justify-center">
                          <Check className="w-4 h-4 text-brand-accent" />
                        </div>
                      </div>
                    </div>
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
                className="space-y-6"
              >
                {/* Header */}
                <div className="space-y-1">
                  <div className="headline text-2xl sm:text-3xl leading-tight">Verify</div>
                  <div className="text-sm text-zinc-500">Continue with Base Account</div>
                </div>

                {/* Farcaster verified state */}
                {typeof verifiedFid === 'number' && verifiedFid > 0 ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm text-zinc-200">Farcaster verified</div>
                      <div className="text-xs text-zinc-500 font-mono">fid {verifiedFid}</div>
                    </div>
                  </div>
                ) : null}

                {/* Wallet verified state (if verified via wallet but not Farcaster) */}
                {verifiedWallet && !(typeof verifiedFid === 'number' && verifiedFid > 0) ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-zinc-200">Wallet verified</div>
                      <div className="text-xs text-zinc-500 font-mono truncate">
                        {verifiedWallet.slice(0, 6)}…{verifiedWallet.slice(-4)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      onClick={() => void signOutWallet()}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}

                {/* Solana verified state (Privy) */}
                {verifiedSolana && !(typeof verifiedFid === 'number' && verifiedFid > 0) && !verifiedWallet ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-zinc-200">Solana verified</div>
                      <div className="text-xs text-zinc-500 font-mono truncate">{verifiedSolana}</div>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      onClick={() => void signOutWallet()}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}

                {/* Privy-first: prefer Base Account (Coinbase Smart Wallet) */}
                {showPrivy &&
                privyStatus === 'ready' &&
                !(typeof verifiedFid === 'number' && verifiedFid > 0) &&
                !verifiedWallet &&
                !verifiedSolana ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      className="w-full min-h-[52px] rounded-xl border border-brand-primary/30 bg-brand-primary/20 text-zinc-100 font-medium px-4 py-3.5 transition-colors hover:bg-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!privyReady || privyVerifyBusy}
                      onClick={() => {
                        if (!privyReady || privyVerifyBusy) return
                        setPrivyVerifyError(null)
                        setPrivyVerifyBusy(true)
                        // Single CTA: Base Account first, but EOAs are available in the same modal.
                        privyPendingWalletLoginRef.current = {
                          walletList: ['base_account', 'coinbase_wallet', 'detected_wallets', 'metamask', 'wallet_connect'],
                        }
                        Promise.resolve(
                          (privyConnectWallet as any)({
                            walletList: ['base_account', 'coinbase_wallet', 'detected_wallets', 'metamask', 'wallet_connect'],
                          }),
                        ).catch((e: any) => {
                          privyPendingWalletLoginRef.current = null
                          setPrivyVerifyError(e?.message ? String(e.message) : 'Wallet connect failed')
                          setPrivyVerifyBusy(false)
                        })
                      }}
                    >
                      {privyVerifyBusy ? 'Opening…' : 'Continue'}
                    </button>
                    {privyVerifyError ? <div className="text-xs text-red-400 text-center">{privyVerifyError}</div> : null}
                  </div>
                ) : null}

                {/* Fallback: original Farcaster + SIWE flow when Privy is disabled */}
                {!showPrivy && !(typeof verifiedFid === 'number' && verifiedFid > 0) && !verifiedWallet ? (
                  <div className="space-y-2">
                    {siwfNonce ? (
                      <div
                        className={[
                          '[&_button]:w-full',
                          '[&_button]:min-h-[52px]',
                          '[&_button]:rounded-xl',
                          '[&_button]:border',
                          '[&_button]:border-brand-primary/30',
                          '[&_button]:bg-brand-primary/20',
                          '[&_button]:text-zinc-100',
                          '[&_button]:font-medium',
                          '[&_button]:px-4',
                          '[&_button]:py-3.5',
                          '[&_button]:transition-colors',
                          '[&_button:hover]:bg-brand-primary/30',
                          '[&_button:disabled]:opacity-50',
                          '[&_button_*]:!font-inherit',
                        ].join(' ')}
                      >
                        <SignInButton
                          nonce={siwfNonce}
                          onSuccess={() => {
                            setSiwfStarted(true)
                            setSiwfError(null)
                          }}
                          onError={(e: any) => setSiwfError(e?.message ? String(e.message) : 'Farcaster sign-in failed')}
                        />
                      </div>
                    ) : (
                      <button
                        className="w-full min-h-[52px] rounded-xl border border-brand-primary/30 bg-brand-primary/20 text-zinc-400 font-medium px-4 py-3.5 cursor-not-allowed"
                        disabled
                      >
                        {siwfBusy ? 'Verifying…' : 'Preparing…'}
                      </button>
                    )}
                    <div className="text-center text-[11px] text-zinc-600">Recommended</div>
                    {siwfError ? (
                      <div className="text-xs text-red-400 text-center">
                        {siwfError}{' '}
                        {!siwfBusy ? (
                          <button
                            type="button"
                            className="underline underline-offset-2 text-red-300 hover:text-red-200"
                            onClick={() => void startSiwf()}
                          >
                            Retry
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="text-center">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                        onClick={() => setShowWalletOption((v) => !v)}
                      >
                        <span>{showWalletOption ? 'Hide wallet option' : 'Or use a wallet instead'}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showWalletOption ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    {showWalletOption ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4 space-y-2"
                      >
                        <ConnectButtonWeb3 />
                        <button
                          type="button"
                          className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={siwe.busy || !isWalletConnected || Boolean(verifiedWallet)}
                          onClick={() => {
                            void (async () => {
                              const signed = await siwe.signIn()
                              if (!signed) return
                              setVerifiedWallet(signed)
                              setClaimCoinError(null)
                            })()
                          }}
                        >
                          {!isWalletConnected ? 'Connect wallet first' : siwe.busy ? 'Signing…' : 'Sign to verify'}
                        </button>
                        {siwe.error ? <div className="text-xs text-red-400">{siwe.error}</div> : null}
                      </motion.div>
                    ) : null}
                  </div>
                ) : null}

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
                  <div className="rounded-xl border border-white/10 bg-black/20">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-400">Creator Coin</span>
                      </div>
                      <span className="text-xs text-zinc-600">Linked</span>
                    </div>
                    <div className="px-4 pb-4 space-y-3">
                      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                        {creatorCoin.imageUrl ? (
                          <img
                            src={creatorCoin.imageUrl}
                            alt={creatorCoin.symbol || 'Creator coin'}
                            className="w-8 h-8 rounded-lg border border-white/10 object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="w-8 h-8 rounded-lg border border-white/10 bg-black/30 flex items-center justify-center text-[10px] text-zinc-500">
                            {creatorCoin.symbol ? creatorCoin.symbol.slice(0, 2) : 'CC'}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-zinc-200 font-medium truncate">{creatorCoin.symbol || 'Creator Coin'}</div>
                          <div className="text-[11px] font-mono text-zinc-600 truncate">{creatorCoin.address}</div>
                        </div>
                        <a
                          href={`${appUrl.replace(/\/+$/, '')}/deploy?token=${encodeURIComponent(creatorCoin.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          View
                        </a>
                      </div>
                      {(creatorCoin.marketCapUsd || creatorCoin.holders) ? (
                        <div className="flex items-center gap-4 text-[11px] text-zinc-600">
                          {creatorCoin.marketCapUsd ? <span>MC {formatUsd(creatorCoin.marketCapUsd)}</span> : null}
                          {creatorCoin.holders ? <span>{formatCount(creatorCoin.holders)} holders</span> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {persona === 'creator' && claimCoinError ? <div className="text-xs text-red-400">{claimCoinError}</div> : null}

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

                {error ? (
                  <div className="text-xs text-red-400" role="status" aria-live="polite">
                    {error}
                  </div>
                ) : null}

                <div className="flex items-center justify-end pt-2">
                  <button
                    type="button"
                    className="btn-accent"
                    disabled={busy || !isValidEmail(emailTrimmed)}
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
                  <div className="headline text-2xl sm:text-3xl leading-tight">You’re in!</div>
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
                          {waitlistPosition ? waitlistPosition.points.total.toLocaleString() : '—'}
                        </div>
                        <div className="text-[11px] text-zinc-700">
                          {waitlistPosition
                            ? `#${waitlistPosition.rank.invite ?? '—'} · Top ${waitlistPosition.percentileInvite ?? '—'}%`
                            : 'Loading…'}
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
                      const actionPointsLocal = (Object.keys(ACTION_POINTS) as ActionKey[]).reduce((sum, k) => {
                        return sum + (actionsDone[k] ? ACTION_POINTS[k] : 0)
                      }, 0)
                      const totalPoints = waitlistPosition?.points?.total ?? SIGNUP_POINTS + actionPointsLocal
                      const taskPoints = waitlistPosition?.points?.tasks ?? actionPointsLocal
                      const signupPoints = waitlistPosition?.points?.signup ?? SIGNUP_POINTS
                      const invitePoints = waitlistPosition?.points?.invite ?? 0
                      return (
                        <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600">Points</div>
                            <div className="text-sm text-zinc-200 font-medium tabular-nums">{totalPoints}</div>
                          </div>
                          <div className="mt-2 space-y-1 text-[11px] text-zinc-600">
                            <div className="flex items-center justify-between gap-3">
                              <span>Joined waitlist</span>
                              <span className="tabular-nums">+{signupPoints}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>Qualified referrals</span>
                              <span className="tabular-nums">+{invitePoints}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>Actions completed</span>
                              <span className="tabular-nums">+{taskPoints}</span>
                            </div>
                          </div>
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
                          const template =
                            REFERRAL_TWEET_TEMPLATES[inviteTemplateIdx % REFERRAL_TWEET_TEMPLATES.length] || REFERRAL_TWEET_TEMPLATES[0]
                          const text = fillTweetTemplate(template, referralLink)
                          const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralLink)}`
                          if (miniApp.isMiniApp) {
                            void (async () => {
                              try {
                                const { sdk } = await import('@farcaster/miniapp-sdk')
                                if (sdk?.actions?.openUrl) {
                                  await sdk.actions.openUrl(url)
                                  markAction('shareX')
                                  return
                                }
                              } catch {
                                // fall through
                              }
                              window.location.href = url
                              markAction('shareX')
                            })()
                            return
                          }
                          const opened = window.open(url, '_blank', 'noopener,noreferrer')
                          if (!opened) {
                            window.location.href = url
                          }
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
                ) : null}

                <div className="space-y-2 pt-1">
                  {shareToast ? <div className="text-[11px] text-zinc-600">{shareToast}</div> : null}

                  <div className="rounded-xl border border-white/10 bg-black/30 divide-y divide-white/10">
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            actionsDone.follow ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-black/20'
                          }`}
                          aria-hidden="true"
                        >
                          {actionsDone.follow ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-zinc-200">Follow @4626fun</div>
                          <div className="text-[11px] text-zinc-600">+{ACTION_POINTS.follow} points</div>
                        </div>
                      </div>
                      <a
                        className="btn-primary px-3 py-2 text-sm"
                        href="https://x.com/4626fun"
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => markAction('follow')}
                      >
                        {actionsDone.follow ? 'Done' : 'Follow'}
                      </a>
                    </div>

                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            actionsDone.share ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-black/20'
                          }`}
                          aria-hidden="true"
                        >
                          {actionsDone.share ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-zinc-200">Share</div>
                          <div className="text-[11px] text-zinc-600">+{ACTION_POINTS.share} points</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-accent px-3 py-2 text-sm disabled:opacity-60"
                        disabled={shareBusy}
                        onClick={() => void shareOrCompose()}
                      >
                        {shareBusy ? 'Working…' : actionsDone.share ? 'Done' : 'Share'}
                      </button>
                    </div>

                    {miniApp.isMiniApp && miniAppAddSupported !== false ? (
                      <div className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                              actionsDone.saveApp ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-black/20'
                            }`}
                            aria-hidden="true"
                          >
                            {actionsDone.saveApp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm text-zinc-200">Save Mini App</div>
                            <div className="text-[11px] text-zinc-600">+{ACTION_POINTS.saveApp} points</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-primary px-3 py-2 text-sm disabled:opacity-60"
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
                          {miniAppAddSupported === null
                            ? 'Checking…'
                            : miniApp.added === true
                              ? 'Saved'
                              : 'Save'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

