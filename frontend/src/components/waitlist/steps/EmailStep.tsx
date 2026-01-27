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
}: EmailStepProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    if (!isEmailValid) {
      onInvalidEmail()
      return
    }
    onContinue()
  }

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
        <div className="text-sm text-zinc-500">Enter your email (same one you use on Zora)</div>
      </div>

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
