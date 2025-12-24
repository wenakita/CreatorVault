import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther, formatUnits } from 'viem'
import {
  Clock,
  ArrowLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
  TrendingUp,
  Zap,
  Target,
} from 'lucide-react'
import { AKITA } from '../config/contracts'
import { ConnectButton } from '../components/ConnectButton'
import { VaultLogo } from '../components/VaultLogo'

// CCA Strategy ABI
const CCA_STRATEGY_ABI = [
  {
    name: 'bid',
    type: 'function',
    inputs: [
      { name: 'ethAmount', type: 'uint256' },
      { name: 'tokenAmount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'getAuctionStatus',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'auction', type: 'address' },
      { name: 'isActive', type: 'bool' },
      { name: 'isGraduated', type: 'bool' },
      { name: 'clearingPrice', type: 'uint256' },
      { name: 'currencyRaised', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'endTime',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'tokenTarget',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

export function AuctionBid() {
  const { isConnected } = useAccount()
  const [ethAmount, setEthAmount] = useState('')
  const [tokenAmount, setTokenAmount] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  // For now, hardcode to AKITA
  const ccaStrategy = AKITA.ccaStrategy

  // Read auction data
  const { data: auctionStatus } = useReadContract({
    address: ccaStrategy as `0x${string}`,
    abi: CCA_STRATEGY_ABI,
    functionName: 'getAuctionStatus',
  })

  const { data: endTime } = useReadContract({
    address: ccaStrategy as `0x${string}`,
    abi: CCA_STRATEGY_ABI,
    functionName: 'endTime',
  })

  const { data: tokenTarget } = useReadContract({
    address: ccaStrategy as `0x${string}`,
    abi: CCA_STRATEGY_ABI,
    functionName: 'tokenTarget',
  })

  // Submit bid
  const { writeContract: submitBid, data: bidTxHash, isPending: isBidding } = useWriteContract()
  const { isLoading: isBidConfirming, isSuccess: isBidSuccess } = useWaitForTransactionReceipt({
    hash: bidTxHash,
  })

  const isActive = auctionStatus?.[1] || false
  const isGraduated = auctionStatus?.[2] || false
  const clearingPrice = auctionStatus?.[3] || 0n
  const currencyRaised = auctionStatus?.[4] || 0n

  // Calculate time remaining
  const now = Math.floor(Date.now() / 1000)
  const timeRemaining = endTime ? Number(endTime) - now : 0
  const daysRemaining = Math.floor(timeRemaining / 86400)
  const hoursRemaining = Math.floor((timeRemaining % 86400) / 3600)

  const auctionNotStarted = !isActive && !isGraduated && currencyRaised === 0n

  const handleSubmitBid = () => {
    if (!ethAmount || !tokenAmount) return
    
    submitBid({
      address: ccaStrategy as `0x${string}`,
      abi: CCA_STRATEGY_ABI,
      functionName: 'bid',
      args: [parseEther(ethAmount), parseEther(tokenAmount)],
      value: parseEther(ethAmount),
    })
  }

  const handlePresetClick = (preset: { eth: string; tokens: string; label: string }) => {
    setEthAmount(preset.eth)
    setTokenAmount(preset.tokens)
    setSelectedPreset(preset.label)
  }

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Force refetch would go here
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <AlertCircle className="w-16 h-16 text-slate-500 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold mb-2">Connect Wallet to Bid</h2>
            <p className="text-slate-400 mb-6">
              You need to connect your wallet to participate in the auction
            </p>
            <ConnectButton />
          </div>
        </motion.div>
      </div>
    )
  }

  // Auction ended
  if (isGraduated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold mb-2">Auction Ended</h2>
            <p className="text-slate-400 mb-6">
              This auction has graduated and tokens are being distributed
            </p>
            <Link to={`/complete-auction/${ccaStrategy}`}>
              <button className="btn-primary">
                Complete Auction →
              </button>
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  // Auction not started
  if (auctionNotStarted) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <Clock className="w-16 h-16 text-slate-500 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold mb-2">Auction Not Active</h2>
            <p className="text-slate-400 mb-6">
              This auction hasn't started yet. Creators can launch it.
            </p>
            <Link to="/activate-akita">
              <button className="btn-secondary">
                Launch Auction
              </button>
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  // Active auction - Main UI
  return (
    <div className="space-y-6 py-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link to="/dashboard">
          <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mb-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            ACTIVE_AUCTION
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight">
            CCA Price Discovery
          </h1>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Price Discovery & Stats */}
        <div className="lg:col-span-2 space-y-6">
          {/* Price Discovery Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 space-y-6"
          >
            {/* Current Metrics */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-mono text-slate-500 mb-2">CLEARING_PRICE</div>
                <div className="text-4xl font-light font-mono text-white">
                  {formatEther(clearingPrice)} ETH
                </div>
                <div className="text-xs text-slate-400 mt-1">per 1K AKITA</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-slate-500 mb-2">CURRENCY_RAISED</div>
                <div className="text-4xl font-light font-mono text-brand-400">
                  {formatEther(currencyRaised)}
                </div>
                <div className="text-xs text-slate-400 mt-1">ETH committed</div>
              </div>
            </div>

            {/* Price Discovery Visualization */}
            <div className="relative h-48 bg-white/[0.02] rounded-xl p-4 overflow-hidden border border-white/5">
              <div className="absolute inset-0 bg-gradient-to-t from-brand-500/10 to-transparent pointer-events-none" />
              
              {/* Fake price bars - would be real bid data */}
              <div className="absolute bottom-0 left-0 right-0 h-full flex items-end justify-around gap-1 px-4 pb-4">
                {[30, 35, 42, 55, 68, 85, 70, 50, 40, 30, 25, 20].map((height, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: i * 0.05, duration: 0.5 }}
                    className={`flex-1 rounded-sm ${
                      i === 5
                        ? 'bg-brand-500 shadow-lg shadow-brand-500/50'
                        : i > 5
                        ? 'bg-white/5 hover:bg-white/10'
                        : 'bg-white/10 hover:bg-white/15'
                    } transition-all cursor-pointer`}
                  />
                ))}
              </div>

              {/* Clearing price line */}
              <div className="absolute left-0 right-0 border-t border-brand-400/50 border-dashed"
                style={{ bottom: '85%' }}
              />
              
              <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
            </div>

            {/* Live Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-mono text-slate-500">SUPPLY</span>
                </div>
                <div className="text-xl font-mono">
                  {tokenTarget ? (Number(formatUnits(tokenTarget, 18)) / 1000000).toFixed(1) : '0'}M
                </div>
                <div className="text-xs text-slate-500">AKITA</div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-mono text-slate-500">TIME_LEFT</span>
                </div>
                <div className="text-xl font-mono text-orange-400">
                  {daysRemaining}d {hoursRemaining}h
                </div>
                <div className="text-xs text-slate-500">until close</div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-mono text-slate-500">PROGRESS</span>
                </div>
                <div className="text-xl font-mono text-green-400">
                  {((Number(formatEther(currencyRaised)) / 100) * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500">of target</div>
              </div>
            </div>

            {/* Info Banner */}
            <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-brand-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-sm">
                  <p className="text-brand-300 font-semibold mb-1">Fair Price Discovery</p>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Everyone pays the same clearing price. Higher bids increase your allocation.
                    Unbought tokens refund automatically.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right: Bidding Interface */}
        <div className="space-y-6">
          {/* Bid Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6 space-y-6 border-l-2 border-brand-500/30"
          >
            <div>
              <h3 className="text-xs font-mono text-slate-500 mb-4 uppercase tracking-wider">
                Submit Bid
              </h3>

              {/* Preset Amounts */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                {[
                  { label: '0.1', eth: '0.1', tokens: '200000' },
                  { label: '0.5', eth: '0.5', tokens: '1000000' },
                  { label: '1.0', eth: '1.0', tokens: '2000000' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetClick(preset)}
                    className={`p-3 rounded-lg text-sm font-mono transition-all ${
                      selectedPreset === preset.label
                        ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    {preset.label} ETH
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-mono text-slate-500 mb-2 block">
                    ETH_AMOUNT
                  </label>
                  <input
                    type="text"
                    value={ethAmount}
                    onChange={(e) => {
                      setEthAmount(e.target.value)
                      setSelectedPreset(null)
                    }}
                    placeholder="0.0"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 font-mono text-lg focus:border-brand-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-500 mb-2 block">
                    TOKEN_AMOUNT
                  </label>
                  <input
                    type="text"
                    value={tokenAmount}
                    onChange={(e) => {
                      setTokenAmount(e.target.value)
                      setSelectedPreset(null)
                    }}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 font-mono text-lg focus:border-brand-500 focus:outline-none transition-colors"
                  />
                  <div className="text-xs text-slate-500 mt-1">AKITA tokens desired</div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="space-y-3">
              <div className="h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />
              
              <button
                onClick={handleSubmitBid}
                disabled={!ethAmount || !tokenAmount || isBidding || isBidConfirming}
                className="w-full btn-primary py-4 text-sm font-mono uppercase tracking-wider disabled:opacity-50"
              >
                {isBidding || isBidConfirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  'Submit Bid'
                )}
              </button>

              {isBidSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto mb-1" />
                  <p className="text-xs font-mono text-green-400">Bid Submitted!</p>
                </motion.div>
              )}

              <div className="text-center text-xs font-mono text-slate-600">
                TX_FEE: ~0.002 ETH
              </div>
            </div>
          </motion.div>

          {/* Token Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-4 mb-4">
              <VaultLogo size="md" />
              <div className="flex-1">
                <h4 className="font-semibold">AKITA</h4>
                <p className="text-xs text-slate-500 font-mono">wsAKITA Vault</p>
              </div>
            </div>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Contract</span>
                <span className="font-mono text-slate-400">
                  {AKITA.token.slice(0, 6)}...{AKITA.token.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Network</span>
                <span className="text-slate-400">Base</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
