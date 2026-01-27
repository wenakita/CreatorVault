import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useState } from 'react'
import { Wallet, ChevronDown } from 'lucide-react'

/**
 * Simple Connect Button
 * 
 * Shows available connectors and handles connection.
 */
export function ConnectButtonWeb3() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [showMenu, setShowMenu] = useState(false)
  const [showOptions, setShowOptions] = useState(false)

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
            {connectors.map((connector) => (
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
