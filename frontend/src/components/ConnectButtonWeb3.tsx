import { type Connector, useAccount, useConnect, useDisconnect, useSignMessage, useSwitchChain } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ChevronDown, AlertCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { base } from 'wagmi/chains'
import { useMiniAppContext } from '@/hooks'
import { logger } from '@/lib/logger'
import { apiFetch } from '@/lib/apiBase'
import { usePrivyClientStatus } from '@/lib/privy/client'

function uniqueConnectors(list: Array<Connector | null | undefined>): Connector[] {
  const out: Connector[] = []
  const seen = new Set<string>()
  for (const c of list) {
    if (!c) continue
    const id = String(c.id ?? c.name ?? '')
    if (!id) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push(c)
  }
  return out
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

type ConnectButtonVariant = 'default' | 'deploy' | 'gate'
type GuideChoice = 'base' | 'farcaster' | 'zora' | 'other'

function PrivyEmailFallbackButton({
  isPending,
  smartWalletConnector,
  getSmartWalletConnector,
  connectDirect,
  onError,
  onReset,
}: {
  isPending: boolean
  smartWalletConnector: Connector | null | undefined
  getSmartWalletConnector?: () => Connector | null | undefined
  connectDirect: (c: Connector | null | undefined, opts?: { timeoutMs?: number; label?: string }) => Promise<void>
  onError: (message: string | null) => void
  onReset?: () => void
}) {
  const { ready, authenticated, login } = usePrivy()
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    if (busy) return
    setBusy(true)
    onError(null)
    try {
      if (typeof onReset === 'function') onReset()
      if (!authenticated) {
        await login({ loginMethods: ['email'] } as any)
      }
      const resolveConnector = async (): Promise<Connector | null | undefined> => {
        let resolved = smartWalletConnector ?? (typeof getSmartWalletConnector === 'function' ? getSmartWalletConnector() : null)
        if (resolved) return resolved
        const started = Date.now()
        while (Date.now() - started < 5_000) {
          await new Promise((r) => setTimeout(r, 250))
          resolved = typeof getSmartWalletConnector === 'function' ? getSmartWalletConnector() : null
          if (resolved) return resolved
        }
        return resolved
      }
      const resolvedConnector = await resolveConnector()
      if (!resolvedConnector) {
        onError('Smart wallet is still loading - try again.')
        return
      }
      await connectDirect(resolvedConnector, { timeoutMs: 60_000, label: 'Email' })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Email sign-in failed'
      onError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleClick()}
        className="btn-primary w-full disabled:opacity-50"
      >
        <span className="label">
          {busy ? 'Starting email sign-in...' : !ready && isPending ? 'Loading sign-in...' : 'Continue with email'}
        </span>
      </button>
      <div className="text-[10px] text-zinc-600">Uses a Privy smart wallet for deploy.</div>
    </div>
  )
}

function ConnectButtonWeb3Wagmi({
  autoConnect = false,
  variant = 'default',
}: {
  autoConnect?: boolean
  variant?: ConnectButtonVariant
}) {
  const { address, isConnected, chain, connector } = useAccount()
  const { connectAsync, connectors, isPending, reset } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { signMessageAsync } = useSignMessage()
  const miniApp = useMiniAppContext()
  const privyStatus = usePrivyClientStatus()
  const [showMenu, setShowMenu] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [guideStep, setGuideStep] = useState<1 | 2>(1)
  const [guideChoice, setGuideChoice] = useState<GuideChoice | null>(null)
  const [copied, setCopied] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [authAddress, setAuthAddress] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const hasAutoConnected = useRef<string | null>(null)

  const miniAppConnector = connectors.find((c) => {
    const id = String(c.id ?? '').toLowerCase()
    const name = String((c as any)?.name ?? '').toLowerCase()
    return id.includes('miniapp') || name.includes('farcaster') || name.includes('mini app')
  })
  const walletConnectConnector = connectors.find((c) => String(c.id) === 'walletConnect' || String(c.name ?? '').toLowerCase().includes('walletconnect'))
  const rabbyConnector = connectors.find((c) => String(c.id ?? '').toLowerCase() === 'rabby' || String(c.name ?? '').toLowerCase().includes('rabby'))
  const baseAppConnector = connectors.find((c) => {
    const id = String(c.id ?? '').toLowerCase()
    const name = String(c.name ?? '').toLowerCase()
    return id === 'coinbasesmartwallet' || name.includes('coinbase') || name.includes('base')
  })
  const zoraConnector = connectors.find((c) => {
    const id = String(c.id ?? '').toLowerCase()
    const name = String(c.name ?? '').toLowerCase()
    return id === 'privy-zora' || name.includes('zora')
  })
  const getPrivySmartWalletConnector = useCallback(() => {
    return connectors.find((c) => {
      const id = String(c.id ?? '').toLowerCase()
      const name = String(c.name ?? '').toLowerCase()
      if (!id && !name) return false
      if (id === 'privy-zora' || name.includes('zora')) return false
      if (id.includes('walletconnect') || name.includes('walletconnect')) return false
      if (id.includes('rabby') || name.includes('rabby')) return false
      if (id.includes('coinbase') || name.includes('coinbase') || name.includes('base app')) return false
      if (id.includes('farcaster') || name.includes('farcaster') || name.includes('mini app')) return false
      return id.includes('privy') || name.includes('privy') || id.includes('embedded') || name.includes('embedded') || name.includes('smart')
    })
  }, [connectors])
  const privySmartWalletConnector = getPrivySmartWalletConnector()
  const canUseBaseApp = Boolean(baseAppConnector)
  const canUseFarcaster = Boolean(miniAppConnector) && miniApp.isMiniApp
  const canUseZora = Boolean(zoraConnector)
  const baseDisabled = !canUseBaseApp
  const farcasterDisabled = !canUseFarcaster
  const zoraDisabled = !canUseZora

  const injectedProvider = typeof window !== 'undefined' ? (window as any)?.ethereum : null
  const ethereumDescriptor =
    typeof window !== 'undefined' ? Object.getOwnPropertyDescriptor(window, 'ethereum') : null
  // Some wallet extensions (or extension conflicts) define `window.ethereum` as a getter-only, non-configurable prop.
  // In that state, injected-wallet connectors are flaky (and can even throw during provider injection).
  // Prefer WalletConnect in those cases.
  const isEthereumLocked = !!ethereumDescriptor && typeof ethereumDescriptor.get === 'function' && !ethereumDescriptor.set
  const isRabbyPresent =
    Boolean(injectedProvider) &&
    (Boolean((injectedProvider as any)?.isRabby) ||
      (Array.isArray((injectedProvider as any)?.providers) &&
        ((injectedProvider as any).providers as any[]).some((p) => Boolean(p?.isRabby))))

  // In the Base app / Farcaster Mini App, prefer the mini app connector (no wallet-brand UX).
  // On the open web, default to the most universal path:
  // - Rabby (if installed)
  // - WalletConnect (QR) fallback
  const isDeployVariant = variant === 'deploy'
  const isGateVariant = variant === 'gate'
  const isDeployLike = isDeployVariant || isGateVariant
  const preferZoraOnDesktop = !isDeployLike && !miniApp.isMiniApp && Boolean(zoraConnector)
  // If Zora cross-app is available on desktop, make it the primary one-click path.
  const showGuidedModal = !isGateVariant && !miniApp.isMiniApp && !preferZoraOnDesktop
  const preferredConnector = isDeployLike
    ? // Deploy should use a single universal path to avoid eth_sign dead-ends:
      // - Mini App connector inside Mini Apps
      // - Base App connector on the open web
      // - WalletConnect fallback when needed
      (miniApp.isMiniApp ? miniAppConnector : null) ?? baseAppConnector ?? walletConnectConnector ?? connectors[0]
    : (miniApp.isMiniApp ? miniAppConnector : null) ?? zoraConnector ?? walletConnectConnector ?? rabbyConnector ?? connectors[0]

  const connectDirect = useCallback(
    async (c: Connector | null | undefined, opts?: { timeoutMs?: number; label?: string }) => {
      if (!c) return
      setConnectError(null)
      try {
        const timeoutMs = typeof opts?.timeoutMs === 'number' ? opts.timeoutMs : 60_000
        await withTimeout(connectAsync({ connector: c }), timeoutMs)
        setShowOptions(false)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        const name = typeof (e as any)?.name === 'string' ? String((e as any).name) : ''
        logger.warn('[ConnectButtonWeb3] connectDirect failed', { connector: { id: c.id, name: c.name }, name, msg })
        reset()
        if (name.toLowerCase().includes('userrejected') || msg.toLowerCase().includes('user rejected')) {
          setConnectError('Connection rejected')
          return
        }
        const isZora = String(c.id ?? '').toLowerCase() === 'privy-zora' || String(c.name ?? '').toLowerCase().includes('zora')
        setConnectError(
          isZora
            ? 'Unable to connect Zora wallet. Make sure you’re logged into Zora and allow the consent popup (or connect another wallet).'
            : opts?.label
              ? `Unable to connect (${opts.label})`
              : 'Unable to connect',
        )
      }
    },
    [connectAsync, reset],
  )

  const connectBestEffort = useCallback(async () => {
    if (!preferredConnector) return
    setConnectError(null)

    const ordered = uniqueConnectors(
      isDeployLike
        ? [
            // In Mini Apps, always use the native connector.
            miniApp.isMiniApp ? miniAppConnector : null,
            // On web, prefer Base App / Coinbase Smart Wallet first.
            !miniApp.isMiniApp ? baseAppConnector : null,
            // Universal fallback (QR).
            !miniApp.isMiniApp ? walletConnectConnector : null,
            preferredConnector,
          ]
        : [
            // Prefer Mini App connector inside Mini Apps.
            miniApp.isMiniApp ? miniAppConnector : null,
            // If available, try Zora cross-app wallet first on desktop.
            !miniApp.isMiniApp ? zoraConnector : null,
            // Universal fallback (QR) — also the safest option when injected wallet extensions conflict.
            !miniApp.isMiniApp ? walletConnectConnector : null,
            // Try injected wallets after WalletConnect (or skip if the injected provider is in a bad/locked state).
            !miniApp.isMiniApp && !isEthereumLocked ? rabbyConnector : null,
            !miniApp.isMiniApp && !isEthereumLocked ? baseAppConnector : null,
            preferredConnector,
            ...connectors,
          ],
    )

    for (const c of ordered) {
      try {
        const id = String(c.id ?? '')

        // Wallet UX nuance:
        // - Extension wallets may "hang" if the provider is in a bad state.
        //   In that case we want to auto-fallback to WalletConnect instead of staying "Connecting…" forever.
        const timeoutMs =
          !miniApp.isMiniApp && !isDeployLike && (id === 'rabby' || id.toLowerCase().includes('metamask'))
            ? 3_000
            : // WalletConnect often requires user action (scan QR / confirm) so give it more time.
              !miniApp.isMiniApp && id.toLowerCase().includes('walletconnect')
              ? 90_000
              : 30_000

        await withTimeout(connectAsync({ connector: c }), timeoutMs)
        return
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        const name = typeof (e as any)?.name === 'string' ? String((e as any).name) : ''
        logger.warn('[ConnectButtonWeb3] connect failed', { connector: { id: c.id, name: c.name }, name, msg })

        // Reset mutation state so we can attempt the next connector immediately.
        reset()

        // If the user explicitly rejected the request, don't immediately open another modal.
        if (name.toLowerCase().includes('userrejected') || msg.toLowerCase().includes('user rejected')) {
          setConnectError('Connection rejected')
          return
        }

        // Timeouts should fall through to try the next connector (usually WalletConnect).
        if (msg.toLowerCase().includes('timeout')) {
          setConnectError('No wallet response — trying another method…')
          continue
        }

        // Try next connector.
        continue
      }
    }

    setConnectError('Unable to connect with available wallets')
  }, [
    connectAsync,
    connectors,
    baseAppConnector,
    isEthereumLocked,
    isDeployLike,
    miniApp.isMiniApp,
    miniAppConnector,
    preferredConnector,
    rabbyConnector,
    reset,
    walletConnectConnector,
  ])

  // Best-effort: preserve a single "Connect Wallet" click when Web3 is lazily enabled.
  useEffect(() => {
    if (!autoConnect) return
    if (isConnected) return
    if (!preferredConnector) return

    // Re-attempt if the preferred connector changes (e.g. once Mini App detection resolves).
    const key = `${String(preferredConnector.id)}:${miniApp.isMiniApp === true ? 'mini' : 'web'}:${isRabbyPresent ? 'rabby' : 'wc'}`
    if (hasAutoConnected.current === key) return
    hasAutoConnected.current = key
    void connectBestEffort()
  }, [autoConnect, connectBestEffort, isConnected, isRabbyPresent, miniApp.isMiniApp, preferredConnector])

  // Check if on wrong network
  const isWrongNetwork = isConnected && chain?.id !== base.id

  // Load current signed-in wallet (if any).
  useEffect(() => {
    let cancelled = false
    async function run() {
      setAuthError(null)
      if (!isConnected) {
        setAuthAddress(null)
        return
      }
      try {
        const res = await apiFetch('/api/auth/me', { headers: { Accept: 'application/json' } })
        const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { address?: string } | null } | null
        const a = json?.data?.address
        if (!cancelled) setAuthAddress(typeof a === 'string' ? a : null)
      } catch {
        if (!cancelled) setAuthAddress(null)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [isConnected])

  const isSignedIn =
    !!address && !!authAddress && authAddress.toLowerCase() === address.toLowerCase()

  const connectorId = String(connector?.id ?? '').toLowerCase()
  const connectorName = String(connector?.name ?? '').toLowerCase()
  const isZoraConnector = connectorId === 'privy-zora' || connectorName.includes('zora')
  const guideData =
    guideChoice === 'base'
      ? {
          title: 'Base App',
          bullets: ['Passkeys sync across devices (no seed phrase).', 'Best for 1-click deploy on Base.'],
          connector: baseAppConnector,
          disabled: !canUseBaseApp,
          disabledHint: 'Open in Base App or Coinbase Wallet to continue.',
          label: 'Base App',
        }
      : guideChoice === 'farcaster'
        ? {
            title: 'Farcaster',
            bullets: ['Available inside Farcaster or Base mini apps.', 'Uses your Farcaster-connected wallet.'],
            connector: miniAppConnector,
            disabled: !canUseFarcaster,
            disabledHint: 'Open this page inside Farcaster or Base app.',
            label: 'Farcaster',
          }
        : guideChoice === 'zora'
          ? {
              title: 'Zora',
              bullets: ['Bring your existing Zora wallet.', 'Sign via Zora popup when needed.'],
              connector: zoraConnector,
              disabled: !canUseZora,
              disabledHint: 'Zora connector is unavailable in this environment.',
              label: 'Zora',
            }
          : null

  async function signIn() {
    if (!address) return
    setAuthBusy(true)
    setAuthError(null)
    try {
      const nonceRes = await apiFetch('/api/auth/nonce', { headers: { Accept: 'application/json' } })
      if (!nonceRes.ok) {
        const errJson = (await nonceRes.json().catch(() => null)) as { error?: string } | null
        throw new Error(errJson?.error || `Failed to start sign-in (HTTP ${nonceRes.status})`)
      }
      const nonceJson = (await nonceRes.json().catch(() => null)) as
        | { success?: boolean; data?: { nonce?: string; issuedAt?: string; domain?: string; uri?: string; chainId?: number } }
        | null
      const data = nonceJson?.data
      const nonce = typeof data?.nonce === 'string' ? data.nonce : ''
      const issuedAt = typeof data?.issuedAt === 'string' ? data.issuedAt : new Date().toISOString()
      const domain = typeof data?.domain === 'string' ? data.domain : window.location.host
      const uri = typeof data?.uri === 'string' ? data.uri : window.location.origin
      const chainId = typeof data?.chainId === 'number' ? data.chainId : base.id

      if (!nonce) throw new Error('Failed to start sign-in (missing nonce)')

      const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to Creator Vaults.\n\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`

      const signature = await signMessageAsync({ message })

      const verifyRes = await apiFetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message, signature }),
      })
      const verifyJson = (await verifyRes.json().catch(() => null)) as { success?: boolean; data?: { address?: string }; error?: string } | null
      if (!verifyRes.ok || !verifyJson?.success) throw new Error(verifyJson?.error || 'Sign-in failed')
      const signed = verifyJson?.data?.address
      setAuthAddress(typeof signed === 'string' ? signed : null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed'
      // Zora cross-app signing can fail if popups are blocked, the provider app is configured as read-only,
      // or the user hasn't granted cross-app consent. Provide a clearer fallback hint.
      if (isZoraConnector) {
        const lower = String(msg || '').toLowerCase()
        const isPopupish =
          lower.includes('popup') || lower.includes('blocked') || lower.includes('window') || lower.includes('redirect')
        const isDenied = lower.includes('denied') || lower.includes('rejected') || lower.includes('cancel')
        setAuthError(
          isDenied
            ? 'Zora wallet signature was cancelled. You can try again or connect another wallet.'
            : isPopupish
              ? 'Zora wallet signature needs a popup. Please allow popups, then try again (or connect another wallet).'
              : 'Unable to sign with Zora wallet. If Zora is read-only here, connect another wallet to continue.',
        )
      } else {
        setAuthError(msg)
      }
    } finally {
      setAuthBusy(false)
    }
  }

  async function signOut() {
    setAuthBusy(true)
    setAuthError(null)
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', headers: { Accept: 'application/json' } })
      setAuthAddress(null)
    } finally {
      setAuthBusy(false)
    }
  }

  // Auto-prompt to switch to Base if on wrong network
  useEffect(() => {
    if (isWrongNetwork && switchChain) {
      // Auto-switch after 1 second
      const timer = setTimeout(() => {
        switchChain({ chainId: base.id })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isWrongNetwork, switchChain])

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  if (isConnected && address) {
    // Show switch network button if on wrong network
    if (isWrongNetwork) {
      return (
        <button
          onClick={() => switchChain?.({ chainId: base.id })}
          className="btn-accent flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4" />
          <span className="label">Switch to Base</span>
        </button>
      )
    }

    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="btn-primary flex items-center gap-3"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span className="mono text-sm">{formatAddress(address)}</span>
          <ChevronDown
            className={`w-3 h-3 text-zinc-600 transition-transform ${
              showMenu ? 'rotate-180' : ''
            }`}
          />
        </button>

        <AnimatePresence>
          {showMenu && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-4 w-56 card p-4 z-50 space-y-2"
              >
                <button
                  onClick={() => {
                    if (authBusy) return
                    if (isSignedIn) void signOut()
                    else void signIn()
                    setShowMenu(false)
                  }}
                  className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors disabled:opacity-50"
                  disabled={authBusy}
                  title={
                    isZoraConnector ? 'Proves you control your Zora wallet (no transaction)' : 'Proves you control this wallet (no transaction)'
                  }
                >
                  <span className="label block mb-1">
                    {isSignedIn ? 'Signed in' : 'Sign in'}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {isSignedIn ? 'Verified for this session' : 'No transaction'}
                  </span>
                </button>
                {authError ? (
                  <div className="px-4 text-[11px] text-red-400/90">{authError}</div>
                ) : null}
                <button
                  onClick={copyAddress}
                  className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors"
                >
                  <span className="label block mb-1">{copied ? 'Copied!' : 'Copy Address'}</span>
                </button>
                <a
                  href={`https://basescan.org/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 px-4 hover:bg-zinc-950 transition-colors"
                >
                  <span className="label block">View on Basescan</span>
                </a>
                <div className="h-px bg-zinc-900 my-2" />
                <button
                  onClick={() => {
                    disconnect()
                    setShowMenu(false)
                  }}
                  className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors"
                >
                  <span className="label block text-zinc-600">Disconnect</span>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    )
  }

  const primaryLabel = isDeployVariant ? 'Continue' : preferZoraOnDesktop ? 'Continue with Zora' : 'Connect Wallet'

  return (
    <div className={`flex flex-col gap-2 ${isDeployLike ? 'items-stretch' : 'items-end'}`}>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!preferredConnector) {
            setConnectError('No wallet connectors are available. Try the email option below.')
            return
          }
          if (showGuidedModal) {
            setGuideStep(1)
            setGuideChoice(null)
            setShowGuide(true)
            return
          }
          void connectBestEffort()
        }}
        className="btn-accent disabled:opacity-50 flex items-center gap-2"
        title={
          connectError
            ? connectError
            : preferredConnector
              ? `Connect with ${preferredConnector.name}`
              : 'No wallet connector available'
        }
      >
        <Wallet className="w-4 h-4" />
        <span className="label">{isPending ? 'Connecting…' : primaryLabel}</span>
      </button>
      <AnimatePresence>
        {showGuide ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              onClick={() => setShowGuide(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed left-1/2 top-24 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 card p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="label">{guideStep === 1 ? 'Choose your path' : guideData?.title ?? 'Choose your path'}</div>
                <button
                  type="button"
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                  onClick={() => setShowGuide(false)}
                >
                  Close
                </button>
              </div>
              {guideStep === 1 ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={zoraDisabled}
                    className={`w-full text-left py-3 px-4 transition-colors ${
                      zoraDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-950'
                    }`}
                    onClick={() => {
                      if (zoraDisabled) return
                      setGuideChoice('zora')
                      setGuideStep(2)
                    }}
                  >
                    <span className="label block mb-1">Zora</span>
                    <span className="text-xs text-zinc-600">
                      {zoraDisabled ? 'Not available on this device.' : 'Continue with your existing Zora wallet.'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={baseDisabled}
                    className={`w-full text-left py-3 px-4 transition-colors ${
                      baseDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-950'
                    }`}
                    onClick={() => {
                      if (baseDisabled) return
                      setGuideChoice('base')
                      setGuideStep(2)
                    }}
                  >
                    <span className="label block mb-1">Base App</span>
                    <span className="text-xs text-zinc-600">
                      {baseDisabled ? 'Not available on this device.' : 'Recommended for Coinbase Smart Wallet.'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={farcasterDisabled}
                    className={`w-full text-left py-3 px-4 transition-colors ${
                      farcasterDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-950'
                    }`}
                    onClick={() => {
                      if (farcasterDisabled) return
                      setGuideChoice('farcaster')
                      setGuideStep(2)
                    }}
                  >
                    <span className="label block mb-1">Farcaster</span>
                    <span className="text-xs text-zinc-600">
                      {farcasterDisabled ? 'Open inside Farcaster or Base app.' : 'Available inside Farcaster or Base app.'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn-primary w-full"
                    onClick={() => {
                      setGuideChoice('other')
                      setGuideStep(2)
                    }}
                  >
                    Other wallets (WalletConnect or email)
                  </button>
                </div>
              ) : guideChoice === 'other' ? (
                <div className="space-y-3">
                  <div className="text-[11px] text-zinc-500">Other wallets</div>
                  {walletConnectConnector ? (
                    <button
                      type="button"
                      disabled={isPending}
                      className="btn-primary w-full disabled:opacity-50"
                      onClick={() => {
                        void connectDirect(walletConnectConnector, { timeoutMs: 90_000, label: 'WalletConnect' })
                        setShowGuide(false)
                      }}
                    >
                      Continue with WalletConnect
                    </button>
                  ) : (
                    <div className="text-[11px] text-amber-300/80">WalletConnect is unavailable in this environment.</div>
                  )}
                  {privyStatus === 'ready' ? (
                    <PrivyEmailFallbackButton
                      isPending={isPending}
                      smartWalletConnector={privySmartWalletConnector}
                      getSmartWalletConnector={getPrivySmartWalletConnector}
                      connectDirect={connectDirect}
                      onError={setConnectError}
                    />
                  ) : null}
                  <button
                    type="button"
                    className="w-full text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    onClick={() => setGuideStep(1)}
                  >
                    Back
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[11px] text-zinc-500">What this means</div>
                  <ul className="text-xs text-zinc-600 list-disc list-inside space-y-1">
                    {(guideData?.bullets ?? []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {guideData?.disabled ? (
                    <div className="text-[11px] text-amber-300/80">{guideData.disabledHint}</div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-accent w-full disabled:opacity-50"
                      disabled={isPending || guideData?.disabled || !guideData?.connector}
                      onClick={() => {
                        if (!guideData?.connector) return
                        void connectDirect(guideData.connector, { timeoutMs: 60_000, label: guideData.label })
                        setShowGuide(false)
                      }}
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      className="w-full text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                      onClick={() => setGuideStep(1)}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
      {!miniApp.isMiniApp && isDeployLike ? (
        <div className="relative">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setShowOptions((v) => !v)}
            className="btn-primary w-full px-6 py-2 disabled:opacity-50"
            title="More connection options"
          >
            <span className="label">More options</span>
          </button>

          <AnimatePresence>
            {showOptions ? (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40"
                  onClick={() => setShowOptions(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute left-0 top-full mt-3 w-[min(360px,calc(100vw-2rem))] card p-3 z-50 space-y-2"
                >
                  {baseAppConnector ? (
                    <button
                      type="button"
                      disabled={isPending}
                      className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors disabled:opacity-50"
                      onClick={() => void connectDirect(baseAppConnector, { timeoutMs: 60_000, label: 'Base App' })}
                    >
                      <span className="label block mb-1">Base App</span>
                      <span className="text-xs text-zinc-600">Best for Coinbase Smart Wallet (passkeys, cross-device).</span>
                    </button>
                  ) : null}

                  {walletConnectConnector ? (
                    <button
                      type="button"
                      disabled={isPending}
                      className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors disabled:opacity-50"
                      onClick={() => void connectDirect(walletConnectConnector, { timeoutMs: 90_000, label: 'WalletConnect' })}
                    >
                      <span className="label block mb-1">WalletConnect (QR)</span>
                      <span className="text-xs text-zinc-600">Universal fallback (any wallet).</span>
                    </button>
                  ) : null}

                  {zoraConnector ? (
                    <button
                      type="button"
                      disabled={isPending}
                      className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors disabled:opacity-50"
                      onClick={() => void connectDirect(zoraConnector, { timeoutMs: 60_000, label: 'Zora' })}
                    >
                      <span className="label block mb-1">Zora</span>
                      <span className="text-xs text-zinc-600">Use your existing Zora wallet.</span>
                    </button>
                  ) : null}
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
      {isDeployLike && privyStatus === 'ready' ? (
        <PrivyEmailFallbackButton
          isPending={isPending}
          smartWalletConnector={privySmartWalletConnector}
          getSmartWalletConnector={getPrivySmartWalletConnector}
          connectDirect={connectDirect}
          onError={setConnectError}
          onReset={reset}
        />
      ) : null}
      {connectError ? <div className="text-[10px] text-zinc-500">{connectError}</div> : null}
    </div>
  )
}

export function ConnectButtonWeb3({ autoConnect = false, variant = 'default' }: { autoConnect?: boolean; variant?: ConnectButtonVariant }) {
  return <ConnectButtonWeb3Wagmi autoConnect={autoConnect} variant={variant} />
}
