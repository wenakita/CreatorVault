import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getAppBaseUrl } from '@/lib/host'
import { useAccount } from 'wagmi'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { isPrivyClientEnabled } from '@/lib/flags'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { toViemAccount, useBaseAccountSdk, useConnectWallet, useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { base } from 'wagmi/chains'
import { ArrowLeft } from 'lucide-react'
import { useMiniAppContext } from '@/hooks'
import { apiAliasPath } from '@/lib/apiBase'
import { fetchZoraCoin, fetchZoraProfile } from '@/lib/zora/client'
import { Logo } from '@/components/brand/Logo'
import type {
  ActionKey,
  ContactPreference,
  FlowState,
  Persona,
  Variant,
  VerificationClaim,
  VerificationMethod,
  VerificationState,
  WaitlistState,
} from './waitlistTypes'
import { VerifyStep } from './steps/VerifyStep'
import { EmailStep } from './steps/EmailStep'
import { DoneStep } from './steps/DoneStep'
import { useWaitlistApi } from './useWaitlistApi'
import { useWaitlistVerification } from './useWaitlistVerification'
import { useWaitlistReferral, getStoredReferralCode } from './useWaitlistReferral'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EVM_RE = /^0x[a-fA-F0-9]{40}$/
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]+$/
const SHARE_MESSAGE = 'Creator vaults on Base — join the waitlist.'

type PatchAction<T> = { type: 'patch'; patch: Partial<T> } | { type: 'reset' }
type WaitlistAction =
  | PatchAction<WaitlistState>
  | { type: 'setActions'; actions: Record<ActionKey, boolean> }
  | { type: 'markAction'; key: ActionKey }

const EMPTY_ACTION_STATE: Record<ActionKey, boolean> = {
  shareX: false,
  copyLink: false,
  share: false,
  follow: false,
  saveApp: false,
}

const initialFlowState: FlowState = {
  persona: 'creator', // Default to creator - simplified flow
  step: 'email', // Start with email input
  contactPreference: 'email',
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

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v)
}

function safeJsonParse<T = unknown>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function normalizeAddress(v: string): string {
  return v.trim()
}

function isValidEvmAddress(v: string): boolean {
  return EVM_RE.test(v)
}

function isValidSolanaAddress(v: string): boolean {
  const s = String(v || '').trim()
  if (!s) return false
  // Base58-ish, 32–44 chars (covers most standard pubkeys)
  if (s.length < 32 || s.length > 44) return false
  return SOL_RE.test(s)
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

type FlowAction =
  | { type: 'reset' }
  | { type: 'select_persona'; persona: Persona }
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
      // Simplified flow - persona is pre-set to 'creator'
      return state
    }
    case 'back': {
      // Simplified flow: email → verify → done
      if (state.step === 'verify') return { ...state, step: 'email' }
      return state
    }
    case 'verified':
      // After verification, go to done (submit happens during verification)
      if (state.step !== 'verify') return state
      return state
    case 'advance_email':
      // From email step, advance to verify step
      return { ...state, step: 'verify' }
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
  if (action.type === 'markAction') {
    if (state.actionsDone[action.key]) return state
    return { ...state, actionsDone: { ...state.actionsDone, [action.key]: true } }
  }
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
  const refreshPositionInFlightRef = useRef<Promise<void> | null>(null)
  const refreshPositionAbortRef = useRef<AbortController | null>(null)

  const appUrl = useMemo(() => getAppBaseUrl(), [])
  const { apiFetch } = useWaitlistApi(appUrl)
  const { address: connectedAddressRaw } = useAccount()
  const siwe = useSiweAuth()
  const miniApp = useMiniAppContext()

  const patchWaitlist = useCallback((patch: Partial<WaitlistState>) => {
    dispatchWaitlist({ type: 'patch', patch })
  }, [])

  const goBackFlow = useCallback(() => dispatchFlow({ type: 'back' }), [])
  const advanceToEmail = useCallback(() => dispatchFlow({ type: 'advance_email' }), [])
  const submitSuccess = useCallback((doneEmail: string | null) => dispatchFlow({ type: 'submit_success', doneEmail }), [])
  const setEmail = useCallback((email: string) => dispatchFlow({ type: 'set_email', email }), [])
  const setBusy = useCallback((busy: boolean) => dispatchFlow({ type: 'set_busy', busy }), [])
  const setError = useCallback((error: string | null) => dispatchFlow({ type: 'set_error', error }), [])
  const handleInvalidEmail = useCallback(() => {
    setError('Enter a valid email address.')
  }, [setError])

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
  const startBaseSubAccount = useCallback(() => dispatchVerification({ type: 'base_sub_start' }), [])
  const setBaseSubAccount = useCallback(
    (address: string) => dispatchVerification({ type: 'base_sub_success', address }),
    [],
  )
  const setBaseSubAccountError = useCallback(
    (error: string) => dispatchVerification({ type: 'base_sub_error', error }),
    [],
  )
  const setActionsDone = useCallback(
    (actionsDone: Record<ActionKey, boolean>) => dispatchWaitlist({ type: 'setActions', actions: actionsDone }),
    [],
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
  } = verification
  const {
    creatorCoin,
    creatorCoinBusy,
    claimCoinBusy,
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
  const showPrivyReady = showPrivy && privyStatus === 'ready'
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
  const { login: privyLogin } = useLogin({
    onComplete: () => {
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

  const siweAuthAddress = useMemo(() => {
    const raw = typeof siwe.authAddress === 'string' ? siwe.authAddress : ''
    return isValidEvmAddress(raw) ? raw : null
  }, [siwe.authAddress])

  const { handlePrivyContinue } = useWaitlistVerification({
    persona,
    step,
    showPrivy,
    privyStatus,
    privyReady,
    privyAuthed,
    privyUser,
    privyWallets,
    privyVerifyBusy,
    privyVerifyError,
    miniAppIsBaseApp: miniApp.isBaseApp,
    verifiedWallet,
    verifiedSolana,
    embeddedWalletAddress,
    baseAccountAddress,
    baseSubAccount,
    baseSubAccountBusy,
    siwe: { isSignedIn: siwe.isSignedIn, authAddress: siweAuthAddress },
    verifyWallet,
    verifySolana,
    startPrivyVerify,
    finishPrivyVerify,
    setPrivyVerifyError,
    privyLinkWallet,
    privyConnectWallet,
    formatPrivyConnectError,
    extractPrivyWalletAddress,
    extractPrivySolanaAddress,
    getPrivyWalletMissingMessage,
    ensureBaseSubAccount,
  })

  const emailTrimmed = useMemo(() => normalizeEmail(email), [email])
  const isEmailValid = useMemo(() => isValidEmail(emailTrimmed), [emailTrimmed])
  // Simplified flow: can submit when email is valid and creator coin is found
  const canSubmit = isEmailValid && !!creatorCoin?.address
  const flowBusy = busy || siwe.busy
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

  // Simplified flow: email → verify → done (3 steps)
  const totalSteps = 3

  const stepIndex = useMemo(() => {
    if (step === 'email') return 1
    if (step === 'verify') return 2
    if (step === 'done') return 3
    return 1
  }, [step])

  const progressPct = useMemo(() => {
    if (!totalSteps) return 0
    return Math.max(0, Math.min(100, Math.round((stepIndex / totalSteps) * 100)))
  }, [stepIndex, totalSteps])

  useEffect(() => {
    if (step === 'email') {
      requestAnimationFrame(() => emailInputRef.current?.focus())
    }
  }, [step])

  // Auto-fill email from Privy user and advance to verify step when authenticated
  useEffect(() => {
    if (!privyAuthed || !privyUser) return
    if (step !== 'email') return

    // Extract email from Privy user
    const privyEmail = privyUser.email?.address || null
    if (privyEmail && isValidEmail(privyEmail)) {
      setEmail(privyEmail)
    }

    // Auto-advance to verify step after Privy login
    advanceToEmail()
  }, [privyAuthed, privyUser, step, setEmail, advanceToEmail])

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
            patchWaitlist({
              waitlistPosition: {
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
                  pendingCountCapped:
                    typeof data?.referrals?.pendingCountCapped === 'number' ? data.referrals.pendingCountCapped : 0,
                  pendingCap: typeof data?.referrals?.pendingCap === 'number' ? data.referrals.pendingCap : 10,
                },
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
    [apiFetch, patchWaitlist],
  )

  useEffect(() => {
    return () => {
      refreshPositionAbortRef.current?.abort()
    }
  }, [])

  const actionStorageKey = useMemo(
    () => (referralCode ? `cv_waitlist_actions_${referralCode}` : 'cv_waitlist_actions'),
    [referralCode],
  )
  const actionsDoneRef = useRef(actionsDone)
  useEffect(() => {
    actionsDoneRef.current = actionsDone
  }, [actionsDone])
  const markAction = useCallback(
    (action: ActionKey) => {
      const current = actionsDoneRef.current
      if (current[action]) return
      const next = { ...current, [action]: true }
      actionsDoneRef.current = next
      dispatchWaitlist({ type: 'markAction', key: action })
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
    [actionStorageKey, apiFetch, doneEmail, refreshPosition],
  )
  const {
    referralLink,
    shareHostLabel,
    handleShareX,
    handleCopyReferral,
    handleNextInviteTemplate,
  } = useWaitlistReferral({
    locationSearch: location.search,
    shareBaseUrl: appUrl.replace(/\/+$/, ''),
    inviteTemplateIdx,
    miniAppIsMiniApp: miniApp.isMiniApp === true,
    referralCode,
    markAction: (action) => markAction(action as any),
    setInviteTemplateIdx: (next) => patchWaitlist({ inviteTemplateIdx: next }),
    setInviteToast: (toast) => patchWaitlist({ inviteToast: toast }),
    apiFetch,
  })
  const pointsBreakdownUrl = useMemo(() => {
    if (!referralCode) return null
    return `${apiAliasPath('/api/waitlist/ledger')}?ref=${encodeURIComponent(referralCode)}`
  }, [referralCode])
  const miniAppHostLabel = useMemo(() => {
    if (!miniApp.isMiniApp) return null
    return miniApp.isBaseApp ? 'Base app' : 'Farcaster'
  }, [miniApp.isBaseApp, miniApp.isMiniApp])
  const displayEmail = doneEmail ?? null

  const handleFollow = useCallback(() => {
    markAction('follow')
  }, [markAction])

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

  async function claimCreatorCoin(coinAddress: string, source: 'auto' | 'manual') {
    if (claimCoinBusy) return
    const coin = normalizeAddress(coinAddress).toLowerCase()
    if (!isValidEvmAddress(coin)) {
      patchWaitlist({ claimCoinError: 'Enter a valid coin address.' })
      return
    }
    patchWaitlist({ claimCoinBusy: true, claimCoinError: null })
    try {
      const res = await apiFetch('/api/creator-wallets/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ coinAddress: coin }),
      })
      const text = await res.text().catch(() => '')
      const json = safeJsonParse<any>(text)
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
            patchWaitlist({
              creatorCoin: {
                address: coin,
                symbol: fetched?.symbol ? String(fetched.symbol) : null,
                coinType: fetched?.coinType ? String(fetched.coinType) : null,
                imageUrl,
                marketCapUsd: asNumber(fetched?.marketCap),
                volume24hUsd: asNumber(fetched?.volume24h),
                holders: typeof fetched?.uniqueHolders === 'number' ? fetched.uniqueHolders : null,
                priceUsd: asNumber(fetched?.tokenPrice?.priceInUsdc),
              },
            })
          }
        } catch {
          // ignore
        }
      }

      advanceToEmail()
    } catch (e: any) {
      patchWaitlist({ claimCoinError: e?.message ? String(e.message) : 'Claim failed' })
    } finally {
      patchWaitlist({ claimCoinBusy: false })
    }
  }

  async function submitWaitlist() {
    setError(null)
    patchWaitlist({ referralCodeTaken: false })
    setBusy(true)
    try {
      const verifications = buildVerifications()
      const hasVerificationForSubmit = verifications.length > 0
      if (persona === 'creator' && !hasVerificationForSubmit) {
        throw new Error('Verify your identity first.')
      }
      if (persona !== 'creator' && persona !== 'user') {
        throw new Error('Select Creator or User first.')
      }
      if (!isEmailValid) {
        throw new Error('Enter a valid email address.')
      }

      const emailForSubmit = emailTrimmed
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
      const json = safeJsonParse<any>(text)
      if (res.status === 409 && json && json.code === 'REFERRAL_CODE_TAKEN') {
        patchWaitlist({
          referralCodeTaken: true,
          claimReferralCode: String(json?.suggested ?? claim ?? ''),
        })
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
      patchWaitlist({ referralCode: typeof json?.data?.referralCode === 'string' ? String(json.data.referralCode) : null })

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
      patchWaitlist({
        creatorCoin: null,
        creatorCoinBusy: false,
        claimCoinBusy: false,
        claimCoinError: null,
      })
      creatorCoinForWalletRef.current = null
      claimCoinForWalletRef.current = null
    }
  }

  useEffect(() => {
    if (step !== 'done') return
    if (!doneEmail) return
    void refreshPosition(doneEmail)
  }, [doneEmail, refreshPosition, step])

  useEffect(() => {
    claimCoinForWalletRef.current = null
    patchWaitlist({ claimCoinError: null })
  }, [patchWaitlist, verifiedWallet])

  useEffect(() => {
    const w = typeof verifiedWallet === 'string' && isValidEvmAddress(verifiedWallet) ? verifiedWallet : null
    if (!w) {
      patchWaitlist({ creatorCoin: null, creatorCoinBusy: false })
      creatorCoinForWalletRef.current = null
      return
    }
    if (creatorCoinForWalletRef.current === w) return
    creatorCoinForWalletRef.current = w

    let cancelled = false
    patchWaitlist({ creatorCoinBusy: true })
    ;(async () => {
      try {
        const profile = await fetchZoraProfile(w)
        const coinAddrRaw = profile?.creatorCoin?.address ? String(profile.creatorCoin.address) : ''
        const coinAddr = isValidEvmAddress(coinAddrRaw) ? coinAddrRaw : null
        if (!coinAddr) {
          if (!cancelled) patchWaitlist({ creatorCoin: null })
          return
        }

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
          patchWaitlist({
            creatorCoin: { address: coinAddr, symbol, coinType, imageUrl, marketCapUsd, volume24hUsd, holders, priceUsd },
          })
        }
      } catch {
        if (!cancelled) {
          patchWaitlist({ creatorCoin: null })
        }
      } finally {
        if (!cancelled) patchWaitlist({ creatorCoinBusy: false })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [patchWaitlist, verifiedWallet])

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(actionStorageKey)
      if (!raw) {
        actionsDoneRef.current = { ...EMPTY_ACTION_STATE }
        setActionsDone({ ...EMPTY_ACTION_STATE })
        return
      }
      const parsed = safeJsonParse<Partial<Record<ActionKey, boolean>>>(raw)
      const next = { ...EMPTY_ACTION_STATE, ...(parsed || {}) }
      actionsDoneRef.current = next
      setActionsDone(next)
    } catch {
      actionsDoneRef.current = { ...EMPTY_ACTION_STATE }
      setActionsDone({ ...EMPTY_ACTION_STATE })
    }
  }, [actionStorageKey, setActionsDone])

  useEffect(() => {
    if (miniApp.added !== true) return
    markAction('saveApp')
  }, [markAction, miniApp.added])

  // Simplified flow: no auto-advance - user clicks "Join Waitlist" to submit

  useEffect(() => {
    if (!miniApp.isMiniApp) {
      patchWaitlist({ miniAppAddSupported: null })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk')
        const ok = typeof sdk?.actions?.addMiniApp === 'function'
        if (!cancelled) patchWaitlist({ miniAppAddSupported: ok })
      } catch {
        if (!cancelled) patchWaitlist({ miniAppAddSupported: false })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [miniApp.isMiniApp, patchWaitlist])

  async function shareOrCompose() {
    if (shareBusy) return
    patchWaitlist({ shareBusy: true, shareToast: null })
    const shareLink = referralLink
    try {
      if (miniApp.isMiniApp) {
        try {
          const { sdk } = await import('@farcaster/miniapp-sdk')
          if (sdk?.actions?.composeCast) {
            await sdk.actions.composeCast({
              text: SHARE_MESSAGE,
              embeds: [shareLink],
            } as any)
            markAction('share')
            patchWaitlist({ shareToast: 'Opened Farcaster composer.' })
            return
          }
        } catch {
          // fall through
        }
      }

      if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
        await (navigator as any).share({
          title: 'Creator Vaults',
          text: SHARE_MESSAGE,
          url: shareLink,
        })
        markAction('share')
        patchWaitlist({ shareToast: 'Shared.' })
        return
      }

      try {
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(SHARE_MESSAGE)}&embeds[]=${encodeURIComponent(
          shareLink,
        )}`
        if (miniApp.isMiniApp) {
          try {
            const { sdk } = await import('@farcaster/miniapp-sdk')
            if (sdk?.actions?.openUrl) {
              await sdk.actions.openUrl(warpcastUrl)
              markAction('share')
              patchWaitlist({ shareToast: 'Opened Warpcast.' })
              return
            }
          } catch {
            // fall through
          }
        }
        const opened = window.open(warpcastUrl, '_blank', 'noopener,noreferrer')
        if (opened) {
          markAction('share')
          patchWaitlist({ shareToast: 'Opened Warpcast.' })
          return
        }
      } catch {
        // fall through
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareLink)
        markAction('share')
        patchWaitlist({ shareToast: 'Link copied.' })
        return
      }

      patchWaitlist({ shareToast: `Open: ${shareHostLabel}` })
    } finally {
      setTimeout(() => patchWaitlist({ shareToast: null }), 2500)
      patchWaitlist({ shareBusy: false })
    }
  }

  async function addMiniApp() {
    if (shareBusy) return
    patchWaitlist({ shareBusy: true, shareToast: null })
    try {
      const { sdk } = await import('@farcaster/miniapp-sdk')
      if (!sdk?.actions?.addMiniApp) {
        patchWaitlist({ shareToast: 'Add is not supported in this host.' })
        return
      }
      await sdk.actions.addMiniApp()
      markAction('saveApp')
      patchWaitlist({ shareToast: 'Added to your Mini Apps.' })
    } catch {
      patchWaitlist({ shareToast: 'Add failed.' })
    } finally {
      setTimeout(() => patchWaitlist({ shareToast: null }), 2500)
      patchWaitlist({ shareBusy: false })
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
            <div className="text-sm text-zinc-600 font-light">Creators verify · email required.</div>
          </div>
        )}

        <div className={cardWrapClass}>
          {/* Show back button on verify step, reset on done step */}
          {step === 'verify' || step === 'done' ? (
            <div className="flex items-center justify-between mb-4">
              {step === 'verify' ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  disabled={flowBusy}
                  onClick={() => {
                    if (flowBusy) return
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
            {step === 'verify' ? (
              <VerifyStep
                verifiedWallet={verifiedWallet}
                showPrivy={showPrivy}
                showPrivyReady={showPrivyReady}
                privyReady={privyReady}
                privyVerifyBusy={privyVerifyBusy}
                privyVerifyError={privyVerifyError}
                creatorCoin={creatorCoin}
                creatorCoinBusy={creatorCoinBusy}
                busy={busy}
                canSubmit={canSubmit}
                onSignOutWallet={signOutWallet}
                onPrivyContinue={() => {
                  startPrivyVerify()
                  privyLogin()
                }}
                onSubmit={submitWaitlist}
              />
            ) : null}

            {step === 'email' ? (
              <EmailStep
                email={email}
                emailTrimmed={emailTrimmed}
                emailInputRef={emailInputRef}
                onEmailChange={setEmail}
                error={error}
                busy={busy}
                isEmailValid={isEmailValid}
                onContinue={advanceToEmail}
                onInvalidEmail={handleInvalidEmail}
                showPrivy={showPrivy}
                privyReady={privyReady}
                privyAuthenticated={privyAuthed}
                privyVerifyBusy={privyVerifyBusy}
                privyVerifyError={privyVerifyError}
                onPrivyLogin={() => {
                  startPrivyVerify()
                  privyLogin()
                }}
              />
            ) : null}

            {step === 'done' ? (
              <DoneStep
                displayEmail={displayEmail}
                isBypassAdmin={isBypassAdmin}
                appUrl={appUrl}
                waitlistPosition={waitlistPosition}
                referralCode={referralCode}
                referralLink={referralLink}
                pointsBreakdownUrl={pointsBreakdownUrl}
                inviteTemplateIdx={inviteTemplateIdx}
                inviteToast={inviteToast}
                shareToast={shareToast}
                shareBusy={shareBusy}
                actionsDone={actionsDone}
                miniAppIsMiniApp={miniApp.isMiniApp === true}
                miniAppAdded={miniApp.added === true}
                miniAppAddSupported={miniAppAddSupported}
                miniAppHostLabel={miniAppHostLabel}
                onShareX={handleShareX}
                onCopyReferral={handleCopyReferral}
                onNextInviteTemplate={handleNextInviteTemplate}
                onFollow={handleFollow}
                onShare={shareOrCompose}
                onAddMiniApp={addMiniApp}
              />
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
