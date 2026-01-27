import { memo } from 'react'
import { motion } from 'framer-motion'

type EmailStepProps = {
  error: string | null
  busy: boolean
  // Privy props
  showPrivy?: boolean
  privyReady?: boolean
  privyAuthenticated?: boolean
  privyVerifyBusy?: boolean
  privyVerifyError?: string | null
  onPrivyLogin?: () => void
}

export const EmailStep = memo(function EmailStep({
  error,
  busy,
  showPrivy,
  privyReady,
  privyAuthenticated,
  privyVerifyBusy,
  privyVerifyError,
  onPrivyLogin,
}: EmailStepProps) {
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
      <div className="space-y-2 text-center">
        <div className="headline text-2xl sm:text-3xl leading-tight">Join the waitlist</div>
        <div className="text-sm text-zinc-500">Sign in with your Zora account to continue</div>
      </div>

      {/* Privy login */}
      {showPrivyLogin ? (
        <div className="space-y-3 pt-2">
          <button
            type="button"
            className="w-full min-h-[56px] rounded-xl border border-brand-primary/30 bg-brand-primary/20 text-zinc-100 font-medium text-lg px-4 py-4 transition-colors hover:bg-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={privyVerifyBusy || busy}
            onClick={onPrivyLogin}
          >
            {privyVerifyBusy ? 'Opening…' : 'Sign in'}
          </button>
          {privyVerifyError ? <div className="text-xs text-red-400 text-center">{privyVerifyError}</div> : null}
        </div>
      ) : null}

      {!showPrivy || !privyReady ? (
        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-sm text-zinc-500">
          Loading...
        </div>
      ) : null}

      {error ? (
        <div className="text-xs text-red-400 text-center" role="status" aria-live="polite">
          {error}
        </div>
      ) : null}
    </motion.div>
  )
})
