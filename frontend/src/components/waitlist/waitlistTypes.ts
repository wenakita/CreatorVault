export type Persona = 'creator' | 'user'
export type Variant = 'page' | 'embedded'

// Legacy actions
export type LegacyActionKey = 'shareX' | 'copyLink' | 'share' | 'follow' | 'saveApp'

// New social actions (verified)
export type SocialActionKey = 'farcaster' | 'baseApp' | 'zora' | 'x' | 'discord' | 'telegram'

// Bonus actions (honor system)
export type BonusActionKey = 'github' | 'tiktok' | 'instagram' | 'reddit'

// Combined action key type
export type ActionKey = LegacyActionKey | SocialActionKey | BonusActionKey

export type ContactPreference = 'wallet' | 'email'
export type VerificationMethod = 'siwe' | 'privy' | 'solana'
export type VerificationClaim = { method: VerificationMethod; subject: string; timestamp: string }

export type FlowState = {
  persona: Persona | null
  step: 'persona' | 'verify' | 'email' | 'link-csw' | 'done'
  contactPreference: ContactPreference
  email: string
  emailOptOut: boolean
  busy: boolean
  error: string | null
  doneEmail: string | null
}

export type VerificationState = {
  verifiedWallet: string | null
  verifiedWalletMethod: VerificationMethod | null
  verifiedSolana: string | null
  privyVerifyBusy: boolean
  privyVerifyError: string | null
  baseSubAccount: string | null
  baseSubAccountBusy: boolean
  baseSubAccountError: string | null
}

export type WaitlistState = {
  creatorCoin: {
    address: string
    symbol: string | null
    coinType: string | null
    imageUrl: string | null
    marketCapUsd: number | null
    volume24hUsd: number | null
    holders: number | null
    priceUsd: number | null
  } | null
  creatorCoinDeclaredMissing: boolean
  creatorCoinBusy: boolean
  claimCoinBusy: boolean
  claimCoinError: string | null
  referralCodeTaken: boolean
  claimReferralCode: string
  inviteToast: string | null
  inviteTemplateIdx: number
  referralCode: string | null
  shareBusy: boolean
  shareToast: string | null
  actionsDone: Record<ActionKey, boolean>
  miniAppAddSupported: boolean | null
  // CSW linking status
  cswLinked: boolean
  cswLinkBusy: boolean
  cswLinkError: string | null
  waitlistPosition: {
    points: {
      total: number
      invite: number
      signup: number
      tasks: number
      csw: number          // Points from CSW linking
      social: number       // Points from verified social actions
      bonus: number        // Points from honor system actions
    }
    rank: { invite: number | null; total: number | null }
    totalCount: number
    totalAheadInvite: number | null
    percentileInvite: number | null
    referrals: {
      qualifiedCount: number     // Referrals who linked CSW
      pendingCount: number       // Referrals who only signed up
      pendingCountCapped: number
      pendingCap: number
    }
  } | null
}
