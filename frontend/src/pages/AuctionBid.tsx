import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import {
  Clock,
  ArrowLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
  TrendingUp,
  Target,
} from 'lucide-react'
import { AKITA } from '../config/contracts'
import { ConnectButton } from '../components/ConnectButton'

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

const PRESET_BIDS = [
  { label: '0.1', eth: '0.1' },
  { label: '0.25', eth: '0.25' },
  { label: '0.5', eth: '0.5' },
  { label: '1.0', eth: '1' },
]

export function AuctionBid() {
  const { isConnected } = useAccount()
  const [ethAmount, setEthAmount] = useState('')
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))

  const ccaStrategy = AKITA.ccaStrategy

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

  const { writeContract: writeBid, data: bidHash } = useWriteContract()
  const { isLoading: isBidding } = useWaitForTransactionReceipt({ hash: bidHash })

  const isActive = auctionStatus?.[1] || false
  const isGraduated = auctionStatus?.[2] || false
  const clearingPrice = auctionStatus?.[3] || 0n
  const currencyRaised = auctionStatus?.[4] || 0n

  const tokenAmount = ethAmount
    ? clearingPrice > 0
      ? (parseEther(ethAmount) * 10n ** 18n) / clearingPrice
      : 0n
    : 0n

  const timeRemaining = endTime ? Number(endTime) - now : 0
  const progress = tokenTarget
    ? Number((currencyRaised * 10000n) / tokenTarget) / 100
    : 0

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return '00:00:00'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleBid = () => {
    if (!ethAmount) return
    writeBid({
      address: ccaStrategy as `0x${string}`,
      abi: CCA_STRATEGY_ABI,
      functionName: 'bid',
      args: [parseEther(ethAmount), tokenAmount],
      value: parseEther(ethAmount),
    })
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="cinematic-section min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-8 max-w-lg px-6"
        >
          <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto" />
          <div className="space-y-4">
            <span className="label">Authentication Required</span>
            <h2 className="headline text-4xl">Connect Wallet</h2>
            <p className="text-zinc-600 font-light">
              Connect your wallet to participate in the AKITA CCA auction
            </p>
          </div>
          <ConnectButton />
          <Link to="/dashboard" className="label text-zinc-600 hover:text-zinc-400 inline-flex items-center gap-2">
            <ArrowLeft className="w-3 h-3" />
            Back to Vaults
          </Link>
        </motion.div>
      </div>
    )
  }

  // Auction ended
  if (isGraduated) {
    return (
      <div className="cinematic-section min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-8 max-w-lg px-6"
        >
          <CheckCircle2 className="w-12 h-12 text-cyan-400 mx-auto" />
          <div className="space-y-4">
            <span className="label">Auction Concluded</span>
            <h2 className="headline text-4xl">CCA Complete</h2>
            <p className="text-zinc-600 font-light">
              The auction has successfully concluded. Head to the vault to deposit.
            </p>
          </div>
          <Link to={`/vault/${AKITA.vault}`} className="btn-accent inline-block">
            Go to Vault
          </Link>
          <Link to="/dashboard" className="label text-zinc-600 hover:text-zinc-400 inline-flex items-center gap-2">
            <ArrowLeft className="w-3 h-3" />
            Back to Vaults
          </Link>
        </motion.div>
      </div>
    )
  }

  // Auction not started
  if (!isActive) {
    return (
      <div className="cinematic-section min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-8 max-w-lg px-6"
        >
          <Clock className="w-12 h-12 text-zinc-600 mx-auto" />
          <div className="space-y-4">
            <span className="label">Pending Launch</span>
            <h2 className="headline text-4xl">Auction Inactive</h2>
            <p className="text-zinc-600 font-light">
              The CCA auction hasn't started yet. Check back soon.
            </p>
          </div>
          <Link to="/dashboard" className="btn-primary inline-block">
            <ArrowLeft className="w-4 h-4 inline mr-2" />
            Back to Vaults
          </Link>
        </motion.div>
      </div>
    )
  }

  // Active auction
  return (
    <div className="relative">
      {/* Particle atmosphere */}
      <div className="particles">
        <div className="absolute top-1/4 right-1/3 w-px h-px bg-cyan-500 rounded-full" style={{ animation: 'particle-float 9s ease-in-out infinite' }} />
        <div className="absolute bottom-1/3 left-1/4 w-px h-px bg-purple-500 rounded-full" style={{ animation: 'particle-float 11s ease-in-out infinite', animationDelay: '3s' }} />
      </div>

      {/* Header */}
      <section className="cinematic-section">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-6"
            >
              <Link to="/dashboard" className="label text-zinc-600 hover:text-zinc-400 inline-flex items-center gap-2">
                <ArrowLeft className="w-3 h-3" />
                Back to Vaults
              </Link>
              <span className="label block">Continuous Combinatorial Auction</span>
              <h1 className="headline text-7xl">AKITA CCA</h1>
              <p className="text-zinc-500 font-light">Get wsAKITA before anyone else</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="space-y-3"
            >
              <span className="label">Time Remaining</span>
              <div className="value mono text-5xl glow-cyan">{formatTime(timeRemaining)}</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="cinematic-section bg-zinc-950/20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-zinc-900">
            <div className="bg-black p-8 space-y-4">
              <span className="label">Total Raised</span>
              <div className="value mono text-4xl glow-cyan">{formatEther(currencyRaised)} ETH</div>
            </div>
            <div className="bg-black p-8 space-y-4">
              <span className="label">Current Price</span>
              <div className="value mono text-4xl">
                {clearingPrice > 0 ? formatEther(clearingPrice) : '...'} ETH
              </div>
            </div>
            <div className="bg-black p-8 space-y-6">
              <span className="label">Progress</span>
              <div className="value mono text-4xl glow-purple">{progress.toFixed(1)}%</div>
              <div className="w-full h-1 bg-zinc-900">
                <div
                  className="h-1 bg-purple-500 transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bid Form */}
      <section className="cinematic-section">
        <div className="max-w-3xl mx-auto px-6 space-y-12">
          <div>
            <span className="label mb-6 block">Place Bid</span>
            <h2 className="headline text-5xl">Enter Amount</h2>
          </div>

          {/* Preset Bids */}
          <div className="grid grid-cols-4 gap-4">
            {PRESET_BIDS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => setEthAmount(preset.eth)}
                className={`card p-6 transition-all duration-300 ${
                  ethAmount === preset.eth
                    ? 'bg-purple-500/10 border-purple-500/30'
                    : 'hover:bg-zinc-950/50'
                }`}
              >
                <div className="value mono text-2xl">{preset.label}</div>
                <span className="label block mt-2">ETH</span>
              </button>
            ))}
          </div>

          {/* Custom Amount */}
          <div className="space-y-4">
            <span className="label">Custom Amount</span>
            <input
              type="text"
              value={ethAmount}
              onChange={(e) => setEthAmount(e.target.value)}
              placeholder="0.0"
              className="input-field w-full text-5xl font-light"
            />
            <span className="label block">ETH</span>
          </div>

          {/* You Receive */}
          {ethAmount && clearingPrice > 0 && (
            <div className="card p-8 space-y-4">
              <span className="label">You Will Receive</span>
              <div className="value mono text-4xl glow-cyan">
                {(Number(tokenAmount) / 1e18).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })} wsAKITA
              </div>
            </div>
          )}

          {/* Bid Button */}
          <button
            onClick={handleBid}
            disabled={isBidding || !ethAmount}
            className="btn-accent w-full disabled:opacity-50"
          >
            {isBidding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Placing Bid...
              </>
            ) : (
              'Place Bid'
            )}
          </button>
        </div>
      </section>

      {/* Info */}
      <section className="cinematic-section bg-zinc-950/20">
        <div className="max-w-3xl mx-auto px-6">
          <span className="label mb-8 block">How CCA Works</span>
          
          <div className="space-y-0">
            <div className="data-row">
              <span className="text-zinc-500 text-sm font-light">Place your bid in ETH to receive wsAKITA tokens</span>
            </div>
            <div className="data-row">
              <span className="text-zinc-500 text-sm font-light">Price adjusts dynamically based on demand</span>
            </div>
            <div className="data-row">
              <span className="text-zinc-500 text-sm font-light">All participants get the same final clearing price</span>
            </div>
            <div className="data-row border-none">
              <span className="text-zinc-500 text-sm font-light">Fair launch mechanism for maximum transparency</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
