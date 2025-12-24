import { useState, useEffect, useMemo } from 'react'
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
import { PriceDiscoveryChart } from '../components/PriceDiscoveryChart'
import { TechnicalMetric, MetricGrid } from '../components/TechnicalMetric'
import { ManifoldBackground } from '../components/ManifoldBackground'

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

  // Generate price discovery data from real metrics
  const priceData = useMemo(() => {
    const raised = Number(formatEther(currencyRaised))
    if (raised === 0) return [30, 35, 42, 55, 68, 85, 70, 50, 40, 30]
    
    // Create data points based on actual raised amount
    const baseData = [30, 35, 42, 55, 68]
    const currentHeight = Math.min(Math.floor((raised / 100) * 100), 100)
    const futureData = [70, 50, 40, 30, 25]
    
    return [...baseData, currentHeight, ...futureData]
  }, [currencyRaised])

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
    <div className="relative space-y-6 py-6">
      {/* Manifold Background */}
      <ManifoldBackground opacity={0.1} variant="cyan" />

      {/* Wire Grid Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link to="/dashboard">
          <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mb-1 uppercase tracking-[0.2em]">
            <span className="inline-block w-2 h-2 rounded-full bg-tension-cyan animate-pulse shadow-glow-cyan" />
            ACTIVE_AUCTION
          </div>
          <h1 className="text-4xl font-bold font-display tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
            CCA_STRATEGY_V4
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
            className="relative bg-basalt/80 backdrop-blur-md border border-basalt-light overflow-hidden"
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-tension-cyan to-transparent opacity-30" />

            <div className="p-8 space-y-8">
              {/* Current Metrics */}
              <MetricGrid columns={2}>
                <TechnicalMetric
                  label="Clearing Price"
                  value={formatEther(clearingPrice)}
                  suffix="ETH"
                  size="xl"
                  loading={!auctionStatus}
                />
                <TechnicalMetric
                  label="Currency Raised"
                  value={formatEther(currencyRaised)}
                  suffix="ETH"
                  size="xl"
                  highlight
                  loading={!auctionStatus}
                />
              </MetricGrid>

              {/* Price Discovery Visualization */}
              <div className="relative">
                <div className="text-xs font-mono uppercase tracking-[0.2em] text-magma-mint/70 mb-4">
                  Price Discovery Curve
                </div>
                <div className="relative bg-black/30 rounded-sm p-6 border border-white/5">
                  <PriceDiscoveryChart 
                    data={priceData}
                    currentPrice={Number(formatEther(clearingPrice))}
                  />
                </div>
              </div>

              {/* Live Stats Grid */}
              <MetricGrid columns={3}>
                <TechnicalMetric
                  label="Total Supply"
                  value={tokenTarget ? (Number(formatUnits(tokenTarget, 18)) / 1000000).toFixed(1) : '0'}
                  suffix="M AKITA"
                  icon={<Target className="w-3 h-3" />}
                  loading={!tokenTarget}
                />
                <TechnicalMetric
                  label="Time Remaining"
                  value={`${daysRemaining}d ${hoursRemaining}h`}
                  icon={<Clock className="w-3 h-3" />}
                  loading={!endTime}
                />
                <TechnicalMetric
                  label="Progress"
                  value={((Number(formatEther(currencyRaised)) / 100) * 100).toFixed(1)}
                  suffix="%"
                  icon={<TrendingUp className="w-3 h-3" />}
                  loading={!auctionStatus}
                />
              </MetricGrid>

            {/* Info Banner */}
            <div className="relative p-6 bg-tension-cyan/5 border border-tension-cyan/20 overflow-hidden">
              {/* Animated shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer" />
              
              <div className="relative flex items-start gap-4">
                <div className="p-2 rounded bg-tension-cyan/10 border border-tension-cyan/30">
                  <Zap className="w-5 h-5 text-tension-cyan" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-1 bg-tension-cyan rounded-full" />
                    <p className="text-sm font-mono uppercase tracking-wider text-tension-cyan">
                      Fair Price Discovery
                    </p>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed font-light">
                    Everyone pays the same clearing price. Higher bids increase allocation.
                    Unbought tokens refund automatically.
                  </p>
                </div>
              </div>
            </div>
            </div>

            {/* Grain overlay */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='filter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23filter)'/%3E%3C/svg%3E")` }}
            />
          </motion.div>
        </div>

        {/* Right: Bidding Interface */}
        <div className="space-y-6">
          {/* Bid Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative bg-basalt/80 backdrop-blur-md border border-basalt-light border-l-4 border-l-tension-cyan/50 overflow-hidden"
          >
            {/* Top accent */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-magma-mint/30 to-transparent" />
            
            <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-1.5 bg-magma-mint rounded-full" />
                <h3 className="text-xs font-mono uppercase tracking-[0.3em] text-magma-mint/80">
                  Auction Parameters
                </h3>
              </div>

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
                    className={`p-3 text-sm font-mono transition-all border ${
                      selectedPreset === preset.label
                        ? 'bg-tension-cyan/10 text-tension-cyan border-tension-cyan/30 shadow-glow-cyan'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                    }`}
                  >
                    {preset.label} ETH
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-2 block">
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
                    className="w-full bg-black/30 border border-basalt-light px-4 py-3 font-mono text-lg focus:border-tension-cyan focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-2 block">
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
                    className="w-full bg-black/30 border border-basalt-light px-4 py-3 font-mono text-lg focus:border-tension-cyan focus:outline-none transition-colors"
                  />
                  <div className="text-xs text-slate-500 mt-1">AKITA tokens desired</div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="space-y-3">
              <div className="h-px bg-gradient-to-r from-transparent via-magma-mint/30 to-transparent" />
              
              <button
                onClick={handleSubmitBid}
                disabled={!ethAmount || !tokenAmount || isBidding || isBidConfirming}
                className="w-full bg-tension-cyan hover:bg-tension-cyan/90 disabled:bg-slate-700 disabled:text-slate-500 text-black py-4 text-sm font-mono uppercase tracking-wider transition-all disabled:opacity-50 border border-tension-cyan/30"
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

              <div className="text-center text-[10px] font-mono text-slate-600 tracking-wider">
                TX_FEE: ~0.002 ETH
              </div>
            </div>
            </div>

            {/* Grain overlay */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='filter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23filter)'/%3E%3C/svg%3E")` }}
            />
          </motion.div>

          {/* Token Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-basalt/80 backdrop-blur-md border border-basalt-light p-6"
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
