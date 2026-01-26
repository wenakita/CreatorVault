import { useCallback, useEffect, useRef } from 'react'
import type { Persona, VerificationMethod } from './waitlistTypes'

type SiweLike = {
  isSignedIn: boolean
  authAddress: string | null
}

type UseWaitlistVerificationParams = {
  persona: Persona | null
  step: 'persona' | 'verify' | 'email' | 'done'
  showPrivy: boolean
  privyStatus: string
  privyReady: boolean
  privyAuthed: boolean
  privyUser: unknown
  privyWallets: unknown[]
  privyVerifyBusy: boolean
  privyVerifyError: string | null
  miniAppIsBaseApp: boolean
  verifiedWallet: string | null
  verifiedSolana: string | null
  embeddedWalletAddress: string | null
  baseAccountAddress: string | null
  baseSubAccount: string | null
  baseSubAccountBusy: boolean
  siwe: SiweLike
  verifyWallet: (address: string, method: VerificationMethod | null) => void
  verifySolana: (address: string) => void
  startPrivyVerify: () => void
  finishPrivyVerify: () => void
  setPrivyVerifyError: (error: string | null) => void
  privyLinkWallet?: (options: unknown) => Promise<unknown> | void
  privyConnectWallet?: (options: unknown) => Promise<unknown> | void
  formatPrivyConnectError: (code: string) => string
  extractPrivyWalletAddress: (user: unknown, walletsOverride?: unknown[]) => string | null
  extractPrivySolanaAddress: (user: unknown, walletsOverride?: unknown[]) => string | null
  getPrivyWalletMissingMessage: (user: unknown, walletsOverride?: unknown[]) => string
  ensureBaseSubAccount: () => Promise<void>
}

export function useWaitlistVerification({
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
  miniAppIsBaseApp,
  verifiedWallet,
  verifiedSolana,
  embeddedWalletAddress,
  baseAccountAddress,
  baseSubAccount,
  baseSubAccountBusy,
  siwe,
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
}: UseWaitlistVerificationParams) {
  const privyVerifyAttemptRef = useRef<number>(0)
  const subAccountAttemptRef = useRef<string | null>(null)

  const handlePrivyContinue = useCallback(() => {
    if (!privyReady || privyVerifyBusy) return
    startPrivyVerify()
    privyVerifyAttemptRef.current = Date.now()
    const walletOptions = {
      // Offer extension wallets unless multiple injected providers are present.
      walletList: miniAppIsBaseApp ? ['base_account'] : ['wallet_connect'],
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
      const msg = formatPrivyConnectError(raw || '')
      setPrivyVerifyError(msg)
    }
  }, [
    finishPrivyVerify,
    formatPrivyConnectError,
    miniAppIsBaseApp,
    privyAuthed,
    privyConnectWallet,
    privyLinkWallet,
    privyReady,
    privyVerifyBusy,
    setPrivyVerifyError,
    startPrivyVerify,
  ])

  // SIWE: when authenticated, treat as verified wallet.
  useEffect(() => {
    if (step !== 'verify') return
    if (!persona) return
    if (!siwe.isSignedIn) return
    if (verifiedWallet) return
    if (!siwe.authAddress) return
    verifyWallet(siwe.authAddress, 'siwe')
  }, [persona, siwe.authAddress, siwe.isSignedIn, step, verifiedWallet, verifyWallet])

  // Privy-first: when Privy has an authenticated wallet, treat it as verified for this flow.
  useEffect(() => {
    if (!showPrivy || privyStatus !== 'ready') return
    if (step !== 'verify') return
    if (!persona) return
    if (!privyReady) return
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
    getPrivyWalletMissingMessage,
    persona,
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
    extractPrivySolanaAddress,
    extractPrivyWalletAddress,
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

  return { handlePrivyContinue }
}
