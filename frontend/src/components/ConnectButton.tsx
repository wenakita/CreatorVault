import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink, Check, AlertCircle } from 'lucide-react'
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
        <motion.button
          onClick={() => switchChain?.({ chainId: base.id })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 transition-colors"
          whileTap={{ scale: 0.98 }}
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <AlertCircle className="w-5 h-5 text-orange-400" />
          <span className="font-semibold text-orange-400">Switch to Base</span>
        </motion.button>
      )
    }
    
    return (
      <div className="relative">
        <motion.button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-900 border border-surface-700 hover:border-surface-600 transition-colors"
          whileTap={{ scale: 0.98 }}
        >
          <div className="w-6 h-6 rounded-full bg-brand-500" />
          <span className="font-mono text-sm">{formatAddress(address)}</span>
          <ChevronDown
            className={`w-4 h-4 text-surface-400 transition-transform ${
              showMenu ? 'rotate-180' : ''
            }`}
          />
        </motion.button>

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
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-56 glass-card p-2 z-50"
              >
                <button
                  onClick={copyAddress}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-800/50 text-surface-300 hover:text-white transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">
                    {copied ? 'Copied!' : 'Copy Address'}
                  </span>
                </button>
                <a
                  href={`https://basescan.org/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-800/50 text-surface-300 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="text-sm font-medium">View on Basescan</span>
                </a>
                <div className="my-1 border-t border-surface-800" />
                <button
                  onClick={() => {
                    disconnect()
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-medium">Disconnect</span>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <motion.button
      onClick={() => connect({ connector: connectors[0] })}
      disabled={isPending}
      className="btn-primary flex items-center gap-2"
      whileTap={{ scale: 0.98 }}
    >
      <Wallet className="w-4 h-4" />
      <span>{isPending ? 'Connecting...' : 'Connect'}</span>
    </motion.button>
  )
}
