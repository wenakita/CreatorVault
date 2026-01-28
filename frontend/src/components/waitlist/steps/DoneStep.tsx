import { memo } from 'react'
import { motion } from 'framer-motion'
import { Check, CheckCircle2, Copy, ExternalLink } from 'lucide-react'
import { INVITE_COPY, REFERRAL_TWEET_TEMPLATES } from '@/components/waitlist/referralsCopy'
import { ACTION_POINTS, SIGNUP_POINTS } from '../waitlistConstants'
import type { ActionKey, WaitlistState } from '../waitlistTypes'

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
const stagger = {
  animate: { transition: { staggerChildren: 0.05 } },
}

type DoneStepProps = {
  displayEmail: string | null
  isBypassAdmin: boolean
  appUrl: string
  waitlistPosition: WaitlistState['waitlistPosition']
  referralCode: string | null
  referralLink: string
  pointsBreakdownUrl?: string | null
  inviteTemplateIdx: number
  inviteToast: string | null
  shareToast: string | null
  shareBusy: boolean
  actionsDone: Record<ActionKey, boolean>
  miniAppIsMiniApp: boolean
  miniAppAdded: boolean
  miniAppAddSupported: boolean | null
  miniAppHostLabel: string | null
  showEmailCapture: boolean
  emailCaptureValue: string
  emailCaptureBusy: boolean
  emailCaptureError: string | null
  emailCaptureSuccess: string | null
  onEmailCaptureChange: (value: string) => void
  onEmailCaptureSubmit: () => void
  onShareX: () => void
  onCopyReferral: () => void
  onNextInviteTemplate: () => void
  onFollow: () => void
  onShare: () => void | Promise<void>
  onAddMiniApp: () => void | Promise<void>
}

export const DoneStep = memo(function DoneStep({
  displayEmail,
  isBypassAdmin,
  appUrl,
  waitlistPosition,
  referralCode,
  referralLink,
  pointsBreakdownUrl,
  inviteTemplateIdx,
  inviteToast,
  shareToast,
  shareBusy,
  actionsDone,
  miniAppIsMiniApp,
  miniAppAdded,
  miniAppAddSupported,
  miniAppHostLabel,
  showEmailCapture,
  emailCaptureValue,
  emailCaptureBusy,
  emailCaptureError,
  emailCaptureSuccess,
  onEmailCaptureChange,
  onEmailCaptureSubmit,
  onShareX,
  onCopyReferral,
  onNextInviteTemplate,
  onFollow,
  onShare,
  onAddMiniApp,
}: DoneStepProps) {
  function renderActionBadge(action: ActionKey) {
    const done = actionsDone[action]
    const points = ACTION_POINTS[action]
    return (
      <span
        className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums transition-colors duration-200 ${
          done
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-zinc-800/50 text-zinc-500'
        }`}
      >
        {done ? `✓ ${points}` : `+${points}`}
      </span>
    )
  }

  return (
    <motion.div
      key="done"
      {...fadeUp}
      className="space-y-5"
    >
      {/* Success header */}
      <motion.div {...scaleIn} className="flex items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-[#0052FF]/10 border border-[#0052FF]/20 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-[#0052FF]" />
          </div>
          <motion.div
            className="absolute inset-0 rounded-2xl border border-[#0052FF]/30"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.4, opacity: 0 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
          />
        </div>
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-light tracking-tight text-white leading-tight">
            You're in
          </h1>
          {displayEmail ? (
            <p className="text-[14px] text-zinc-500 font-mono">{displayEmail}</p>
          ) : null}
        </div>
      </motion.div>

      <motion.p {...fadeUp} className="text-[15px] text-zinc-400 leading-relaxed">
        Share your link to move up the waitlist.
      </motion.p>

      {/* Email capture */}
      {showEmailCapture ? (
        <motion.div {...fadeUp} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-600 font-medium">Get notified</div>
            <p className="text-[13px] text-zinc-500 mt-1">Add email for updates.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              className="flex-1 rounded-xl border border-zinc-800 bg-black/40 px-4 py-3 text-[14px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#0052FF]/50 transition-colors duration-200"
              placeholder="you@email.com"
              value={emailCaptureValue}
              onChange={(event) => onEmailCaptureChange(event.target.value)}
            />
            <button
              type="button"
              className="px-5 py-3 rounded-xl bg-[#0052FF] text-white text-[14px] font-medium hover:bg-[#0047E1] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              disabled={emailCaptureBusy || emailCaptureValue.trim().length === 0}
              onClick={onEmailCaptureSubmit}
            >
              {emailCaptureBusy ? 'Saving…' : 'Save'}
            </button>
          </div>
          {emailCaptureError ? <div className="text-[12px] text-red-400">{emailCaptureError}</div> : null}
          {emailCaptureSuccess ? <div className="text-[12px] text-emerald-400">{emailCaptureSuccess}</div> : null}
        </motion.div>
      ) : null}

      {/* Admin shortcuts */}
      {isBypassAdmin ? (
        <motion.div {...fadeUp} className="flex gap-2">
          <a
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0052FF] text-white text-[14px] font-medium hover:bg-[#0047E1] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
            href={`${appUrl.replace(/\/+$/, '')}/deploy`}
          >
            Deploy
          </a>
          <a
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-zinc-800 text-zinc-300 text-[14px] font-medium hover:text-white hover:border-zinc-700 hover:bg-zinc-800/50 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
            href={`${appUrl.replace(/\/+$/, '')}/admin/creator-access`}
          >
            Admin
          </a>
        </motion.div>
      ) : null}

      {/* Points card */}
      <motion.div {...fadeUp} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-600 font-medium mb-1">
              {INVITE_COPY.counterLabel}
            </div>
            <div className="text-[32px] font-light text-white tabular-nums tracking-tight">
              {waitlistPosition ? waitlistPosition.points.total.toLocaleString() : '—'}
            </div>
            <div className="text-[13px] text-zinc-500">
              {waitlistPosition
                ? `#${waitlistPosition.rank.invite ?? '—'} · Top ${waitlistPosition.percentileInvite ?? '—'}%`
                : 'Loading…'}
            </div>
          </div>
          <a
            className="text-[13px] text-[#0052FF] hover:text-[#3373FF] transition-colors duration-200 flex items-center gap-1"
            href="/leaderboard"
          >
            Leaderboard
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {(() => {
          const actionPointsLocal = (Object.keys(ACTION_POINTS) as ActionKey[]).reduce((sum, k) => {
            return sum + (actionsDone[k] ? ACTION_POINTS[k] : 0)
          }, 0)
          const totalPoints = waitlistPosition?.points?.total ?? SIGNUP_POINTS + actionPointsLocal
          const taskPoints = waitlistPosition?.points?.tasks ?? actionPointsLocal
          const signupPoints = waitlistPosition?.points?.signup ?? SIGNUP_POINTS
          const invitePoints = waitlistPosition?.points?.invite ?? 0
          void totalPoints
          return (
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between text-zinc-500">
                <span>Signup</span>
                <span className="tabular-nums text-zinc-300">+{signupPoints}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-500">
                <span>Referrals</span>
                <span className="tabular-nums text-zinc-300">+{invitePoints}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-500">
                <span>Actions</span>
                <span className="tabular-nums text-zinc-300">+{taskPoints}</span>
              </div>
            </div>
          )
        })()}

        {referralCode && pointsBreakdownUrl ? (
          <a
            className="mt-3 inline-flex items-center gap-1 text-[12px] text-zinc-600 hover:text-zinc-400 transition-colors duration-200"
            href={pointsBreakdownUrl}
            target="_blank"
            rel="noreferrer"
          >
            View breakdown
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : null}
      </motion.div>

      {/* Referral link */}
      {referralCode ? (
        <motion.div {...fadeUp} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-600 font-medium mb-2">
              {INVITE_COPY.linkLabel}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2.5">
              <span className="flex-1 font-mono text-[13px] text-zinc-300 truncate">
                {referralLink}
              </span>
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors duration-200"
                onClick={onCopyReferral}
                title="Copy link"
              >
                <Copy className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0052FF] text-white text-[14px] font-medium hover:bg-[#0047E1] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.98]"
              onClick={onShareX}
            >
              {INVITE_COPY.shareButton}
              {renderActionBadge('shareX')}
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-zinc-800 text-zinc-300 text-[14px] font-medium hover:text-white hover:border-zinc-700 hover:bg-zinc-800/50 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.98]"
              onClick={onCopyReferral}
            >
              {INVITE_COPY.copyButton}
              {renderActionBadge('copyLink')}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-[12px] text-zinc-600 hover:text-zinc-400 transition-colors duration-200"
              onClick={onNextInviteTemplate}
            >
              Try different copy ({(inviteTemplateIdx % REFERRAL_TWEET_TEMPLATES.length) + 1}/{REFERRAL_TWEET_TEMPLATES.length})
            </button>
            {inviteToast ? (
              <motion.span {...fadeUp} className="text-[12px] text-emerald-400">
                {inviteToast}
              </motion.span>
            ) : null}
          </div>
        </motion.div>
      ) : null}

      {/* Actions */}
      <motion.div {...stagger} className="space-y-2">
        {shareToast ? (
          <motion.div {...fadeUp} className="text-[12px] text-zinc-500">{shareToast}</motion.div>
        ) : null}

        <motion.div {...fadeUp} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden divide-y divide-zinc-800/50">
          {/* Follow action */}
          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                  actionsDone.follow
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-zinc-800/50 border border-zinc-700'
                }`}
              >
                {actionsDone.follow ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] text-white">Follow @4626fun</div>
              </div>
            </div>
            <a
              className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                actionsDone.follow
                  ? 'bg-zinc-800/50 text-zinc-500'
                  : 'bg-[#0052FF] text-white hover:bg-[#0047E1] active:scale-[0.98]'
              }`}
              href="https://x.com/4626fun"
              target="_blank"
              rel="noreferrer"
              onClick={onFollow}
            >
              {actionsDone.follow ? 'Done' : `Follow +${ACTION_POINTS.follow}`}
            </a>
          </div>

          {/* Share action */}
          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                  actionsDone.share
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-zinc-800/50 border border-zinc-700'
                }`}
              >
                {actionsDone.share ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] text-white">Share</div>
              </div>
            </div>
            <button
              type="button"
              className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 ${
                actionsDone.share
                  ? 'bg-zinc-800/50 text-zinc-500'
                  : 'border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/50 active:scale-[0.98]'
              }`}
              disabled={shareBusy}
              onClick={onShare}
            >
              {shareBusy ? 'Sharing…' : actionsDone.share ? 'Done' : `Share +${ACTION_POINTS.share}`}
            </button>
          </div>

          {/* Save app action */}
          {miniAppIsMiniApp && miniAppAddSupported !== false ? (
            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                    actionsDone.saveApp
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'bg-zinc-800/50 border border-zinc-700'
                  }`}
                >
                  {actionsDone.saveApp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] text-white">Save app</div>
                </div>
              </div>
              <button
                type="button"
                className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 ${
                  actionsDone.saveApp || miniAppAdded
                    ? 'bg-zinc-800/50 text-zinc-500'
                    : 'bg-[#0052FF] text-white hover:bg-[#0047E1] active:scale-[0.98]'
                }`}
                disabled={shareBusy || miniAppAddSupported === null || miniAppAdded === true}
                onClick={onAddMiniApp}
              >
                {miniAppAddSupported === null ? 'Checking…' : miniAppAdded ? 'Saved' : `Save +${ACTION_POINTS.saveApp}`}
              </button>
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </motion.div>
  )
})
