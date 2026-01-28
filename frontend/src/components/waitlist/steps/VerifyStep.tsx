import { memo } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2 } from 'lucide-react'
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
  onSubmit,
}: VerifyStepProps) {
  const hasCreatorCoin = !!creatorCoin?.address
  const showSubmitButton = verifiedWallet && (hasCreatorCoin || creatorCoinDeclaredMissing)
  const short = (v: string) => `${v.slice(0, 6)}…${v.slice(-4)}`
  const privyCtaLabel = privyAuthed ? 'Switch sign-in' : 'Connect Wallet'
  const privyEmbeddedCtaLabel = privyAuthed ? 'Switch sign-in' : 'Sign in with Privy'
  const creatorGreeting = (creatorCoin?.symbol || creatorCoin?.name || '').trim()

  return (
    <motion.div
      key="verify"
      {...fadeUp}
      className="space-y-4"
    >
      {/* Header */}
      <motion.div {...scaleIn} className="space-y-1">
        <h1 className="text-[28px] sm:text-[32px] font-light tracking-tight text-white leading-tight">
          Connect wallet
        </h1>
      </motion.div>

      {/* Connect wallet button */}
      {showPrivyReady && !verifiedWallet ? (
        <motion.div {...scaleIn} className="space-y-3">
          <button
            type="button"
            className="group w-full flex items-center justify-center gap-3 min-h-[56px] rounded-2xl bg-[#0052FF] text-white font-medium text-[15px] px-6 py-4 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[#0047E1] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            disabled={!privyReady || privyVerifyBusy || busy}
            onClick={onPrivyContinue}
          >
            <img src={BASE_SQUARE_WHITE} alt="" className="w-3.5 h-3.5" aria-hidden="true" />
            {privyVerifyBusy ? 'Opening…' : privyCtaLabel}
          </button>
          {privyVerifyError ? (
            <motion.div {...fadeUp} className="text-[13px] text-red-400 text-center">
              {privyVerifyError}
            </motion.div>
          ) : null}
        </motion.div>
      ) : null}

      {/* Loading Creator Coin */}
      {verifiedWallet && creatorCoinBusy ? (
        <motion.div {...fadeUp} className="flex items-center justify-center gap-3 py-5">
          <div className="w-5 h-5 rounded-full border-2 border-zinc-700 border-t-[#0052FF] animate-spin" />
          <span className="text-[14px] text-zinc-400">Finding your Creator Coin…</span>
        </motion.div>
      ) : null}

      {/* Creator Coin found */}
      {verifiedWallet && hasCreatorCoin ? (
        <motion.div
          {...scaleIn}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4"
        >
          <div className="flex items-center gap-3">
            {creatorCoin.imageUrl ? (
              <img
                src={creatorCoin.imageUrl}
                alt={creatorCoin.symbol || 'Creator Coin'}
                className="w-12 h-12 rounded-xl border border-white/10 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl border border-white/10 bg-black/40 flex items-center justify-center text-[13px] text-zinc-500 font-medium">
                {creatorCoin.symbol?.slice(0, 2) || 'CC'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[15px] text-white font-medium">{creatorCoin.symbol || 'Creator Coin'}</div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-[#0052FF] shrink-0" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: baseEase }}
            className="mt-3 flex items-start gap-3"
          >
            <motion.div
              initial={{ x: -6, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.18, ease: baseEase }}
              className="mt-[5px]"
              aria-hidden="true"
            >
              <img src={BASE_SQUARE_BLUE} alt="" className="w-2.5 h-2.5" aria-hidden="true" />
            </motion.div>
            <div className="min-w-0 text-[13px] text-zinc-400 leading-relaxed">
              <span className="text-white/90">Hey {creatorGreeting || 'creator'}.</span> You’re verified — ready to deploy vaults on Base.
            </div>
          </motion.div>
        </motion.div>
      ) : null}

      {/* No Creator Coin found */}
      {/* If no Creator Coin found, we auto-continue (minimal flow). */}

      {/* Optional: 1-click deploy setup (collapsed by default) */}
      {showDeployOwnerLink ? (
        <details className="group rounded-2xl border border-zinc-800 bg-zinc-900/20">
          <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-3 min-w-0">
              <span className="inline-block w-2.5 h-2.5 rounded-[3px] bg-[#0052FF]/80" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[13px] text-zinc-200">1-click deploy</div>
                <div className="text-[12px] text-zinc-500">Optional</div>
              </div>
            </div>
            <div className="text-[12px] text-zinc-500 group-open:text-zinc-300 transition-colors">Details</div>
          </summary>
          <div className="px-4 pb-4 pt-1 space-y-3">
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between gap-3 text-zinc-500">
                <span>Smart wallet</span>
                <span className="font-mono text-zinc-300 text-[12px]">{cswAddress ? short(cswAddress) : '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-zinc-500">
                <span>Embedded</span>
                <span className="font-mono text-zinc-300 text-[12px]">{embeddedEoaAddress ? short(embeddedEoaAddress) : '—'}</span>
              </div>
            </div>

            {embeddedEoaIsOwner ? (
              <div className="flex items-center gap-2 text-[13px] text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Enabled
              </div>
            ) : (
              <div className="space-y-3">
                {!embeddedEoaAddress ? (
                  <button
                    type="button"
                    className="w-full text-[14px] font-medium px-4 py-3 rounded-xl border border-[#0052FF]/30 bg-[#0052FF]/10 text-[#0052FF] hover:bg-[#0052FF]/20 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!showPrivyReady || privyVerifyBusy || busy}
                    onClick={() => void onPrivyContinue()}
                  >
                    {privyVerifyBusy ? 'Opening…' : privyEmbeddedCtaLabel}
                  </button>
                ) : (
                  <>
                    <div className="text-[12px] text-zinc-600">Connect owner wallet:</div>
                    <ConnectButtonWeb3 />
                    {connectedOwnerAddress && connectedOwnerIsOwner === false ? (
                      <div className="text-[12px] text-amber-400">Not an owner. Try another wallet.</div>
                    ) : null}
                    <button
                      type="button"
                      className="w-full text-[14px] font-medium px-4 py-3 rounded-xl border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/50 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={
                        Boolean(busy || deployOwnerLinkBusy) ||
                        !embeddedEoaAddress ||
                        !cswAddress ||
                        !connectedOwnerAddress ||
                        connectedOwnerIsOwner === false
                      }
                      onClick={() => void onLinkEmbeddedEoaAsOwner?.()}
                    >
                      {deployOwnerLinkBusy ? 'Linking…' : 'Enable'}
                    </button>
                  </>
                )}
                {deployOwnerLinkError ? <div className="text-[12px] text-red-400">{deployOwnerLinkError}</div> : null}
              </div>
            )}
          </div>
        </details>
      ) : null}

      {/* Submit button */}
      {showSubmitButton ? (
        <motion.div {...scaleIn} className="pt-2">
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 min-h-[56px] rounded-2xl bg-[#0052FF] text-white font-medium text-[15px] px-6 py-4 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[#0047E1] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
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
