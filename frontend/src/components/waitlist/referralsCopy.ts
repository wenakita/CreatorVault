export const REFERRAL_BADGES = [
  { threshold: 1, label: 'First convert' },
  { threshold: 3, label: 'Signal' },
  { threshold: 10, label: 'Momentum' },
  { threshold: 25, label: 'Operator' },
] as const

export const REFERRAL_TWEET_TEMPLATES = [
  `CreatorVaults are going live on Base. Founding creators get early access.\nJoin the waitlist: {ref_link} @4626fun`,
  `Early access is invite-only right now. If you’re a creator, you want in.\nWaitlist: {ref_link} @4626fun`,
  `4626 is picking founding creators from the waitlist leaderboard.\nIf you build onchain, don’t watch from the sidelines: {ref_link} @4626fun`,
  `I’m trying to secure a founding CreatorVault spot. Invites that convert count.\nJoin through my link: {ref_link} @4626fun`,
  `Launch is coming. Founder slots are earned, not asked for.\nGet on the list: {ref_link} @4626fun`,
] as const

export function fillTweetTemplate(template: string, refLink: string): string {
  return String(template).split('{ref_link}').join(refLink)
}

export const INVITE_COPY = {
  title: 'Invite creators. Climb the leaderboard.',
  body: 'Your link is tracked. Every real signup through it counts as a converted invite.',
  counterLabel: 'Converted invites',
  counterHint: 'Only successful signups count.',
  shareButton: 'Share on X',
  shareMicrocopy: 'Use one of 5 templates. Keep it personal—your voice converts.',
  linkLabel: 'Your invite link',
  linkHelper: 'Anyone who joins through this link boosts your score.',
  copyButton: 'Copy link',
  copiedToast: 'Link copied.',
  conversionsHeadline: '{count} invites converted',
  conversionsSecondary: '{weekly_count} this week',
  conversionsAttributionHint: 'Last-click attribution. One conversion per signup.',
  rewardsTitle: 'Rewards',
  rewardsBody: 'Converted invites unlock badges. Weekly winners earn Founder access as one of the first CreatorVaults.',
  founderTitle: 'CreatorVault Founding Creator',
  founderBody: 'Early access to deploy your vault, priority onboarding, and a Founder badge on your profile.',
  finePrint: 'Winners are subject to basic anti-fraud review.',
} as const

