import { memo } from 'react'
import { motion } from 'framer-motion'
import { Check, CheckCircle2 } from 'lucide-react'
import { INVITE_COPY, REFERRAL_TWEET_TEMPLATES } from '@/components/waitlist/referralsCopy'
import { ACTION_POINTS, SIGNUP_POINTS } from '../waitlistConstants'
import type { ActionKey, WaitlistState } from '../waitlistTypes'

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
        className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] ${
          done ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200' : 'border-white/5 bg-black/20 text-zinc-600'
        }`}
      >
        {done ? `✓${points}` : `•${points}`}
      </span>
    )
  }

  return (
    <motion.div
      key="done"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.18 }}
      className="space-y-5"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="flex items-center gap-3"
      >
        <div className="relative w-9 h-9 rounded-full border border-brand-primary/20 bg-brand-primary/10 inline-flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-brand-primary/20 animate-pulse-ring" />
          <CheckCircle2 className="w-5 h-5 text-brand-accent" />
        </div>
        <div className="headline text-2xl sm:text-3xl leading-tight">You’re in!</div>
      </motion.div>

      <div className="text-sm text-zinc-600 font-light">
        {displayEmail ? (
          <>
            You’re in as <span className="font-mono text-zinc-300">{displayEmail}</span>. Share to move up.
          </>
        ) : (
          <>You’re in. Share to move up.</>
        )}
      </div>

      {isBypassAdmin ? (
        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600">Admin</div>
          <a className="btn-primary w-full inline-flex justify-center" href={`${appUrl.replace(/\/+$/, '')}/deploy`}>
            Continue to deploy
          </a>
          <a className="btn-accent w-full inline-flex justify-center" href={`${appUrl.replace(/\/+$/, '')}/admin/creator-access`}>
            Creator access
          </a>
        </div>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600 mb-1">{INVITE_COPY.counterLabel}</div>
            <div className="text-2xl text-zinc-200">{waitlistPosition ? waitlistPosition.points.total.toLocaleString() : '—'}</div>
            <div className="text-[11px] text-zinc-700">
              {waitlistPosition
                ? `#${waitlistPosition.rank.invite ?? '—'} · Top ${waitlistPosition.percentileInvite ?? '—'}%`
                : 'Loading…'}
            </div>
          </div>
          <a className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors pt-1" href="/leaderboard">
            Leaderboard
          </a>
        </div>

        <div className="pt-2">
          {(() => {
            const actionPointsLocal = (Object.keys(ACTION_POINTS) as ActionKey[]).reduce((sum, k) => {
              return sum + (actionsDone[k] ? ACTION_POINTS[k] : 0)
            }, 0)
            const totalPoints = waitlistPosition?.points?.total ?? SIGNUP_POINTS + actionPointsLocal
            const taskPoints = waitlistPosition?.points?.tasks ?? actionPointsLocal
            const signupPoints = waitlistPosition?.points?.signup ?? SIGNUP_POINTS
            const invitePoints = waitlistPosition?.points?.invite ?? 0
            return (
              <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600">Points</div>
                  <div className="text-sm text-zinc-200 font-medium tabular-nums">{totalPoints}</div>
                </div>
                <div className="mt-2 space-y-1 text-[11px] text-zinc-600">
                  <div className="flex items-center justify-between gap-3">
                    <span>Joined waitlist</span>
                    <span className="tabular-nums">+{signupPoints}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Qualified referrals</span>
                    <span className="tabular-nums">+{invitePoints}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Actions completed</span>
                    <span className="tabular-nums">+{taskPoints}</span>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-zinc-700">
                  Points are recorded server-side; actions are best-effort and duplicates are ignored.
                </div>
                {referralCode && pointsBreakdownUrl ? (
                  <a
                    className="mt-2 inline-flex text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                    href={pointsBreakdownUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View points breakdown
                  </a>
                ) : null}
              </div>
            )
          })()}
        </div>
      </div>

      {referralCode ? (
        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600 mb-1">{INVITE_COPY.linkLabel}</div>
            <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[12px] text-zinc-300 break-all">
              {referralLink}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button type="button" className="btn-primary w-full flex items-center justify-between gap-2" onClick={onShareX}>
              <span>{INVITE_COPY.shareButton}</span>
              {renderActionBadge('shareX')}
            </button>
            <button type="button" className="btn-accent w-full flex items-center justify-between gap-2" onClick={onCopyReferral}>
              <span>{INVITE_COPY.copyButton}</span>
              {renderActionBadge('copyLink')}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button type="button" className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors" onClick={onNextInviteTemplate}>
              New copy ({(inviteTemplateIdx % REFERRAL_TWEET_TEMPLATES.length) + 1}/{REFERRAL_TWEET_TEMPLATES.length})
            </button>
            {inviteToast ? <div className="text-[11px] text-zinc-600">{inviteToast}</div> : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-2 pt-1">
        {shareToast ? <div className="text-[11px] text-zinc-600">{shareToast}</div> : null}

        <div className="rounded-xl border border-white/10 bg-black/30 divide-y divide-white/10">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  actionsDone.follow ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-black/20'
                }`}
                aria-hidden="true"
              >
                {actionsDone.follow ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
              </div>
              <div className="min-w-0">
                <div className="text-sm text-zinc-200">Follow @4626fun</div>
                <div className="text-[11px] text-zinc-600">+{ACTION_POINTS.follow} points</div>
              </div>
            </div>
            <a className="btn-primary px-3 py-2 text-sm" href="https://x.com/4626fun" target="_blank" rel="noreferrer" onClick={onFollow}>
              {actionsDone.follow ? 'Done' : 'Follow'}
            </a>
          </div>

          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  actionsDone.share ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-black/20'
                }`}
                aria-hidden="true"
              >
                {actionsDone.share ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
              </div>
              <div className="min-w-0">
                <div className="text-sm text-zinc-200">Share</div>
                <div className="text-[11px] text-zinc-600">+{ACTION_POINTS.share} points</div>
              </div>
            </div>
            <button type="button" className="btn-accent px-3 py-2 text-sm disabled:opacity-60" disabled={shareBusy} onClick={onShare}>
              {shareBusy ? 'Working…' : actionsDone.share ? 'Done' : 'Share'}
            </button>
          </div>

          {miniAppIsMiniApp && miniAppAddSupported !== false ? (
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    actionsDone.saveApp ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-black/20'
                  }`}
                  aria-hidden="true"
                >
                  {actionsDone.saveApp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-zinc-200">Save Mini App</div>
                  <div className="text-[11px] text-zinc-600">+{ACTION_POINTS.saveApp} points</div>
                </div>
              </div>
              <button
                type="button"
                className="btn-primary px-3 py-2 text-sm disabled:opacity-60"
                disabled={shareBusy || miniAppAddSupported === null || miniAppAdded === true}
                onClick={onAddMiniApp}
                title={
                  miniAppAddSupported === null
                    ? 'Checking host capabilities…'
                    : miniAppAdded === true
                      ? `Already saved in ${miniAppHostLabel ?? 'Mini Apps'}`
                      : `Save this Mini App in ${miniAppHostLabel ?? 'Mini Apps'}`
                }
              >
                {miniAppAddSupported === null ? 'Checking…' : miniAppAdded === true ? 'Saved' : 'Save'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  )
})
