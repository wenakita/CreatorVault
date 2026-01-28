import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getAppBaseUrl } from '@/lib/host'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { isPrivyClientEnabled } from '@/lib/flags'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { toViemAccount, useBaseAccountSdk, useConnectWallet, useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { base } from 'wagmi/chains'
import { encodeAbiParameters, getAddress, isAddress } from 'viem'
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
import { LinkCswStep } from './steps/LinkCswStep'
import { DoneStep } from './steps/DoneStep'
import { useWaitlistApi } from './useWaitlistApi'
import { useWaitlistVerification } from './useWaitlistVerification'
import { useWaitlistReferral, getStoredReferralCode } from './useWaitlistReferral'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EVM_RE = /^0x[a-fA-F0-9]{40}$/
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]+$/
const SHARE_MESSAGE = 'Creator vaults on Base — join the waitlist.'
const BASE_EASE = [0.4, 0, 0.2, 1] as const
const BASE_MOTION_MS = 0.2

const STEP_WIPE = {
  initial: { opacity: 0, scaleX: 0.2 },
  animate: { opacity: 1, scaleX: 1 },
  exit: { opacity: 0, scaleX: 0.2 },
  transition: { duration: BASE_MOTION_MS, ease: BASE_EASE },
} as const

const COINBASE_SMART_WALLET_OWNER_LINK_ABI = [
  {
    type: 'function',
    name: 'addOwnerAddress',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const COINBASE_SMART_WALLET_FACTORY_ABI = [
  {
    inputs: [
      { name: 'owners', type: 'bytes[]' },
      { name: 'nonce', type: 'uint256' },
    ],
    name: 'getAddress',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const COINBASE_SMART_WALLET_FACTORIES = [
  getAddress(`0x${'0ba5ed0c6aa8c49038f819e587e2633c4a9f428a'}`),
  getAddress(`0x${'ba5ed110efdba3d005bfc882d75358acbbb85842'}`),
] as const

function asOwnerBytes(owner: `0x${string}`) {
  return encodeAbiParameters([{ type: 'address' }], [owner])
}

type PatchAction<T> = { type: 'patch'; patch: Partial<T> } | { type: 'reset' }
type WaitlistAction =
  | PatchAction<WaitlistState>
  | { type: 'setActions'; actions: Record<ActionKey, boolean> }
  | { type: 'markAction'; key: ActionKey }

const EMPTY_ACTION_STATE: Record<ActionKey, boolean> = {
  // Legacy actions
  shareX: false,
  copyLink: false,
  share: false,
  follow: false,
  saveApp: false,
  // Social actions (verified)
  farcaster: false,
  baseApp: false,
  zora: false,
  x: false,
  discord: false,
  telegram: false,
  // Bonus actions (honor system)
  github: false,
  tiktok: false,
  instagram: false,
  reddit: false,
}

const initialFlowState: FlowState = {
  persona: 'creator', // Default to creator - simplified flow
  step: 'verify', // Start with verification
  contactPreference: 'email',
  email: '',
  emailOptOut: true,
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
  creatorCoinDeclaredMissing: false,
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
  // CSW linking status
  cswLinked: false,
  cswLinkBusy: false,
  cswLinkError: null,
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

function isSyntheticEmail(v: string): boolean {
  return v.endsWith('@noemail.4626.fun')
}

function buildSyntheticEmail(seed?: string | null): string {
  const domain = 'noemail.4626.fun'
  const safeSeed = typeof seed === 'string' ? seed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) : ''

  // Deterministic token so repeat signups (wallet-only) upsert by email.
  // This prevents duplicate leaderboard rows for the same wallet.
  const fnv1a32 = (input: string): number => {
    let h = 0x811c9dc5
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
  }
  const seedNorm = typeof seed === 'string' ? seed.trim().toLowerCase() : ''
  const token = fnv1a32(seedNorm || 'anon').toString(36).padStart(7, '0').slice(0, 12)

  const prefix = safeSeed.length > 0 ? safeSeed.toLowerCase() : 'anon'
  return `${prefix}+${token}@${domain}`
}

function formatPrivyConnectError(code: string): string {
  const c = code.trim().toLowerCase()
  if (!c) return 'Wallet connect failed.'
  if (c.includes('user_exited') || c.includes('user_rejected')) return 'Connection cancelled.'
  if (c.includes('client_request_timeout') || c.includes('timeout')) return 'Wallet connection timed out. Try again.'
  if (c.includes('disallowed_login_method')) {
    return 'Wallet sign-in isn’t available for this app. If you control this Privy app, enable Wallet login in the Privy dashboard.'
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

  const normalizeType = (w: any) =>
    String(w?.wallet_client_type || w?.walletClientType || w?.connector_type || w?.connectorType || '').toLowerCase()
  const isSmartOrEmbedded = (w: any) => {
    const t = normalizeType(w)
    return t.includes('smart') || t === 'base_account' || t === 'privy'
  }

  // Prefer external EOAs for Zora profile lookup.
  for (const w of all) {
    const addr = typeof w?.address === 'string' ? w.address : null
    if (!addr || !isValidEvmAddress(addr)) continue
    if (!isSmartOrEmbedded(w)) return addr
  }

  const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
  for (const a of linked) {
    const addr = typeof a?.address === 'string' ? a.address : null
    if (addr && isValidEvmAddress(addr)) return addr
  }

  // Fallback: smart/embedded wallet if it's the only option.
  for (const w of all) {
    const addr = typeof w?.address === 'string' ? w.address : null
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
    return 'Wallet sign-in isn’t available right now (or no Base Account is linked). If you control this Privy app, enable Wallet login in the Privy dashboard. Otherwise, use the Coinbase Wallet fallback below.'
  }
  return 'Wallet sign-in isn’t available for this app. If you control this Privy app, enable Wallet login in the Privy dashboard. Otherwise, use the Coinbase Wallet fallback below.'
}

type FlowAction =
  | { type: 'reset' }
  | { type: 'select_persona'; persona: Persona }
  | { type: 'submit_success'; doneEmail: string | null }
  | { type: 'csw_complete' }
  | { type: 'set_email'; email: string }
  | { type: 'set_email_opt_out'; emailOptOut: boolean }
  | { type: 'set_done_email'; doneEmail: string | null }
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
    case 'submit_success':
      if (state.step === 'done' || state.step === 'link-csw') return state
      return { ...state, step: 'link-csw', doneEmail: action.doneEmail }
    case 'csw_complete':
      // CSW linked (or skipped) - proceed to done
      return { ...state, step: 'done' }
    case 'set_email':
      return { ...state, email: action.email }
    case 'set_email_opt_out':
      return { ...state, emailOptOut: action.emailOptOut }
    case 'set_done_email':
      return { ...state, doneEmail: action.doneEmail }
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

  const refreshPositionInFlightRef = useRef<Promise<void> | null>(null)
  const refreshPositionAbortRef = useRef<AbortController | null>(null)

  const appUrl = useMemo(() => getAppBaseUrl(), [])
  const { apiFetch } = useWaitlistApi(appUrl)
  const { address: connectedAddressRaw } = useAccount()
  const publicClient = usePublicClient({ chainId: base.id })
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const siwe = useSiweAuth()
  const miniApp = useMiniAppContext()

  const patchWaitlist = useCallback((patch: Partial<WaitlistState>) => {
    dispatchWaitlist({ type: 'patch', patch })
  }, [])

  const submitSuccess = useCallback((doneEmail: string | null) => dispatchFlow({ type: 'submit_success', doneEmail }), [])
  const setEmail = useCallback((email: string) => dispatchFlow({ type: 'set_email', email }), [])
  const setEmailOptOut = useCallback(
    (emailOptOutNext: boolean) => dispatchFlow({ type: 'set_email_opt_out', emailOptOut: emailOptOutNext }),
    [],
  )
  const setDoneEmail = useCallback((value: string | null) => dispatchFlow({ type: 'set_done_email', doneEmail: value }), [])
  const setBusy = useCallback((busy: boolean) => dispatchFlow({ type: 'set_busy', busy }), [])
  const setError = useCallback((error: string | null) => dispatchFlow({ type: 'set_error', error }), [])
  const setContactPreference = useCallback(
    (contactPreferenceNext: ContactPreference) =>
      dispatchFlow({ type: 'set_contact_preference', contactPreference: contactPreferenceNext }),
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

  const { persona, step, contactPreference, email, emailOptOut, busy, doneEmail } = flow
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
    creatorCoinDeclaredMissing,
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

  // Wallet type detection can vary across Privy SDK versions/contexts.
  // Mirror deploy hardening: look across multiple fields and use substring matches.
  const walletClientTypeOf = useCallback((w: any): string => {
    return String(
      w?.wallet_client_type ??
        w?.walletClientType ??
        w?.connector_type ??
        w?.connectorType ??
        w?.type ??
        '',
    )
      .trim()
      .toLowerCase()
  }, [])
  const embeddedWallet = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    return (
      ws.find((w) => {
        const t = walletClientTypeOf(w)
        return t === 'privy' || t.includes('privy') || t.includes('embedded')
      }) ?? null
    )
  }, [privyWallets, walletClientTypeOf])
  const baseAccountWallet = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    return ws.find((w) => walletClientTypeOf(w) === 'base_account') ?? null
  }, [privyWallets, walletClientTypeOf])
  
  // Detect Coinbase Smart Wallet from Privy wallets
  const coinbaseSmartWallet = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    return ws.find((w) => {
      const t = walletClientTypeOf(w)
      return t.includes('coinbase_smart_wallet') || t.includes('coinbase-smart-wallet')
    }) ?? null
  }, [privyWallets, walletClientTypeOf])
  const coinbaseSmartWalletAddress = useMemo(() => {
    const raw = typeof coinbaseSmartWallet?.address === 'string' ? coinbaseSmartWallet.address : ''
    return isValidEvmAddress(raw) ? raw : null
  }, [coinbaseSmartWallet?.address])
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

  const openPrivyLogin = useCallback(async () => {
    if (!privyReady || privyVerifyBusy) return
    // Guardrail: never leave the UI stuck in a busy state (Privy can no-op in some edge cases).
    if (typeof window !== 'undefined') {
      window.setTimeout(() => finishPrivyVerify(), 12_000)
    }
    if (privyAuthed && !embeddedWalletAddress) {
      startPrivyVerify()
      try {
        if (typeof privyLogout === 'function') {
          try {
            await privyLogout()
          } catch {
            // ignore
          }
        }
        await privyLogin({ loginMethods: ['wallet', 'email'] })
      } catch (e: any) {
        const msg = formatPrivyConnectError(e?.message ? String(e.message) : String(e ?? ''))
        setPrivyVerifyError(msg)
        finishPrivyVerify()
      }
      return
    }
    handlePrivyContinue()
  }, [
    embeddedWalletAddress,
    finishPrivyVerify,
    formatPrivyConnectError,
    handlePrivyContinue,
    privyAuthed,
    privyLogin,
    privyLogout,
    privyReady,
    privyVerifyBusy,
    setPrivyVerifyError,
    startPrivyVerify,
  ])

  // Email-only fallback: lets users at least authenticate with Privy even if wallet login is disabled.
  // (They will still need wallet sign-in enabled to link Base Account for deploy/verification.)
  const openPrivyEmailLogin = useCallback(async () => {
    if (!privyReady || privyVerifyBusy) return
    if (typeof window !== 'undefined') window.setTimeout(() => finishPrivyVerify(), 12_000)
    startPrivyVerify()
    try {
      if (privyAuthed && typeof privyLogout === 'function') {
        try {
          await privyLogout()
        } catch {
          // ignore
        }
      }
      await privyLogin({ loginMethods: ['email'] })
    } catch (e: any) {
      const msg = formatPrivyConnectError(e?.message ? String(e.message) : String(e ?? ''))
      setPrivyVerifyError(msg)
      finishPrivyVerify()
    }
  }, [finishPrivyVerify, formatPrivyConnectError, privyAuthed, privyLogin, privyLogout, privyReady, privyVerifyBusy, setPrivyVerifyError, startPrivyVerify])

  // If wallet sign-in is disabled (Privy dashboard config), auto-fall back to email login once
  // so users aren’t stuck staring at an error.
  const autoEmailFallbackRef = useRef(false)
  useEffect(() => {
    if (step !== 'verify') return
    if (!showPrivyReady) return
    if (privyAuthed) return
    if (autoEmailFallbackRef.current) return
    const msg = typeof privyVerifyError === 'string' ? privyVerifyError : ''
    if (!/wallet sign-in isn’t available|wallet login is not enabled|disallowed_login_method/i.test(msg)) return
    autoEmailFallbackRef.current = true
    void openPrivyEmailLogin()
  }, [openPrivyEmailLogin, privyAuthed, privyVerifyError, showPrivyReady, step])

  const fallbackSignIn = useCallback(async () => {
    try {
      // This will prefer Privy session-bridge when possible; otherwise it falls back to SIWE.
      await siwe.signIn()
    } catch {
      // errors are handled in the auth hook UI; no-op here
    }
  }, [siwe])

  const emailTrimmed = useMemo(() => normalizeEmail(email), [email])
  const isEmailValid = useMemo(() => isValidEmail(emailTrimmed), [emailTrimmed])
  const canSubmit = (isEmailValid || emailOptOut) && (Boolean(creatorCoin?.address) || creatorCoinDeclaredMissing)
  const connectedAddress = useMemo(
    () =>
      typeof connectedAddressRaw === 'string' && connectedAddressRaw.startsWith('0x') ? connectedAddressRaw.toLowerCase() : null,
    [connectedAddressRaw],
  )

  // Optional: Link Privy embedded EOA as owner on CSW to enable Privy-based deploy signing.
  const [zoraProfileSmartWalletAddress, setZoraProfileSmartWalletAddress] = useState<string | null>(null)
  const [zoraProfileExists, setZoraProfileExists] = useState<boolean | null>(null)
  const cswAddress = useMemo(() => {
    const raw = typeof zoraProfileSmartWalletAddress === 'string' ? zoraProfileSmartWalletAddress : ''
    return isAddress(raw) ? (getAddress(raw) as any) : null
  }, [zoraProfileSmartWalletAddress])
  const embeddedEoaAddressForLink = embeddedWalletAddress
  const connectedOwnerAddressForLink = useMemo(() => {
    const raw = typeof connectedAddressRaw === 'string' ? connectedAddressRaw : ''
    return isValidEvmAddress(raw) ? raw : null
  }, [connectedAddressRaw])

  const [deployOwnerLinkBusy, setDeployOwnerLinkBusy] = useState(false)
  const [deployOwnerLinkError, setDeployOwnerLinkError] = useState<string | null>(null)
  const [embeddedEoaIsOwner, setEmbeddedEoaIsOwner] = useState<boolean | null>(null)
  const [connectedOwnerIsOwner, setConnectedOwnerIsOwner] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!publicClient || !cswAddress || !embeddedEoaAddressForLink) {
        if (!cancelled) setEmbeddedEoaIsOwner(null)
        return
      }
      try {
        const ok = (await (publicClient as any).readContract({
          address: cswAddress,
          abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
          functionName: 'isOwnerAddress',
          args: [embeddedEoaAddressForLink],
        })) as boolean
        if (!cancelled) setEmbeddedEoaIsOwner(Boolean(ok))
      } catch {
        if (!cancelled) setEmbeddedEoaIsOwner(null)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [cswAddress, embeddedEoaAddressForLink, publicClient])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!publicClient || !cswAddress || !connectedOwnerAddressForLink) {
        if (!cancelled) setConnectedOwnerIsOwner(null)
        return
      }
      if (connectedOwnerAddressForLink.toLowerCase() === cswAddress.toLowerCase()) {
        if (!cancelled) setConnectedOwnerIsOwner(true)
        return
      }
      try {
        const ok = (await (publicClient as any).readContract({
          address: cswAddress,
          abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
          functionName: 'isOwnerAddress',
          args: [connectedOwnerAddressForLink],
        })) as boolean
        if (!cancelled) setConnectedOwnerIsOwner(Boolean(ok))
      } catch {
        if (!cancelled) setConnectedOwnerIsOwner(null)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [connectedOwnerAddressForLink, cswAddress, publicClient])

  const linkEmbeddedEoaAsOwner = useCallback(async () => {
    if (deployOwnerLinkBusy) return
    setDeployOwnerLinkBusy(true)
    setDeployOwnerLinkError(null)
    try {
      if (!publicClient) throw new Error('Network client not ready.')
      if (!walletClient) throw new Error('Connect an owner wallet to continue.')
      if (!cswAddress) throw new Error('Creator smart wallet is not configured.')
      if (!embeddedEoaAddressForLink) throw new Error('Sign in with Privy to create your embedded wallet.')
      if (!connectedOwnerAddressForLink) throw new Error('Connect a wallet that already owns the creator smart wallet.')

      const hasMultipleInjectedProviders =
        typeof window !== 'undefined' &&
        Array.isArray((window as any)?.ethereum?.providers) &&
        ((window as any).ethereum.providers as any[]).length > 1
      if (hasMultipleInjectedProviders) {
        throw new Error('Multiple wallet extensions detected. Disable one (MetaMask/Coinbase/Rabby) and retry.')
      }

      // Ensure Base chain for the owner wallet.
      const wc: any = walletClient as any
      const currentChainId = typeof wc?.chain?.id === 'number' ? wc.chain.id : null
      if (currentChainId !== base.id) {
        try {
          if (typeof wc?.switchChain === 'function') {
            await wc.switchChain({ id: base.id })
          }
        } catch {
          // ignore
        }
      }

      if (connectedOwnerAddressForLink.toLowerCase() !== cswAddress.toLowerCase()) {
        const isOwner = (await (publicClient as any).readContract({
          address: cswAddress,
          abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
          functionName: 'isOwnerAddress',
          args: [connectedOwnerAddressForLink],
        })) as boolean
        if (!isOwner) throw new Error('Connected wallet is not an owner of the creator smart wallet.')
      }

      const hash = await (walletClient as any).writeContract({
        account: connectedOwnerAddressForLink,
        chain: base as any,
        address: cswAddress,
        abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
        functionName: 'addOwnerAddress',
        args: [embeddedEoaAddressForLink],
      })

      await (publicClient as any).waitForTransactionReceipt({ hash })

      // Refresh status
      setConnectedOwnerIsOwner(true)
      setEmbeddedEoaIsOwner(true)
    } catch (e: any) {
      setDeployOwnerLinkError(e?.shortMessage || e?.message || 'Failed to link deploy signer')
    } finally {
      setDeployOwnerLinkBusy(false)
    }
  }, [
    connectedOwnerAddressForLink,
    cswAddress,
    deployOwnerLinkBusy,
    embeddedEoaAddressForLink,
    publicClient,
    walletClient,
  ])

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

  // Smooth handoff: check allowlist on the app host so marketing → app works.
  // Keep the CTA slot stable (checking → ready/waitlist) to avoid jarring layout jumps.
  const [deployAccessState, setDeployAccessState] = useState<'checking' | 'ready' | 'waitlist'>('checking')
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (step !== 'done') return
      const addr = typeof verifiedWallet === 'string' && isValidEvmAddress(verifiedWallet) ? verifiedWallet.toLowerCase() : null
      if (!addr) return
      try {
        if (!cancelled) setDeployAccessState('checking')
        const res = await apiFetch(`/api/creator-allowlist?address=${encodeURIComponent(addr)}`, { method: 'GET' })
        const json = (await res.json().catch(() => null)) as any
        const data = json?.success ? json?.data : null
        const mode = typeof data?.mode === 'string' ? String(data.mode) : null
        const allowed = data?.allowed === true
        const ok = isBypassAdmin || mode === 'disabled' || allowed
        if (!cancelled) setDeployAccessState(ok ? 'ready' : 'waitlist')
      } catch {
        if (!cancelled) setDeployAccessState('waitlist')
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [apiFetch, isBypassAdmin, step, verifiedWallet])
  const deployHref = useMemo(() => {
    const baseUrl = appUrl.replace(/\/+$/, '')
    // autologin=1 prompts Privy sign-in on app host; from=waitlist helps tailor UX.
    return `${baseUrl}/deploy?from=waitlist&autologin=1`
  }, [appUrl])
  const primaryCta = useMemo(() => {
    if (deployAccessState !== 'ready') return null
    return { label: 'Continue to Deploy', href: deployHref }
  }, [deployAccessState, deployHref])

  // Simplified flow: verify → done (2 steps)

  // Minimal flow: if Creator Coin lookup completes with no match, auto-allow joining.
  useEffect(() => {
    if (step !== 'verify') return
    if (!verifiedWallet) return
    if (creatorCoinBusy) return
    if (creatorCoin?.address) return
    if (creatorCoinDeclaredMissing) return
    patchWaitlist({ creatorCoinDeclaredMissing: true })
  }, [creatorCoin?.address, creatorCoinBusy, creatorCoinDeclaredMissing, patchWaitlist, step, verifiedWallet])

  // Auto-fill email from Privy user when authenticated
  useEffect(() => {
    if (!privyAuthed || !privyUser) return
    if (step !== 'verify') return

    // Extract email from Privy user
    const privyEmail = privyUser.email?.address || null
    if (privyEmail && isValidEmail(privyEmail)) {
      setEmail(privyEmail)
      setEmailOptOut(false)
      setContactPreference('email')
    } else {
      setEmail('')
      setEmailOptOut(true)
      setContactPreference('wallet')
    }

  }, [privyAuthed, privyUser, step, setEmail, setEmailOptOut, setContactPreference])

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
                  csw: typeof data?.points?.csw === 'number' ? data.points.csw : 0,
                  social: typeof data?.points?.social === 'number' ? data.points.social : 0,
                  bonus: typeof data?.points?.bonus === 'number' ? data.points.bonus : 0,
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
  const displayEmail = doneEmail && !isSyntheticEmail(doneEmail) ? doneEmail : null
  const showEmailCapture = Boolean(doneEmail && isSyntheticEmail(doneEmail))
  const [emailCapture, setEmailCapture] = useState('')
  const [emailCaptureBusy, setEmailCaptureBusy] = useState(false)
  const [emailCaptureError, setEmailCaptureError] = useState<string | null>(null)
  const [emailCaptureSuccess, setEmailCaptureSuccess] = useState<string | null>(null)

  const handleFollow = useCallback(() => {
    markAction('follow')
    markAction('x')
  }, [markAction])

  // Effective CSW address - prioritize Privy-connected wallet over Zora profile
  // This way the wallet they actively connect during signup takes precedence
  const effectiveCswAddress = coinbaseSmartWalletAddress || cswAddress

  const handleLinkCsw = useCallback(async () => {
    if (waitlist.cswLinkBusy || waitlist.cswLinked) return
    patchWaitlist({ cswLinkBusy: true, cswLinkError: null })
    
    try {
      // If user already has a CSW (from Zora profile or Privy), mark as linked
      if (effectiveCswAddress) {
        // Award points for linking CSW
        if (doneEmail) {
          await apiFetch('/api/waitlist/csw-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ 
              email: doneEmail, 
              cswAddress: effectiveCswAddress,
              primaryWallet: verifiedWallet || effectiveCswAddress,
            }),
          })
          await refreshPosition(doneEmail)
        }
        patchWaitlist({ cswLinked: true, cswLinkBusy: false })
      } else {
        // Open Privy wallet connect to link a CSW
        privyConnectWallet()
        patchWaitlist({ cswLinkBusy: false })
      }
    } catch (e: any) {
      patchWaitlist({ 
        cswLinkBusy: false, 
        cswLinkError: e?.message || 'Failed to link wallet' 
      })
    }
  }, [
    apiFetch,
    effectiveCswAddress,
    doneEmail,
    privyConnectWallet,
    patchWaitlist,
    refreshPosition,
    verifiedWallet,
    waitlist.cswLinkBusy,
    waitlist.cswLinked,
  ])

  // Auto-detect CSW when on link-csw step and CSW is available
  useEffect(() => {
    if (step !== 'link-csw') return
    if (waitlist.cswLinked) return
    if (!effectiveCswAddress || !doneEmail) return
    
    // Auto-award CSW points and mark as linked
    const linkCsw = async () => {
      patchWaitlist({ cswLinkBusy: true })
      try {
        await apiFetch('/api/waitlist/csw-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ 
            email: doneEmail, 
            cswAddress: effectiveCswAddress,
            primaryWallet: verifiedWallet || effectiveCswAddress,
          }),
        })
        await refreshPosition(doneEmail)
        patchWaitlist({ cswLinked: true, cswLinkBusy: false })
      } catch {
        patchWaitlist({ cswLinkBusy: false })
      }
    }
    linkCsw()
  }, [apiFetch, doneEmail, effectiveCswAddress, patchWaitlist, refreshPosition, step, verifiedWallet, waitlist.cswLinked])

  const handleSocialAction = useCallback((action: ActionKey, _url: string) => {
    markAction(action)
    
    // Sync to server for verified actions
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
          // ignore - best effort
        }
      })()
    }
  }, [apiFetch, doneEmail, markAction, refreshPosition])

  const handleEmailCaptureSubmit = useCallback(async () => {
    if (!doneEmail || !isSyntheticEmail(doneEmail)) return
    const nextEmail = normalizeEmail(emailCapture)
    if (!isValidEmail(nextEmail)) {
      setEmailCaptureError('Enter a valid email address.')
      setEmailCaptureSuccess(null)
      return
    }
    setEmailCaptureBusy(true)
    setEmailCaptureError(null)
    setEmailCaptureSuccess(null)
    try {
      const res = await apiFetch('/api/waitlist/update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ currentEmail: doneEmail, newEmail: nextEmail }),
      })
      const text = await res.text().catch(() => '')
      const json = safeJsonParse<any>(text)
      if (!res.ok || !json || json.success !== true) {
        const msg =
          json && typeof json.error === 'string'
            ? json.error
            : res.ok
              ? 'Email update failed.'
              : `Email update failed (HTTP ${res.status})`
        throw new Error(msg)
      }
      const updatedEmail = String(json?.data?.email || nextEmail)
      setDoneEmail(updatedEmail)
      setContactPreference('email')
      setEmailOptOut(false)
      setEmailCapture('')
      setEmailCaptureSuccess('Email saved.')
    } catch (e: any) {
      setEmailCaptureError(e?.message ? String(e.message) : 'Email update failed.')
    } finally {
      setEmailCaptureBusy(false)
    }
  }, [apiFetch, doneEmail, emailCapture, setContactPreference, setDoneEmail, setEmailOptOut])

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
              creatorCoinDeclaredMissing: false,
            })
          }
        } catch {
          // ignore
        }
      }

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
      if (emailTrimmed.length > 0 && !isEmailValid && !emailOptOut) {
        throw new Error('Enter a valid email address.')
      }
      if (emailTrimmed.length === 0 && !emailOptOut) {
        throw new Error('Add an email or skip for now.')
      }

      const emailForSubmit = isEmailValid ? emailTrimmed : buildSyntheticEmail(primaryWalletForSubmit())
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
          contactPreference: isEmailValid ? contactPreference : 'wallet',
          verifications,
          intent: {
            persona,
            hasCreatorCoin: creatorCoinBusy ? null : creatorCoinDeclaredMissing ? false : Boolean(creatorCoin?.address),
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
      patchWaitlist({ creatorCoin: null, creatorCoinBusy: false, creatorCoinDeclaredMissing: false })
      creatorCoinForWalletRef.current = null
      setZoraProfileSmartWalletAddress(null)
      setZoraProfileExists(null)
      return
    }
    if (creatorCoinForWalletRef.current === w) return
    creatorCoinForWalletRef.current = w

    let cancelled = false
    patchWaitlist({ creatorCoinBusy: true })
    ;(async () => {
      try {
        let fallbackSmartWallet: string | null = null
        if (publicClient) {
          try {
            const code = await publicClient.getBytecode({ address: getAddress(w) as any })
            if (code && code !== '0x') {
              try {
                await (publicClient as any).readContract({
                  address: getAddress(w) as any,
                  abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
                  functionName: 'isOwnerAddress',
                  args: [w],
                })
                fallbackSmartWallet = w
              } catch {
                // ignore
              }
            } else {
              const ownerBytes = asOwnerBytes(w as `0x${string}`)
              const nonces = [0n, 1n, 2n]
              for (const factory of COINBASE_SMART_WALLET_FACTORIES) {
                for (const nonce of nonces) {
                  try {
                    const predicted = await (publicClient as any).readContract({
                      address: factory,
                      abi: COINBASE_SMART_WALLET_FACTORY_ABI,
                      functionName: 'getAddress',
                      args: [[ownerBytes], nonce],
                    })
                    const predictedAddress = typeof predicted === 'string' ? predicted : ''
                    if (!isValidEvmAddress(predictedAddress)) continue
                    const predictedCode = await publicClient.getBytecode({ address: getAddress(predictedAddress) as any })
                    if (!predictedCode || predictedCode === '0x') continue
                    const isOwner = await (publicClient as any).readContract({
                      address: getAddress(predictedAddress) as any,
                      abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
                      functionName: 'isOwnerAddress',
                      args: [w],
                    })
                    if (isOwner) {
                      fallbackSmartWallet = predictedAddress
                      break
                    }
                  } catch {
                    // ignore
                  }
                }
                if (fallbackSmartWallet) break
              }
            }
          } catch {
            // ignore
          }
        }
        const profile = await fetchZoraProfile(w)
        if (!cancelled) setZoraProfileExists(Boolean(profile))
        const coinAddrRaw = profile?.creatorCoin?.address ? String(profile.creatorCoin.address) : ''
        const coinAddr = isValidEvmAddress(coinAddrRaw) ? coinAddrRaw : null
        let smartWallet: string | null = null
        const linkedWalletEdges = Array.isArray((profile as any)?.linkedWallets?.edges)
          ? ((profile as any).linkedWallets.edges as any[])
          : []
        const linkedWalletCandidates = linkedWalletEdges
          .map((e) => (e && typeof e === 'object' ? (e as any).node : null))
          .map((n) => (n && typeof n === 'object' ? String((n as any).walletAddress ?? '') : ''))
          .filter((addr) => isValidEvmAddress(addr))

        smartWallet = linkedWalletCandidates.length > 0 ? linkedWalletCandidates[0] : null

        let symbol: string | null = null
        let coinType: string | null = null
        let imageUrl: string | null = null
        let marketCapUsd: number | null = null
        let volume24hUsd: number | null = null
        let holders: number | null = null
        let priceUsd: number | null = null
        if (coinAddr) {
          try {
            const coin = await fetchZoraCoin(coinAddr as any)
            symbol = coin?.symbol ? String(coin.symbol) : null
            coinType = coin?.coinType ? String(coin.coinType) : null
            imageUrl =
              (coin?.mediaContent?.previewImage?.medium as string | undefined) ||
              (coin?.mediaContent?.previewImage?.small as string | undefined) ||
              null
            const payoutRaw = typeof coin?.payoutRecipientAddress === 'string' ? coin.payoutRecipientAddress : ''
            smartWallet = isValidEvmAddress(payoutRaw) ? payoutRaw : smartWallet
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
        }

        // If the payout recipient isn't available, try to infer a smart wallet from linked wallets.
        // (Best-effort; schema can vary by API source.)
        if (!smartWallet && linkedWalletCandidates.length > 0) {
          smartWallet = linkedWalletCandidates[0] ?? null
        }

        // Ensure this looks like a smart wallet (contract) when possible.
        if (smartWallet && publicClient) {
          try {
            const code = await publicClient.getBytecode({ address: getAddress(smartWallet) as any })
            if (!code || code === '0x') smartWallet = null
          } catch {
            // ignore
          }
        }

        if (!cancelled) {
          patchWaitlist(
            coinAddr
              ? {
                  creatorCoin: { address: coinAddr, symbol, coinType, imageUrl, marketCapUsd, volume24hUsd, holders, priceUsd },
                  creatorCoinDeclaredMissing: false,
                }
              : { creatorCoin: null },
          )
          setZoraProfileSmartWalletAddress(smartWallet)
        }
      } catch {
        if (!cancelled) {
          patchWaitlist({ creatorCoin: null })
          setZoraProfileSmartWalletAddress(null)
          setZoraProfileExists(null)
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
      ? 'min-h-[100svh] flex items-center justify-center px-4 sm:px-6 py-12 sm:py-16 bg-[#020202]'
      : 'cinematic-section'

  const innerWrapClass = variant === 'page' ? 'w-full max-w-[440px]' : 'max-w-3xl mx-auto px-6 py-14'

  const cardWrapClass =
    variant === 'page'
      ? 'rounded-3xl bg-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl p-5 sm:p-7'
      : 'rounded-3xl border border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl p-5 sm:p-7'

  return (
    <section id={variant === 'embedded' ? sectionId : undefined} className={containerClass}>
      <div className={innerWrapClass}>
        {variant === 'page' ? (
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div className="flex items-center gap-3">
              <Logo width={32} height={32} showText={false} />
              <div>
                <div className="text-[13px] text-white font-medium">Creator Vaults</div>
                <div className="text-[11px] text-zinc-500">Waitlist</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            <span className="text-[11px] uppercase tracking-[0.15em] text-zinc-600 font-medium">Waitlist</span>
            <div className="text-[40px] sm:text-[48px] font-light tracking-tight text-white leading-tight">Early access</div>
            <div className="text-[15px] text-zinc-500 font-light">Verify your wallet to join.</div>
          </div>
        )}

        <motion.div className={cardWrapClass}>
          {/* Show reset on done step */}
          {step === 'done' ? (
            <div className="flex items-center justify-between mb-5">
              <button
                type="button"
                className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors duration-200"
                onClick={resetFlow}
              >
                Start over
              </button>
              <div className="w-8" />
            </div>
          ) : null}
          {/* Step indicator (stable, no layout/slide jitter) */}
          <div className="mb-6 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-600">
              {step === 'verify' ? 'Sign Up' : step === 'link-csw' ? 'Connect Wallet' : 'Complete'}
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-[3px] ${step === 'verify' ? 'bg-white/20' : 'bg-white/10'}`} />
              <div className={`h-2 w-2 rounded-[3px] ${step === 'link-csw' ? 'bg-white/20' : 'bg-white/10'}`} />
              <div className={`h-2 w-2 rounded-[3px] ${step === 'done' ? 'bg-white/20' : 'bg-white/10'}`} />
              <div className="ml-1 text-[11px] text-zinc-600 tabular-nums">
                {step === 'verify' ? '1' : step === 'link-csw' ? '2' : '3'}/3
              </div>
            </div>
          </div>

          {/* Step transition: smooth layout */}
          <div className="relative">
            <AnimatePresence mode="wait">
              {step === 'verify' ? (
                <motion.div
                  key="step:verify"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: BASE_MOTION_MS, ease: BASE_EASE }}
                >
                  <VerifyStep
                    verifiedWallet={verifiedWallet}
                    showPrivy={showPrivy}
                    showPrivyReady={showPrivyReady}
                    privyReady={privyReady}
                    privyAuthed={privyAuthed}
                    privyVerifyBusy={privyVerifyBusy}
                    privyVerifyError={privyVerifyError}
                    showDeployOwnerLink={Boolean(showPrivyReady && privyAuthed && cswAddress)}
                    deployOwnerLinkBusy={deployOwnerLinkBusy}
                    deployOwnerLinkError={deployOwnerLinkError}
                    cswAddress={cswAddress}
                    embeddedEoaAddress={embeddedEoaAddressForLink}
                    connectedOwnerAddress={connectedOwnerAddressForLink}
                    embeddedEoaIsOwner={embeddedEoaIsOwner}
                    connectedOwnerIsOwner={connectedOwnerIsOwner}
                    onLinkEmbeddedEoaAsOwner={linkEmbeddedEoaAsOwner}
                    creatorCoin={creatorCoin}
                    creatorCoinDeclaredMissing={creatorCoinDeclaredMissing}
                    creatorCoinBusy={creatorCoinBusy}
                    busy={busy}
                    canSubmit={canSubmit}
                    onPrivyContinue={openPrivyLogin}
                    onPrivyEmailContinue={openPrivyEmailLogin}
                    onFallbackSignIn={fallbackSignIn}
                    onSubmit={submitWaitlist}
                  />
                </motion.div>
              ) : null}

              {step === 'link-csw' ? (
                <motion.div
                  key="step:link-csw"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: BASE_MOTION_MS, ease: BASE_EASE }}
                >
                  <LinkCswStep
                    cswLinked={waitlist.cswLinked}
                    cswLinkBusy={waitlist.cswLinkBusy}
                    cswLinkError={waitlist.cswLinkError}
                    onLinkCsw={handleLinkCsw}
                    onSkip={() => dispatchFlow({ type: 'csw_complete' })}
                    onContinue={() => dispatchFlow({ type: 'csw_complete' })}
                  />
                </motion.div>
              ) : null}

              {step === 'done' ? (
                <motion.div
                  key="step:done"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: BASE_MOTION_MS, ease: BASE_EASE }}
                >
                  <DoneStep
                    displayEmail={displayEmail}
                    isBypassAdmin={isBypassAdmin}
                    appUrl={appUrl}
                    waitlistPosition={waitlistPosition}
                    referralCode={referralCode}
                    referralLink={referralLink}
                    onCopyReferral={handleCopyReferral}
                    copyToast={inviteToast}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
