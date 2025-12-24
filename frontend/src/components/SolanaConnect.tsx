import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ExternalLink, ArrowLeftRight, Loader2, CheckCircle2 } from 'lucide-react'

/**
 * SolanaConnect - Solana wallet connection for Base-Solana bridge
 * 
 * Enables Solana users to:
 * - Connect Phantom/Solflare wallet
 * - See their Twin contract address on Base
 * - Bridge SOL to participate in CCA & Lottery
 */

// Base motion curve
const baseEase = [0.4, 0, 0.2, 1] as const

interface SolanaConnectProps {
  onConnect?: (publicKey: string) => void
  className?: string
}

export function SolanaConnect({ onConnect, className = '' }: SolanaConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const connectWallet = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      // Check if Phantom is installed
      const phantom = (window as any).phantom?.solana
      
      if (!phantom) {
        setError('Please install Phantom wallet')
        window.open('https://phantom.app/', '_blank')
        return
      }

      const response = await phantom.connect()
      const pubKey = response.publicKey.toString()
      
      setPublicKey(pubKey)
      onConnect?.(pubKey)
    } catch (err: any) {
      setError(err.message || 'Failed to connect')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = async () => {
    try {
      const phantom = (window as any).phantom?.solana
      if (phantom) {
        await phantom.disconnect()
        setPublicKey(null)
      }
    } catch (err) {
      console.error('Disconnect error:', err)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  if (publicKey) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: baseEase }}
        className={`flex items-center gap-3 ${className}`}
      >
        {/* Solana badge */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-sm font-mono text-purple-400">{formatAddress(publicKey)}</span>
        </div>
        
        <button
          onClick={disconnectWallet}
          className="text-xs text-surface-500 hover:text-white transition-colors"
        >
          Disconnect
        </button>
      </motion.div>
    )
  }

  return (
    <motion.button
      onClick={connectWallet}
      disabled={isConnecting}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.12, ease: baseEase }}
    >
      {isConnecting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <img 
            src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" 
            alt="Solana" 
            className="w-4 h-4"
          />
          Connect Solana
        </>
      )}
    </motion.button>
  )
}

/**
 * SolanaBridgeCard - UI for bridging from Solana to Base
 */
interface SolanaBridgeCardProps {
  publicKey: string | null
  onBridge?: (amount: string, action: 'cca' | 'lottery' | 'deposit') => void
}

export function SolanaBridgeCard({ publicKey, onBridge }: SolanaBridgeCardProps) {
  const [amount, setAmount] = useState('')
  const [action, setAction] = useState<'cca' | 'lottery' | 'deposit'>('lottery')
  const [isBridging, setIsBridging] = useState(false)

  const handleBridge = async () => {
    if (!publicKey || !amount) return
    setIsBridging(true)
    
    try {
      onBridge?.(amount, action)
    } finally {
      setIsBridging(false)
    }
  }

  if (!publicKey) {
    return (
      <div className="glass-card p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto">
          <Wallet className="w-6 h-6 text-purple-500" />
        </div>
        <h3 className="font-semibold">Bridge from Solana</h3>
        <p className="text-surface-400 text-sm">
          Connect your Solana wallet to bridge SOL and participate in CCA auctions & lottery.
        </p>
        <SolanaConnect />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: baseEase }}
      className="glass-card p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-purple-500" />
          Bridge from Solana
        </h3>
        <a
          href="https://docs.base.org/guides/base-solana-bridge"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-surface-500 hover:text-brand-400 flex items-center gap-1"
        >
          Docs <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Amount input */}
      <div className="space-y-2">
        <label className="text-sm text-surface-400">Amount (SOL)</label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className="input-field text-lg font-semibold"
        />
      </div>

      {/* Action selector */}
      <div className="space-y-2">
        <label className="text-sm text-surface-400">Action on Base</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'lottery', label: '🎰 Lottery', desc: 'Buy wsToken' },
            { id: 'cca', label: '🏷️ CCA Bid', desc: 'Fair launch' },
            { id: 'deposit', label: '🏦 Deposit', desc: 'Into vault' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setAction(opt.id as typeof action)}
              className={`p-3 rounded-xl border text-center transition-all duration-200 ${
                action === opt.id
                  ? 'bg-brand-500/10 border-brand-500/50 text-white'
                  : 'bg-surface-900/50 border-surface-800 text-surface-400 hover:border-surface-700'
              }`}
            >
              <span className="text-lg">{opt.label.split(' ')[0]}</span>
              <p className="text-xs mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Info box */}
      <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 text-sm">
        <p className="text-purple-300">
          {action === 'lottery' && 'Bridge SOL → Swap for wsToken → Enter lottery automatically!'}
          {action === 'cca' && 'Bridge SOL → Submit bid to CCA auction for fair token distribution'}
          {action === 'deposit' && 'Bridge SOL → Swap for Creator Coin → Deposit into vault'}
        </p>
      </div>

      {/* Bridge button */}
      <button
        onClick={handleBridge}
        disabled={!amount || isBridging}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {isBridging ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Bridging...
          </>
        ) : (
          <>
            <ArrowLeftRight className="w-4 h-4" />
            Bridge & {action === 'lottery' ? 'Enter Lottery' : action === 'cca' ? 'Submit Bid' : 'Deposit'}
          </>
        )}
      </button>

      {/* Flow explainer */}
      <div className="flex items-center justify-center gap-2 text-xs text-surface-500">
        <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400">Solana</span>
        <span>→</span>
        <span className="px-2 py-1 rounded bg-brand-500/10 text-brand-400">Base</span>
        <span>→</span>
        <span className="px-2 py-1 rounded bg-green-500/10 text-green-400">
          {action === 'lottery' ? 'Jackpot' : action === 'cca' ? 'CCA' : 'Vault'}
        </span>
      </div>
    </motion.div>
  )
}

/**
 * TwinAddressDisplay - Shows the deterministic Twin contract address
 */
export function TwinAddressDisplay({ solanaAddress }: { solanaAddress: string }) {
  // In production, this would fetch the actual Twin address from the bridge
  const twinAddress = '0x...' // Computed from Solana address
  
  return (
    <div className="p-3 rounded-lg bg-surface-900/50 border border-surface-800">
      <p className="text-xs text-surface-500 mb-1">Your Twin Contract on Base</p>
      <p className="font-mono text-sm text-surface-300 break-all">{twinAddress}</p>
      <p className="text-xs text-surface-600 mt-2">
        This address executes your Base transactions from Solana
      </p>
    </div>
  )
}


import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ExternalLink, ArrowLeftRight, Loader2, CheckCircle2 } from 'lucide-react'

/**
 * SolanaConnect - Solana wallet connection for Base-Solana bridge
 * 
 * Enables Solana users to:
 * - Connect Phantom/Solflare wallet
 * - See their Twin contract address on Base
 * - Bridge SOL to participate in CCA & Lottery
 */

// Base motion curve
const baseEase = [0.4, 0, 0.2, 1] as const

interface SolanaConnectProps {
  onConnect?: (publicKey: string) => void
  className?: string
}

export function SolanaConnect({ onConnect, className = '' }: SolanaConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const connectWallet = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      // Check if Phantom is installed
      const phantom = (window as any).phantom?.solana
      
      if (!phantom) {
        setError('Please install Phantom wallet')
        window.open('https://phantom.app/', '_blank')
        return
      }

      const response = await phantom.connect()
      const pubKey = response.publicKey.toString()
      
      setPublicKey(pubKey)
      onConnect?.(pubKey)
    } catch (err: any) {
      setError(err.message || 'Failed to connect')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = async () => {
    try {
      const phantom = (window as any).phantom?.solana
      if (phantom) {
        await phantom.disconnect()
        setPublicKey(null)
      }
    } catch (err) {
      console.error('Disconnect error:', err)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  if (publicKey) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: baseEase }}
        className={`flex items-center gap-3 ${className}`}
      >
        {/* Solana badge */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-sm font-mono text-purple-400">{formatAddress(publicKey)}</span>
        </div>
        
        <button
          onClick={disconnectWallet}
          className="text-xs text-surface-500 hover:text-white transition-colors"
        >
          Disconnect
        </button>
      </motion.div>
    )
  }

  return (
    <motion.button
      onClick={connectWallet}
      disabled={isConnecting}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.12, ease: baseEase }}
    >
      {isConnecting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <img 
            src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" 
            alt="Solana" 
            className="w-4 h-4"
          />
          Connect Solana
        </>
      )}
    </motion.button>
  )
}

/**
 * SolanaBridgeCard - UI for bridging from Solana to Base
 */
interface SolanaBridgeCardProps {
  publicKey: string | null
  onBridge?: (amount: string, action: 'cca' | 'lottery' | 'deposit') => void
}

export function SolanaBridgeCard({ publicKey, onBridge }: SolanaBridgeCardProps) {
  const [amount, setAmount] = useState('')
  const [action, setAction] = useState<'cca' | 'lottery' | 'deposit'>('lottery')
  const [isBridging, setIsBridging] = useState(false)

  const handleBridge = async () => {
    if (!publicKey || !amount) return
    setIsBridging(true)
    
    try {
      onBridge?.(amount, action)
    } finally {
      setIsBridging(false)
    }
  }

  if (!publicKey) {
    return (
      <div className="glass-card p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto">
          <Wallet className="w-6 h-6 text-purple-500" />
        </div>
        <h3 className="font-semibold">Bridge from Solana</h3>
        <p className="text-surface-400 text-sm">
          Connect your Solana wallet to bridge SOL and participate in CCA auctions & lottery.
        </p>
        <SolanaConnect />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: baseEase }}
      className="glass-card p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-purple-500" />
          Bridge from Solana
        </h3>
        <a
          href="https://docs.base.org/guides/base-solana-bridge"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-surface-500 hover:text-brand-400 flex items-center gap-1"
        >
          Docs <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Amount input */}
      <div className="space-y-2">
        <label className="text-sm text-surface-400">Amount (SOL)</label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className="input-field text-lg font-semibold"
        />
      </div>

      {/* Action selector */}
      <div className="space-y-2">
        <label className="text-sm text-surface-400">Action on Base</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'lottery', label: '🎰 Lottery', desc: 'Buy wsToken' },
            { id: 'cca', label: '🏷️ CCA Bid', desc: 'Fair launch' },
            { id: 'deposit', label: '🏦 Deposit', desc: 'Into vault' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setAction(opt.id as typeof action)}
              className={`p-3 rounded-xl border text-center transition-all duration-200 ${
                action === opt.id
                  ? 'bg-brand-500/10 border-brand-500/50 text-white'
                  : 'bg-surface-900/50 border-surface-800 text-surface-400 hover:border-surface-700'
              }`}
            >
              <span className="text-lg">{opt.label.split(' ')[0]}</span>
              <p className="text-xs mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Info box */}
      <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 text-sm">
        <p className="text-purple-300">
          {action === 'lottery' && 'Bridge SOL → Swap for wsToken → Enter lottery automatically!'}
          {action === 'cca' && 'Bridge SOL → Submit bid to CCA auction for fair token distribution'}
          {action === 'deposit' && 'Bridge SOL → Swap for Creator Coin → Deposit into vault'}
        </p>
      </div>

      {/* Bridge button */}
      <button
        onClick={handleBridge}
        disabled={!amount || isBridging}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {isBridging ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Bridging...
          </>
        ) : (
          <>
            <ArrowLeftRight className="w-4 h-4" />
            Bridge & {action === 'lottery' ? 'Enter Lottery' : action === 'cca' ? 'Submit Bid' : 'Deposit'}
          </>
        )}
      </button>

      {/* Flow explainer */}
      <div className="flex items-center justify-center gap-2 text-xs text-surface-500">
        <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400">Solana</span>
        <span>→</span>
        <span className="px-2 py-1 rounded bg-brand-500/10 text-brand-400">Base</span>
        <span>→</span>
        <span className="px-2 py-1 rounded bg-green-500/10 text-green-400">
          {action === 'lottery' ? 'Jackpot' : action === 'cca' ? 'CCA' : 'Vault'}
        </span>
      </div>
    </motion.div>
  )
}

/**
 * TwinAddressDisplay - Shows the deterministic Twin contract address
 */
export function TwinAddressDisplay({ solanaAddress }: { solanaAddress: string }) {
  // In production, this would fetch the actual Twin address from the bridge
  const twinAddress = '0x...' // Computed from Solana address
  
  return (
    <div className="p-3 rounded-lg bg-surface-900/50 border border-surface-800">
      <p className="text-xs text-surface-500 mb-1">Your Twin Contract on Base</p>
      <p className="font-mono text-sm text-surface-300 break-all">{twinAddress}</p>
      <p className="text-xs text-surface-600 mt-2">
        This address executes your Base transactions from Solana
      </p>
    </div>
  )
}

