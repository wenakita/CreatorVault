import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ChevronDown, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { base } from 'wagmi/chains'

export function ConnectButton() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // Check if on wrong network
  const isWrongNetwork = isConnected && chain?.id !== base.id
  
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

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`

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
                  onClick={copyAddress}
                  className="w-full text-left py-3 px-4 hover:bg-zinc-950 transition-colors"
                >
                  <span className="label block mb-1">
                    {copied ? 'Copied!' : 'Copy Address'}
                  </span>
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
    <button
      onClick={() => connect({ connector: connectors[0] })}
      disabled={isPending}
      className="btn-accent disabled:opacity-50"
    >
      <Wallet className="w-4 h-4 inline mr-2" />
      <span className="label">{isPending ? 'Connecting...' : 'Connect Wallet'}</span>
    </button>
  )
}
