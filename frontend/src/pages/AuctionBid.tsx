import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther, formatUnits } from 'viem'
import {
  Clock,
  TrendingUp,
  Users,
  Coins,
  Zap,
  ArrowLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Trophy,
} from 'lucide-react'
import { AKITA } from '../config/contracts'
import { ConnectButton } from '../components/ConnectButton'
import { TokenImage } from '../components/TokenImage'

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
  const { address: vaultAddress } = useParams()
  const { address, isConnected } = useAccount()
  const [ethAmount, setEthAmount] = useState('')
  const [tokenAmount, setTokenAmount] = useState('')

  // For now, hardcode to AKITA - in production, fetch vault's CCA address
  const ccaStrategy = AKITA.ccaStrategy

  // Read auction status
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
  const currencyRaised = auctionStatus?.[4] || 0n

  // Calculate time remaining
  const now = Math.floor(Date.now() / 1000)
  const timeRemaining = endTime ? Number(endTime) - now : 0
  const daysRemaining = Math.floor(timeRemaining / 86400)
  const hoursRemaining = Math.floor((timeRemaining % 86400) / 3600)

  // Calculate price per token
  const pricePerToken = ethAmount && tokenAmount 
    ? (parseFloat(ethAmount) / parseFloat(tokenAmount)).toFixed(6)
    : '0'

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

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 max-w-md text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto">
            <Trophy className="w-8 h-8 text-brand-500" />
          </div>
          <h2 className="font-display text-2xl font-bold">Connect to Bid</h2>
          <p className="text-surface-400">
            Connect your wallet to participate in the CCA auction
          </p>
          <ConnectButton />
        </motion.div>
      </div>
    )
  }

  if (isGraduated) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <Link to={`/vault/${vaultAddress}`} className="inline-flex items-center gap-2 text-brand-500 hover:text-brand-400">
          <ArrowLeft className="w-4 h-4" />
          Back to Vault
        </Link>
        <div className="glass-card p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="font-display text-2xl font-bold">Auction Ended</h2>
          <p className="text-surface-400">
            This auction has graduated. The creator needs to complete it.
          </p>
          <Link to={`/complete-auction/${ccaStrategy}`}>
            <button className="btn-primary">
              Complete Auction
            </button>
          </Link>
        </div>
      </div>
    )
  }

  if (!isActive) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <Link to={`/vault/${vaultAddress}`} className="inline-flex items-center gap-2 text-brand-500 hover:text-brand-400">
          <ArrowLeft className="w-4 h-4" />
          Back to Vault
        </Link>
        <div className="glass-card p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-700/10 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="font-display text-2xl font-bold">Auction Not Active</h2>
          <p className="text-surface-400">
            This auction hasn't started yet or has already ended.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-8">
      {/* Back Button */}
      <Link to={`/vault/${vaultAddress}`} className="inline-flex items-center gap-2 text-brand-500 hover:text-brand-400">
        <ArrowLeft className="w-4 h-4" />
        Back to Vault
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <TokenImage
            tokenAddress={AKITA.token as `0x${string}`}
            symbol="AKITA"
            size="lg"
            fallbackColor="from-orange-500 to-red-600"
          />
          <div className="text-left">
            <h1 className="font-display text-3xl font-bold">AKITA Auction</h1>
            <p className="text-surface-400">Continuous Combinatorial Auction</p>
          </div>
        </div>
        
        {/* Time Remaining Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/20">
          <Clock className="w-4 h-4 text-brand-400" />
          <span className="text-brand-400 font-medium">
            {daysRemaining}d {hoursRemaining}h remaining
          </span>
        </div>
      </motion.div>

      {/* Auction Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid sm:grid-cols-3 gap-4"
      >
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-brand-500" />
            <span className="text-xs text-slate-500">Total Raised</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatEther(currencyRaised)} ETH
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-slate-500">Tokens Available</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {tokenTarget ? formatUnits(tokenTarget, 18) : '0'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-green-500" />
            <span className="text-xs text-slate-500">Your Bids</span>
          </div>
          <p className="text-2xl font-bold text-white">0</p>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bid Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 space-y-6"
        >
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-brand-500" />
            Place Your Bid
          </h2>

          {/* ETH Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-surface-300">
              ETH Amount
            </label>
            <div className="relative">
              <input
                type="text"
                value={ethAmount}
                onChange={(e) => setEthAmount(e.target.value)}
                placeholder="0.1"
                className="input-field pr-16"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-surface-500">
                ETH
              </div>
            </div>
          </div>

          {/* Token Amount Desired */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-surface-300">
              AKITA Desired
            </label>
            <div className="relative">
              <input
                type="text"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                placeholder="1000"
                className="input-field pr-20"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-surface-500">
                AKITA
              </div>
            </div>
          </div>

          {/* Price Calculation */}
          {ethAmount && tokenAmount && (
            <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-brand-300">Your Bid Price</span>
                <span className="text-lg font-bold text-white">{pricePerToken} ETH</span>
              </div>
              <p className="text-xs text-brand-400">per AKITA token</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmitBid}
            disabled={!ethAmount || !tokenAmount || isBidding || isBidConfirming}
            className="btn-primary w-full"
          >
            {isBidding || isBidConfirming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting Bid...
              </>
            ) : (
              <>
                <Trophy className="w-4 h-4" />
                Submit Bid
              </>
            )}
          </button>

          {isBidSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Bid submitted successfully!
            </motion.div>
          )}

          {/* Info */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-slate-400 leading-relaxed">
                <p className="font-semibold text-slate-300 mb-1">How bidding works</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Specify how much ETH you'll pay for how many tokens</li>
                  <li>Higher price per token = better chance of winning</li>
                  <li>Winners pay the clearing price (lowest winning bid)</li>
                  <li>You can submit multiple bids</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Current Auction State */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 space-y-6"
        >
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-500" />
            Current State
          </h2>

          {/* Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Day 1</span>
              <span>Day 7</span>
            </div>
            <div className="relative h-3 rounded-full bg-slate-900/50 overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-500 to-purple-500"
                initial={{ width: '0%' }}
                animate={{ 
                  width: `${Math.min(100, ((7 * 86400 - timeRemaining) / (7 * 86400)) * 100)}%` 
                }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
            <p className="text-center text-xs text-slate-500">
              {daysRemaining} days, {hoursRemaining} hours remaining
            </p>
          </div>

          {/* Example Competitive Bids */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">Example Competitive Bids</p>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <span className="text-xs text-green-300">High (likely wins)</span>
                <span className="text-white font-bold text-sm">0.0005 ETH</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <span className="text-xs text-brand-300">Medium</span>
                <span className="text-white font-bold text-sm">0.0003 ETH</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-700/10 border border-slate-700/20">
                <span className="text-xs text-slate-400">Low</span>
                <span className="text-white font-bold text-sm">0.0001 ETH</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">per AKITA token</p>
          </div>

          {/* Key Points */}
          <div className="pt-4 border-t border-white/5 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Remember
            </p>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>Bid early to secure your position</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>You can update your bid anytime</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>ETH is locked until auction ends</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>Losing bids get full refund</span>
              </li>
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

