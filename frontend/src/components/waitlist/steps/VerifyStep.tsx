import { memo } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2 } from 'lucide-react'
import type { WaitlistState } from '../waitlistTypes'

type VerifyStepProps = {
  verifiedWallet: string | null
  showPrivy: boolean
  showPrivyReady: boolean
  privyReady: boolean
  privyVerifyBusy: boolean
  privyVerifyError: string | null
  // Auto-fetched Creator Coin
  creatorCoin: WaitlistState['creatorCoin']
  creatorCoinBusy: boolean
  // Submission
  busy: boolean
  canSubmit: boolean
  onSignOutWallet: () => void | Promise<void>
  onPrivyContinue: () => void
  onSubmit: () => void | Promise<void>
}

export const VerifyStep = memo(function VerifyStep({
  verifiedWallet,
  showPrivy,
  showPrivyReady,
  privyReady,
  privyVerifyBusy,
  privyVerifyError,
  creatorCoin,
  creatorCoinBusy,
  busy,
  canSubmit,
  onSignOutWallet,
  onPrivyContinue,
  onSubmit,
}: VerifyStepProps) {
  const hasCreatorCoin = !!creatorCoin?.address
  const showSubmitButton = verifiedWallet && hasCreatorCoin

  return (
    <motion.div
      key="verify"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.18 }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <div className="headline text-2xl sm:text-3xl leading-tight">Connect wallet</div>
        <div className="text-sm text-zinc-500">
          Connect the wallet linked to your Zora profile
        </div>
      </div>

      {/* Wallet connection status */}
      {verifiedWallet ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-zinc-200">Wallet connected</div>
            <div className="text-xs text-zinc-500 font-mono truncate">
              {verifiedWallet.slice(0, 6)}…{verifiedWallet.slice(-4)}
            </div>
          </div>
          {!hasCreatorCoin && !creatorCoinBusy ? (
            <button
              type="button"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              onClick={onSignOutWallet}
            >
              Change
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Connect wallet button */}
      {showPrivyReady && !verifiedWallet ? (
        <div className="space-y-2">
          <button
            type="button"
            className="w-full min-h-[52px] rounded-xl border border-brand-primary/30 bg-brand-primary/20 text-zinc-100 font-medium px-4 py-3.5 transition-colors hover:bg-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!privyReady || privyVerifyBusy || busy}
            onClick={onPrivyContinue}
          >
            {privyVerifyBusy ? 'Opening…' : 'Connect Wallet'}
          </button>
          {privyVerifyError ? <div className="text-xs text-red-400 text-center">{privyVerifyError}</div> : null}
          <div className="text-[11px] text-zinc-500 text-center">WalletConnect only</div>
        </div>
      ) : null}

      {/* Loading Creator Coin */}
      {verifiedWallet && creatorCoinBusy ? (
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
          <span className="text-sm text-zinc-500">Looking up your Creator Coin...</span>
        </div>
      ) : null}

      {/* Creator Coin found */}
      {verifiedWallet && hasCreatorCoin ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-3">
            {creatorCoin.imageUrl ? (
              <img
                src={creatorCoin.imageUrl}
                alt={creatorCoin.symbol || 'Creator Coin'}
                className="w-10 h-10 rounded-lg border border-white/10 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg border border-white/10 bg-black/30 flex items-center justify-center text-xs text-zinc-500">
                {creatorCoin.symbol?.slice(0, 2) || 'CC'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm text-zinc-200 font-medium">{creatorCoin.symbol || 'Creator Coin'}</div>
              <div className="text-xs text-emerald-400">Creator Coin found</div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          </div>
        </div>
      ) : null}

      {/* No Creator Coin found */}
      {verifiedWallet && !creatorCoinBusy && !hasCreatorCoin ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="text-sm text-amber-300/90">No Creator Coin found</div>
          <div className="text-xs text-zinc-500 mt-1">
            This wallet doesn't have a Creator Coin on Zora. Try connecting a different wallet.
          </div>
        </div>
      ) : null}

      {/* Submit button */}
      {showSubmitButton ? (
        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            className="btn-accent"
            disabled={busy || !canSubmit}
            onClick={onSubmit}
          >
            {busy ? 'Submitting…' : 'Join Waitlist'}
          </button>
        </div>
      ) : null}

      {!showPrivy ? (
        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-[11px] text-zinc-500">
          Wallet login is unavailable. Enable Privy to continue.
        </div>
      ) : null}
    </motion.div>
  )
})
