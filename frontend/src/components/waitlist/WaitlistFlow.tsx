import { AnimatePresence, motion } from 'framer-motion'
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
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

type Persona = 'creator' | 'user'
type Variant = 'page' | 'embedded'

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
  const [siwfBusy, setSiwfBusy] = useState(false)
  const [siwfError, setSiwfError] = useState<string | null>(null)
  const [useWalletSig, setUseWalletSig] = useState(false)
  const [walletSigStarted, setWalletSigStarted] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareToast, setShareToast] = useState<string | null>(null)
  const [userWallet, setUserWallet] = useState('')
  const [showUserWallet, setShowUserWallet] = useState(false)

  const emailInputRef = useRef<HTMLInputElement | null>(null)

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

      const res = await apiFetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email,
          primaryWallet: primaryWalletForSubmit(),
          intent: {
            persona,
            fid: verifiedFid,
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
    setSiwfBusy(false)
    setSiwfError(null)
    setUseWalletSig(false)
    setWalletSigStarted(false)
    setUserWallet('')
    setShowUserWallet(false)
  }

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

  async function startSiwf() {
    setSiwfError(null)
    setSiwfBusy(true)
    try {
      const res = await apiFetch('/api/farcaster/nonce', {
        headers: { Accept: 'application/json' },
        withCredentials: true,
      })
      const json = (await res.json().catch(() => null)) as any
      const nonce = typeof json?.data?.nonce === 'string' ? json.data.nonce : ''
      if (!res.ok || !json?.success || !nonce) {
        const msg =
          json?.error ||
          (res.ok ? 'Failed to start Farcaster sign-in (missing nonce)' : `Failed to start Farcaster sign-in (HTTP ${res.status})`)
        throw new Error(msg)
      }
      setSiwfNonce(nonce)
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
        body: JSON.stringify({ message: siwfMessage, signature: siwfSignature }),
        withCredentials: true,
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

  const shareUrl = useMemo(() => 'https://4626.fun', [])

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
    try {
      if (miniApp.isMiniApp) {
        try {
          const { sdk } = await import('@farcaster/miniapp-sdk')
          if (sdk?.actions?.composeCast) {
            await sdk.actions.composeCast({
              text: 'Creator vaults on Base — join the waitlist',
              embeds: [shareUrl],
            } as any)
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
          text: 'Creator vaults on Base — join the waitlist',
          url: shareUrl,
        })
        setShareToast('Shared.')
        return
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        setShareToast('Link copied.')
        return
      }

      setShareToast('Open: 4626.fun')
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
            <div className="headline text-4xl sm:text-5xl leading-tight">Get early access</div>
            <div className="text-sm text-zinc-600 font-light">
              Users: email only. Creators: verify first, then email — so we can prioritize onboarding.
            </div>
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
                <div className="headline text-2xl sm:text-3xl leading-tight">Step 1: Select</div>
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
                    <div className="mt-1 text-sm text-zinc-600 font-light">Launching a vault for my CreatorCoin.</div>
                    <div className="mt-2 text-[11px] text-zinc-700">Requires verification before email.</div>
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
                    <div className="mt-1 text-sm text-zinc-600 font-light">Participating in creator vaults.</div>
                    <div className="mt-2 text-[11px] text-zinc-700">Email only.</div>
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
                <div className="headline text-2xl sm:text-3xl leading-tight">Verify identity</div>
                <div className="text-sm text-zinc-600 font-light">
                  Creators verify before joining so we can prioritize onboarding and reduce spam.
                </div>

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
                      Use wallet signature instead
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
                    <button
                      type="button"
                      className="w-full text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                      onClick={() => {
                        setUseWalletSig(false)
                        setWalletSigStarted(false)
                      }}
                    >
                      Back to Farcaster
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
                <div className="headline text-2xl sm:text-3xl leading-tight">Add your email</div>
                <div className="text-sm text-zinc-600 font-light">
                  {persona === 'creator' ? 'We’ll email you when creator onboarding opens.' : 'We’ll email you when onboarding opens.'}
                </div>

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
                        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600 mb-2">Primary wallet</div>
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
                          <div className="mt-2 text-xs text-zinc-700">We’ll ask you to prove ownership later before using it.</div>
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
                  <div className="headline text-2xl sm:text-3xl leading-tight">You’re in.</div>
                </motion.div>
                <div className="text-sm text-zinc-600 font-light">
                  {doneEmail ? (
                    <>
                      We’ll email <span className="font-mono text-zinc-300">{doneEmail}</span> when onboarding opens.
                    </>
                  ) : (
                    <>We’ll email you when onboarding opens.</>
                  )}
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                      onClick={resetFlow}
                    >
                      Start over
                    </button>
                    {shareToast ? <div className="text-[11px] text-zinc-600">{shareToast}</div> : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <a className="btn-primary w-full text-center" href="https://x.com/4626fun" target="_blank" rel="noreferrer">
                      Follow @4626fun
                    </a>
                    <button type="button" className="btn-accent w-full" disabled={shareBusy} onClick={() => void shareOrCompose()}>
                      {shareBusy ? 'Working…' : 'Share'}
                    </button>
                  </div>

                  {miniApp.isMiniApp && miniAppAddSupported !== false ? (
                    <button
                      type="button"
                      className="w-full text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-60"
                      disabled={shareBusy || miniAppAddSupported === null}
                      onClick={() => void addMiniApp()}
                      title={miniAppAddSupported === null ? 'Checking host capabilities…' : 'Add this Mini App to your list'}
                    >
                      {miniAppAddSupported === null ? 'Checking Mini App support…' : 'Add to Mini Apps'}
                    </button>
                  ) : (
                    <div className="text-[11px] text-zinc-700">
                      Tip: bookmark <span className="font-mono text-zinc-500">4626.fun</span> so you can come back fast.
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

