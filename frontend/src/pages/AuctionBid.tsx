import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBlockNumber } from 'wagmi'
import { parseEther, formatEther, formatUnits } from 'viem'
import {
  Clock,
  ArrowLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
  TrendingUp,
  Activity,
  BarChart3,
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
  {
    name: 'auctionToken',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
] as const

const PRESET_BIDS = [
  { label: '0.05 ETH', eth: '0.05' },
  { label: '0.1 ETH', eth: '0.1' },
  { label: '0.25 ETH', eth: '0.25' },
  { label: '0.5 ETH', eth: '0.5' },
  { label: '1 ETH', eth: '1' },
]

export function AuctionBid() {
  const { isConnected } = useAccount()
  const [ethAmount, setEthAmount] = useState('')
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))
  const [priceHistory, setPriceHistory] = useState<Array<{ block: number; price: number }>>([])

  const ccaStrategy = AKITA.ccaStrategy

  // Get current block number
  const { data: currentBlock } = useBlockNumber({ watch: true })

  const { data: auctionStatus, refetch: refetchStatus } = useReadContract({
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

  const { data: auctionTokenAddress } = useReadContract({
    address: ccaStrategy as `0x${string}`,
    abi: CCA_STRATEGY_ABI,
    functionName: 'auctionToken',
  })

  const { writeContract: writeBid, data: bidHash } = useWriteContract()
  const { isLoading: isBidding, isSuccess: bidSuccess } = useWaitForTransactionReceipt({ hash: bidHash })

  const isActive = auctionStatus?.[1] || false
  const isGraduated = auctionStatus?.[2] || false
  const clearingPrice = auctionStatus?.[3] || 0n
  const currencyRaised = auctionStatus?.[4] || 0n

  const tokenAmount = ethAmount
    ? clearingPrice > 0
      ? (parseEther(ethAmount) * 10n ** 18n) / clearingPrice
      : 0n
    : 0n

  // Update clock
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Track price history for chart
  useEffect(() => {
    if (clearingPrice > 0 && currentBlock) {
      const priceInEth = Number(formatUnits(clearingPrice, 18))
      setPriceHistory(prev => {
        const newHistory = [...prev, { block: Number(currentBlock), price: priceInEth }]
        // Keep last 50 data points
        return newHistory.slice(-50)
      })
    }
  }, [clearingPrice, currentBlock])

  // Refetch status on bid success
  useEffect(() => {
    if (bidSuccess) {
      refetchStatus()
    }
  }, [bidSuccess, refetchStatus])

  const timeLeft = endTime ? Number(endTime) - now : 0
  const days = Math.floor(timeLeft / 86400)
  const hours = Math.floor((timeLeft % 86400) / 3600)
  const minutes = Math.floor((timeLeft % 3600) / 60)
  const seconds = timeLeft % 60

  const progress = tokenTarget && currencyRaised
    ? Number((currencyRaised * 100n) / parseEther('1')) // Assuming 1 ETH target for visualization
    : 0

  const handleBid = () => {
    if (!ethAmount || !clearingPrice) return

    writeBid({
      address: ccaStrategy as `0x${string}`,
      abi: CCA_STRATEGY_ABI,
      functionName: 'bid',
      args: [parseEther(ethAmount), tokenAmount],
      value: parseEther(ethAmount),
    })
  }

  // Not Connected State
  if (!isConnected) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <AlertCircle className="w-16 h-16 text-zinc-500 mx-auto" />
          <div>
            <h2 className="headline text-3xl mb-3">Connect Wallet</h2>
            <p className="text-zinc-500 mb-6">Connect your wallet to participate in the auction</p>
            <ConnectButton />
          </div>
        </motion.div>
      </div>
    )
  }

  // Auction Ended State
  if (!isActive && isGraduated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 max-w-2xl"
        >
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
          <div>
            <h2 className="headline text-3xl mb-3">Auction Completed</h2>
            <p className="text-zinc-500 mb-6">
              The CCA auction has successfully completed and graduated.
            </p>
            <div className="card p-6 text-left space-y-3">
              <div className="data-row border-none">
                <span className="label">Final Price</span>
                <span className="value mono text-xl">
                  {clearingPrice > 0 ? formatUnits(clearingPrice, 18) : '0'} ETH
                </span>
              </div>
              <div className="data-row border-none">
                <span className="label">Total Raised</span>
                <span className="value mono text-xl glow-purple">
                  {formatEther(currencyRaised)} ETH
                </span>
              </div>
            </div>
            <Link to={`/vault/${AKITA.vault}`}>
              <button className="btn-primary mt-6">View Vault</button>
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  // Auction Not Started State
  if (!isActive && !isGraduated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <Clock className="w-16 h-16 text-zinc-500 mx-auto" />
          <div>
            <h2 className="headline text-3xl mb-3">Auction Not Active</h2>
            <p className="text-zinc-500 mb-6">
              The CCA auction has not started yet or has ended without graduating.
            </p>
            <Link to="/dashboard">
              <button className="btn-secondary">Back to Dashboard</button>
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  // Active Auction State
  return (
    <div className="relative min-h-screen">
      {/* Header */}
      <section className="cinematic-section">
        <div className="max-w-7xl mx-auto px-6">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-400 transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" />
            <span className="label">Back to vaults</span>
          </Link>

          <div className="flex items-start justify-between mb-12">
            <div>
              <span className="label block mb-4">Continuous Clearing Auction</span>
              <h1 className="headline text-6xl mb-4">wsAKITA Price Discovery</h1>
              <p className="text-zinc-500 text-lg font-light max-w-2xl">
                Fair, transparent, onchain distribution. Market-driven pricing through continuous block-by-block clearing.
              </p>
            </div>
            
            {/* Timer Card */}
            <div className="card p-6 min-w-[280px]">
              <span className="label block mb-3">Auction ends in</span>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <div className="value mono text-3xl glow-purple">{days}</div>
                  <div className="label mt-1">Days</div>
                </div>
                <div className="text-center">
                  <div className="value mono text-3xl">{hours}</div>
                  <div className="label mt-1">Hrs</div>
                </div>
                <div className="text-center">
                  <div className="value mono text-3xl">{minutes}</div>
                  <div className="label mt-1">Min</div>
                </div>
                <div className="text-center">
                  <div className="value mono text-3xl">{seconds}</div>
                  <div className="label mt-1">Sec</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="cinematic-section bg-zinc-950/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left: Price Discovery Chart */}
            <div className="lg:col-span-2 space-y-8">
              {/* Current Clearing Price */}
              <div className="card p-8">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <span className="label block mb-3">Current Clearing Price</span>
                    <div className="headline text-5xl mb-2">
                      {clearingPrice > 0 ? parseFloat(formatUnits(clearingPrice, 18)).toFixed(6) : '0.000000'} ETH
                    </div>
                    <p className="text-zinc-600 text-sm font-light">Per wsAKITA token</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-purple-500/10 border border-purple-500/30">
                    <Activity className="w-4 h-4 text-purple-400" />
                    <span className="label text-purple-400">Live</span>
                  </div>
                </div>

                {/* Price Chart */}
                <div className="h-64 relative">
                  <span className="label block mb-6">Price Discovery Over Time</span>
                  
                  {priceHistory.length > 1 ? (
                    <svg width="100%" height="200" className="overflow-visible">
                      <defs>
                        <linearGradient id="priceGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="rgb(147, 51, 234)" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="rgb(147, 51, 234)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      
                      {/* Grid lines */}
                      {[0, 1, 2, 3, 4].map(i => (
                        <line
                          key={i}
                          x1="0"
                          x2="100%"
                          y1={i * 50}
                          y2={i * 50}
                          stroke="rgb(39, 39, 42)"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                      ))}

                      {/* Price line */}
                      <motion.polyline
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        fill="url(#priceGradient)"
                        stroke="rgb(147, 51, 234)"
                        strokeWidth="2"
                        points={priceHistory.map((point, i) => {
                          const x = (i / (priceHistory.length - 1)) * 100
                          const maxPrice = Math.max(...priceHistory.map(p => p.price))
                          const y = 200 - (point.price / maxPrice) * 180
                          return `${x}%,${y}`
                        }).join(' ')}
                      />
                    </svg>
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-600">
                      <p className="label">Waiting for price discovery...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Auction Stats */}
              <div className="grid grid-cols-2 gap-px bg-zinc-900">
                <div className="card p-6 space-y-3 border-none rounded-none">
                  <span className="label">Total Raised</span>
                  <div className="value mono text-3xl glow-purple">
                    {formatEther(currencyRaised)} ETH
                  </div>
                </div>
                <div className="card p-6 space-y-3 border-none rounded-none">
                  <span className="label">Tokens for Sale</span>
                  <div className="value mono text-3xl">
                    {tokenTarget ? formatEther(tokenTarget) : '0'} wsAKITA
                  </div>
                </div>
                <div className="card p-6 space-y-3 border-none rounded-none">
                  <span className="label">Current Block</span>
                  <div className="value mono text-xl">
                    {currentBlock ? currentBlock.toString() : '...'}
                  </div>
                </div>
                <div className="card p-6 space-y-3 border-none rounded-none">
                  <span className="label">Auction Type</span>
                  <div className="value text-xl">Continuous Clearing</div>
                </div>
              </div>

              {/* How It Works */}
              <div className="card p-8 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="w-6 h-6 text-purple-400" />
                  <span className="headline text-2xl">How CCA Works</span>
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="value text-sm text-purple-400">1</span>
                    </div>
                    <div>
                      <p className="text-white font-medium mb-1">Continuous Clearing</p>
                      <p className="text-zinc-600 text-sm font-light">
                        Bids are split across auction blocks. Each block clears at the market-discovered price.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="value text-sm text-purple-400">2</span>
                    </div>
                    <div>
                      <p className="text-white font-medium mb-1">Price Discovery</p>
                      <p className="text-zinc-600 text-sm font-light">
                        Fair market price emerges from all participants, not set by insiders.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="value text-sm text-purple-400">3</span>
                    </div>
                    <div>
                      <p className="text-white font-medium mb-1">Instant Liquidity</p>
                      <p className="text-zinc-600 text-sm font-light">
                        At auction end, a Uniswap V4 pool is created at the discovered price.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Bid Form */}
            <div className="space-y-6">
              {/* Bid Card */}
              <div className="card p-8 space-y-6 sticky top-24">
                <div>
                  <span className="label block mb-3">Place Your Bid</span>
                  <h3 className="headline text-2xl mb-2">Join the Auction</h3>
                  <p className="text-zinc-600 text-sm font-light">
                    Your bid will be split across remaining blocks
                  </p>
                </div>

                {/* Preset Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  {PRESET_BIDS.map((preset) => (
                    <button
                      key={preset.eth}
                      onClick={() => setEthAmount(preset.eth)}
                      className={`py-3 px-4 rounded-md border transition-all ${
                        ethAmount === preset.eth
                          ? 'bg-purple-500/20 border-purple-500 text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <span className="value mono text-sm">{preset.label}</span>
                    </button>
                  ))}
                </div>

                {/* Custom Amount */}
                <div className="space-y-3">
                  <span className="label">Custom Amount (ETH)</span>
                  <input
                    type="text"
                    value={ethAmount}
                    onChange={(e) => setEthAmount(e.target.value)}
                    placeholder="0.0"
                    className="input-field w-full text-4xl font-light text-center"
                  />
                </div>

                {/* You Will Receive */}
                {ethAmount && clearingPrice > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="card p-6 space-y-3 bg-zinc-950"
                  >
                    <span className="label">You Will Receive</span>
                    <div className="value mono text-3xl glow-cyan">
                      ~{parseFloat(formatEther(tokenAmount)).toFixed(2)} wsAKITA
                    </div>
                    <p className="text-zinc-600 text-xs font-light">
                      Based on current clearing price. Final amount may vary.
                    </p>
                  </motion.div>
                )}

                {/* Bid Button */}
                <button
                  onClick={handleBid}
                  disabled={!ethAmount || isBidding}
                  className="btn-primary w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBidding ? (
                    <span className="flex items-center justify-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Placing Bid...
                    </span>
                  ) : (
                    'Place Bid'
                  )}
                </button>

                {bidSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-green-400 text-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Bid placed successfully!</span>
                  </motion.div>
                )}

                <p className="text-zinc-600 text-xs font-light text-center">
                  Powered by Uniswap Continuous Clearing Auctions
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
