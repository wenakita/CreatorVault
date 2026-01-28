import { memo } from 'react'
import { motion } from 'framer-motion'
import { AnimatePresence } from 'framer-motion'
import { Check, CheckCircle2, Copy, ExternalLink, Wallet } from 'lucide-react'
import { INVITE_COPY, REFERRAL_TWEET_TEMPLATES } from '@/components/waitlist/referralsCopy'
import { 
  ACTION_POINTS, 
  SIGNUP_POINTS, 
  LINK_CSW_POINTS,
  SOCIAL_POINTS,
  BONUS_POINTS,
  SOCIAL_LINKS,
} from '../waitlistConstants'
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
  primaryCta?: { label: string; href: string } | null
  deployAccessState: 'checking' | 'ready' | 'waitlist'
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
  // CSW linking
  cswLinked: boolean
  cswLinkBusy: boolean
  cswLinkError: string | null
  onLinkCsw: () => void | Promise<void>
  // Action handlers
  onEmailCaptureChange: (value: string) => void
  onEmailCaptureSubmit: () => void
  onShareX: () => void
  onCopyReferral: () => void
  onNextInviteTemplate: () => void
  onFollow: () => void
  onShare: () => void | Promise<void>
  onAddMiniApp: () => void | Promise<void>
  onSocialAction: (action: ActionKey, url: string) => void
}

export const DoneStep = memo(function DoneStep({
  displayEmail,
  isBypassAdmin,
  appUrl,
  primaryCta,
  deployAccessState,
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
  showEmailCapture,
  emailCaptureValue,
  emailCaptureBusy,
  emailCaptureError,
  emailCaptureSuccess,
  cswLinked,
  cswLinkBusy,
  cswLinkError,
  onLinkCsw,
  onEmailCaptureChange,
  onEmailCaptureSubmit,
  onShareX,
  onCopyReferral,
  onNextInviteTemplate,
  onFollow,
  onShare,
  onAddMiniApp,
  onSocialAction,
}: DoneStepProps) {
  const headline =
    deployAccessState === 'ready'
      ? "You're ready"
      : deployAccessState === 'checking'
        ? 'Finalizing…'
        : "You're on the waitlist"

  const subcopy =
    deployAccessState === 'ready'
      ? 'You can deploy now. Continue when you’re ready.'
      : deployAccessState === 'checking'
        ? 'Checking deploy access…'
        : 'Share your link to move up the waitlist.'

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
      className="space-y-6"
    >
      {/* Success header */}
      <motion.div {...scaleIn} className="flex items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-[#0052FF]" />
          </div>
          <motion.div
            className="absolute inset-0 rounded-2xl border border-[#0052FF]/25"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.4, opacity: 0 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
          />
        </div>
        <div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h1
              key={`headline:${deployAccessState}`}
              className="text-[30px] sm:text-[34px] font-light tracking-tight text-white leading-[1.08]"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: baseEase }}
            >
              {headline}
            </motion.h1>
          </AnimatePresence>
          {displayEmail ? (
            <p className="text-[14px] text-zinc-500 font-mono">{displayEmail}</p>
          ) : null}
        </div>
      </motion.div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={`subcopy:${deployAccessState}`}
          className="text-[15px] text-zinc-400 leading-relaxed"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: baseEase }}
        >
          {subcopy}
        </motion.p>
      </AnimatePresence>

      {/* Primary CTA (e.g. Continue to deploy) */}
      <motion.div {...fadeUp} className="flex" layout>
        <AnimatePresence mode="wait" initial={false}>
          {deployAccessState === 'checking' ? (
            <motion.button
              key="cta:checking"
              type="button"
              disabled
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/30 text-zinc-500 text-[14px] font-medium"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: baseEase }}
            >
              Checking access…
            </motion.button>
          ) : primaryCta ? (
            <motion.a
              key="cta:ready"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0052FF] text-white text-[14px] font-medium shadow-[0_10px_30px_-16px_rgba(0,82,255,0.8)] hover:bg-[#0047E1] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
              href={primaryCta.href}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: baseEase }}
            >
              {primaryCta.label}
            </motion.a>
          ) : null}
        </AnimatePresence>
      </motion.div>

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
                ? `#${waitlistPosition.rank.total ?? '—'} · Top ${waitlistPosition.percentileInvite ?? '—'}%`
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
          const signupPoints = waitlistPosition?.points?.signup ?? SIGNUP_POINTS
          const cswPoints = waitlistPosition?.points?.csw ?? (cswLinked ? LINK_CSW_POINTS : 0)
          const invitePoints = waitlistPosition?.points?.invite ?? 0
          const socialPoints = waitlistPosition?.points?.social ?? 0
          const bonusPoints = waitlistPosition?.points?.bonus ?? 0
          return (
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between text-zinc-500">
                <span>Signup</span>
                <span className="tabular-nums text-emerald-400">+{signupPoints}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-500">
                <span>Link CSW</span>
                <span className={`tabular-nums ${cswLinked ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {cswLinked ? `+${cswPoints}` : `+${LINK_CSW_POINTS}`}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-500">
                <span>Referrals</span>
                <span className="tabular-nums text-zinc-300">+{invitePoints}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-500">
                <span>Social</span>
                <span className="tabular-nums text-zinc-300">+{socialPoints}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-500">
                <span>Bonus</span>
                <span className="tabular-nums text-zinc-300">+{bonusPoints}</span>
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

      {/* CSW Linking - High Priority */}
      {!cswLinked ? (
        <motion.div {...fadeUp} className="rounded-2xl border-2 border-[#0052FF]/30 bg-[#0052FF]/5 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-[#0052FF]" />
            </div>
            <div className="flex-1">
              <div className="text-[14px] text-white font-medium">Link Coinbase Smart Wallet</div>
              <div className="text-[12px] text-zinc-500">Biggest points boost available</div>
            </div>
            <span className="px-3 py-1.5 rounded-full bg-[#0052FF]/10 text-[#0052FF] text-[13px] font-medium">
              +{LINK_CSW_POINTS}
            </span>
          </div>
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0052FF] text-white text-[14px] font-medium hover:bg-[#0047E1] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={cswLinkBusy}
            onClick={onLinkCsw}
          >
            {cswLinkBusy ? 'Linking…' : 'Link Wallet'}
          </button>
          {cswLinkError ? <div className="text-[12px] text-red-400">{cswLinkError}</div> : null}
        </motion.div>
      ) : (
        <motion.div {...fadeUp} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="text-[14px] text-white font-medium">Wallet Linked</div>
              <div className="text-[12px] text-zinc-500">You earned +{LINK_CSW_POINTS} points</div>
            </div>
          </div>
        </motion.div>
      )}

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

      {/* Social Actions - Verified */}
      <motion.div {...fadeUp} className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-600 font-medium">
          Social (Verified)
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden divide-y divide-zinc-800/50">
          {/* Farcaster */}
          <SocialActionRow
            label="Follow on Farcaster"
            handle="@4626"
            points={SOCIAL_POINTS.farcaster}
            done={actionsDone.farcaster}
            url={SOCIAL_LINKS.farcaster}
            onAction={() => onSocialAction('farcaster', SOCIAL_LINKS.farcaster)}
          />
          {/* Base App */}
          <SocialActionRow
            label="Follow on Base App"
            handle="@4626"
            points={SOCIAL_POINTS.baseApp}
            done={actionsDone.baseApp}
            url={SOCIAL_LINKS.baseApp}
            onAction={() => onSocialAction('baseApp', SOCIAL_LINKS.baseApp)}
          />
          {/* Zora */}
          <SocialActionRow
            label="Follow on Zora"
            handle="@4626"
            points={SOCIAL_POINTS.zora}
            done={actionsDone.zora}
            url={SOCIAL_LINKS.zora}
            onAction={() => onSocialAction('zora', SOCIAL_LINKS.zora)}
          />
          {/* X/Twitter */}
          <SocialActionRow
            label="Follow on X"
            handle="@4626fun"
            points={SOCIAL_POINTS.x}
            done={actionsDone.x || actionsDone.follow}
            url={SOCIAL_LINKS.x}
            onAction={() => {
              onFollow()
              onSocialAction('x', SOCIAL_LINKS.x)
            }}
          />
          {/* Discord */}
          <SocialActionRow
            label="Join Discord"
            handle="4626"
            points={SOCIAL_POINTS.discord}
            done={actionsDone.discord}
            url={SOCIAL_LINKS.discord}
            onAction={() => onSocialAction('discord', SOCIAL_LINKS.discord)}
          />
          {/* Telegram */}
          <SocialActionRow
            label="Join Telegram"
            handle="@fun4626"
            points={SOCIAL_POINTS.telegram}
            done={actionsDone.telegram}
            url={SOCIAL_LINKS.telegram}
            onAction={() => onSocialAction('telegram', SOCIAL_LINKS.telegram)}
          />
        </div>
      </motion.div>

      {/* Bonus Actions - Honor System */}
      <motion.div {...fadeUp} className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-600 font-medium">
          Bonus
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden divide-y divide-zinc-800/50">
          <SocialActionRow
            label="Star on GitHub"
            handle="4626fun"
            points={BONUS_POINTS.github}
            done={actionsDone.github}
            url={SOCIAL_LINKS.github}
            onAction={() => onSocialAction('github', SOCIAL_LINKS.github)}
          />
          <SocialActionRow
            label="Follow on TikTok"
            handle="@4626fun"
            points={BONUS_POINTS.tiktok}
            done={actionsDone.tiktok}
            url={SOCIAL_LINKS.tiktok}
            onAction={() => onSocialAction('tiktok', SOCIAL_LINKS.tiktok)}
          />
          <SocialActionRow
            label="Follow on Instagram"
            handle="@4626fun"
            points={BONUS_POINTS.instagram}
            done={actionsDone.instagram}
            url={SOCIAL_LINKS.instagram}
            onAction={() => onSocialAction('instagram', SOCIAL_LINKS.instagram)}
          />
          <SocialActionRow
            label="Join Reddit"
            handle="r/4626"
            points={BONUS_POINTS.reddit}
            done={actionsDone.reddit}
            url={SOCIAL_LINKS.reddit}
            onAction={() => onSocialAction('reddit', SOCIAL_LINKS.reddit)}
          />
        </div>
      </motion.div>

      {/* Share/Misc Actions */}
      <motion.div {...stagger} className="space-y-2">
        {shareToast ? (
          <motion.div {...fadeUp} className="text-[12px] text-zinc-500">{shareToast}</motion.div>
        ) : null}

        <motion.div {...fadeUp} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden divide-y divide-zinc-800/50">
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

// Reusable social action row component
function SocialActionRow({
  label,
  handle,
  points,
  done,
  url,
  onAction,
}: {
  label: string
  handle: string
  points: number
  done: boolean
  url: string
  onAction: () => void
}) {
  return (
    <div className="px-4 py-3.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors duration-200 ${
            done
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : 'bg-zinc-800/50 border border-zinc-700'
          }`}
        >
          {done ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
        </div>
        <div className="min-w-0">
          <div className="text-[14px] text-white">{label}</div>
          <div className="text-[12px] text-zinc-500">{handle}</div>
        </div>
      </div>
      <a
        className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          done
            ? 'bg-zinc-800/50 text-zinc-500 cursor-default'
            : 'bg-[#0052FF] text-white hover:bg-[#0047E1] active:scale-[0.98]'
        }`}
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={() => {
          if (!done) {
            onAction()
          }
        }}
      >
        {done ? '✓ Done' : `+${points}`}
      </a>
    </div>
  )
}
