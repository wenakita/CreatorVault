import { useAccount, useConnect, useDisconnect, useSignMessage, useSwitchChain } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ChevronDown, AlertCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { base } from 'wagmi/chains'
import { useMiniAppContext } from '@/hooks'

export function ConnectButtonWeb3({ autoConnect = false }: { autoConnect?: boolean }) {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { signMessageAsync } = useSignMessage()
  const miniApp = useMiniAppContext()
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const [authAddress, setAuthAddress] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const hasAutoConnected = useRef<string | null>(null)

  const miniAppConnector = connectors.find((c) => {
    const id = String(c.id ?? '').toLowerCase()
    const name = String((c as any)?.name ?? '').toLowerCase()
    return id.includes('miniapp') || name.includes('farcaster') || name.includes('mini app')
  })
  const coinbaseConnector = connectors.find((c) => c.id === 'coinbaseWalletSDK' || c.name?.toLowerCase().includes('coinbase'))
  const injectedConnector = connectors.find((c) => c.id === 'injected')

  // In the Base app / Farcaster Mini App, prefer the mini app connector (no wallet-brand UX).
  // On the open web, prefer Coinbase Wallet when available.
  const preferredConnector = (miniApp.isMiniApp ? miniAppConnector : null) ?? coinbaseConnector ?? connectors[0]

  // Best-effort: preserve a single "Connect Wallet" click when Web3 is lazily enabled.
  useEffect(() => {
    if (!autoConnect) return
    if (isConnected) return
    if (!preferredConnector) return

    // Re-attempt if the preferred connector changes (e.g. once Mini App detection resolves).
    if (hasAutoConnected.current === preferredConnector.id) return
    hasAutoConnected.current = preferredConnector.id
    connect({ connector: preferredConnector })
  }, [autoConnect, connect, isConnected, preferredConnector])

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
        const res = await fetch('/api/auth/me', { headers: { Accept: 'application/json' } })
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

  async function signIn() {
    if (!address) return
    setAuthBusy(true)
    setAuthError(null)
    try {
      const nonceRes = await fetch('/api/auth/nonce', { headers: { Accept: 'application/json' } })
      const nonceJson = (await nonceRes.json().catch(() => null)) as
        | { success?: boolean; data?: { nonce?: string; issuedAt?: string; domain?: string; uri?: string; chainId?: number } }
        | null
      const data = nonceJson?.data
      const nonce = typeof data?.nonce === 'string' ? data.nonce : ''
      const issuedAt = typeof data?.issuedAt === 'string' ? data.issuedAt : new Date().toISOString()
      const domain = typeof data?.domain === 'string' ? data.domain : window.location.host
      const uri = typeof data?.uri === 'string' ? data.uri : window.location.origin
      const chainId = typeof data?.chainId === 'number' ? data.chainId : base.id

      if (!nonce) throw new Error('Failed to start sign-in')

      const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to Creator Vaults.\n\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`

      const signature = await signMessageAsync({ message })

      const verifyRes = await fetch('/api/auth/verify', {
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
      setAuthError(msg)
    } finally {
      setAuthBusy(false)
    }
  }

  async function signOut() {
    setAuthBusy(true)
    setAuthError(null)
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: { Accept: 'application/json' } })
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
                  title="Proves you control this wallet (no transaction)"
                >
                  <span className="label block mb-1">{isSignedIn ? 'Signed in' : 'Sign in'}</span>
                  <span className="text-xs text-zinc-600">{isSignedIn ? 'Verified for this session' : 'No transaction'}</span>
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

  return (
    <div className="relative">
    <button
        onClick={() => setShowMenu(!showMenu)}
      disabled={isPending}
        className="btn-accent disabled:opacity-50 flex items-center gap-2"
    >
        <Wallet className="w-4 h-4" />
      <span className="label">{isPending ? 'Connecting...' : 'Connect Wallet'}</span>
        {coinbaseConnector || injectedConnector ? <ChevronDown className="w-3 h-3 text-zinc-600" /> : null}
      </button>

      <AnimatePresence>
        {showMenu && !isPending && (
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
              className="absolute right-0 top-full mt-4 w-64 card p-3 z-50 space-y-2"
            >
              {coinbaseConnector ? (
                <button
                  onClick={() => {
                    connect({ connector: coinbaseConnector })
                    setShowMenu(false)
                  }}
                  className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors"
                >
                  <span className="label block mb-1">Coinbase Wallet</span>
                  <span className="text-xs text-zinc-600">Coinbase wallet app / extension</span>
                </button>
              ) : null}

              {injectedConnector ? (
                <button
                  onClick={() => {
                    connect({ connector: injectedConnector })
                    setShowMenu(false)
                  }}
                  className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors"
                >
                  <span className="label block mb-1">Browser Wallet</span>
                  <span className="text-xs text-zinc-600">MetaMask / Rabby / Brave</span>
                </button>
              ) : null}

              {!coinbaseConnector && !injectedConnector ? (
                <button
                  onClick={() => {
                    if (preferredConnector) connect({ connector: preferredConnector })
                    setShowMenu(false)
                  }}
                  className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors"
                >
                  <span className="label block">Connect</span>
    </button>
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}


