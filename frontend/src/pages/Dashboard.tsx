import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import {
  TrendingUp,
  Users,
  Coins,
  ArrowUpRight,
  Sparkles,
  Gift,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react'
import { AKITA } from '../config/contracts'
import { TokenImage } from '../components/TokenImage'
import { LotteryDistributionCompact } from '../components/DistributionChart'

// CCA Strategy ABI for reading auction status
const CCA_STRATEGY_ABI = [
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
] as const

// Example vault data
const vaults = [
  {
    id: 'akita',
    name: 'AKITA',
    symbol: 'AKITA',
    wrappedSymbol: 'wsAKITA',
    token: AKITA.token,
    vault: AKITA.vault,
    ccaStrategy: AKITA.ccaStrategy,
    tvl: '$420,690',
    apy: '42.0%',
    holders: 69,
    status: 'active' as const,
    color: 'from-orange-500 to-red-600',
  },
]

const sharedLottery = {
  jackpot: '0.1 ETH',
  progress: 35,
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

function useAuctionStatus(ccaStrategy: string) {
  const { data } = useReadContract({
    address: ccaStrategy as `0x${string}`,
    abi: CCA_STRATEGY_ABI,
    functionName: 'getAuctionStatus',
  })
  
  return {
    auction: data?.[0],
    isActive: data?.[1] || false,
    isGraduated: data?.[2] || false,
    clearingPrice: data?.[3],
    currencyRaised: data?.[4],
  }
}

function AuctionStatusBadge({ ccaStrategy }: { ccaStrategy: string }) {
  const { isActive, isGraduated, currencyRaised } = useAuctionStatus(ccaStrategy)
  
  if (isGraduated) {
    return (
      <Link 
        to={`/complete-auction/${ccaStrategy}`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-medium hover:bg-yellow-500/20 transition-colors"
      >
        <AlertCircle className="w-3 h-3" />
        Action Required
      </Link>
    )
  }
  
  if (isActive) {
    const raised = currencyRaised ? Number(formatUnits(currencyRaised, 18)).toFixed(4) : '0'
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 text-xs font-medium">
        <Clock className="w-3 h-3" />
        CCA ({raised} ETH)
      </span>
    )
  }
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
      <CheckCircle2 className="w-3 h-3" />
      Active
    </span>
  )
}

export function Dashboard() {
  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="font-display text-2xl font-bold">Vaults</h1>
          <p className="text-surface-500 text-sm">Creator-powered yield vaults</p>
        </div>
        <Link to="/launch">
          <button className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
            <Plus className="w-4 h-4" />
            New
          </button>
        </Link>
      </motion.div>

      {/* Stats */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-4 gap-3"
      >
        {[
          { icon: Coins, value: '$420K', label: 'TVL', color: 'text-brand-500' },
          { icon: TrendingUp, value: '42%', label: 'APY', color: 'text-green-500' },
          { icon: Users, value: '1', label: 'Vaults', color: 'text-blue-500' },
          { icon: Gift, value: '0.1 ETH', label: 'Jackpot', color: 'text-yellow-500' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            variants={item}
            className="p-3 rounded-xl bg-surface-900/50 border border-surface-800/50"
          >
            <stat.icon className={`w-4 h-4 ${stat.color} mb-2`} />
            <p className="font-bold text-lg">{stat.value}</p>
            <p className="text-[10px] text-surface-500 uppercase tracking-wider">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Vault List */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-3"
      >
        {vaults.map((vault) => (
          <motion.div key={vault.id} variants={item}>
            <Link to={`/vault/${vault.vault}`}>
              <div className="glass-card p-4 hover:border-brand-500/30 transition-all group">
                <div className="flex items-center gap-4">
                  <TokenImage
                    tokenAddress={vault.token as `0x${string}`}
                    symbol={vault.symbol}
                    size="md"
                    fallbackColor={vault.color}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{vault.name}</h3>
                      <AuctionStatusBadge ccaStrategy={vault.ccaStrategy} />
                    </div>
                    <p className="text-surface-500 text-xs">
                      {vault.symbol} → {vault.wrappedSymbol}
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-6 text-right">
                    <div>
                      <p className="font-semibold">{vault.tvl}</p>
                      <p className="text-[10px] text-surface-500 uppercase">TVL</p>
                    </div>
                    <div>
                      <p className="font-semibold text-green-400">{vault.apy}</p>
                      <p className="text-[10px] text-surface-500 uppercase">APY</p>
                    </div>
                  </div>

                  <ArrowUpRight className="w-4 h-4 text-surface-600 group-hover:text-brand-500 transition-colors" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* Lottery Card with Distribution Chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-4 h-4 text-yellow-500" />
          <span className="font-medium text-sm">Jackpot Distribution</span>
          <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 text-[10px] font-medium">
            VRF
          </span>
        </div>
        
        <LotteryDistributionCompact jackpotAmount={sharedLottery.jackpot} />
        
        <p className="text-[10px] text-surface-500 mt-3 pt-3 border-t border-surface-800">
          6.9% trade fees fund the pool • Every buy = lottery entry
        </p>
      </motion.div>

      {/* Empty State */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="p-6 rounded-xl border border-dashed border-surface-800 text-center"
      >
        <Sparkles className="w-8 h-8 text-surface-600 mx-auto mb-3" />
        <p className="text-surface-400 text-sm mb-3">Have a Creator Coin?</p>
        <Link to="/launch">
          <button className="btn-secondary text-sm px-4 py-2">Create Vault</button>
        </Link>
      </motion.div>
    </div>
  )
}
