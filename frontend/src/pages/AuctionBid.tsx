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
  { label: '0.1 ETH', eth: '0.1' },
  { label: '0.25 ETH', eth: '0.25' },
  { label: '0.5 ETH', eth: '0.5' },
  { label: '1 ETH', eth: '1' },
]

export function AuctionBid() {
  const { isConnected } = useAccount()
  const [ethAmount, setEthAmount] = useState('')
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))

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
    if (seconds <= 0) return '0:00:00'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
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
      <div className="min-h-[70vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 max-w-md"
        >
          <AlertCircle className="w-16 h-16 text-zinc-500 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold mb-2">Connect Wallet to Bid</h2>
            <p className="text-zinc-400 mb-6">
              Connect your wallet to participate in the AKITA CCA auction
            </p>
          </div>
          <ConnectButton />
          <Link to="/dashboard" className="text-blue-500 hover:text-blue-400 text-sm flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Vaults
          </Link>
        </motion.div>
      </div>
    )
  }

  // Auction ended
  if (isGraduated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 max-w-md"
        >
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold mb-2">Auction Ended</h2>
            <p className="text-zinc-400 mb-6">
              The CCA auction has successfully concluded. Head to the vault to deposit.
            </p>
          </div>
          <Link to={`/vault/${AKITA.vault}`} className="btn-primary inline-flex">
            Go to Vault
          </Link>
          <Link to="/dashboard" className="text-blue-500 hover:text-blue-400 text-sm flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Vaults
          </Link>
        </motion.div>
      </div>
    )
  }

  // Auction not started
  if (!isActive) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 max-w-md"
        >
          <Clock className="w-16 h-16 text-zinc-500 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold mb-2">Auction Not Active</h2>
            <p className="text-zinc-400 mb-6">
              The CCA auction hasn't started yet. Check back soon!
            </p>
          </div>
          <Link to="/dashboard" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Vaults
          </Link>
        </motion.div>
      </div>
    )
  }

  // Active auction
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link to="/dashboard" className="text-blue-500 hover:text-blue-400 text-sm flex items-center gap-2 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Vaults
          </Link>
          <h1 className="text-4xl font-bold">AKITA CCA Auction</h1>
          <p className="text-zinc-400">Get wsAKITA before anyone else</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 text-center">
          <div className="text-sm text-zinc-500 mb-1">Time Remaining</div>
          <div className="text-2xl font-bold font-mono text-blue-500">
            {formatTime(timeRemaining)}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-zinc-500">Total Raised</span>
          </div>
          <div className="text-xl font-semibold">
            {formatEther(currencyRaised)} ETH
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-zinc-500" />
            <span className="text-xs text-zinc-500">Current Price</span>
          </div>
          <div className="text-xl font-semibold">
            {clearingPrice > 0 ? formatEther(clearingPrice) : '...'} ETH
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-zinc-500">Progress</span>
          </div>
          <div className="text-xl font-semibold">{progress.toFixed(1)}%</div>
          <div className="w-full bg-zinc-900 rounded-full h-2 mt-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bid Form */}
      <div className="card p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Place Your Bid</h2>
          <p className="text-zinc-400 text-sm">
            Choose an amount or enter a custom bid. Higher bids get better prices.
          </p>
        </div>

        {/* Preset Bids */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRESET_BIDS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setEthAmount(preset.eth)}
              className={`p-4 rounded-lg border transition-all ${
                ethAmount === preset.eth
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-900 hover:border-zinc-800'
              }`}
            >
              <div className="text-lg font-semibold">{preset.label}</div>
            </button>
          ))}
        </div>

        {/* Custom Amount */}
        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Custom Amount (ETH)</label>
          <input
            type="text"
            value={ethAmount}
            onChange={(e) => setEthAmount(e.target.value)}
            placeholder="0.0"
            className="input-field w-full text-2xl"
          />
        </div>

        {/* You Get */}
        {ethAmount && clearingPrice > 0 && (
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-4">
            <div className="text-sm text-zinc-500 mb-1">You Will Receive</div>
            <div className="text-2xl font-bold text-blue-500">
              {(Number(tokenAmount) / 1e18).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}{' '}
              wsAKITA
            </div>
          </div>
        )}

        {/* Bid Button */}
        <button
          onClick={handleBid}
          disabled={isBidding || !ethAmount}
          className="btn-primary w-full text-lg py-4 disabled:opacity-50"
        >
          {isBidding ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Bidding...
            </span>
          ) : (
            'Place Bid'
          )}
        </button>
      </div>

      {/* Info */}
      <div className="card p-6 bg-zinc-950/50">
        <h3 className="font-semibold mb-3">How CCA Works</h3>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>Place your bid in ETH to receive wsAKITA tokens</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>Price adjusts dynamically based on demand</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>All participants get the same final clearing price</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>Fair launch mechanism for maximum transparency</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
