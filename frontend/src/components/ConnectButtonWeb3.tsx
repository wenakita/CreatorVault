import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useMemo, useState } from 'react'
import { Wallet, ChevronDown } from 'lucide-react'
import { useSiweAuth } from '@/hooks/useSiweAuth'

/**
 * Simple Connect Button
 * 
 * Shows available connectors and handles connection.
 */
export function ConnectButtonWeb3() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const auth = useSiweAuth()
  const [showMenu, setShowMenu] = useState(false)
  const [showOptions, setShowOptions] = useState(false)

  const hasMultipleInjectedProviders =
    typeof window !== 'undefined' &&
    Array.isArray((window as any)?.ethereum?.providers) &&
    ((window as any).ethereum.providers as any[]).length > 1

  const filteredConnectors = useMemo(() => {
    if (!hasMultipleInjectedProviders) return connectors
    return connectors.filter((connector) => {
      const id = String((connector as any)?.id ?? '').toLowerCase()
      return !id.includes('injected')
    })
  }, [connectors, hasMultipleInjectedProviders])

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  // Connected - show address with disconnect option
  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="btn-primary flex items-center gap-3"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span className="mono text-sm">{formatAddress(address)}</span>
          <ChevronDown className={`w-3 h-3 text-zinc-600 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-full mt-4 w-56 card p-4 z-50 space-y-2">
              <a
                href={`https://basescan.org/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 px-4 hover:bg-zinc-950 transition-colors"
              >
                <span className="label block">View on Basescan</span>
              </a>
              <div className="h-px bg-zinc-900 my-2" />
              {!auth.isSignedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    void auth.signIn()
                    setShowMenu(false)
                  }}
                  disabled={auth.busy}
                  className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors disabled:opacity-60"
                >
                  <span className="label block">{auth.busy ? 'Signing in…' : 'Sign in'}</span>
                  <span className="text-[11px] text-zinc-600 block mt-1">No transaction.</span>
                </button>
              ) : (
                <div className="px-4 py-3">
                  <div className="label text-emerald-200">Signed in</div>
                  <div className="text-[11px] text-zinc-600 mt-1">Session matches connected wallet.</div>
                </div>
              )}
              {auth.isSignedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    void auth.signOut()
                    setShowMenu(false)
                  }}
                  disabled={auth.busy}
                  className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors disabled:opacity-60"
                >
                  <span className="label block text-zinc-300">{auth.busy ? 'Signing out…' : 'Sign out'}</span>
                </button>
              ) : null}
              {auth.error ? <div className="px-4 text-[11px] text-red-400/90">{auth.error}</div> : null}
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
            </div>
          </>
        )}
      </div>
    )
  }

  // Disconnected - show connect options
  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setShowOptions(!showOptions)}
        className="btn-accent disabled:opacity-50 flex items-center gap-2"
      >
        <Wallet className="w-4 h-4" />
        <span className="label">{isPending ? 'Connecting…' : 'Connect'}</span>
      </button>

      {showOptions && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowOptions(false)}
          />
          <div className="absolute right-0 top-full mt-3 w-64 card p-3 z-50 space-y-1">
            {hasMultipleInjectedProviders ? (
              <div className="px-4 py-2 text-[11px] text-zinc-500">
                Multiple wallet extensions detected. Use Coinbase Wallet or WalletConnect.
              </div>
            ) : null}
            {filteredConnectors.map((connector) => (
              <button
                key={connector.uid}
                type="button"
                disabled={isPending}
                className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors disabled:opacity-50"
                onClick={() => {
                  connect({ connector })
                  setShowOptions(false)
                }}
              >
                <span className="label block">{connector.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
