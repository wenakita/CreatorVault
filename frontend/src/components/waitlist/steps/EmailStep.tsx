import { memo } from 'react'
import { motion } from 'framer-motion'
import type { RefObject } from 'react'
import type { ContactPreference, Persona, WaitlistState } from '../waitlistTypes'

type EmailStepProps = {
  persona: Persona | null
  verifiedWallet: string | null
  creatorCoin: WaitlistState['creatorCoin']
  claimCoinError: string | null
  referralCodeTaken: boolean
  claimReferralCode: string
  wantsEmail: boolean
  canUseWallet: boolean
  contactPreference: ContactPreference
  onContactPreferenceChange: (pref: ContactPreference) => void
  email: string
  emailTrimmed: string
  emailInputRef: RefObject<HTMLInputElement>
  onEmailChange: (value: string) => void
  error: string | null
  busy: boolean
  canSubmit: boolean
  isEmailValid: boolean
  onSubmit: () => void | Promise<void>
  onInvalidEmail: () => void
  onClaimReferralCodeChange: (value: string) => void
  appUrl: string
  formatUsd: (value: number | null) => string
  formatCount: (value: number | null) => string
}

export const EmailStep = memo(function EmailStep({
  persona,
  verifiedWallet,
  creatorCoin,
  claimCoinError,
  referralCodeTaken,
  claimReferralCode,
  wantsEmail,
  canUseWallet,
  contactPreference,
  onContactPreferenceChange,
  email,
  emailTrimmed,
  emailInputRef,
  onEmailChange,
  error,
  busy,
  canSubmit,
  isEmailValid,
  onSubmit,
  onInvalidEmail,
  onClaimReferralCodeChange,
  appUrl,
  formatUsd,
  formatCount,
}: EmailStepProps) {
  const isCreator = persona === 'creator'
  const showEmailInput = isCreator || wantsEmail
  return (
    <motion.div
      key="email"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.18 }}
      className="space-y-5"
    >
      <div className="headline text-2xl sm:text-3xl leading-tight">Email</div>

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
            {creatorCoin.marketCapUsd || creatorCoin.holders ? (
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
              onChange={(e) => onClaimReferralCodeChange(e.target.value)}
              placeholder="CODE"
              inputMode="text"
              autoComplete="off"
              className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 font-mono"
            />
            <button type="button" className="btn-accent" disabled={busy || !canSubmit} onClick={onSubmit}>
              Claim
            </button>
          </div>
          <div className="mt-2 text-[11px] text-zinc-700">A–Z 0–9 · 16 max</div>
        </div>
      ) : null}

      {showEmailInput ? (
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
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                if (!isEmailValid) {
                  onInvalidEmail()
                  return
                }
                onSubmit()
              }}
            />
            <div className="kbd-hint">Enter ↵</div>
          </div>
          {emailTrimmed.length > 0 && !isEmailValid ? (
            <div className="mt-2 text-xs text-amber-300/80">That doesn’t look like a valid email.</div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="text-xs text-red-400" role="status" aria-live="polite">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end pt-2">
        <button type="button" className="btn-accent" disabled={busy || !canSubmit} onClick={onSubmit}>
          {busy ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </motion.div>
  )
})
