import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther, formatUnits } from 'viem'
import {
  Clock,
  Users,
  Coins,
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

      <div className="space-y-6">
        {/* Simple Value Prop */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg mb-2">Why Bid Now?</h3>
              <div className="space-y-1 text-sm text-slate-300">
                <p>✓ Get tokens before they hit the market</p>
                <p>✓ You might pay less than your bid (fair pricing)</p>
                <p>✓ If you don't win, get a full refund</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Simple Bid Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 space-y-6"
        >
          <h2 className="text-2xl font-bold text-center">Choose Your Investment</h2>

          {/* Preset Amounts */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Small', eth: '0.1', tokens: '200000', popular: false },
              { label: 'Medium', eth: '0.5', tokens: '1000000', popular: true },
              { label: 'Large', eth: '1.0', tokens: '2000000', popular: false },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  setEthAmount(preset.eth)
                  setTokenAmount(preset.tokens)
                }}
                className={`relative p-4 rounded-xl border-2 transition-all ${
                  ethAmount === preset.eth
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-white/10 bg-white/[0.02] hover:border-brand-500/50'
                }`}
              >
                {preset.popular && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-brand-500 text-white text-[10px] font-bold">
                    POPULAR
                  </div>
                )}
                <p className="text-xl font-bold text-white mb-1">{preset.eth} ETH</p>
                <p className="text-xs text-slate-400">~{(parseFloat(preset.tokens) / 1000000).toFixed(1)}M AKITA</p>
              </button>
            ))}
          </div>

          {/* Custom Amount */}
          <div className="text-center">
            <button
              onClick={() => {
                setEthAmount('')
                setTokenAmount('')
              }}
              className="text-sm text-brand-400 hover:text-brand-300"
            >
              Or enter custom amount →
            </button>
          </div>

          {(ethAmount === '' || !['0.1', '0.5', '1.0'].includes(ethAmount)) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 pt-4 border-t border-white/5"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-300">
                  Custom ETH Amount
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={ethAmount}
                    onChange={(e) => setEthAmount(e.target.value)}
                    placeholder="0.1"
                    className="input-field pr-16 text-xl"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-surface-500">
                    ETH
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-surface-300">
                  AKITA Tokens You Want
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={tokenAmount}
                    onChange={(e) => setTokenAmount(e.target.value)}
                    placeholder="1000000"
                    className="input-field pr-20 text-xl"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-surface-500">
                    AKITA
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmitBid}
            disabled={!ethAmount || !tokenAmount || isBidding || isBidConfirming}
            className="btn-primary w-full py-6 text-xl"
          >
            {isBidding || isBidConfirming ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Trophy className="w-5 h-5" />
                Submit Bid ({ethAmount || '0'} ETH)
              </>
            )}
          </button>

          {isBidSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center"
            >
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="text-green-400 font-bold mb-1">Bid Submitted!</p>
              <p className="text-xs text-slate-400">Check back after auction ends</p>
            </motion.div>
          )}

          {/* Simple Explainer */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
            <p className="text-xs text-slate-400">
              💡 <span className="text-white font-medium">You might pay less!</span> Everyone pays the same fair price.
              <br />
              <span className="text-slate-500">No win? Full refund.</span>
            </p>
          </div>
        </motion.div>

      </div>
    </div>
  )
}

