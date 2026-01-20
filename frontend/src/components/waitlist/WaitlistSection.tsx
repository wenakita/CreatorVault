import { Suspense, lazy, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { isPrivyClientEnabled } from '@/lib/flags'
import { usePrivyClientStatus } from '@/lib/privy/client'

type WaitlistResponse =
  | { success: true; data: { created: boolean; email: string } }
  | { success: false; error: string }

export type WaitlistIntent = {
  persona: 'creator' | 'user' | null
  hasCreatorCoin: boolean | null
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  // Lightweight validation: enough to prevent obvious mistakes without being overly strict.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function normalizeAddress(v: string): string {
  return v.trim()
}

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

const PrivyEmailLoginButton = lazy(async () => {
  const m = await import('./PrivyEmailLoginButton')
  return { default: m.PrivyEmailLoginButton }
})

export function WaitlistSection(props: { intent?: WaitlistIntent }) {
  const [email, setEmail] = useState('')
  const [primaryWallet, setPrimaryWallet] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneEmail, setDoneEmail] = useState<string | null>(null)
  const privyStatus = usePrivyClientStatus()
  const showPrivy = isPrivyClientEnabled()

  const emailTrimmed = useMemo(() => normalizeEmail(email), [email])
  const walletTrimmed = useMemo(() => normalizeAddress(primaryWallet), [primaryWallet])
  const walletOptionalOk = walletTrimmed.length === 0 || isValidEvmAddress(walletTrimmed)

  async function submit() {
    setError(null)

    const e = normalizeEmail(email)
    const w = normalizeAddress(primaryWallet)

    if (!isValidEmail(e)) {
      setError('Enter a valid email address.')
      return
    }
    if (w.length > 0 && !isValidEvmAddress(w)) {
      setError('Wallet address must be a valid 0x… EVM address (or leave it blank).')
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: e,
          primaryWallet: w.length > 0 ? w : null,
          intent: props.intent ?? null,
        }),
      })
      const json = (await res.json()) as WaitlistResponse
      if (!json || json.success !== true) {
        throw new Error(json && 'error' in json && json.error ? json.error : 'Waitlist request failed')
      }
      setDoneEmail(json.data.email)
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Waitlist request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="waitlist" className="cinematic-section">
      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-5">
            <span className="label">Waitlist</span>
            <h2 className="headline text-5xl leading-tight">
              Get early access
              <br />
              <span className="glow-brand">without wallet popups</span>
            </h2>
            <p className="text-zinc-600 text-sm font-light max-w-xl">
              Join the waitlist. We’ll notify you when onboarding opens. Optional: add the wallet you want to link later.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-900/70 bg-black/30 backdrop-blur-sm p-6">
            {doneEmail ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-zinc-200">
                  <CheckCircle2 className="w-5 h-5 text-brand-primary" />
                  <div className="text-sm">
                    You’re on the waitlist as <span className="font-mono text-zinc-100">{doneEmail}</span>.
                  </div>
                </div>
                <div className="text-[11px] text-zinc-700">
                  We’ll reach out when onboarding opens.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {showPrivy ? (
                  <div className="space-y-3">
                    {privyStatus === 'ready' ? (
                      <Suspense
                        fallback={
                          <button className="btn-primary w-full opacity-60 cursor-not-allowed" disabled>
                            Continue with email
                          </button>
                        }
                      >
                        <PrivyEmailLoginButton
                          prefillEmail={emailTrimmed || undefined}
                          onAutofill={({ email: e, wallet }) => {
                            if (typeof e === 'string' && e.trim()) setEmail(e)
                            if (typeof wallet === 'string' && wallet.trim() && primaryWallet.trim().length === 0) {
                              setPrimaryWallet(wallet)
                            }
                            setError(null)
                          }}
                          onError={(msg) => setError(msg)}
                        />
                      </Suspense>
                    ) : (
                      <button className="btn-primary w-full opacity-60 cursor-not-allowed" disabled>
                        Continue with email
                      </button>
                    )}

                    <div className="flex items-center gap-3">
                      <div className="h-px bg-white/10 flex-1" />
                      <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-700">or</div>
                      <div className="h-px bg-white/10 flex-1" />
                    </div>
                  </div>
                ) : null}

                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-2">Email</div>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    inputMode="email"
                    autoComplete="email"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  />
                  {emailTrimmed.length > 0 && !isValidEmail(emailTrimmed) ? (
                    <div className="mt-2 text-xs text-amber-300/80">That doesn’t look like a valid email.</div>
                  ) : null}
                </div>

                <div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-2">
                      Primary wallet (optional)
                    </div>
                    <div className="text-[10px] text-zinc-700 mb-2">0x…</div>
                  </div>
                  <input
                    value={primaryWallet}
                    onChange={(e) => setPrimaryWallet(e.target.value)}
                    placeholder="0x0000000000000000000000000000000000000000"
                    inputMode="text"
                    autoComplete="off"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  />
                  {!walletOptionalOk ? (
                    <div className="mt-2 text-xs text-amber-300/80">Must be a valid 0x… address (or leave blank).</div>
                  ) : null}
                  <div className="mt-2 text-xs text-zinc-700">
                    If you provide this, we’ll ask you to prove ownership later (a signature) before using it.
                  </div>
                </div>

                {error ? <div className="text-xs text-red-400">{error}</div> : null}

                <button
                  onClick={submit}
                  disabled={busy || !isValidEmail(emailTrimmed) || !walletOptionalOk}
                  className="btn-accent disabled:opacity-50 disabled:cursor-not-allowed w-full"
                >
                  {busy ? 'Joining…' : 'Join waitlist'}
                </button>

                <div className="text-[11px] text-zinc-700">
                  By joining, you agree we can email you about CreatorVault launches and onboarding.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

