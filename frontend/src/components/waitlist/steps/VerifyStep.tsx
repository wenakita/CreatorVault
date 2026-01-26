import { memo } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

type VerifyStepProps = {
  verifiedWallet: string | null
  verifiedSolana: string | null
  showPrivy: boolean
  showPrivyReady: boolean
  privyReady: boolean
  privyVerifyBusy: boolean
  privyVerifyError: string | null
  privyAuthed: boolean
  baseSubAccountBusy: boolean
  baseSubAccount: string | null
  baseSubAccountError: string | null
  onSignOutWallet: () => void | Promise<void>
  onPrivyContinue: () => void
}

export const VerifyStep = memo(function VerifyStep({
  verifiedWallet,
  verifiedSolana,
  showPrivy,
  showPrivyReady,
  privyReady,
  privyVerifyBusy,
  privyVerifyError,
  privyAuthed,
  baseSubAccountBusy,
  baseSubAccount,
  baseSubAccountError,
  onSignOutWallet,
  onPrivyContinue,
}: VerifyStepProps) {
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
        <div className="headline text-2xl sm:text-3xl leading-tight">Verify</div>
        <div className="text-sm text-zinc-500">Continue with a wallet</div>
      </div>

      {verifiedWallet ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-zinc-200">Wallet verified</div>
            <div className="text-xs text-zinc-500 font-mono truncate">
              {verifiedWallet.slice(0, 6)}…{verifiedWallet.slice(-4)}
            </div>
          </div>
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            onClick={onSignOutWallet}
          >
            Sign out
          </button>
        </div>
      ) : null}

      {verifiedSolana && !verifiedWallet ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-zinc-200">Solana verified</div>
            <div className="text-xs text-zinc-500 font-mono truncate">{verifiedSolana}</div>
          </div>
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            onClick={onSignOutWallet}
          >
            Sign out
          </button>
        </div>
      ) : null}

      {showPrivyReady && !verifiedWallet && !verifiedSolana ? (
        <div className="space-y-2">
          <button
            type="button"
            className="w-full min-h-[52px] rounded-xl border border-brand-primary/30 bg-brand-primary/20 text-zinc-100 font-medium px-4 py-3.5 transition-colors hover:bg-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!privyReady || privyVerifyBusy}
            onClick={onPrivyContinue}
          >
            {privyVerifyBusy ? 'Opening…' : 'Continue'}
          </button>
          {privyVerifyError ? <div className="text-xs text-red-400 text-center">{privyVerifyError}</div> : null}
          {privyAuthed && baseSubAccountBusy ? (
            <div className="text-[11px] text-zinc-500 text-center">Setting up Base sub-account…</div>
          ) : null}
          {privyAuthed && baseSubAccount ? (
            <div className="text-[11px] text-emerald-300/80 text-center">Base sub-account ready.</div>
          ) : null}
          {privyAuthed && baseSubAccountError ? (
            <div className="text-[11px] text-amber-300/80 text-center">{baseSubAccountError}</div>
          ) : null}
          <div className="text-[11px] text-zinc-500 text-center">WalletConnect only.</div>
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
