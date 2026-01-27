import { memo } from 'react'
import { motion } from 'framer-motion'
import type { RefObject } from 'react'

type EmailStepProps = {
  email: string
  emailTrimmed: string
  emailInputRef: RefObject<HTMLInputElement>
  onEmailChange: (value: string) => void
  error: string | null
  busy: boolean
  isEmailValid: boolean
  onContinue: () => void
  onInvalidEmail: () => void
  // Privy props
  showPrivy?: boolean
  privyReady?: boolean
  privyAuthenticated?: boolean
  privyVerifyBusy?: boolean
  privyVerifyError?: string | null
  onPrivyLogin?: () => void
}

export const EmailStep = memo(function EmailStep({
  email,
  emailTrimmed,
  emailInputRef,
  onEmailChange,
  error,
  busy,
  isEmailValid,
  onContinue,
  onInvalidEmail,
  showPrivy,
  privyReady,
  privyAuthenticated,
  privyVerifyBusy,
  privyVerifyError,
  onPrivyLogin,
}: EmailStepProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    if (!isEmailValid) {
      onInvalidEmail()
      return
    }
    onContinue()
  }

  const showPrivyLogin = showPrivy && privyReady && !privyAuthenticated && onPrivyLogin

  return (
    <motion.div
      key="email"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.18 }}
      className="space-y-5"
    >
      <div className="space-y-1">
        <div className="headline text-2xl sm:text-3xl leading-tight">Join the waitlist</div>
        <div className="text-sm text-zinc-500">Sign in or enter your email to continue</div>
      </div>

      {/* Privy login buttons */}
      {showPrivyLogin ? (
        <div className="space-y-3">
          <button
            type="button"
            className="w-full min-h-[52px] rounded-xl border border-brand-primary/30 bg-brand-primary/20 text-zinc-100 font-medium px-4 py-3.5 transition-colors hover:bg-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={privyVerifyBusy || busy}
            onClick={onPrivyLogin}
          >
            {privyVerifyBusy ? 'Opening…' : 'Sign in'}
          </button>
          <div className="text-[11px] text-zinc-500 text-center">Email, Google, Farcaster, X, or Apple</div>
          {privyVerifyError ? <div className="text-xs text-red-400 text-center">{privyVerifyError}</div> : null}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-zinc-500">or enter email manually</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
        </div>
      ) : null}

      <div>
        <div className="flex items-center gap-3">
          <input
            ref={emailInputRef}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="you@domain.com"
            inputMode="email"
            autoComplete="email"
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            onKeyDown={handleKeyDown}
            disabled={busy}
          />
          <div className="kbd-hint">Enter ↵</div>
        </div>
        {emailTrimmed.length > 0 && !isEmailValid ? (
          <div className="mt-2 text-xs text-amber-300/80">That doesn't look like a valid email.</div>
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
          disabled={busy || !isEmailValid}
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </motion.div>
  )
})
