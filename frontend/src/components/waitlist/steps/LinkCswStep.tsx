import { memo } from 'react'
import { motion } from 'framer-motion'
import { Wallet, CheckCircle2, ArrowRight, Shield, ExternalLink, Sparkles } from 'lucide-react'
import { LINK_CSW_POINTS, SIGNUP_POINTS } from '../waitlistConstants'

const ZORA_SIGNUP_URL = 'https://zora.co'

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

type LinkCswStepProps = {
  cswLinked: boolean
  cswLinkBusy: boolean
  cswLinkError: string | null
  onLinkCsw: () => void | Promise<void>
  onSkip?: () => void
  onContinue: () => void
}

export const LinkCswStep = memo(function LinkCswStep({
  cswLinked,
  cswLinkBusy,
  cswLinkError,
  onLinkCsw,
  onSkip,
  onContinue,
}: LinkCswStepProps) {
  if (cswLinked) {
    // CSW already linked - show success and continue
    return (
      <motion.div {...fadeUp} className="space-y-6">
        <motion.div {...scaleIn} className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <motion.div
                className="absolute inset-0 rounded-2xl border border-emerald-500/30"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
              />
            </div>
          </div>
          
          <div>
            <h2 className="text-[24px] font-light text-white tracking-tight">
              Wallet Connected!
            </h2>
            <p className="text-[14px] text-zinc-500 mt-2">
              You earned <span className="text-emerald-400 font-medium">+{LINK_CSW_POINTS} points</span>
            </p>
          </div>
        </motion.div>

        <motion.div {...fadeUp}>
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-[#0052FF] text-white text-[15px] font-medium hover:bg-[#0047E1] transition-all duration-200 active:scale-[0.98]"
            onClick={onContinue}
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div {...fadeUp} className="space-y-6">
      {/* Header */}
      <motion.div {...scaleIn} className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-[#0052FF]/10 border border-[#0052FF]/20 flex items-center justify-center">
            <Wallet className="w-7 h-7 text-[#0052FF]" />
          </div>
        </div>
        
        <div>
          <h2 className="text-[24px] font-light text-white tracking-tight">
            Connect Your Wallet
          </h2>
          <p className="text-[14px] text-zinc-500 mt-2">
            Link your Coinbase Smart Wallet to complete signup
          </p>
        </div>
      </motion.div>

      {/* Points breakdown */}
      <motion.div {...fadeUp} className="rounded-2xl bg-zinc-900/50 border border-zinc-800/50 p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-zinc-500">Signup bonus</span>
            <span className="text-emerald-400 tabular-nums">+{SIGNUP_POINTS}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-zinc-500">Wallet connection</span>
            <span className="text-emerald-400 tabular-nums">+{LINK_CSW_POINTS}</span>
          </div>
          <div className="flex items-center justify-between text-[14px] pt-2 border-t border-zinc-800">
            <span className="text-white font-medium">Total starting points</span>
            <span className="text-white font-medium tabular-nums">{SIGNUP_POINTS + LINK_CSW_POINTS}</span>
          </div>
        </div>
      </motion.div>

      {/* Benefits */}
      <motion.div {...fadeUp} className="space-y-2">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/30">
          <Shield className="w-5 h-5 text-[#0052FF] flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-[13px] text-white">Secure & Gasless</div>
            <div className="text-[12px] text-zinc-500">Smart Wallet enables gasless transactions on Base</div>
          </div>
        </div>
      </motion.div>

      {/* Main CTAs */}
      <motion.div {...fadeUp} className="space-y-3">
        {/* Connect existing wallet */}
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-[#0052FF] text-white text-[15px] font-medium hover:bg-[#0047E1] transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onLinkCsw}
          disabled={cswLinkBusy}
        >
          {cswLinkBusy ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="w-4 h-4" />
              I have a Smart Wallet
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-[11px] text-zinc-600 uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        {/* Create Zora account */}
        <a
          href={ZORA_SIGNUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border border-zinc-700 bg-zinc-900/50 text-white text-[15px] font-medium hover:bg-zinc-800/50 hover:border-zinc-600 transition-all duration-200 active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4" />
          Create Zora Account
          <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
        </a>
        <p className="text-[12px] text-zinc-500 text-center">
          New to crypto? Create a free Zora account to get a Smart Wallet.
        </p>

        {cswLinkError && (
          <div className="text-[12px] text-red-400 text-center">{cswLinkError}</div>
        )}

        {onSkip && (
          <button
            type="button"
            className="w-full text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors py-2"
            onClick={onSkip}
          >
            Skip for now (fewer points)
          </button>
        )}
      </motion.div>
    </motion.div>
  )
})

export default LinkCswStep
