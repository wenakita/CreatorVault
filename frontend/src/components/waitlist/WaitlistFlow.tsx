import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getAppBaseUrl } from '@/lib/host'
import { useAccount } from 'wagmi'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { isPrivyClientEnabled } from '@/lib/flags'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { toViemAccount, useBaseAccountSdk, useConnectWallet, usePrivy, useWallets } from '@privy-io/react-auth'
import { base } from 'wagmi/chains'
import { Check, CheckCircle2, ArrowLeft } from 'lucide-react'
import { useMiniAppContext } from '@/hooks'
import { apiAliasPath } from '@/lib/apiBase'
import { fetchZoraCoin, fetchZoraProfile } from '@/lib/zora/client'
import { REFERRAL_TWEET_TEMPLATES, fillTweetTemplate, INVITE_COPY } from '@/components/waitlist/referralsCopy'
import { Logo } from '@/components/brand/Logo'

type Persona = 'creator' | 'user'
type Variant = 'page' | 'embedded'
type ActionKey = 'shareX' | 'copyLink' | 'share' | 'follow' | 'saveApp'
type ContactPreference = 'wallet' | 'email'
type VerificationMethod = 'siwe' | 'privy' | 'solana'
type VerificationClaim = { method: VerificationMethod; subject: string; timestamp: string }

type FlowState = {
  persona: Persona | null
  step: 'persona' | 'verify' | 'email' | 'done'
  contactPreference: ContactPreference
  email: string
  busy: boolean
  error: string | null
  doneEmail: string | null
}

type VerificationState = {
  verifiedWallet: string | null
  verifiedWalletMethod: VerificationMethod | null
  verifiedSolana: string | null
  privyVerifyBusy: boolean
  privyVerifyError: string | null
  baseSubAccount: string | null
  baseSubAccountBusy: boolean
  baseSubAccountError: string | null
}

type WaitlistState = {
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

type PatchAction<T> = { type: 'patch'; patch: Partial<T> } | { type: 'reset' }
type WaitlistAction =
  | PatchAction<WaitlistState>
  | { type: 'setActions'; actions: Record<ActionKey, boolean> }

const ACTION_POINTS: Record<ActionKey, number> = {
  shareX: 10,
  copyLink: 5,
  share: 7,
  follow: 4,
  saveApp: 6,
}

const SIGNUP_POINTS = 1

const EMPTY_ACTION_STATE: Record<ActionKey, boolean> = {
  shareX: false,
  copyLink: false,
  share: false,
  follow: false,
  saveApp: false,
}

const initialFlowState: FlowState = {
  persona: null,
  step: 'persona',
  contactPreference: 'wallet',
  email: '',
  busy: false,
  error: null,
  doneEmail: null,
}

const initialVerificationState: VerificationState = {
  verifiedWallet: null,
  verifiedWalletMethod: null,
  verifiedSolana: null,
  privyVerifyBusy: false,
  privyVerifyError: null,
  baseSubAccount: null,
  baseSubAccountBusy: false,
  baseSubAccountError: null,
}

const initialWaitlistState: WaitlistState = {
  creatorCoin: null,
  creatorCoinBusy: false,
  claimCoinBusy: false,
  claimCoinError: null,
  referralCodeTaken: false,
  claimReferralCode: '',
  inviteToast: null,
  inviteTemplateIdx: 0,
  referralCode: null,
  shareBusy: false,
  shareToast: null,
  actionsDone: { ...EMPTY_ACTION_STATE },
  miniAppAddSupported: null,
  waitlistPosition: null,
}

type FlowAction =
  | { type: 'reset' }
  | { type: 'select_persona'; persona: Persona }
  | { type: 'force_persona'; persona: Persona }
  | { type: 'back' }
  | { type: 'verified' }
  | { type: 'advance_email' }
  | { type: 'submit_success'; doneEmail: string | null }
  | { type: 'set_email'; email: string }
  | { type: 'set_busy'; busy: boolean }
  | { type: 'set_error'; error: string | null }
  | { type: 'set_contact_preference'; contactPreference: ContactPreference }

function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'reset':
      return initialFlowState
    case 'select_persona': {
      if (state.step !== 'persona') return state
      return {
        ...state,
        persona: action.persona,
        step: 'verify',
        contactPreference: 'wallet',
      }
    }
    case 'force_persona':
      if (state.step !== 'persona') return state
      return {
        ...state,
        persona: action.persona,
        step: 'verify',
        contactPreference: 'wallet',
      }
    case 'back': {
      if (state.step === 'verify') return { ...state, step: 'persona' }
      if (state.step === 'email') {
        if (state.persona === 'creator') return { ...state, step: 'verify' }
        if (state.persona === 'user') return { ...state, step: 'verify' }
        return { ...state, step: 'persona' }
      }
      return state
    }
    case 'verified':
      if (state.step !== 'verify') return state
      if (!state.persona) return state
      return { ...state, step: 'email' }
    case 'advance_email':
      if (!state.persona) return state
      return { ...state, step: 'email' }
    case 'submit_success':
      if (state.step === 'done') return state
      return { ...state, step: 'done', doneEmail: action.doneEmail }
    case 'set_email':
      return { ...state, email: action.email }
    case 'set_busy':
      return { ...state, busy: action.busy }
    case 'set_error':
      return { ...state, error: action.error }
    case 'set_contact_preference':
      return { ...state, contactPreference: action.contactPreference }
    default:
      return state
  }
}

type VerificationAction =
  | { type: 'reset' }
  | { type: 'verify_wallet'; address: string; method: VerificationMethod | null }
  | { type: 'verify_solana'; address: string }
  | { type: 'clear_wallet_verifications' }
  | { type: 'privy_start' }
  | { type: 'privy_notice'; error: string }
  | { type: 'privy_error'; error: string | null }
  | { type: 'privy_done' }
  | { type: 'base_sub_start' }
  | { type: 'base_sub_success'; address: string }
  | { type: 'base_sub_error'; error: string }

function verificationReducer(state: VerificationState, action: VerificationAction): VerificationState {
  switch (action.type) {
    case 'reset':
      return initialVerificationState
    case 'verify_wallet': {
      if (!action.address) return state
      const nextMethod =
        action.method && (!state.verifiedWalletMethod || state.verifiedWallet !== action.address)
          ? action.method
          : state.verifiedWalletMethod
      return { ...state, verifiedWallet: action.address, verifiedWalletMethod: nextMethod }
    }
    case 'verify_solana':
      if (!action.address) return state
      return { ...state, verifiedSolana: action.address }
    case 'clear_wallet_verifications':
      return {
        ...state,
        verifiedWallet: null,
        verifiedWalletMethod: null,
        verifiedSolana: null,
        baseSubAccount: null,
        baseSubAccountBusy: false,
        baseSubAccountError: null,
      }
    case 'privy_start':
      return { ...state, privyVerifyBusy: true, privyVerifyError: null }
    case 'privy_notice':
      return { ...state, privyVerifyError: action.error }
    case 'privy_error':
      return { ...state, privyVerifyBusy: false, privyVerifyError: action.error }
    case 'privy_done':
      return { ...state, privyVerifyBusy: false, privyVerifyError: null }
    case 'base_sub_start':
      return { ...state, baseSubAccountBusy: true, baseSubAccountError: null }
    case 'base_sub_success':
      return { ...state, baseSubAccountBusy: false, baseSubAccountError: null, baseSubAccount: action.address }
    case 'base_sub_error':
      return { ...state, baseSubAccountBusy: false, baseSubAccountError: action.error }
    default:
      return state
  }
}

function waitlistReducer(state: WaitlistState, action: WaitlistAction): WaitlistState {
  if (action.type === 'reset') return initialWaitlistState
  if (action.type === 'setActions') return { ...state, actionsDone: action.actions }
  if (action.type === 'patch') return { ...state, ...action.patch }
  return state
}

export function WaitlistFlow(props: { variant?: Variant; sectionId?: string }) {
  const variant: Variant = props.variant ?? 'page'
  const sectionId = props.sectionId ?? 'waitlist'

  const location = useLocation()
  const [flow, dispatchFlow] = useReducer(flowReducer, initialFlowState)
  const [verification, dispatchVerification] = useReducer(verificationReducer, initialVerificationState)
  const [waitlist, dispatchWaitlist] = useReducer(waitlistReducer, initialWaitlistState)
  const creatorCoinForWalletRef = useRef<string | null>(null)
  const claimCoinForWalletRef = useRef<string | null>(null)

  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const referralSessionIdRef = useRef<string | null>(null)
  const apiRouteCacheRef = useRef<{ base: string; useAlias: boolean } | null>(null)
  const refreshPositionInFlightRef = useRef<Promise<void> | null>(null)
  const refreshPositionAbortRef = useRef<AbortController | null>(null)
  const subAccountAttemptRef = useRef<string | null>(null)

  const appUrl = useMemo(() => getAppBaseUrl(), [])
  const { address: connectedAddressRaw } = useAccount()
  const siwe = useSiweAuth()
  const miniApp = useMiniAppContext()

  const setWaitlist = useCallback((patch: Partial<WaitlistState>) => {
    dispatchWaitlist({ type: 'patch', patch })
  }, [])

  const selectPersona = useCallback((persona: Persona) => dispatchFlow({ type: 'select_persona', persona }), [])
  const forcePersona = useCallback((persona: Persona) => dispatchFlow({ type: 'force_persona', persona }), [])
  const goBackFlow = useCallback(() => dispatchFlow({ type: 'back' }), [])
  const advanceAfterVerify = useCallback(() => dispatchFlow({ type: 'verified' }), [])
  const advanceToEmail = useCallback(() => dispatchFlow({ type: 'advance_email' }), [])
  const submitSuccess = useCallback((doneEmail: string | null) => dispatchFlow({ type: 'submit_success', doneEmail }), [])
  const setEmail = useCallback((email: string) => dispatchFlow({ type: 'set_email', email }), [])
  const setBusy = useCallback((busy: boolean) => dispatchFlow({ type: 'set_busy', busy }), [])
  const setError = useCallback((error: string | null) => dispatchFlow({ type: 'set_error', error }), [])
  const setContactPreference = useCallback(
    (contactPreference: ContactPreference) => dispatchFlow({ type: 'set_contact_preference', contactPreference }),
    [],
  )

  const verifyWallet = useCallback(
    (address: string, method: VerificationMethod | null) => dispatchVerification({ type: 'verify_wallet', address, method }),
    [],
  )
  const verifySolana = useCallback((address: string) => dispatchVerification({ type: 'verify_solana', address }), [])
  const clearWalletVerifications = useCallback(() => dispatchVerification({ type: 'clear_wallet_verifications' }), [])
  const startPrivyVerify = useCallback(() => dispatchVerification({ type: 'privy_start' }), [])
  const finishPrivyVerify = useCallback(() => dispatchVerification({ type: 'privy_done' }), [])
  const setPrivyVerifyError = useCallback(
    (error: string | null) => dispatchVerification({ type: 'privy_error', error }),
    [],
  )
  const setPrivyVerifyNotice = useCallback(
    (error: string) => dispatchVerification({ type: 'privy_notice', error }),
    [],
  )
  const startBaseSubAccount = useCallback(() => dispatchVerification({ type: 'base_sub_start' }), [])
  const setBaseSubAccount = useCallback(
    (address: string) => dispatchVerification({ type: 'base_sub_success', address }),
    [],
  )
  const setBaseSubAccountError = useCallback(
    (error: string) => dispatchVerification({ type: 'base_sub_error', error }),
    [],
  )

  const setCreatorCoin = useCallback((creatorCoin: WaitlistState['creatorCoin']) => setWaitlist({ creatorCoin }), [setWaitlist])
  const setCreatorCoinBusy = useCallback((creatorCoinBusy: boolean) => setWaitlist({ creatorCoinBusy }), [setWaitlist])
  const setClaimCoinBusy = useCallback((claimCoinBusy: boolean) => setWaitlist({ claimCoinBusy }), [setWaitlist])
  const setClaimCoinError = useCallback((claimCoinError: string | null) => setWaitlist({ claimCoinError }), [setWaitlist])
  const setReferralCodeTaken = useCallback((referralCodeTaken: boolean) => setWaitlist({ referralCodeTaken }), [setWaitlist])
  const setClaimReferralCode = useCallback((claimReferralCode: string) => setWaitlist({ claimReferralCode }), [setWaitlist])
  const setInviteToast = useCallback((inviteToast: string | null) => setWaitlist({ inviteToast }), [setWaitlist])
  const setInviteTemplateIdx = useCallback((inviteTemplateIdx: number) => setWaitlist({ inviteTemplateIdx }), [setWaitlist])
  const setReferralCode = useCallback((referralCode: string | null) => setWaitlist({ referralCode }), [setWaitlist])
  const setShareBusy = useCallback((shareBusy: boolean) => setWaitlist({ shareBusy }), [setWaitlist])
  const setShareToast = useCallback((shareToast: string | null) => setWaitlist({ shareToast }), [setWaitlist])
  const setActionsDone = useCallback(
    (actionsDone: Record<ActionKey, boolean>) => dispatchWaitlist({ type: 'setActions', actions: actionsDone }),
    [],
  )
  const setMiniAppAddSupported = useCallback(
    (miniAppAddSupported: boolean | null) => setWaitlist({ miniAppAddSupported }),
    [setWaitlist],
  )
  const setWaitlistPosition = useCallback(
    (waitlistPosition: WaitlistState['waitlistPosition']) => setWaitlist({ waitlistPosition }),
    [setWaitlist],
  )

  const { persona, step, contactPreference, email, busy, error, doneEmail } = flow
  const {
    verifiedWallet,
    verifiedWalletMethod,
    verifiedSolana,
    privyVerifyBusy,
    privyVerifyError,
    baseSubAccount,
    baseSubAccountBusy,
    baseSubAccountError,
  } = verification
  const {
    creatorCoin,
    creatorCoinBusy,
    claimCoinBusy,
    claimCoinError,
    referralCodeTaken,
    claimReferralCode,
    inviteToast,
    inviteTemplateIdx,
    referralCode,
    shareBusy,
    shareToast,
    actionsDone,
    miniAppAddSupported,
    waitlistPosition,
  } = waitlist

  const privyStatus = usePrivyClientStatus()
  const showPrivy = isPrivyClientEnabled()
  const {
    ready: privyReady,
    authenticated: privyAuthed,
    user: privyUser,
    logout: privyLogout,
    linkWallet: privyLinkWallet,
  } = usePrivy()
  const { connectWallet: privyConnectWallet } = useConnectWallet({
    onSuccess: () => {
      finishPrivyVerify()
    },
    onError: (error) => {
      const code = String(error || '')
      const msg = formatPrivyConnectError(code)
      setPrivyVerifyError(msg)
    },
  })
  const { wallets: privyWallets } = useWallets()
  const { baseAccountSdk } = useBaseAccountSdk()
  const privyVerifyAttemptRef = useRef<number>(0)

  function normalizeEmail(v: string): string {
    return v.trim().toLowerCase()
  }
  function isValidEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  }
  function normalizeAddress(v: string): string {
    return v.trim()
  }
  function isValidEvmAddress(v: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(v)
  }

  const embeddedWallet = useMemo(() => privyWallets.find((w) => w.walletClientType === 'privy') ?? null, [privyWallets])
  const baseAccountWallet = useMemo(
    () => privyWallets.find((w) => w.walletClientType === 'base_account') ?? null,
    [privyWallets],
  )
  const embeddedWalletAddress = useMemo(() => {
    const raw = typeof embeddedWallet?.address === 'string' ? embeddedWallet.address : ''
    return isValidEvmAddress(raw) ? raw : null
  }, [embeddedWallet?.address])
  const baseAccountAddress = useMemo(() => {
    const raw = typeof baseAccountWallet?.address === 'string' ? baseAccountWallet.address : ''
    return isValidEvmAddress(raw) ? raw : null
  }, [baseAccountWallet?.address])

  function isValidSolanaAddress(v: string): boolean {
    const s = String(v || '').trim()
    if (!s) return false
    // Base58-ish, 32–44 chars (covers most standard pubkeys)
    if (s.length < 32 || s.length > 44) return false
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
  }

  function extractPrivyWalletAddress(user: any, walletsOverride?: any[]): string | null {
    const wallets = Array.isArray(walletsOverride) ? walletsOverride : Array.isArray(user?.wallets) ? user.wallets : []
    const primaryWallet = user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []
    const all = [...primaryWallet, ...wallets]
    // Prefer Base Account / Coinbase Smart Wallet if present.
    for (const w of all) {
      const addr = typeof w?.address === 'string' ? w.address : null
      if (!addr || !isValidEvmAddress(addr)) continue
      const clientType = String(w?.wallet_client_type || w?.walletClientType || '').toLowerCase()
      const connectorType = String(w?.connector_type || w?.connectorType || '').toLowerCase()
      if (clientType.includes('base') || clientType.includes('smart') || connectorType.includes('base')) return addr
    }
    // Fallback: first EVM wallet.
    for (const w of all) {
      const addr = typeof w?.address === 'string' ? w.address : null
      if (addr && isValidEvmAddress(addr)) return addr
    }
    const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
    for (const a of linked) {
      const addr = typeof a?.address === 'string' ? a.address : null
      if (addr && isValidEvmAddress(addr)) return addr
    }
    return null
  }

  function extractPrivySolanaAddress(user: any, walletsOverride?: any[]): string | null {
    const wallets = Array.isArray(walletsOverride) ? walletsOverride : Array.isArray(user?.wallets) ? user.wallets : []
    const primaryWallet = user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []
    const all = [...primaryWallet, ...wallets]
    for (const w of all) {
      const chainType = String(w?.chain_type || w?.chainType || '').toLowerCase()
      const addr = typeof w?.address === 'string' ? w.address : null
      if (addr && chainType.includes('solana') && isValidSolanaAddress(addr)) return addr
    }
    const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
    for (const a of linked) {
      const t = String(a?.type || '').toLowerCase()
      const chainType = String(a?.chain_type || a?.chainType || '').toLowerCase()
      const addr = typeof a?.address === 'string' ? a.address : null
      if (!addr) continue
      if (t.includes('solana') || chainType.includes('solana')) {
        if (isValidSolanaAddress(addr)) return addr
      }
    }
    return null
  }

  function formatPrivyConnectError(code: string): string {
    const c = code.trim().toLowerCase()
    if (!c) return 'Wallet connect failed.'
    if (c.includes('user_exited') || c.includes('user_rejected')) return 'Connection cancelled.'
    if (c.includes('client_request_timeout') || c.includes('timeout')) return 'Wallet connection timed out. Try again.'
    if (c.includes('disallowed_login_method')) {
      return 'Wallet login is not enabled for this app. Enable wallet login in Privy and try again.'
    }
    if (c.includes('unsupported_chain_id')) return 'Unsupported network. Switch to Base and try again.'
    if (c.includes('generic_connect_wallet_error') || c.includes('unknown_connect_wallet_error')) {
      return 'Wallet connect failed. Try another wallet.'
    }
    return `Wallet connect failed (${code}).`
  }

  function hasPrivyLinkedWallet(user: any, walletsOverride?: any[]): boolean {
    const wallets = Array.isArray(walletsOverride) ? walletsOverride : Array.isArray(user?.wallets) ? user.wallets : []
    const primaryWallet = user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []
    const all = [...primaryWallet, ...wallets]
    if (all.some((w) => typeof w?.address === 'string')) return true
    const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
    return linked.some((a: any) => {
      const t = String(a?.type || '').toLowerCase()
      const addr = typeof a?.address === 'string' ? a.address : ''
      return t.includes('wallet') || isValidEvmAddress(addr) || isValidSolanaAddress(addr)
    })
  }

  function getPrivyWalletMissingMessage(user: any, walletsOverride?: any[]): string {
    const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
    const hasWallet = hasPrivyLinkedWallet(user, walletsOverride)
    const hasNonWalletAccount = linked.some((a: any) => {
      const t = String(a?.type || '').toLowerCase()
      return Boolean(t) && !t.includes('wallet')
    })
    if (hasWallet) return 'Connect Base Account to verify.'
    if (hasNonWalletAccount) {
      return 'Wallet login is not enabled for this app or no Base Account is linked. Enable wallet login in Privy and try again.'
    }
    return 'Wallet login is not enabled for this app. Enable wallet login in Privy and try again.'
  }

  const ensureBaseSubAccount = useCallback(async () => {
    if (!embeddedWallet || !embeddedWalletAddress) return
    if (!baseAccountWallet || !baseAccountAddress) return
    if (baseSubAccount || baseSubAccountBusy) return

    startBaseSubAccount()
    try {
      if (typeof baseAccountWallet.switchChain === 'function') {
        try {
          await baseAccountWallet.switchChain(base.id)
        } catch {
          // ignore
        }
      }

      const provider = await baseAccountWallet.getEthereumProvider()
      if (!provider?.request) throw new Error('Base Account provider missing request()')

      const res = (await provider.request({
        method: 'wallet_getSubAccounts',
        params: [
          {
            account: baseAccountAddress,
            domain: typeof window !== 'undefined' ? window.location.origin : 'https://4626.fun',
          },
        ],
      })) as { subAccounts?: Array<{ address?: string } | null> } | null

      const existing = Array.isArray(res?.subAccounts) ? res?.subAccounts?.[0] : null
      const existingAddr = typeof (existing as any)?.address === 'string' ? String((existing as any).address) : ''
      let subAddr: string | null = isValidEvmAddress(existingAddr) ? existingAddr : null

      if (!subAddr) {
        const created = (await provider.request({
          method: 'wallet_addSubAccount',
          params: [
            {
              version: '1',
              account: {
                type: 'create',
                keys: [
                  {
                    type: 'address',
                    publicKey: embeddedWalletAddress as any,
                  },
                ],
              },
            },
          ],
        })) as { address?: string } | null
        const createdAddr = typeof created?.address === 'string' ? created.address : ''
        subAddr = isValidEvmAddress(createdAddr) ? createdAddr : null
      }

      if (!subAddr) throw new Error('Failed to create Base sub-account')
      setBaseSubAccount(subAddr)

      if (baseAccountSdk?.subAccount?.setToOwnerAccount) {
        baseAccountSdk.subAccount.setToOwnerAccount(async () => {
          const account = await toViemAccount({ wallet: embeddedWallet })
          return { account }
        })
      }
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : 'Base sub-account setup failed'
      setBaseSubAccountError(msg)
    }
  }, [
    baseAccountAddress,
    baseAccountSdk,
    baseAccountWallet,
    baseSubAccount,
    baseSubAccountBusy,
    embeddedWallet,
    embeddedWalletAddress,
    setBaseSubAccount,
    setBaseSubAccountError,
    startBaseSubAccount,
  ])

  const emailTrimmed = useMemo(() => normalizeEmail(email), [email])
  const hasVerification = useMemo(() => Boolean(verifiedWallet || verifiedSolana), [verifiedWallet, verifiedSolana])
  const wantsEmail = contactPreference === 'email'
  const canUseWallet = hasVerification
  const connectedAddress = useMemo(
    () =>
      typeof connectedAddressRaw === 'string' && connectedAddressRaw.startsWith('0x') ? connectedAddressRaw.toLowerCase() : null,
    [connectedAddressRaw],
  )
  const adminBypassSet = useMemo(() => {
    // Keep this in sync with `frontend/src/App.tsx` so admins can always escape the waitlist UI.
    const seed: string[] = ['0xb05cf01231cf2ff99499682e64d3780d57c80fdd']
    const raw = String((import.meta.env.VITE_ADMIN_BYPASS_ADDRESSES as string | undefined) ?? '')
    const fromEnv = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => isValidEvmAddress(s))
    return new Set<string>([...seed, ...fromEnv].map((a) => a.toLowerCase()))
  }, [])
  const isBypassAdmin = !!connectedAddress && adminBypassSet.has(connectedAddress)

  const forcedPersona = useMemo(() => {
    const q = new URLSearchParams(location.search)
    const raw = (q.get('persona') ?? '').trim().toLowerCase()
    return raw === 'creator' ? ('creator' as const) : raw === 'user' ? ('user' as const) : null
  }, [location.search])
  const forcedPersonaAppliedRef = useRef(false)

  const refParam = useMemo(() => {
    const q = new URLSearchParams(location.search)
    const raw = (q.get('ref') ?? '').trim()
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
    return cleaned.length > 0 ? cleaned : null
  }, [location.search])

  function getOrCreateReferralSessionId(): string {
    if (referralSessionIdRef.current) return referralSessionIdRef.current
    try {
      const k = 'cv_ref_session'
      const existing = localStorage.getItem(k)
      if (existing && existing.trim()) {
        referralSessionIdRef.current = existing.trim()
        return referralSessionIdRef.current
      }
      const randomHex = (bytes = 16) => {
        const arr = new Uint8Array(bytes)
        crypto.getRandomValues(arr)
        return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
      }
      const v = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${randomHex(16)}${randomHex(16)}`
      localStorage.setItem(k, v)
      referralSessionIdRef.current = v
      return v
    } catch {
      const randomHex = (bytes = 16) => {
        const arr = new Uint8Array(bytes)
        crypto.getRandomValues(arr)
        return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
      }
      const v = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${randomHex(16)}${randomHex(16)}`
      referralSessionIdRef.current = v
      return v
    }
  }

  function getStoredReferralCode(): string | null {
    try {
      const v = localStorage.getItem('cv_ref_code')
      const t = typeof v === 'string' ? v.trim().toUpperCase() : ''
      return t ? t : null
    } catch {
      return null
    }
  }

  function storeReferralCode(code: string | null) {
    try {
      if (!code) {
        localStorage.removeItem('cv_ref_code')
        return
      }
      localStorage.setItem('cv_ref_code', code)
    } catch {
      // ignore
    }
  }

  // If user arrives with ?ref=CODE, store it and record a click.
  useEffect(() => {
    if (!refParam) return
    storeReferralCode(refParam)
    void (async () => {
      try {
        await apiFetch('/api/referrals/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            referralCode: refParam,
            sessionId: getOrCreateReferralSessionId(),
            landingUrl: typeof window !== 'undefined' ? window.location.href : null,
          }),
        })
      } catch {
        // ignore
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refParam])

  // Keep persona preselection lightweight: on first load, if persona is set via query params,
  // jump straight into the right step.
  useEffect(() => {
    if (!forcedPersona) return
    if (forcedPersonaAppliedRef.current) return
    // If user already progressed, don't override their choice mid-flow.
    if (step !== 'persona') return
    forcedPersonaAppliedRef.current = true
    forcePersona(forcedPersona)
  }, [forcePersona, forcedPersona, step])

  const totalSteps = useMemo(() => {
    // persona + verify + contact + done
    if (persona === 'creator' || persona === 'user') return 4
    return 0
  }, [persona])

  const stepIndex = useMemo(() => {
    if (step === 'persona') return 1
    if (step === 'verify') return 2
    if (step === 'email') return 3
    return totalSteps
  }, [step, totalSteps])

  const progressPct = useMemo(() => {
    if (!totalSteps) return 0
    return Math.max(0, Math.min(100, Math.round((stepIndex / totalSteps) * 100)))
  }, [stepIndex, totalSteps])

  useEffect(() => {
    if (step === 'email' && wantsEmail) {
      requestAnimationFrame(() => emailInputRef.current?.focus())
    }
  }, [step, wantsEmail])

  const apiFetch = useCallback(
    async (path: string, init: RequestInit & { withCredentials?: boolean } = {}) => {
      const bases: string[] = []
      if (typeof window !== 'undefined') bases.push(window.location.origin)
      bases.push(appUrl)

      const withCreds = Boolean(init.withCredentials)
      const headers = new Headers(init.headers ?? undefined)
      if (typeof window !== 'undefined' && path.startsWith('/api/') && !headers.has('Authorization')) {
        try {
          const token = sessionStorage.getItem('cv_siwe_session_token')
          if (token && token.trim()) headers.set('Authorization', `Bearer ${token.trim()}`)
        } catch {
          // ignore
        }
      }

      const baseInit: RequestInit = {
        ...init,
        headers,
        ...(withCreds ? { credentials: 'include' as const } : null),
      }
      delete (baseInit as any).withCredentials

      const tryOnce = async (base: string, useAlias: boolean) => {
        const b = base.replace(/\/+$/, '')
        const p = path.startsWith('/api/') && useAlias ? apiAliasPath(path) : path
        const url = `${b}${p}`
        const res = await fetch(url, baseInit)
        const ct = (res.headers.get('content-type') ?? '').toLowerCase()
        // In dev, a missing alias may return index.html; treat that as a miss and continue.
        if (ct.includes('text/html')) return null
        if (res.status === 404) return null
        if (useAlias && res.status === 405) return null
        return res
      }

      const cached = apiRouteCacheRef.current
      if (cached) {
        const res = await tryOnce(cached.base, cached.useAlias)
        if (res) return res
        apiRouteCacheRef.current = null
      }

      let lastErr: unknown = null
      const aliasModes = path.startsWith('/api/') ? [true, false] : [false]
      for (const base of bases) {
        for (const useAlias of aliasModes) {
          try {
            const res = await tryOnce(base, useAlias)
            if (res) {
              apiRouteCacheRef.current = { base, useAlias }
              return res
            }
          } catch (e: unknown) {
            lastErr = e
          }
        }
      }
      throw lastErr ?? new Error('Request failed')
    },
    [appUrl],
  )
  const refreshPosition = useCallback(
    async (emailForSync: string) => {
      if (!emailForSync) return
      if (refreshPositionInFlightRef.current) return refreshPositionInFlightRef.current

      const controller = new AbortController()
      refreshPositionAbortRef.current = controller
      const run = (async () => {
        try {
          const res = await apiFetch(`/api/waitlist/position?email=${encodeURIComponent(emailForSync)}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          })
          const json = (await res.json().catch(() => null)) as any
          const data = json?.success ? json?.data : null
          if (res.ok && data) {
            setWaitlistPosition({
              points: {
                total: typeof data?.points?.total === 'number' ? data.points.total : 0,
                invite: typeof data?.points?.invite === 'number' ? data.points.invite : 0,
                signup: typeof data?.points?.signup === 'number' ? data.points.signup : 0,
                tasks: typeof data?.points?.tasks === 'number' ? data.points.tasks : 0,
              },
              rank: {
                invite: typeof data?.rank?.invite === 'number' ? data.rank.invite : null,
                total: typeof data?.rank?.total === 'number' ? data.rank.total : null,
              },
              totalCount: typeof data?.totalCount === 'number' ? data.totalCount : 0,
              totalAheadInvite: typeof data?.totalAheadInvite === 'number' ? data.totalAheadInvite : null,
              percentileInvite: typeof data?.percentileInvite === 'number' ? data.percentileInvite : null,
              referrals: {
                qualifiedCount: typeof data?.referrals?.qualifiedCount === 'number' ? data.referrals.qualifiedCount : 0,
                pendingCount: typeof data?.referrals?.pendingCount === 'number' ? data.referrals.pendingCount : 0,
                pendingCountCapped: typeof data?.referrals?.pendingCountCapped === 'number' ? data.referrals.pendingCountCapped : 0,
                pendingCap: typeof data?.referrals?.pendingCap === 'number' ? data.referrals.pendingCap : 10,
              },
            })
          }
        } catch {
          // ignore
        } finally {
          refreshPositionInFlightRef.current = null
          refreshPositionAbortRef.current = null
        }
      })()

      refreshPositionInFlightRef.current = run
      return run
    },
    [apiFetch],
  )

  useEffect(() => {
    return () => {
      refreshPositionAbortRef.current?.abort()
    }
  }, [])

  async function claimCreatorCoin(coinAddress: string, source: 'auto' | 'manual') {
    if (claimCoinBusy) return
    const coin = normalizeAddress(coinAddress).toLowerCase()
    if (!isValidEvmAddress(coin)) {
      setClaimCoinError('Enter a valid coin address.')
      return
    }
    setClaimCoinBusy(true)
    setClaimCoinError(null)
    try {
      const res = await apiFetch('/api/creator-wallets/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ coinAddress: coin }),
      })
      const text = await res.text().catch(() => '')
      const json = text ? JSON.parse(text) : null
      if (!res.ok || !json || json.success !== true) {
        const msg = json && typeof json.error === 'string' ? json.error : `Claim failed (HTTP ${res.status})`
        throw new Error(msg)
      }

      if (source === 'manual') {
        try {
          const fetched = await fetchZoraCoin(coin as any)
          if (fetched) {
            const imageUrl =
              (fetched?.mediaContent?.previewImage?.medium as string | undefined) ||
              (fetched?.mediaContent?.previewImage?.small as string | undefined) ||
              null
            const asNumber = (v: any): number | null => {
              const n = Number(v)
              return Number.isFinite(n) ? n : null
            }
            setCreatorCoin({
              address: coin,
              symbol: fetched?.symbol ? String(fetched.symbol) : null,
              coinType: fetched?.coinType ? String(fetched.coinType) : null,
              imageUrl,
              marketCapUsd: asNumber(fetched?.marketCap),
              volume24hUsd: asNumber(fetched?.volume24h),
              holders: typeof fetched?.uniqueHolders === 'number' ? fetched.uniqueHolders : null,
              priceUsd: asNumber(fetched?.tokenPrice?.priceInUsdc),
            })
          }
        } catch {
          // ignore
        }
      }

      advanceToEmail()
    } catch (e: any) {
      setClaimCoinError(e?.message ? String(e.message) : 'Claim failed')
    } finally {
      setClaimCoinBusy(false)
    }
  }

  function primaryWalletForSubmit(): string | null {
    const pw = typeof verifiedWallet === 'string' && isValidEvmAddress(verifiedWallet) ? verifiedWallet : null
    return pw
  }

  function solanaWalletForSubmit(): string | null {
    const sw = typeof verifiedSolana === 'string' && isValidSolanaAddress(verifiedSolana) ? verifiedSolana : null
    return sw
  }

  function baseSubAccountForSubmit(): string | null {
    const sub = typeof baseSubAccount === 'string' && isValidEvmAddress(baseSubAccount) ? baseSubAccount : null
    return sub
  }

  function buildVerifications(): VerificationClaim[] {
    const ts = new Date().toISOString()
    const out: VerificationClaim[] = []
    if (verifiedWallet && isValidEvmAddress(verifiedWallet)) {
      out.push({ method: verifiedWalletMethod ?? 'siwe', subject: verifiedWallet, timestamp: ts })
    }
    if (verifiedSolana && isValidSolanaAddress(verifiedSolana)) {
      out.push({ method: 'solana', subject: verifiedSolana, timestamp: ts })
    }
    return out
  }

  function buildSyntheticEmail(): string {
    if (verifiedWallet && isValidEvmAddress(verifiedWallet)) {
      return `wallet-${verifiedWallet.toLowerCase().replace(/^0x/, '')}@noemail.4626.fun`
    }
    if (verifiedSolana && isValidSolanaAddress(verifiedSolana)) {
      return `sol-${verifiedSolana}@noemail.4626.fun`
    }
    return ''
  }

  async function submitWaitlist(params: { email: string }) {
    setError(null)
    setReferralCodeTaken(false)
    setBusy(true)
    try {
      const verifications = buildVerifications()
      const hasVerification = verifications.length > 0
      const wantsEmail = contactPreference === 'email'
      // Creators must verify before submission.
      if (persona === 'creator' && !hasVerification) {
        throw new Error('Verify your identity first.')
      }
      if (persona === 'user' && !hasVerification) {
        throw new Error('Connect a wallet first. Email is for notifications.')
      }
      if (persona !== 'creator' && persona !== 'user') {
        throw new Error('Select Creator or User first.')
      }
      if (wantsEmail && !isValidEmail(emailTrimmed)) {
        throw new Error('Enter a valid email address.')
      }

      const emailForSubmit = wantsEmail
        ? emailTrimmed
        : isValidEmail(emailTrimmed)
          ? emailTrimmed
          : buildSyntheticEmail()
      if (!emailForSubmit) {
        throw new Error('Choose a verification method or provide an email.')
      }

      const storedRef = getStoredReferralCode()
      const claim =
        persona === 'creator'
          ? String(claimReferralCode || '')
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, '')
              .slice(0, 16)
          : ''

      const res = await apiFetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailForSubmit,
          primaryWallet: primaryWalletForSubmit(),
          solanaWallet: solanaWalletForSubmit(),
          baseSubAccount: baseSubAccountForSubmit(),
          referralCode: storedRef,
          claimReferralCode: claim.length > 0 ? claim : null,
          contactPreference,
          verifications,
          intent: {
            persona,
            hasCreatorCoin: creatorCoinBusy ? null : Boolean(creatorCoin?.address),
          },
        }),
      })
      const text = await res.text().catch(() => '')
      let json: any = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = null
      }
      if (res.status === 409 && json && json.code === 'REFERRAL_CODE_TAKEN') {
        setReferralCodeTaken(true)
        setClaimReferralCode(String(json?.suggested ?? claim ?? ''))
        throw new Error('That referral code is taken. Pick another and resubmit.')
      }
      if (!res.ok || !json || json.success !== true) {
        const msg =
          json && typeof json.error === 'string'
            ? json.error
            : res.ok
              ? 'Waitlist request failed'
              : `Waitlist request failed (HTTP ${res.status})`
        throw new Error(msg)
      }
      const doneEmailValue = String(json?.data?.email || emailForSubmit)
      submitSuccess(doneEmailValue)
      setReferralCode(typeof json?.data?.referralCode === 'string' ? String(json.data.referralCode) : null)

      // Best-effort: mark profile complete + qualify referral.
      // Do not block the UI; points awards are idempotent server-side.
      void (async () => {
        try {
          const emailForSync = doneEmailValue
          await apiFetch('/api/waitlist/profile-complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ email: emailForSync }),
          })

          await refreshPosition(emailForSync)
        } catch {
          // ignore
        }
      })()
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Waitlist request failed')
    } finally {
      setBusy(false)
    }
  }

  function resetFlow() {
    dispatchFlow({ type: 'reset' })
    dispatchVerification({ type: 'reset' })
    dispatchWaitlist({ type: 'reset' })
    creatorCoinForWalletRef.current = null
    claimCoinForWalletRef.current = null
  }

  async function signOutWallet() {
    try {
      if (showPrivy && privyAuthed) {
        await privyLogout()
      }
      const maybe = siwe as any
      if (typeof maybe?.signOut === 'function') {
        await maybe.signOut()
      }
    } catch {
      // ignore
    } finally {
      clearWalletVerifications()
      finishPrivyVerify()
      setCreatorCoin(null)
      setCreatorCoinBusy(false)
      creatorCoinForWalletRef.current = null
      claimCoinForWalletRef.current = null
      setClaimCoinBusy(false)
      setClaimCoinError(null)
    }
  }

  // Fetch waitlist points + position once we're in.
  useEffect(() => {
    if (step !== 'done') return
    if (!doneEmail) return
    void refreshPosition(doneEmail)
  }, [doneEmail, refreshPosition, step])

  // If SIWE has established an authenticated address, treat it as the verified wallet for this flow.
  useEffect(() => {
    if (step !== 'verify') return
    if (!persona) return
    if (!siwe.isSignedIn) return
    if (verifiedWallet) return
    const a = typeof siwe.authAddress === 'string' && isValidEvmAddress(siwe.authAddress) ? siwe.authAddress : null
    if (!a) return
    verifyWallet(a, 'siwe')
  }, [persona, siwe.authAddress, siwe.isSignedIn, step, verifiedWallet, verifyWallet])

  useEffect(() => {
    claimCoinForWalletRef.current = null
    setClaimCoinError(null)
  }, [verifiedWallet])

  // Best-effort: detect the user's Zora Creator Coin (if any) from the verified wallet.
  useEffect(() => {
    const w = typeof verifiedWallet === 'string' && isValidEvmAddress(verifiedWallet) ? verifiedWallet : null
    if (!w) {
      setCreatorCoin(null)
      setCreatorCoinBusy(false)
      creatorCoinForWalletRef.current = null
      return
    }
    if (creatorCoinForWalletRef.current === w) return
    creatorCoinForWalletRef.current = w

    let cancelled = false
    setCreatorCoinBusy(true)
    ;(async () => {
      try {
        const profile = await fetchZoraProfile(w)
        const coinAddrRaw = profile?.creatorCoin?.address ? String(profile.creatorCoin.address) : ''
        const coinAddr = isValidEvmAddress(coinAddrRaw) ? coinAddrRaw : null
        if (!coinAddr) {
          if (!cancelled) setCreatorCoin(null)
          return
        }

        // Resolve metadata (symbol/type/stats) for display. If it fails, still show the address.
        let symbol: string | null = null
        let coinType: string | null = null
        let imageUrl: string | null = null
        let marketCapUsd: number | null = null
        let volume24hUsd: number | null = null
        let holders: number | null = null
        let priceUsd: number | null = null
        try {
          const coin = await fetchZoraCoin(coinAddr as any)
          symbol = coin?.symbol ? String(coin.symbol) : null
          coinType = coin?.coinType ? String(coin.coinType) : null
          imageUrl =
            (coin?.mediaContent?.previewImage?.medium as string | undefined) ||
            (coin?.mediaContent?.previewImage?.small as string | undefined) ||
            null
          const asNumber = (v: any): number | null => {
            const n = Number(v)
            return Number.isFinite(n) ? n : null
          }
          marketCapUsd = asNumber(coin?.marketCap)
          volume24hUsd = asNumber(coin?.volume24h)
          holders = typeof coin?.uniqueHolders === 'number' ? coin.uniqueHolders : null
          priceUsd = asNumber(coin?.tokenPrice?.priceInUsdc)
        } catch {
          // ignore
        }

        if (!cancelled) {
          setCreatorCoin({ address: coinAddr, symbol, coinType, imageUrl, marketCapUsd, volume24hUsd, holders, priceUsd })
        }
      } catch (e: any) {
        if (!cancelled) {
          setCreatorCoin(null)
        }
      } finally {
        if (!cancelled) setCreatorCoinBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [verifiedWallet])

  useEffect(() => {
    if (step !== 'verify') return
    if (persona !== 'creator') return
    if (!verifiedWallet) return
    if (!creatorCoin?.address) return
    if (claimCoinBusy) return
    const key = `${verifiedWallet.toLowerCase()}:${creatorCoin.address.toLowerCase()}`
    if (claimCoinForWalletRef.current === key) return
    claimCoinForWalletRef.current = key
    void claimCreatorCoin(creatorCoin.address, 'auto')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimCoinBusy, creatorCoin?.address, persona, step, verifiedWallet])

  const shareBaseUrl = useMemo(() => appUrl.replace(/\/+$/, ''), [appUrl])
  const displayEmail = wantsEmail ? doneEmail : null
  const referralLink = useMemo(() => {
    if (referralCode) {
      return `${shareBaseUrl}/?ref=${encodeURIComponent(referralCode)}#waitlist`
    }
    return `${shareBaseUrl}/#waitlist`
  }, [referralCode, shareBaseUrl])
  const shareMessage = 'Creator vaults on Base — join the waitlist.'
  const miniAppHostLabel = useMemo(() => {
    if (!miniApp.isMiniApp) return null
    return miniApp.isBaseApp ? 'Base app' : 'Farcaster'
  }, [miniApp.isBaseApp, miniApp.isMiniApp])
  const actionStorageKey = useMemo(
    () => (referralCode ? `cv_waitlist_actions_${referralCode}` : 'cv_waitlist_actions'),
    [referralCode],
  )
  const markAction = useCallback(
    (action: ActionKey) => {
      if (actionsDone[action]) return
      const next = { ...actionsDone, [action]: true }
      setActionsDone(next)
      try {
        localStorage.setItem(actionStorageKey, JSON.stringify(next))
      } catch {
        // ignore
      }
      // Best-effort: sync task completion to server points ledger (idempotent).
      // We key by email so all waitlist users can participate (not just wallet-auth users).
      if (doneEmail) {
        void (async () => {
          try {
            await apiFetch('/api/waitlist/task-claim', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ email: doneEmail, taskKey: action }),
            })
            await refreshPosition(doneEmail)
          } catch {
            // ignore
          }
        })()
      }
    },
    [actionStorageKey, actionsDone, apiFetch, doneEmail, refreshPosition, setActionsDone],
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(actionStorageKey)
      if (!raw) {
        setActionsDone({ ...EMPTY_ACTION_STATE })
        return
      }
      const parsed = JSON.parse(raw) as Partial<Record<ActionKey, boolean>> | null
      setActionsDone({ ...EMPTY_ACTION_STATE, ...(parsed || {}) })
    } catch {
      setActionsDone({ ...EMPTY_ACTION_STATE })
    }
  }, [actionStorageKey, setActionsDone])

  useEffect(() => {
    if (miniApp.added !== true) return
    markAction('saveApp')
  }, [markAction, miniApp.added])

  // Privy-first: when Privy has an authenticated wallet, treat it as verified for this flow.
  useEffect(() => {
    if (!showPrivy || privyStatus !== 'ready') return
    if (step !== 'verify') return
    if (!persona) return
    if (!privyReady || !privyAuthed) return
    if (verifiedWallet || verifiedSolana) return
    let cancelled = false
    const delay = privyVerifyAttemptRef.current ? 350 : 120
    const timer = window.setTimeout(() => {
      if (cancelled) return
      const evm = extractPrivyWalletAddress(privyUser, privyWallets)
      const sol = extractPrivySolanaAddress(privyUser, privyWallets)
      if (evm) {
        verifyWallet(evm, 'privy')
        finishPrivyVerify()
        return
      }
      if (sol) {
        verifySolana(sol)
        finishPrivyVerify()
        return
      }
      // User completed Privy auth but has no wallet attached (common for email-only login).
      // Make the next step explicit instead of silently doing nothing.
      const msg = getPrivyWalletMissingMessage(privyUser, privyWallets)
      if (privyVerifyError !== msg) setPrivyVerifyError(msg)
    }, delay)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    finishPrivyVerify,
    persona,
    privyAuthed,
    privyReady,
    privyStatus,
    privyUser,
    privyVerifyError,
    privyWallets,
    setPrivyVerifyError,
    showPrivy,
    step,
    verifySolana,
    verifyWallet,
    verifiedSolana,
    verifiedWallet,
  ])

  // Privy Base sub-account: once Privy auth is ready and both wallets exist, create or fetch it.
  useEffect(() => {
    if (!showPrivy || privyStatus !== 'ready') return
    if (step !== 'verify') return
    if (!privyReady || !privyAuthed) return
    if (!embeddedWalletAddress || !baseAccountAddress) return
    if (baseSubAccount || baseSubAccountBusy) return
    const key = `${embeddedWalletAddress.toLowerCase()}:${baseAccountAddress.toLowerCase()}`
    if (subAccountAttemptRef.current === key) return
    subAccountAttemptRef.current = key
    void ensureBaseSubAccount()
  }, [
    baseAccountAddress,
    baseSubAccount,
    baseSubAccountBusy,
    embeddedWalletAddress,
    ensureBaseSubAccount,
    privyAuthed,
    privyReady,
    privyStatus,
    showPrivy,
    step,
  ])

  // UX: once creators are verified, immediately advance to email (no extra "Continue" click).
  useEffect(() => {
    if (step !== 'verify') return
    if (!verifiedWallet && !verifiedSolana) return
    const timer = window.setTimeout(() => {
      advanceAfterVerify()
    }, 800)
    return () => window.clearTimeout(timer)
  }, [advanceAfterVerify, step, verifiedSolana, verifiedWallet])

  useEffect(() => {
    if (!miniApp.isMiniApp) {
      setMiniAppAddSupported(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk')
        const ok = typeof sdk?.actions?.addMiniApp === 'function'
        if (!cancelled) setMiniAppAddSupported(ok)
      } catch {
        if (!cancelled) setMiniAppAddSupported(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [miniApp.isMiniApp, setMiniAppAddSupported])

  async function shareOrCompose() {
    if (shareBusy) return
    setShareBusy(true)
    setShareToast(null)
    const shareLink = referralLink
    try {
      if (miniApp.isMiniApp) {
        try {
          const { sdk } = await import('@farcaster/miniapp-sdk')
          if (sdk?.actions?.composeCast) {
            await sdk.actions.composeCast({
              text: shareMessage,
              embeds: [shareLink],
            } as any)
            markAction('share')
            setShareToast('Opened Farcaster composer.')
            return
          }
        } catch {
          // fall through
        }
      }

      if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
        await (navigator as any).share({
          title: 'Creator Vaults',
          text: shareMessage,
          url: shareLink,
        })
        markAction('share')
        setShareToast('Shared.')
        return
      }

      try {
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(shareMessage)}&embeds[]=${encodeURIComponent(
          shareLink,
        )}`
        if (miniApp.isMiniApp) {
          try {
            const { sdk } = await import('@farcaster/miniapp-sdk')
            if (sdk?.actions?.openUrl) {
              await sdk.actions.openUrl(warpcastUrl)
              markAction('share')
              setShareToast('Opened Warpcast.')
              return
            }
          } catch {
            // fall through
          }
        }
        const opened = window.open(warpcastUrl, '_blank', 'noopener,noreferrer')
        if (opened) {
          markAction('share')
          setShareToast('Opened Warpcast.')
          return
        }
      } catch {
        // fall through
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareLink)
        markAction('share')
        setShareToast('Link copied.')
        return
      }

      setShareToast(`Open: ${shareBaseUrl.replace(/^https?:\/\//, '')}`)
    } finally {
      setTimeout(() => setShareToast(null), 2500)
      setShareBusy(false)
    }
  }

  async function addMiniApp() {
    if (shareBusy) return
    setShareBusy(true)
    setShareToast(null)
    try {
      const { sdk } = await import('@farcaster/miniapp-sdk')
      if (!sdk?.actions?.addMiniApp) {
        setShareToast('Add is not supported in this host.')
        return
      }
      await sdk.actions.addMiniApp()
      markAction('saveApp')
      setShareToast('Added to your Mini Apps.')
    } catch {
      setShareToast('Add failed.')
    } finally {
      setTimeout(() => setShareToast(null), 2500)
      setShareBusy(false)
    }
  }

  const containerClass =
    variant === 'page'
      ? 'min-h-[100svh] flex items-center justify-center px-4 sm:px-6 py-10 sm:py-14'
      : 'cinematic-section'

  const innerWrapClass = variant === 'page' ? 'w-full max-w-lg' : 'max-w-3xl mx-auto px-6 py-14'

  const cardWrapClass =
    variant === 'page'
      ? 'rounded-2xl bg-black/30 backdrop-blur-sm p-4 sm:p-6 shadow-void'
      : 'rounded-2xl border border-zinc-900/70 bg-black/30 backdrop-blur-sm p-5 sm:p-6'

  const goBack = useCallback(() => {
    setError(null)
    goBackFlow()
  }, [goBackFlow, setError])

  const compactNumber = useMemo(
    () => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }),
    [],
  )

  function formatUsd(value: number | null): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
    return `$${compactNumber.format(value)}`
  }

  function formatCount(value: number | null): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
    return compactNumber.format(value)
  }

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
    <section id={variant === 'embedded' ? sectionId : undefined} className={containerClass}>
      <div className={innerWrapClass}>
        {variant === 'page' ? (
          <div className="flex items-center justify-between mb-5 sm:mb-7">
            <div className="flex items-center gap-3">
              <Logo width={36} height={36} showText={false} />
              <div>
                <div className="text-[11px] text-zinc-200">Creator Vaults</div>
                <div className="text-[10px] text-zinc-600">Waitlist</div>
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] text-zinc-500">
              Step {stepIndex} / {totalSteps}
            </div>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            <span className="label">Waitlist</span>
            <div className="headline text-4xl sm:text-5xl leading-tight">Early access</div>
            <div className="text-sm text-zinc-600 font-light">Creators verify · email is optional.</div>
          </div>
        )}

        <div className={cardWrapClass}>
          {step !== 'persona' ? (
            <div className="flex items-center justify-between mb-4">
              {step !== 'done' ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  disabled={busy || siwe.busy}
                  onClick={() => {
                    if (busy || siwe.busy) return
                    goBack()
                  }}
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  onClick={resetFlow}
                >
                  Reset
                </button>
              )}
              <div className="w-8" />
            </div>
          ) : null}
          <div className="mb-5 sm:mb-6">
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-brand-primary/20 via-brand-primary/50 to-brand-primary/20"
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === 'persona' ? (
              <motion.div
                key="persona"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <div className="headline text-2xl sm:text-3xl leading-tight">Choose your path</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="group rounded-xl border border-white/10 bg-black/40 hover:bg-black/50 hover:border-brand-primary/30 p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    onClick={() => {
                      selectPersona('creator')
                      setError(null)
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-zinc-100 font-medium">Creator</div>
                        <div className="mt-1 text-sm text-zinc-600 font-light">Launch a vault</div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-6 h-6 rounded-full border border-brand-primary/20 bg-brand-primary/10 inline-flex items-center justify-center">
                          <Check className="w-4 h-4 text-brand-accent" />
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="group rounded-xl border border-white/10 bg-black/40 hover:bg-black/50 hover:border-brand-primary/30 p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    onClick={() => {
                      selectPersona('user')
                      setError(null)
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-zinc-100 font-medium">User</div>
                        <div className="mt-1 text-sm text-zinc-600 font-light">Join early access</div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-6 h-6 rounded-full border border-brand-primary/20 bg-brand-primary/10 inline-flex items-center justify-center">
                          <Check className="w-4 h-4 text-brand-accent" />
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            ) : null}

            {step === 'verify' ? (
              <motion.div
                key="verify"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-6"
              >
                {/* Header */}
                <div className="space-y-1">
                  <div className="headline text-2xl sm:text-3xl leading-tight">Verify</div>
                  <div className="text-sm text-zinc-500">Continue with a wallet</div>
                </div>

                {/* Wallet verified state */}
                {verifiedWallet ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-zinc-200">Wallet verified</div>
                      <div className="text-xs text-zinc-500 font-mono truncate">
                        {verifiedWallet.slice(0, 6)}…{verifiedWallet.slice(-4)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      onClick={() => void signOutWallet()}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}

                {/* Solana verified state (Privy) */}
                {verifiedSolana && !verifiedWallet ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-zinc-200">Solana verified</div>
                      <div className="text-xs text-zinc-500 font-mono truncate">{verifiedSolana}</div>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      onClick={() => void signOutWallet()}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}

                {/* Privy-first: prefer Base Account (Coinbase Smart Wallet) */}
                {showPrivy && privyStatus === 'ready' && !verifiedWallet && !verifiedSolana ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      className="w-full min-h-[52px] rounded-xl border border-brand-primary/30 bg-brand-primary/20 text-zinc-100 font-medium px-4 py-3.5 transition-colors hover:bg-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!privyReady || privyVerifyBusy}
                      onClick={() => {
                        if (!privyReady || privyVerifyBusy) return
                        startPrivyVerify()
                        privyVerifyAttemptRef.current = Date.now()
                        const isBaseApp = miniApp.isBaseApp
                        const walletOptions = {
                          // Offer extension wallets unless multiple injected providers are present.
                          walletList: isBaseApp ? ['base_account'] : ['wallet_connect'],
                          walletChainType: 'ethereum-only',
                          description: 'Connect a wallet to verify.',
                        } as const
                        const openWallet = () => {
                          if (privyAuthed && typeof privyLinkWallet === 'function') {
                            return privyLinkWallet(walletOptions as any)
                          }
                          return privyConnectWallet ? privyConnectWallet(walletOptions as any) : null
                        }
                        try {
                          openWallet()
                          // Fallback: if no callback fires (e.g., modal closed), clear spinner after a short delay.
                          window.setTimeout(() => finishPrivyVerify(), 12_000)
                        } catch (e: any) {
                          const raw = e?.message ? String(e.message) : ''
                          const msg = raw || 'Wallet connect failed'
                          setPrivyVerifyError(msg)
                        }
                      }}
                    >
                      {privyVerifyBusy ? 'Opening…' : 'Continue'}
                    </button>
                    {privyVerifyError ? <div className="text-xs text-red-400 text-center">{privyVerifyError}</div> : null}
                    {privyAuthed && baseSubAccountBusy ? (
                      <div className="text-[11px] text-zinc-500 text-center">Setting up Base sub-account…</div>
                    ) : null}
                    {privyAuthed && baseSubAccount ? (
                      <div className="text-[11px] text-emerald-300/80 text-center">Base sub-account ready.</div>
                    ) : null}
                    {privyAuthed && baseSubAccountError ? (
                      <div className="text-[11px] text-amber-300/80 text-center">{baseSubAccountError}</div>
                    ) : null}
                    <div className="text-[11px] text-zinc-500 text-center">
                      WalletConnect works best if you have multiple wallet extensions.
                    </div>
                  </div>
                ) : null}

                {!showPrivy ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-[11px] text-zinc-500">
                    Wallet login is unavailable. Enable Privy to continue.
                  </div>
                ) : null}

              </motion.div>
            ) : null}

            {step === 'email' ? (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <div className="headline text-2xl sm:text-3xl leading-tight">Contact</div>
                <div className="text-sm text-zinc-600 font-light">Choose how we should notify you. Email is optional.</div>

                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 space-y-2">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600">Preference</div>
                  <div className="space-y-2 text-sm text-zinc-300">
                    <label className={`flex items-center gap-2 ${canUseWallet ? '' : 'opacity-50 cursor-not-allowed'}`}>
                      <input
                        type="radio"
                        name="contactPreference"
                        className="accent-brand-primary"
                        disabled={!canUseWallet}
                        checked={contactPreference === 'wallet'}
                        onChange={() => setContactPreference('wallet')}
                      />
                      <span>Wallet (self custody)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="contactPreference"
                        className="accent-brand-primary"
                        checked={contactPreference === 'email'}
                        onChange={() => setContactPreference('email')}
                      />
                      <span>Email (notifications)</span>
                    </label>
                  </div>
                </div>

                {wantsEmail ? (
                  <div className="text-[11px] text-zinc-600">We only use this for waitlist notifications. No marketing.</div>
                ) : (
                  <div className="text-[11px] text-zinc-600">No email required. You can add one later.</div>
                )}

                {persona === 'creator' && verifiedWallet && creatorCoin ? (
                  <div className="rounded-xl border border-white/10 bg-black/20">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-400">Creator Coin</span>
                      </div>
                      <span className="text-xs text-zinc-600">Linked</span>
                    </div>
                    <div className="px-4 pb-4 space-y-3">
                      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                        {creatorCoin.imageUrl ? (
                          <img
                            src={creatorCoin.imageUrl}
                            alt={creatorCoin.symbol || 'Creator coin'}
                            className="w-8 h-8 rounded-lg border border-white/10 object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="w-8 h-8 rounded-lg border border-white/10 bg-black/30 flex items-center justify-center text-[10px] text-zinc-500">
                            {creatorCoin.symbol ? creatorCoin.symbol.slice(0, 2) : 'CC'}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-zinc-200 font-medium truncate">{creatorCoin.symbol || 'Creator Coin'}</div>
                          <div className="text-[11px] font-mono text-zinc-600 truncate">{creatorCoin.address}</div>
                        </div>
                        <a
                          href={`${appUrl.replace(/\/+$/, '')}/deploy?token=${encodeURIComponent(creatorCoin.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          View
                        </a>
                      </div>
                      {(creatorCoin.marketCapUsd || creatorCoin.holders) ? (
                        <div className="flex items-center gap-4 text-[11px] text-zinc-600">
                          {creatorCoin.marketCapUsd ? <span>MC {formatUsd(creatorCoin.marketCapUsd)}</span> : null}
                          {creatorCoin.holders ? <span>{formatCount(creatorCoin.holders)} holders</span> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {persona === 'creator' && claimCoinError ? <div className="text-xs text-red-400">{claimCoinError}</div> : null}

                {persona === 'creator' && referralCodeTaken ? (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-amber-300/80 mb-2">Code</div>
                    <div className="text-xs text-zinc-600 mb-3">Code taken. Choose another.</div>
                    <div className="flex items-center gap-2">
                      <input
                        value={claimReferralCode}
                        onChange={(e) => setClaimReferralCode(e.target.value)}
                        placeholder="CODE"
                        inputMode="text"
                        autoComplete="off"
                        className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 font-mono"
                      />
                      <button
                        type="button"
                        className="btn-accent"
                        disabled={busy || !isValidEmail(emailTrimmed)}
                        onClick={() => void submitWaitlist({ email: emailTrimmed })}
                      >
                        Claim
                      </button>
                    </div>
                    <div className="mt-2 text-[11px] text-zinc-700">A–Z 0–9 · 16 max</div>
                  </div>
                ) : null}

                {wantsEmail ? (
                  <div>
                    <div className="flex items-center gap-3">
                      <input
                        ref={emailInputRef}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@domain.com"
                        inputMode="email"
                        autoComplete="email"
                        className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return
                          const v = emailTrimmed
                          if (!isValidEmail(v)) {
                            setError('Enter a valid email address.')
                            return
                          }
                          void submitWaitlist({ email: v })
                        }}
                      />
                      <div className="kbd-hint">Enter ↵</div>
                    </div>
                    {emailTrimmed.length > 0 && !isValidEmail(emailTrimmed) ? (
                      <div className="mt-2 text-xs text-amber-300/80">That doesn’t look like a valid email.</div>
                    ) : null}
                  </div>
                ) : null}

                {error ? (
                  <div className="text-xs text-red-400" role="status" aria-live="polite">
                    {error}
                  </div>
                ) : null}

                <div className="flex items-center justify-end pt-2">
                  <button
                    type="button"
                    className="btn-accent"
                    disabled={busy || (wantsEmail ? !isValidEmail(emailTrimmed) : !hasVerification)}
                    onClick={() => void submitWaitlist({ email: emailTrimmed })}
                  >
                    {busy ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </motion.div>
            ) : null}

            {step === 'done' ? (
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
                    <a
                      className="btn-primary w-full inline-flex justify-center"
                      href={`${appUrl.replace(/\/+$/, '')}/deploy`}
                    >
                      Continue to deploy
                    </a>
                    <a
                      className="btn-accent w-full inline-flex justify-center"
                      href={`${appUrl.replace(/\/+$/, '')}/admin/creator-access`}
                    >
                      Creator access
                    </a>
                  </div>
                ) : null}

                <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-600 mb-1">{INVITE_COPY.counterLabel}</div>
                        <div className="text-2xl text-zinc-200">
                          {waitlistPosition ? waitlistPosition.points.total.toLocaleString() : '—'}
                        </div>
                        <div className="text-[11px] text-zinc-700">
                          {waitlistPosition
                            ? `#${waitlistPosition.rank.invite ?? '—'} · Top ${waitlistPosition.percentileInvite ?? '—'}%`
                            : 'Loading…'}
                        </div>
                    </div>
                    <a
                      className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors pt-1"
                      href="/leaderboard"
                    >
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
                          {referralCode ? (
                            <a
                              className="mt-2 inline-flex text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                              href={`${apiAliasPath('/api/waitlist/ledger')}?ref=${encodeURIComponent(referralCode)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View points ledger
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
                      <button
                        type="button"
                        className="btn-primary w-full flex items-center justify-between gap-2"
                        onClick={() => {
                          const template =
                            REFERRAL_TWEET_TEMPLATES[inviteTemplateIdx % REFERRAL_TWEET_TEMPLATES.length] || REFERRAL_TWEET_TEMPLATES[0]
                          const text = fillTweetTemplate(template, referralLink)
                          const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralLink)}`
                          if (miniApp.isMiniApp) {
                            void (async () => {
                              try {
                                const { sdk } = await import('@farcaster/miniapp-sdk')
                                if (sdk?.actions?.openUrl) {
                                  await sdk.actions.openUrl(url)
                                  markAction('shareX')
                                  return
                                }
                              } catch {
                                // fall through
                              }
                              window.location.href = url
                              markAction('shareX')
                            })()
                            return
                          }
                          const opened = window.open(url, '_blank', 'noopener,noreferrer')
                          if (!opened) {
                            window.location.href = url
                          }
                          markAction('shareX')
                        }}
                      >
                        <span>{INVITE_COPY.shareButton}</span>
                        {renderActionBadge('shareX')}
                      </button>
                      <button
                        type="button"
                        className="btn-accent w-full flex items-center justify-between gap-2"
                        onClick={() => {
                          void (async () => {
                            try {
                              await navigator.clipboard.writeText(referralLink)
                              markAction('copyLink')
                              setInviteToast(INVITE_COPY.copiedToast)
                              window.setTimeout(() => setInviteToast(null), 1800)
                            } catch {
                              setInviteToast('Copy failed.')
                              window.setTimeout(() => setInviteToast(null), 1800)
                            }
                          })()
                        }}
                      >
                        <span>{INVITE_COPY.copyButton}</span>
                        {renderActionBadge('copyLink')}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                        onClick={() =>
                          setInviteTemplateIdx((inviteTemplateIdx + 1) % REFERRAL_TWEET_TEMPLATES.length)
                        }
                      >
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
                      <a
                        className="btn-primary px-3 py-2 text-sm"
                        href="https://x.com/4626fun"
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => markAction('follow')}
                      >
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
                      <button
                        type="button"
                        className="btn-accent px-3 py-2 text-sm disabled:opacity-60"
                        disabled={shareBusy}
                        onClick={() => void shareOrCompose()}
                      >
                        {shareBusy ? 'Working…' : actionsDone.share ? 'Done' : 'Share'}
                      </button>
                    </div>

                    {miniApp.isMiniApp && miniAppAddSupported !== false ? (
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
                          disabled={shareBusy || miniAppAddSupported === null || miniApp.added === true}
                          onClick={() => void addMiniApp()}
                          title={
                            miniAppAddSupported === null
                              ? 'Checking host capabilities…'
                              : miniApp.added === true
                                ? `Already saved in ${miniAppHostLabel ?? 'Mini Apps'}`
                                : `Save this Mini App in ${miniAppHostLabel ?? 'Mini Apps'}`
                          }
                        >
                          {miniAppAddSupported === null
                            ? 'Checking…'
                            : miniApp.added === true
                              ? 'Saved'
                              : 'Save'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
