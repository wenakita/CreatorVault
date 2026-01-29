import { memo, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronRight, Mail, ShieldCheck, Wallet, X } from 'lucide-react'
import type { WaitlistState } from '../waitlistTypes'
import { ConnectButtonWeb3 } from '@/components/ConnectButtonWeb3'

// Base brand motion: cubic-bezier(0.4, 0, 0.2, 1), 120-240ms for snappy UI
const baseEase = [0.4, 0, 0.2, 1] as const
const BASE_SQUARE_BLUE = '/base/1_Base%20Brand%20Assets/The%20Square/Base_square_blue.svg'
const BASE_SQUARE_WHITE = '/base/1_Base%20Brand%20Assets/The%20Square/Base_square_white.svg'
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: baseEase },
}
const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.18, ease: baseEase },
}

type VerifyStepProps = {
  verifiedWallet: string | null
  showPrivy: boolean
  showPrivyReady: boolean
  privyReady: boolean
  privyAuthed: boolean
  privyVerifyBusy: boolean
  privyVerifyError: string | null
  // Optional: enable 1-click deploy by linking Privy embedded EOA as an owner of a Coinbase Smart Wallet
  showDeployOwnerLink?: boolean
  deployOwnerLinkBusy?: boolean
  deployOwnerLinkError?: string | null
  cswAddress?: string | null
  embeddedEoaAddress?: string | null
  connectedOwnerAddress?: string | null
  embeddedEoaIsOwner?: boolean | null
  connectedOwnerIsOwner?: boolean | null
  onLinkEmbeddedEoaAsOwner?: () => void | Promise<void>
  // Auto-fetched Creator Coin
  creatorCoin: WaitlistState['creatorCoin']
  creatorCoinDeclaredMissing: boolean
  creatorCoinBusy: boolean
  // Submission
  busy: boolean
  canSubmit: boolean
  onPrivyContinue: () => void
  onPrivyEmailContinue?: () => void
  onFallbackSignIn?: () => void | Promise<void>
  onSubmit: () => void | Promise<void>
}

export const VerifyStep = memo(function VerifyStep({
  verifiedWallet,
  showPrivy,
  showPrivyReady,
  privyReady,
  privyAuthed,
  privyVerifyBusy,
  privyVerifyError,
  showDeployOwnerLink,
  deployOwnerLinkBusy,
  deployOwnerLinkError,
  cswAddress,
  embeddedEoaAddress,
  connectedOwnerAddress,
  embeddedEoaIsOwner,
  connectedOwnerIsOwner,
  onLinkEmbeddedEoaAsOwner,
  creatorCoin,
  creatorCoinDeclaredMissing,
  creatorCoinBusy,
  busy,
  canSubmit,
  onPrivyContinue,
  onPrivyEmailContinue,
  onFallbackSignIn,
  onSubmit,
}: VerifyStepProps) {
  const hasCreatorCoin = !!creatorCoin?.address
  const showSubmitButton = verifiedWallet && (hasCreatorCoin || creatorCoinDeclaredMissing)
  const short = (v: string) => `${v.slice(0, 6)}…${v.slice(-4)}`
  const privyCtaLabel = privyAuthed ? 'Switch sign-in' : 'Connect Wallet'
  const privyEmbeddedCtaLabel = privyAuthed ? 'Switch sign-in' : 'Sign in with Privy'
  const creatorGreeting = (creatorCoin?.symbol || '').trim()
  const headerTitle = !verifiedWallet ? 'Connect wallet' : showSubmitButton ? 'Join the waitlist' : 'Checking your wallet'
  const headerSubtitle = !verifiedWallet
    ? 'Use a wallet connected to your creator coin. We’ll look it up automatically.'
    : showSubmitButton
      ? 'Welcome — you’re all set. Join the waitlist for early access updates.'
      : 'One moment…'
  const looksLikeWalletLoginDisabled =
    typeof privyVerifyError === 'string' && /wallet (login|sign-in) is not enabled|wallet sign-in isn’t available/i.test(privyVerifyError)
  const [showTrouble, setShowTrouble] = useState(false)
  const canContinue = showPrivyReady && privyReady && !privyVerifyBusy && !busy

  const helperText = useMemo(() => {
    if (privyVerifyBusy) return 'Opening…'
    if (!showPrivyReady) return 'Privy is not ready.'
    if (!privyReady) return 'Loading…'
    return 'No transaction. ~10 seconds.'
  }, [privyReady, privyVerifyBusy, showPrivyReady])

  return (
    <motion.div
      key="verify"
      {...fadeUp}
      className="space-y-5"
    >
      {/* Header */}
      <motion.div {...scaleIn} className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h1 className="text-[30px] sm:text-[34px] font-light tracking-tight text-white leading-[1.08]">
            {headerTitle}
          </h1>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
            No gas
          </div>
        </div>
        <div className="text-[13px] text-zinc-500 leading-relaxed">{headerSubtitle}</div>
      </motion.div>

      {/* Single primary CTA + progressive disclosure */}
      {!verifiedWallet ? (
        <motion.div {...scaleIn} className="space-y-3.5">
          <button
            type="button"
            className="group w-full flex items-center justify-between gap-3 min-h-[58px] rounded-2xl bg-[#0052FF] text-white font-medium text-[15px] px-5 py-4 shadow-[0_10px_30px_-16px_rgba(0,82,255,0.8)] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[#0047E1] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            disabled={!canContinue}
            onClick={() => {
              if (looksLikeWalletLoginDisabled && typeof onPrivyEmailContinue === 'function') {
                onPrivyEmailContinue()
              } else {
                onPrivyContinue()
              }
            }}
          >
            <span className="flex items-center gap-3">
              <img src={BASE_SQUARE_WHITE} alt="" className="w-3.5 h-3.5" aria-hidden="true" />
              Continue
            </span>
            <ChevronRight className="w-4 h-4 opacity-90" />
          </button>

          <div className="flex items-center justify-between">
            <div className="text-[12px] text-zinc-500">{helperText}</div>
            <button
              type="button"
              className="text-[12px] text-zinc-400 hover:text-zinc-200 transition-colors"
              onClick={() => setShowTrouble(true)}
            >
              Having trouble?
            </button>
          </div>

          {privyVerifyError ? (
            <motion.div
              {...fadeUp}
              className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[12px] text-red-200/90"
            >
              {privyVerifyError}
            </motion.div>
          ) : null}
        </motion.div>
      ) : null}

      {/* Trouble sheet */}
      <AnimatePresence>
        {showTrouble ? (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: baseEase }}
              onClick={() => setShowTrouble(false)}
            />
            <motion.div
              className="fixed left-0 right-0 bottom-0 z-50"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.2, ease: baseEase }}
            >
              <div className="mx-auto w-full max-w-[440px] px-4 pb-4">
                <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/90 backdrop-blur-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[12px] text-zinc-500">Having trouble?</div>
                      <div className="text-[16px] text-white mt-1">Try another option</div>
                    </div>
                    <button
                      type="button"
                      className="rounded-xl border border-zinc-800 bg-black/30 p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
                      onClick={() => setShowTrouble(false)}
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {looksLikeWalletLoginDisabled ? (
                    <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-200/90">
                      Wallet sign-in is disabled for this Privy app. Enable Wallet login in Privy to link Base Account.
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-2">
                    <div className="rounded-2xl border border-zinc-800/70 bg-black/20 px-4 py-3">
                      <div className="flex items-center gap-2 text-[12px] text-zinc-300">
                        <Wallet className="w-4 h-4 text-zinc-500" />
                        Use Coinbase Wallet / WalletConnect
                      </div>
                      <div className="mt-3">
                        <ConnectButtonWeb3 />
                      </div>
                      {onFallbackSignIn ? (
                        <button
                          type="button"
                          className="mt-3 w-full rounded-xl border border-zinc-800 bg-black/30 px-4 py-3 text-[13px] text-zinc-200 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/40 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50"
                          disabled={busy}
                          onClick={() => void onFallbackSignIn()}
                        >
                          Sign in (no transaction)
                        </button>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-zinc-800/70 bg-black/20 px-4 py-3">
                      <div className="flex items-center gap-2 text-[12px] text-zinc-300">
                        <Mail className="w-4 h-4 text-zinc-500" />
                        Continue with email
                      </div>
                      <div className="text-[11px] text-zinc-600 mt-1">
                        Useful if wallet popups are blocked. Deploy still requires Wallet login enabled in Privy.
                      </div>
                      <button
                        type="button"
                        className="mt-3 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-[13px] text-zinc-200 hover:text-white hover:border-white/20 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50"
                        disabled={busy || privyVerifyBusy || typeof onPrivyEmailContinue !== 'function'}
                        onClick={() => void onPrivyEmailContinue?.()}
                      >
                        Continue with email
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {/* Loading Creator Coin */}
      {verifiedWallet && creatorCoinBusy ? (
        <motion.div {...fadeUp} className="flex items-center justify-center gap-3 py-5">
          <div className="w-5 h-5 rounded-full border-2 border-zinc-700 border-t-[#0052FF] animate-spin" />
          <span className="text-[14px] text-zinc-400">Finding your Creator Coin…</span>
        </motion.div>
      ) : null}

      {/* Verified summary (fills the empty state) */}
      {verifiedWallet && (hasCreatorCoin || creatorCoinDeclaredMissing) ? (
        <motion.div {...scaleIn} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Ready</div>
              <div className="text-[16px] text-white mt-1">Review & join</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="flex items-center gap-3">
              {creatorCoin?.imageUrl ? (
                <img
                  src={creatorCoin.imageUrl}
                  alt={creatorCoin.symbol || 'Creator Coin'}
                  className="w-12 h-12 rounded-2xl border border-white/10 object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl border border-white/10 bg-black/40 flex items-center justify-center text-[13px] text-zinc-500 font-medium">
                  {(creatorCoin?.symbol || 'CC').slice(0, 2)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[14px] text-white font-medium truncate">
                  {creatorCoin?.symbol ? creatorCoin.symbol : creatorCoinDeclaredMissing ? 'No coin found' : 'Creator Coin'}
                </div>
                <div className="text-[12px] text-zinc-500 truncate">
                  {creatorCoin?.symbol ? 'Creator coin detected' : 'You can still join.'}
                </div>
              </div>
              {creatorCoin?.symbol ? <CheckCircle2 className="w-5 h-5 text-[#0052FF] shrink-0" /> : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[12px] text-zinc-500">Wallet</div>
                <div className="text-[12px] text-zinc-300 font-mono">{short(verifiedWallet)}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-[12px] text-zinc-500">Network</div>
                <div className="text-[12px] text-zinc-300">Base</div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* No Creator Coin found */}
      {/* If no Creator Coin found, we auto-continue (minimal flow). */}

      {/* Link CSW to Privy - Required for vault deployment */}
      {showDeployOwnerLink ? (
        <motion.div {...scaleIn} className="rounded-2xl border-2 border-[#0052FF]/30 bg-[#0052FF]/5 p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-5 h-5 text-[#0052FF]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] text-white font-medium">Link Smart Wallet</div>
              <div className="text-[12px] text-zinc-500 mt-0.5">
                Required to deploy vaults from your CSW
              </div>
            </div>
          </div>

          <div className="space-y-2 text-[13px] rounded-xl bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3 text-zinc-500">
              <span>Your CSW</span>
              <span className="font-mono text-zinc-300 text-[12px]">{cswAddress ? short(cswAddress) : '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-zinc-500">
              <span>Privy wallet</span>
              <span className="font-mono text-zinc-300 text-[12px]">{embeddedEoaAddress ? short(embeddedEoaAddress) : '—'}</span>
            </div>
          </div>

          {embeddedEoaIsOwner ? (
            <div className="flex items-center gap-2 text-[13px] text-emerald-400 bg-emerald-500/10 rounded-xl px-3 py-2">
              <CheckCircle2 className="w-4 h-4" />
              Linked — ready for deployment
            </div>
          ) : (
            <div className="space-y-3">
              {!embeddedEoaAddress ? (
                <button
                  type="button"
                  className="w-full text-[14px] font-medium px-4 py-3 rounded-xl bg-[#0052FF] text-white hover:bg-[#0047E1] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!showPrivyReady || privyVerifyBusy || busy}
                  onClick={() => void onPrivyContinue()}
                >
                  {privyVerifyBusy ? 'Opening…' : 'Sign in with Privy'}
                </button>
              ) : (
                <>
                  <div className="text-[12px] text-zinc-400">
                    Connect an owner wallet of your CSW to authorize:
                  </div>
                  <ConnectButtonWeb3 />
                  {connectedOwnerAddress && connectedOwnerIsOwner === false ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-200/90">
                      This wallet is not an owner of your CSW. Try another.
                    </div>
                  ) : null}
                  {connectedOwnerAddress && connectedOwnerIsOwner !== false ? (
                    <button
                      type="button"
                      className="w-full text-[14px] font-medium px-4 py-3 rounded-xl bg-[#0052FF] text-white hover:bg-[#0047E1] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={
                        Boolean(busy || deployOwnerLinkBusy) ||
                        !embeddedEoaAddress ||
                        !cswAddress ||
                        !connectedOwnerAddress
                      }
                      onClick={() => void onLinkEmbeddedEoaAsOwner?.()}
                    >
                      {deployOwnerLinkBusy ? 'Linking…' : 'Link Wallet'}
                    </button>
                  ) : null}
                </>
              )}
              {deployOwnerLinkError ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-[12px] text-red-200/90">
                  {deployOwnerLinkError}
                </div>
              ) : null}
            </div>
          )}
        </motion.div>
      ) : null}

      {/* Submit button */}
      {showSubmitButton ? (
        <motion.div {...scaleIn} className="pt-2">
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 min-h-[58px] rounded-2xl bg-[#0052FF] text-white font-medium text-[15px] px-6 py-4 shadow-[0_10px_30px_-16px_rgba(0,82,255,0.8)] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[#0047E1] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            disabled={busy || !canSubmit}
            onClick={onSubmit}
          >
            {busy ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Joining…
              </>
            ) : (
              'Join Waitlist'
            )}
          </button>
          <div className="mt-3 text-center text-[12px] text-zinc-600">
            Takes ~10 seconds. No transaction.
          </div>
        </motion.div>
      ) : null}

      {!showPrivy ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-center text-[13px] text-zinc-500">
          Wallet login unavailable
        </div>
      ) : null}
    </motion.div>
  )
})
