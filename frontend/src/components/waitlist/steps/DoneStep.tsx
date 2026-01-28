import { memo } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, ArrowRight, Trophy, Copy } from 'lucide-react'
import { SIGNUP_POINTS } from '../waitlistConstants'
import type { WaitlistState } from '../waitlistTypes'

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

type DoneStepProps = {
  displayEmail: string | null
  isBypassAdmin: boolean
  appUrl: string
  waitlistPosition: WaitlistState['waitlistPosition']
  referralCode: string | null
  referralLink: string
  onCopyReferral: () => void
  copyToast?: string | null
}

export const DoneStep = memo(function DoneStep({
  displayEmail,
  isBypassAdmin,
  appUrl,
  waitlistPosition,
  referralCode,
  referralLink,
  onCopyReferral,
  copyToast,
}: DoneStepProps) {
  const points = waitlistPosition?.points.total ?? SIGNUP_POINTS
  const rank = waitlistPosition?.rank.total ?? null

  return (
    <motion.div {...fadeUp} className="space-y-6">
      {/* Success Header */}
      <motion.div {...scaleIn} className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-[#0052FF]/10 border border-[#0052FF]/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-[#0052FF]" />
            </div>
            <motion.div
              className="absolute inset-0 rounded-2xl border border-[#0052FF]/30"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
            />
          </div>
        </div>
        
        <div>
          <h1 className="text-[28px] font-light text-white tracking-tight">
            You're on the waitlist!
          </h1>
          {displayEmail && (
            <p className="text-[14px] text-zinc-500 mt-1">{displayEmail}</p>
          )}
        </div>
      </motion.div>

      {/* Points Summary */}
      <motion.div {...fadeUp} className="rounded-2xl bg-zinc-900/50 border border-zinc-800/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-600 font-medium">
              Starting Points
            </div>
            <div className="text-[32px] font-light text-white tabular-nums">
              {points.toLocaleString()}
            </div>
          </div>
          {rank && (
            <div className="text-right">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Trophy className="w-4 h-4" />
                <span className="text-[14px]">Rank #{rank}</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Primary CTA - Go to Profile */}
      <motion.div {...fadeUp} className="space-y-3">
        <a
          href="/profile"
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-[#0052FF] text-white text-[15px] font-medium hover:bg-[#0047E1] transition-all duration-200 active:scale-[0.98]"
        >
          Complete Profile & Earn More
          <ArrowRight className="w-4 h-4" />
        </a>
        
        <p className="text-center text-[13px] text-zinc-500">
          Link your wallet, connect socials, and invite friends to earn up to <span className="text-white">715+ points</span>
        </p>
      </motion.div>

      {/* Quick Referral Link */}
      {referralCode && (
        <motion.div {...fadeUp} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-zinc-600 mb-1">Your referral link</div>
              <div className="font-mono text-[12px] text-zinc-400 truncate">
                {referralLink}
              </div>
            </div>
            <button
              type="button"
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
              onClick={onCopyReferral}
            >
              <Copy className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
          {copyToast && (
            <div className="text-[11px] text-emerald-400 mt-2">{copyToast}</div>
          )}
        </motion.div>
      )}

      {/* Secondary Links */}
      <motion.div {...fadeUp} className="flex items-center justify-center gap-4 text-[13px]">
        <a
          href="/leaderboard"
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          View Leaderboard
        </a>
        {isBypassAdmin && (
          <>
            <span className="text-zinc-700">•</span>
            <a
              href={`${appUrl}/deploy`}
              className="text-[#0052FF] hover:text-[#3373FF] transition-colors"
            >
              Deploy (Admin)
            </a>
          </>
        )}
      </motion.div>
    </motion.div>
  )
})

export default DoneStep
