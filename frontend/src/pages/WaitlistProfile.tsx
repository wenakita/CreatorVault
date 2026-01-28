import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Check, 
  CheckCircle2, 
  Copy, 
  Wallet,
  ArrowLeft,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { usePrivy, useWallets, useLinkAccount } from '@privy-io/react-auth'
import { getAppBaseUrl } from '@/lib/host'
import { Logo } from '@/components/brand/Logo'
import {
  SIGNUP_POINTS,
  LINK_CSW_POINTS,
  SOCIAL_POINTS,
  BONUS_POINTS,
  SOCIAL_LINKS,
  REFERRAL_SIGNUP_POINTS,
  REFERRAL_CSW_LINK_POINTS,
} from '@/components/waitlist/waitlistConstants'

type WaitlistPosition = {
  points: {
    total: number
    invite: number
    signup: number
    tasks: number
    csw: number
    social: number
    bonus: number
  }
  rank: { invite: number | null; total: number | null }
  totalCount: number
  percentileInvite: number | null
  referrals: {
    qualifiedCount: number
    pendingCount: number
  }
}

type UserData = {
  email: string
  referralCode: string | null
  cswLinked: boolean
  position: WaitlistPosition | null
}

const baseEase = [0.4, 0, 0.2, 1] as const
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: baseEase },
}

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

export function WaitlistProfile() {
  const appUrl = useMemo(() => getAppBaseUrl(), [])
  const { ready: privyReady, authenticated: privyAuthed, user: privyUser, login: privyLogin } = usePrivy()
  const { wallets: privyWallets } = useWallets()
  
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Action states
  const [actionsDone, setActionsDone] = useState<Record<string, boolean>>({})
  const [cswLinkBusy, setCswLinkBusy] = useState(false)
  const [cswLinkError, setCswLinkError] = useState<string | null>(null)
  const [copyToast, setCopyToast] = useState<string | null>(null)

  // Extract email from Privy user
  const userEmail = useMemo(() => {
    if (!privyUser) return null
    return privyUser.email?.address || null
  }, [privyUser])

  // Extract wallet addresses
  const walletClientTypeOf = useCallback((w: any): string => {
    return String(
      w?.wallet_client_type ??
        w?.walletClientType ??
        w?.connector_type ??
        w?.connectorType ??
        w?.type ??
        '',
    ).trim().toLowerCase()
  }, [])

  const embeddedWallet = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    return ws.find((w) => {
      const t = walletClientTypeOf(w)
      return t === 'privy' || t.includes('privy') || t.includes('embedded')
    }) ?? null
  }, [privyWallets, walletClientTypeOf])

  // Check if user has linked a CSW (any external wallet)
  const hasLinkedCsw = useMemo(() => {
    if (!privyUser) return false
    const wallets = Array.isArray(privyWallets) ? privyWallets : []
    return wallets.some((w: any) => {
      const t = walletClientTypeOf(w)
      return !t.includes('privy') && !t.includes('embedded') && isValidEvmAddress(w?.address || '')
    })
  }, [privyUser, privyWallets, walletClientTypeOf])

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    if (!userEmail) return
    
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch(`${appUrl}/api/waitlist/position?email=${encodeURIComponent(userEmail)}`)
      const json = await res.json()
      
      if (json.success && json.data) {
        setUserData({
          email: userEmail,
          referralCode: json.data.referralCode || null,
          cswLinked: json.data.points?.csw > 0 || hasLinkedCsw,
          position: json.data,
        })
      } else {
        // User not found - they need to complete waitlist signup first
        setError('Please complete the waitlist signup first.')
      }
    } catch (e) {
      setError('Failed to load profile data.')
    } finally {
      setLoading(false)
    }
  }, [appUrl, userEmail, hasLinkedCsw])

  useEffect(() => {
    if (privyAuthed && userEmail) {
      fetchUserData()
    } else if (privyReady && !privyAuthed) {
      setLoading(false)
    }
  }, [privyAuthed, userEmail, privyReady, fetchUserData])

  // Load saved actions from localStorage
  useEffect(() => {
    if (!userData?.referralCode) return
    try {
      const key = `cv_waitlist_actions_${userData.referralCode}`
      const saved = localStorage.getItem(key)
      if (saved) {
        setActionsDone(JSON.parse(saved))
      }
    } catch {
      // ignore
    }
  }, [userData?.referralCode])

  // Link account hook from Privy
  const { linkWallet } = useLinkAccount({
    onSuccess: () => {
      setCswLinkBusy(false)
      fetchUserData()
    },
    onError: (error) => {
      setCswLinkBusy(false)
      setCswLinkError(typeof error === 'string' ? error : 'Failed to link wallet')
    },
  })

  // Handle CSW linking
  const handleLinkCsw = useCallback(async () => {
    if (cswLinkBusy || !privyAuthed) return
    setCswLinkBusy(true)
    setCswLinkError(null)

    try {
      // Trigger Privy to link a wallet
      linkWallet()
    } catch (e: any) {
      setCswLinkBusy(false)
      setCswLinkError(e?.message || 'Failed to link wallet')
    }
  }, [cswLinkBusy, linkWallet, privyAuthed])

  // Handle social action
  const handleSocialAction = useCallback(async (action: string, url: string) => {
    // Mark as done locally
    setActionsDone(prev => {
      const next = { ...prev, [action]: true }
      if (userData?.referralCode) {
        try {
          localStorage.setItem(`cv_waitlist_actions_${userData.referralCode}`, JSON.stringify(next))
        } catch { /* ignore */ }
      }
      return next
    })

    // Sync to server
    if (userEmail) {
      try {
        await fetch(`${appUrl}/api/waitlist/task-claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail, taskKey: action }),
        })
        // Refresh position
        fetchUserData()
      } catch {
        // ignore
      }
    }

    // Open link in new tab
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [appUrl, fetchUserData, userData?.referralCode, userEmail])

  // Copy referral link
  const handleCopyReferral = useCallback(async () => {
    if (!userData?.referralCode) return
    const link = `${appUrl}?ref=${userData.referralCode}`
    try {
      await navigator.clipboard.writeText(link)
      setCopyToast('Copied!')
      setTimeout(() => setCopyToast(null), 2000)
    } catch {
      setCopyToast('Failed to copy')
      setTimeout(() => setCopyToast(null), 2000)
    }
  }, [appUrl, userData?.referralCode])

  // Not authenticated - show login
  if (privyReady && !privyAuthed) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center px-4 py-12 bg-[#020202]">
        <div className="w-full max-w-[440px]">
          <div className="flex items-center gap-3 mb-8">
            <Logo width={32} height={32} showText={false} />
            <div>
              <div className="text-[13px] text-white font-medium">4626.fun</div>
              <div className="text-[11px] text-zinc-500">Waitlist Profile</div>
            </div>
          </div>

          <div className="rounded-3xl bg-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl p-6 space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-[24px] font-light text-white">Sign in to view your profile</h1>
              <p className="text-[14px] text-zinc-500">
                Connect to see your points, rank, and complete actions.
              </p>
            </div>

            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0052FF] text-white text-[14px] font-medium hover:bg-[#0047E1] transition-all duration-200"
              onClick={() => privyLogin()}
            >
              Sign In
            </button>

            <Link
              to="/"
              className="flex items-center justify-center gap-2 text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to waitlist
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center px-4 py-12 bg-[#020202]">
        <div className="text-zinc-500">Loading...</div>
      </div>
    )
  }

  // Error or no data
  if (error || !userData) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center px-4 py-12 bg-[#020202]">
        <div className="w-full max-w-[440px]">
          <div className="rounded-3xl bg-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl p-6 space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-[24px] font-light text-white">Join the waitlist first</h1>
              <p className="text-[14px] text-zinc-500">
                {error || 'Complete the waitlist signup to access your profile.'}
              </p>
            </div>

            <Link
              to="/"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0052FF] text-white text-[14px] font-medium hover:bg-[#0047E1] transition-all duration-200"
            >
              Join Waitlist
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const position = userData.position
  const referralLink = userData.referralCode ? `${appUrl}?ref=${userData.referralCode}` : null

  return (
    <div className="min-h-[100svh] px-4 py-8 bg-[#020202]">
      <div className="w-full max-w-[540px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo width={28} height={28} showText={false} />
            <div>
              <div className="text-[13px] text-white font-medium">4626.fun</div>
              <div className="text-[11px] text-zinc-500">Profile</div>
            </div>
          </div>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
        </div>

        {/* Points Summary Card */}
        <motion.div {...fadeUp} className="rounded-2xl bg-gradient-to-br from-[#0052FF]/10 to-transparent border border-[#0052FF]/20 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.15em] text-[#0052FF] font-medium mb-1">
                Your Points
              </div>
              <div className="text-[40px] font-light text-white tabular-nums tracking-tight leading-none">
                {position?.points.total.toLocaleString() ?? '—'}
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5 text-[13px] text-zinc-400">
                <Trophy className="w-4 h-4" />
                Rank #{position?.rank.total ?? '—'}
              </div>
              <div className="text-[12px] text-zinc-500 mt-1">
                Top {position?.percentileInvite ?? '—'}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-zinc-800/50">
            <div className="text-center">
              <div className="text-[18px] font-light text-white tabular-nums">
                {position?.referrals.qualifiedCount ?? 0}
              </div>
              <div className="text-[11px] text-zinc-500">Referrals</div>
            </div>
            <div className="text-center">
              <div className="text-[18px] font-light text-white tabular-nums">
                +{position?.points.invite ?? 0}
              </div>
              <div className="text-[11px] text-zinc-500">From refs</div>
            </div>
            <div className="text-center">
              <Link to="/leaderboard" className="text-[13px] text-[#0052FF] hover:text-[#3373FF] transition-colors">
                Leaderboard →
              </Link>
            </div>
          </div>
        </motion.div>

        {/* CSW Linking - High Priority */}
        {!userData.cswLinked ? (
          <motion.div {...fadeUp} className="rounded-2xl border-2 border-[#0052FF]/40 bg-[#0052FF]/5 p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
                <Wallet className="w-6 h-6 text-[#0052FF]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[15px] text-white font-medium">Link Coinbase Smart Wallet</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#0052FF]/20 text-[#0052FF] text-[11px] font-medium">
                    +{LINK_CSW_POINTS} pts
                  </span>
                </div>
                <p className="text-[13px] text-zinc-500">
                  Connect your CSW to unlock the biggest points boost and prepare for launch.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0052FF] text-white text-[14px] font-medium hover:bg-[#0047E1] transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
              disabled={cswLinkBusy}
              onClick={handleLinkCsw}
            >
              {cswLinkBusy ? 'Linking...' : 'Link Wallet'}
            </button>
            {cswLinkError && <div className="text-[12px] text-red-400">{cswLinkError}</div>}
          </motion.div>
        ) : (
          <motion.div {...fadeUp} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-[14px] text-white font-medium">Wallet Linked</div>
                <div className="text-[12px] text-zinc-500">+{LINK_CSW_POINTS} points earned</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Referral Section */}
        {referralLink && (
          <motion.div {...fadeUp} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-zinc-400" />
              <div className="text-[14px] text-white font-medium">Invite Friends</div>
            </div>
            
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-black/40 px-3 py-2.5">
              <span className="flex-1 font-mono text-[12px] text-zinc-400 truncate">
                {referralLink}
              </span>
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                onClick={handleCopyReferral}
              >
                <Copy className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
            
            {copyToast && (
              <div className="text-[12px] text-emerald-400">{copyToast}</div>
            )}

            <div className="flex gap-2 text-[12px] text-zinc-500">
              <span>+{REFERRAL_SIGNUP_POINTS} per signup</span>
              <span>•</span>
              <span>+{REFERRAL_CSW_LINK_POINTS} when they link CSW</span>
            </div>
          </motion.div>
        )}

        {/* Social Actions */}
        <motion.div {...fadeUp} className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-zinc-600 font-medium">
            <Zap className="w-3.5 h-3.5" />
            Earn More Points
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden divide-y divide-zinc-800/50">
            {/* High Value Socials */}
            <SocialRow
              label="Follow on Farcaster"
              handle="@4626"
              points={SOCIAL_POINTS.farcaster}
              done={actionsDone.farcaster}
              onAction={() => handleSocialAction('farcaster', SOCIAL_LINKS.farcaster)}
              verified
            />
            <SocialRow
              label="Follow on Base App"
              handle="@4626"
              points={SOCIAL_POINTS.baseApp}
              done={actionsDone.baseApp}
              onAction={() => handleSocialAction('baseApp', SOCIAL_LINKS.baseApp)}
            />
            <SocialRow
              label="Follow on Zora"
              handle="@4626"
              points={SOCIAL_POINTS.zora}
              done={actionsDone.zora}
              onAction={() => handleSocialAction('zora', SOCIAL_LINKS.zora)}
            />
            <SocialRow
              label="Follow on X"
              handle="@4626fun"
              points={SOCIAL_POINTS.x}
              done={actionsDone.x || actionsDone.follow}
              onAction={() => handleSocialAction('x', SOCIAL_LINKS.x)}
            />
            <SocialRow
              label="Join Discord"
              handle="4626"
              points={SOCIAL_POINTS.discord}
              done={actionsDone.discord}
              onAction={() => handleSocialAction('discord', SOCIAL_LINKS.discord)}
            />
            <SocialRow
              label="Join Telegram"
              handle="@fun4626"
              points={SOCIAL_POINTS.telegram}
              done={actionsDone.telegram}
              onAction={() => handleSocialAction('telegram', SOCIAL_LINKS.telegram)}
            />
          </div>
        </motion.div>

        {/* Bonus Actions */}
        <motion.div {...fadeUp} className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-600 font-medium">
            Bonus
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden divide-y divide-zinc-800/50">
            <SocialRow
              label="Star on GitHub"
              handle="4626fun"
              points={BONUS_POINTS.github}
              done={actionsDone.github}
              onAction={() => handleSocialAction('github', SOCIAL_LINKS.github)}
            />
            <SocialRow
              label="Follow on TikTok"
              handle="@4626fun"
              points={BONUS_POINTS.tiktok}
              done={actionsDone.tiktok}
              onAction={() => handleSocialAction('tiktok', SOCIAL_LINKS.tiktok)}
            />
            <SocialRow
              label="Follow on Instagram"
              handle="@4626fun"
              points={BONUS_POINTS.instagram}
              done={actionsDone.instagram}
              onAction={() => handleSocialAction('instagram', SOCIAL_LINKS.instagram)}
            />
            <SocialRow
              label="Join Reddit"
              handle="r/4626"
              points={BONUS_POINTS.reddit}
              done={actionsDone.reddit}
              onAction={() => handleSocialAction('reddit', SOCIAL_LINKS.reddit)}
            />
          </div>
        </motion.div>

        {/* Points Breakdown */}
        <motion.div {...fadeUp} className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
          <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-600 font-medium mb-3">
            Points Breakdown
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-zinc-500">Signup</span>
              <span className="text-zinc-300">+{position?.points.signup ?? SIGNUP_POINTS}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">CSW Link</span>
              <span className={userData.cswLinked ? 'text-emerald-400' : 'text-zinc-500'}>
                +{position?.points.csw ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Referrals</span>
              <span className="text-zinc-300">+{position?.points.invite ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Social</span>
              <span className="text-zinc-300">+{position?.points.social ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Bonus</span>
              <span className="text-zinc-300">+{position?.points.bonus ?? 0}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-zinc-800">
              <span className="text-white font-medium">Total</span>
              <span className="text-white font-medium">{position?.points.total ?? 0}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// Social action row component
function SocialRow({
  label,
  handle,
  points,
  done,
  onAction,
  verified,
}: {
  label: string
  handle: string
  points: number
  done: boolean
  onAction: () => void
  verified?: boolean
}) {
  return (
    <div className="px-4 py-3.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
            done
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : 'bg-zinc-800/50 border border-zinc-700'
          }`}
        >
          {done && <Check className="w-3.5 h-3.5 text-emerald-400" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] text-white">{label}</span>
            {verified && (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#0052FF]/10 text-[#0052FF] font-medium">
                VERIFIED
              </span>
            )}
          </div>
          <div className="text-[12px] text-zinc-500">{handle}</div>
        </div>
      </div>
      <button
        type="button"
        className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
          done
            ? 'bg-zinc-800/50 text-zinc-500 cursor-default'
            : 'bg-[#0052FF] text-white hover:bg-[#0047E1] active:scale-[0.98]'
        }`}
        onClick={() => !done && onAction()}
        disabled={done}
      >
        {done ? '✓ Done' : `+${points}`}
      </button>
    </div>
  )
}

export default WaitlistProfile
