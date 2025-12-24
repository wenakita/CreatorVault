import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther, formatUnits } from 'viem'
import {
  Clock,
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
  const { isConnected } = useAccount()
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

  // Check if auction hasn't started yet
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
        <div className="glass-card p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto">
            <Clock className="w-10 h-10 text-orange-500" />
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold mb-2">Auction Not Started Yet</h2>
            <p className="text-surface-400 text-lg">
              The creator needs to activate the auction before bidding can begin.
            </p>
          </div>

          {auctionNotStarted && (
            <div className="pt-4 space-y-4">
              <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 text-left">
                <p className="text-sm font-semibold text-brand-300 mb-2">Are you the creator?</p>
                <p className="text-xs text-slate-400 mb-3">
                  Launch the 7-day auction and let your community get early access to your tokens.
                </p>
                <Link to="/activate-akita">
                  <button className="btn-primary w-full">
                    🚀 Launch Auction
                  </button>
                </Link>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-left">
                <p className="text-xs text-slate-400 mb-2">How it works:</p>
                <div className="space-y-1 text-xs text-slate-500">
                  <p>1. Creator deposits tokens & launches auction</p>
                  <p>2. Community bids for 7 days</p>
                  <p>3. Highest bidders win at fair price</p>
                </div>
              </div>
            </div>
          )}
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
        className="text-center space-y-4"
      >
        <TokenImage
          tokenAddress={AKITA.token as `0x${string}`}
          symbol="AKITA"
          size="xl"
          fallbackColor="from-orange-500 to-red-600"
          className="mx-auto"
        />
        <div>
          <h1 className="font-display text-4xl font-bold mb-2">Get AKITA Early</h1>
          <p className="text-slate-400 text-lg">
            Buy before it launches on the market
          </p>
        </div>
        
        {/* Time Remaining - Urgent */}
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-orange-500/10 border border-orange-500/30">
          <Clock className="w-5 h-5 text-orange-400" />
          <span className="text-orange-400 font-bold text-lg">
            {daysRemaining} days {hoursRemaining} hours left
          </span>
        </div>
      </motion.div>

      {/* Real Auction Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-center gap-8 text-center"
      >
        <div>
          <p className="text-3xl font-bold text-white mb-1">
            {formatEther(currencyRaised)}
          </p>
          <p className="text-xs text-slate-400">ETH invested</p>
        </div>
        <div className="w-px h-12 bg-white/10" />
        <div>
          <p className="text-3xl font-bold text-white mb-1">
            {tokenTarget ? (Number(formatUnits(tokenTarget, 18)) / 1000000).toFixed(1) : '0'}M
          </p>
          <p className="text-xs text-slate-400">AKITA available</p>
        </div>
      </motion.div>

      {/* How It Works - Simple 3 Steps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-4xl mx-auto"
      >
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
            <div className="w-12 h-12 rounded-full bg-brand-500/20 flex items-center justify-center mx-auto mb-3 text-xl font-bold text-brand-400">
              1
            </div>
            <p className="font-semibold text-white mb-1">Choose Package</p>
            <p className="text-xs text-slate-400">Pick your investment size</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
            <div className="w-12 h-12 rounded-full bg-brand-500/20 flex items-center justify-center mx-auto mb-3 text-xl font-bold text-brand-400">
              2
            </div>
            <p className="font-semibold text-white mb-1">Lock In</p>
            <p className="text-xs text-slate-400">Submit your bid</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3 text-xl font-bold text-green-400">
              3
            </div>
            <p className="font-semibold text-white mb-1">Get Tokens</p>
            <p className="text-xs text-slate-400">Claim after {daysRemaining} days</p>
          </div>
        </div>
      </motion.div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Simple Bid Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-8 space-y-8"
        >
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">Choose Your Package</h2>
            <p className="text-slate-400">Pick how much you want to invest</p>
          </div>

          {/* Preset Amounts - Package Style */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { 
                label: 'Starter', 
                emoji: '🌱',
                eth: '0.1', 
                tokens: '200000', 
                popular: false,
                desc: 'Try it out'
              },
              { 
                label: 'Builder', 
                emoji: '🚀',
                eth: '0.5', 
                tokens: '1000000', 
                popular: true,
                desc: 'Most popular'
              },
              { 
                label: 'Whale', 
                emoji: '🐋',
                eth: '1.0', 
                tokens: '2000000', 
                popular: false,
                desc: 'Go big'
              },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  setEthAmount(preset.eth)
                  setTokenAmount(preset.tokens)
                }}
                className={`relative p-6 rounded-2xl border-2 transition-all hover:scale-105 ${
                  ethAmount === preset.eth
                    ? 'border-brand-500 bg-brand-500/10 shadow-xl shadow-brand-500/20'
                    : 'border-white/10 bg-white/[0.02] hover:border-brand-500/50'
                }`}
              >
                {preset.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-brand-500 to-purple-500 text-white text-xs font-bold shadow-lg">
                    ⭐ {preset.desc}
                  </div>
                )}
                <div className="text-center space-y-2">
                  <div className="text-4xl mb-2">{preset.emoji}</div>
                  <p className="text-lg font-bold text-white">{preset.label}</p>
                  <div className="py-3 px-4 rounded-xl bg-white/5">
                    <p className="text-2xl font-black text-white">{preset.eth} ETH</p>
                  </div>
                  <p className="text-sm text-slate-400">
                    Get ~{(parseFloat(preset.tokens) / 1000000).toFixed(1)}M AKITA
                  </p>
                  {!preset.popular && (
                    <p className="text-xs text-slate-500">{preset.desc}</p>
                  )}
                </div>
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

          {/* What You Get */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20">
            <p className="text-center text-slate-300 mb-4">
              🎁 <span className="font-bold text-white">Bonus:</span> Everyone pays the same lowest price
            </p>
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <p className="text-2xl mb-1">💰</p>
                <p className="text-slate-400">Pay less than your bid</p>
              </div>
              <div>
                <p className="text-2xl mb-1">🔒</p>
                <p className="text-slate-400">100% refund if you lose</p>
              </div>
              <div>
                <p className="text-2xl mb-1">⚡</p>
                <p className="text-slate-400">Get tokens first</p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmitBid}
            disabled={!ethAmount || !tokenAmount || isBidding || isBidConfirming}
            className="btn-primary w-full py-6 text-xl font-bold shadow-2xl hover:scale-105 transition-transform"
          >
            {isBidding || isBidConfirming ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                🎯 Lock In {ethAmount || '0'} ETH
              </>
            )}
          </button>

          {isBidSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 rounded-2xl bg-green-500/10 border border-green-500/20 text-center"
            >
              <div className="text-6xl mb-3">🎉</div>
              <p className="text-2xl font-bold text-green-400 mb-2">You're In!</p>
              <p className="text-slate-400">Check back after {daysRemaining} days to claim your tokens</p>
            </motion.div>
          )}

          {/* Trust Signals */}
          <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-400" />
              <span>Secure</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-400" />
              <span>Fair pricing</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-400" />
              <span>Full refund</span>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  )
}

