import type { ActionKey } from './waitlistTypes'

// Core actions (automated verification)
export const SIGNUP_POINTS = 100
export const LINK_CSW_POINTS = 250

// Referral points
export const REFERRAL_SIGNUP_POINTS = 50
export const REFERRAL_CSW_LINK_POINTS = 100

// Social actions - verified via API/bot
export const SOCIAL_POINTS = {
  farcaster: 75,      // Neynar API
  baseApp: 50,        // Neynar API (Farcaster-based)
  zora: 50,           // Zora API
  x: 50,              // Honor system
  discord: 50,        // Discord bot
  telegram: 50,       // Telegram bot
} as const

// Bonus actions - honor system (low value = low cheat incentive)
export const BONUS_POINTS = {
  github: 10,
  tiktok: 10,
  instagram: 10,
  reddit: 10,
} as const

// Legacy action points for backwards compatibility
export const ACTION_POINTS: Record<ActionKey, number> = {
  // Legacy
  shareX: 10,
  copyLink: 5,
  share: 7,
  follow: SOCIAL_POINTS.x,
  saveApp: 6,
  // New social actions
  farcaster: SOCIAL_POINTS.farcaster,
  baseApp: SOCIAL_POINTS.baseApp,
  zora: SOCIAL_POINTS.zora,
  x: SOCIAL_POINTS.x,
  discord: SOCIAL_POINTS.discord,
  telegram: SOCIAL_POINTS.telegram,
  // Bonus actions
  github: BONUS_POINTS.github,
  tiktok: BONUS_POINTS.tiktok,
  instagram: BONUS_POINTS.instagram,
  reddit: BONUS_POINTS.reddit,
}

// Social links
export const SOCIAL_LINKS = {
  x: 'https://x.com/4626fun',
  farcaster: 'https://warpcast.com/4626',
  baseApp: 'https://base.org/@4626',
  zora: 'https://zora.co/@4626',
  discord: 'https://discord.gg/4626',
  telegram: 'https://t.me/fun4626',
  github: 'https://github.com/4626fun',
  tiktok: 'https://tiktok.com/@4626fun',
  instagram: 'https://instagram.com/4626fun',
  reddit: 'https://reddit.com/r/4626',
} as const
