import { memo } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, Wallet } from 'lucide-react'
import type { WaitlistState } from '../waitlistTypes'
import { ConnectButtonWeb3 } from '@/components/ConnectButtonWeb3'

// Base brand motion: cubic-bezier(0.4, 0, 0.2, 1), 120-240ms for snappy UI
const baseEase = [0.4, 0, 0.2, 1] as const
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
  zoraProfileExists?: boolean | null
  // Auto-fetched Creator Coin
  creatorCoin: WaitlistState['creatorCoin']
  creatorCoinDeclaredMissing: boolean
  creatorCoinBusy: boolean
  // Submission
  busy: boolean
  canSubmit: boolean
  onSignOutWallet: () => void | Promise<void>
  onNoCreatorCoin: () => void
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
  zoraProfileExists,
  creatorCoin,
  creatorCoinDeclaredMissing,
  creatorCoinBusy,
  busy,
  canSubmit,
  onSignOutWallet,
  onNoCreatorCoin,
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
      className="space-y-5"
    >
      {/* Header */}
      <motion.div {...scaleIn} className="space-y-2">
        <h1 className="text-[28px] sm:text-[32px] font-light tracking-tight text-white leading-tight">
          Connect wallet
        </h1>
        <p className="text-[15px] text-zinc-500 font-light">
          Link the wallet on your Zora profile
        </p>
      </motion.div>

      {/* Wallet connected state */}
      {verifiedWallet && (hasCreatorCoin || creatorCoinBusy) ? (
        <motion.div
          {...scaleIn}
          className="flex items-center gap-3 rounded-2xl border border-[#0052FF]/20 bg-[#0052FF]/5 px-4 py-3.5"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0052FF]/10 border border-[#0052FF]/20 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-[#0052FF]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] text-white font-medium">Connected</div>
            <div className="text-[13px] text-zinc-500 font-mono">
              {verifiedWallet.slice(0, 6)}…{verifiedWallet.slice(-4)}
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* Connect wallet button */}
      {showPrivyReady && !verifiedWallet ? (
        <motion.div {...scaleIn} className="space-y-3">
          <button
            type="button"
            className="group w-full flex items-center justify-center gap-3 min-h-[56px] rounded-2xl bg-[#0052FF] text-white font-medium text-[15px] px-6 py-4 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[#0047E1] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            disabled={!privyReady || privyVerifyBusy || busy}
            onClick={onPrivyContinue}
          >
            <Wallet className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
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
        <motion.div {...fadeUp} className="flex items-center justify-center gap-3 py-6">
          <div className="w-5 h-5 rounded-full border-2 border-zinc-700 border-t-[#0052FF] animate-spin" />
          <span className="text-[14px] text-zinc-400">Looking up your Creator Coin…</span>
        </motion.div>
      ) : null}

      {/* Creator Coin found */}
      {verifiedWallet && hasCreatorCoin ? (
        <motion.div
          {...scaleIn}
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"
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
              <div className="text-[13px] text-emerald-400">Verified</div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          </div>
          <div className="mt-3 rounded-2xl border border-[#0052FF]/15 bg-gradient-to-b from-[#0052FF]/10 via-black/30 to-black/20 px-4 py-3.5">
            <div className="flex items-start gap-3">
              {/* Base-inspired square motif */}
              <div className="mt-0.5 w-3 h-3 rounded-[3px] bg-[#0052FF]" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-medium">
                  Verified
                </div>
                <div className="mt-1 text-[15px] text-white/95 leading-snug">
                  Hey <span className="text-white font-medium">{creatorGreeting || 'creator'}</span>.
                </div>
                <div className="mt-1 text-[13px] text-zinc-400 leading-relaxed">
                  Welcome to <span className="text-white/90 font-medium">4626.fun</span>. You’re cleared to deploy vaults on Base.
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* No Creator Coin found */}
      {verifiedWallet && !creatorCoinBusy && !hasCreatorCoin ? (
        <motion.div {...fadeUp} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
          <div>
            <div className="text-[15px] text-white font-medium">
              {zoraProfileExists === false ? 'No Zora account' : 'No Creator Coin'}
            </div>
            <p className="text-[13px] text-zinc-500 mt-1 leading-relaxed">
              {zoraProfileExists === false
                ? 'Create a Zora account to continue.'
                : 'You can still join the waitlist.'}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {zoraProfileExists === false ? (
              <a
                href="https://zora.co"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center text-[14px] font-medium px-4 py-3 rounded-xl bg-[#0052FF] text-white hover:bg-[#0047E1] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.98]"
              >
                Create Zora account
              </a>
            ) : null}
            <button
              type="button"
              className="text-[14px] font-medium px-4 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/50 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
              onClick={onSignOutWallet}
            >
              Try different wallet
            </button>
            {zoraProfileExists !== false ? (
              <button
                type="button"
                className="text-[14px] font-medium px-4 py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/50 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onNoCreatorCoin}
                disabled={creatorCoinDeclaredMissing}
              >
                {creatorCoinDeclaredMissing ? 'Continuing without coin' : 'Continue anyway'}
              </button>
            ) : null}
          </div>
        </motion.div>
      ) : null}

      {/* Optional: 1-click deploy setup */}
      {showDeployOwnerLink ? (
        <motion.div {...fadeUp} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-600 font-medium">1-click deploy</div>
            <p className="text-[13px] text-zinc-500 mt-1">
              Link your embedded wallet for seamless deploys.
            </p>
          </div>

          <div className="space-y-2 text-[13px]">
            <div className="flex items-center justify-between gap-3 text-zinc-500">
              <span>Smart wallet</span>
              <span className="font-mono text-zinc-300 text-[12px]">{cswAddress ? short(cswAddress) : '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-zinc-500">
              <span>Embedded</span>
              <span className="font-mono text-zinc-300 text-[12px]">
                {embeddedEoaAddress ? short(embeddedEoaAddress) : '—'}
              </span>
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
                    {deployOwnerLinkBusy ? 'Linking…' : 'Enable 1-click deploy'}
                  </button>
                </>
              )}
              {deployOwnerLinkError ? <div className="text-[12px] text-red-400">{deployOwnerLinkError}</div> : null}
            </div>
          )}
        </motion.div>
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
