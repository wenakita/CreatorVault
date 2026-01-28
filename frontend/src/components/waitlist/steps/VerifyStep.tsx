import { memo } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2 } from 'lucide-react'
import type { WaitlistState } from '../waitlistTypes'
import { ConnectButtonWeb3 } from '@/components/ConnectButtonWeb3'

type VerifyStepProps = {
  verifiedWallet: string | null
  showPrivy: boolean
  showPrivyReady: boolean
  privyReady: boolean
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

      {/* Wallet connection status - only show prominently when creator coin found */}
      {verifiedWallet && (hasCreatorCoin || creatorCoinBusy) ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-zinc-200">Wallet connected</div>
            <div className="text-xs text-zinc-500 font-mono truncate">
              {verifiedWallet.slice(0, 6)}…{verifiedWallet.slice(-4)}
            </div>
          </div>
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
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-3">
          <div>
            <div className="text-sm text-amber-300/90">
              {zoraProfileExists === false ? 'No Zora account yet' : 'Zora account found'}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {zoraProfileExists === false
                ? 'Create a Zora account so we can set up your creator smart wallet.'
                : 'No creator coin yet. You can continue and we’ll link your embedded wallet to your smart wallet.'}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {zoraProfileExists === false ? (
              <a
                href="https://zora.co"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-sm font-medium px-4 py-2 rounded-lg bg-brand-primary/20 border border-brand-primary/30 text-zinc-100 hover:bg-brand-primary/30 transition-colors"
              >
                Create a Zora account
              </a>
            ) : null}
            <button
              type="button"
              className="flex-1 text-sm font-medium px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-colors"
              onClick={onSignOutWallet}
            >
              Try a different wallet
            </button>
            <button
              type="button"
              className="flex-1 text-sm font-medium px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onNoCreatorCoin}
              disabled={creatorCoinDeclaredMissing}
            >
              Continue without a Creator Coin
            </button>
          </div>
          {creatorCoinDeclaredMissing ? (
            <div className="text-xs text-emerald-400">Got it. You can still join the waitlist.</div>
          ) : null}
        </div>
      ) : null}

      {showDeployOwnerLink ? (
        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600">Enable 1‑click deploy</div>
            <div className="text-xs text-zinc-500 mt-1">
              This adds your Privy embedded wallet as an owner on the creator smart wallet, so deploys don’t depend on
              Rabby’s blocked signature method.
            </div>
          </div>

          <div className="space-y-2 text-[11px] text-zinc-600">
            <div className="flex items-center justify-between gap-3">
              <span>Creator smart wallet</span>
              <span className="font-mono text-zinc-300">{cswAddress ? short(cswAddress) : '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Privy embedded EOA</span>
              <span className="font-mono text-zinc-300">
                {embeddedEoaAddress ? short(embeddedEoaAddress) : 'Sign in with Privy'}
              </span>
            </div>
          </div>

          {embeddedEoaIsOwner ? (
            <div className="text-[11px] text-emerald-300/80">Already enabled.</div>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] text-zinc-600">Connect an existing owner wallet to approve:</div>
              <ConnectButtonWeb3 />

              {connectedOwnerAddress ? (
                <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-600">
                  <span>Connected owner</span>
                  <span className="font-mono text-zinc-300">{short(connectedOwnerAddress)}</span>
                </div>
              ) : null}

              {connectedOwnerAddress && connectedOwnerIsOwner === false ? (
                <div className="text-[11px] text-amber-300/80">
                  Connected wallet is not an owner of the creator smart wallet. Switch wallets and retry.
                </div>
              ) : null}

              <button
                type="button"
                className="btn-accent w-full disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={
                  Boolean(busy || deployOwnerLinkBusy) ||
                  !embeddedEoaAddress ||
                  !cswAddress ||
                  !connectedOwnerAddress ||
                  connectedOwnerIsOwner === false ||
                  typeof onLinkEmbeddedEoaAsOwner !== 'function'
                }
                onClick={() => void onLinkEmbeddedEoaAsOwner?.()}
              >
                {deployOwnerLinkBusy ? 'Linking…' : 'Add Privy embedded EOA as owner'}
              </button>

              {deployOwnerLinkError ? <div className="text-xs text-red-400 text-center">{deployOwnerLinkError}</div> : null}
            </div>
          )}
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
