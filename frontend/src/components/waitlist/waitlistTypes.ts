export type Persona = 'creator' | 'user'
export type Variant = 'page' | 'embedded'
export type ActionKey = 'shareX' | 'copyLink' | 'share' | 'follow' | 'saveApp'
export type ContactPreference = 'wallet' | 'email'
export type VerificationMethod = 'siwe' | 'privy' | 'solana'
export type VerificationClaim = { method: VerificationMethod; subject: string; timestamp: string }

export type FlowState = {
  persona: Persona | null
  step: 'persona' | 'verify' | 'email' | 'done'
  contactPreference: ContactPreference
  email: string
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
  waitlistPosition: {
    points: { total: number; invite: number; signup: number; tasks: number }
    rank: { invite: number | null; total: number | null }
    totalCount: number
    totalAheadInvite: number | null
    percentileInvite: number | null
    referrals: { qualifiedCount: number; pendingCount: number; pendingCountCapped: number; pendingCap: number }
  } | null
}
