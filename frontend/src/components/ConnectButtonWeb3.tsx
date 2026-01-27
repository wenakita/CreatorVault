import { type Connector, useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ChevronDown, AlertCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { base } from 'wagmi/chains'
import { useMiniAppContext } from '@/hooks'
import { logger } from '@/lib/logger'
import { useSiweAuth } from '@/hooks/useSiweAuth'

/**
 * Simplified Connect Button
 *
 * Primary wallet paths:
 * 1. Coinbase Smart Wallet - passkeys, cross-device, gas sponsorship
 * 2. Farcaster Mini App - when running inside Farcaster/Base app
 * 3. WalletConnect - universal fallback for any wallet
 */

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

function ConnectButtonWeb3Wagmi({
  autoConnect = false,
  variant = 'default',
}: {
  autoConnect?: boolean
  variant?: ConnectButtonVariant
}) {
  const { address, isConnected, chain } = useAccount()
  const { connectAsync, connectors, isPending, reset } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const miniApp = useMiniAppContext()
  const siwe = useSiweAuth()
  const [showMenu, setShowMenu] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [copied, setCopied] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const hasAutoConnected = useRef<string | null>(null)

  // Find connectors
  const miniAppConnector = connectors.find((c) => {
    const id = String(c.id ?? '').toLowerCase()
    const name = String((c as any)?.name ?? '').toLowerCase()
    return id.includes('miniapp') || name.includes('farcaster') || name.includes('mini app')
  })
  const walletConnectConnector = connectors.find(
    (c) => String(c.id) === 'walletConnect' || String(c.name ?? '').toLowerCase().includes('walletconnect'),
  )
  const coinbaseSmartWalletConnector = connectors.find((c) => {
    const id = String(c.id ?? '').toLowerCase()
    const name = String(c.name ?? '').toLowerCase()
    return id === 'coinbasesmartwallet' || name.includes('coinbase') || name.includes('smart wallet')
  })

  // Determine preferred connector based on context
  const preferredConnector = miniApp.isMiniApp
    ? miniAppConnector ?? coinbaseSmartWalletConnector ?? walletConnectConnector
    : coinbaseSmartWalletConnector ?? walletConnectConnector ?? connectors[0]

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
        setConnectError(opts?.label ? `Unable to connect (${opts.label})` : 'Unable to connect')
      }
    },
    [connectAsync, reset],
  )

  const connectBestEffort = useCallback(async () => {
    if (!preferredConnector) return
    setConnectError(null)

    // Order: Mini App (if in mini app) → Coinbase Smart Wallet → WalletConnect
    const ordered = [
      miniApp.isMiniApp ? miniAppConnector : null,
      coinbaseSmartWalletConnector,
      walletConnectConnector,
      preferredConnector,
    ].filter((c): c is Connector => c !== null && c !== undefined)

    // Dedupe
    const seen = new Set<string>()
    const deduped = ordered.filter((c) => {
      const id = String(c.id ?? '')
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })

    for (const c of deduped) {
      try {
        const id = String(c.id ?? '')
        const timeoutMs = id.toLowerCase().includes('walletconnect') ? 90_000 : 30_000

        await withTimeout(connectAsync({ connector: c }), timeoutMs)
        return
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        const name = typeof (e as any)?.name === 'string' ? String((e as any).name) : ''
        logger.warn('[ConnectButtonWeb3] connect failed', { connector: { id: c.id, name: c.name }, name, msg })
        reset()

        if (name.toLowerCase().includes('userrejected') || msg.toLowerCase().includes('user rejected')) {
          setConnectError('Connection rejected')
          return
        }

        // Try next connector
        continue
      }
    }

    setConnectError('Unable to connect with available wallets')
  }, [connectAsync, coinbaseSmartWalletConnector, miniApp.isMiniApp, miniAppConnector, preferredConnector, reset, walletConnectConnector])

  // Auto-connect when enabled
  useEffect(() => {
    if (!autoConnect) return
    if (isConnected) return
    if (!preferredConnector) return

    const key = `${String(preferredConnector.id)}:${miniApp.isMiniApp === true ? 'mini' : 'web'}`
    if (hasAutoConnected.current === key) return
    hasAutoConnected.current = key
    void connectBestEffort()
  }, [autoConnect, connectBestEffort, isConnected, miniApp.isMiniApp, preferredConnector])

  // Check if on wrong network
  const isWrongNetwork = isConnected && chain?.id !== base.id
  const isSignedIn = siwe.isSignedIn

  // Auto-switch to Base if on wrong network
  useEffect(() => {
    if (isWrongNetwork && switchChain) {
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

  // Connected state - show address menu
  if (isConnected && address) {
    if (isWrongNetwork) {
      return (
        <button onClick={() => switchChain?.({ chainId: base.id })} className="btn-accent flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span className="label">Switch to Base</span>
        </button>
      )
    }

    return (
      <div className="relative">
        <button onClick={() => setShowMenu(!showMenu)} className="btn-primary flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span className="mono text-sm">{formatAddress(address)}</span>
          <ChevronDown className={`w-3 h-3 text-zinc-600 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
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
                    if (siwe.busy) return
                    if (isSignedIn) void siwe.signOut()
                    else void siwe.signIn()
                    setShowMenu(false)
                  }}
                  className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors disabled:opacity-50"
                  disabled={siwe.busy}
                  title="Proves you control this wallet (no transaction)"
                >
                  <span className="label block mb-1">{isSignedIn ? 'Signed in' : 'Sign in'}</span>
                  <span className="text-xs text-zinc-600">{isSignedIn ? 'Verified for this session' : 'No transaction'}</span>
                </button>
                {siwe.error ? <div className="px-4 text-[11px] text-red-400/90">{siwe.error}</div> : null}
                <button onClick={copyAddress} className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors">
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

  // Disconnected state - show connect button
  const isDeployLike = variant === 'deploy' || variant === 'gate'
  const primaryLabel = isDeployLike ? 'Continue' : 'Connect Wallet'

  return (
    <div className={`flex flex-col gap-2 ${isDeployLike ? 'items-stretch' : 'items-end'}`}>
      <button
        type="button"
        disabled={isPending}
        onClick={() => void connectBestEffort()}
        className="btn-accent disabled:opacity-50 flex items-center gap-2"
        title={preferredConnector ? `Connect with ${preferredConnector.name}` : 'Connect wallet'}
      >
        <Wallet className="w-4 h-4" />
        <span className="label">{isPending ? 'Connecting…' : primaryLabel}</span>
      </button>

      {/* More options dropdown for deploy flows */}
      {!miniApp.isMiniApp && isDeployLike && (
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
            {showOptions && (
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
                  {coinbaseSmartWalletConnector && (
                    <button
                      type="button"
                      disabled={isPending}
                      className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors disabled:opacity-50"
                      onClick={() => void connectDirect(coinbaseSmartWalletConnector, { timeoutMs: 60_000, label: 'Coinbase Smart Wallet' })}
                    >
                      <span className="label block mb-1">Coinbase Smart Wallet</span>
                      <span className="text-xs text-zinc-600">Passkeys, cross-device, gas sponsorship.</span>
                    </button>
                  )}
                  {walletConnectConnector && (
                    <button
                      type="button"
                      disabled={isPending}
                      className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors disabled:opacity-50"
                      onClick={() => void connectDirect(walletConnectConnector, { timeoutMs: 90_000, label: 'WalletConnect' })}
                    >
                      <span className="label block mb-1">WalletConnect</span>
                      <span className="text-xs text-zinc-600">Connect any wallet via QR code.</span>
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}

      {connectError && <div className="text-[10px] text-zinc-500">{connectError}</div>}
    </div>
  )
}

export function ConnectButtonWeb3({ autoConnect = false, variant = 'default' }: { autoConnect?: boolean; variant?: ConnectButtonVariant }) {
  return <ConnectButtonWeb3Wagmi autoConnect={autoConnect} variant={variant} />
}
