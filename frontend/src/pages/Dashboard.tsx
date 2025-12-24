import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import {
  ArrowUpRight,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react'
import { AKITA } from '../config/contracts'
import { TokenImage } from '../components/TokenImage'

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

// Vault data - all stats from blockchain
const vaults = [
  {
    id: 'akita',
    name: 'AKITA',
    symbol: 'AKITA',
    wrappedSymbol: 'wsAKITA',
    token: AKITA.token,
    vault: AKITA.vault,
    ccaStrategy: AKITA.ccaStrategy,
    status: 'active' as const,
    color: 'from-orange-500 to-red-600',
  },
]

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

function VaultPhaseCard({ ccaStrategy }: { ccaStrategy: string }) {
  const { isActive, isGraduated, currencyRaised } = useAuctionStatus(ccaStrategy)
  
  // CCA Phase - Needs Completion
  if (isGraduated) {
    return (
      <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-orange-400" />
          <span className="font-semibold text-orange-400 text-sm">CCA Ended</span>
        </div>
        <p className="text-xs text-orange-300/80 mb-2">
          Auction complete. Needs finalization.
        </p>
        <Link 
          to={`/complete-auction/${ccaStrategy}`}
          className="text-xs text-orange-400 hover:text-orange-300 font-medium underline"
        >
          Complete Auction →
        </Link>
      </div>
    )
  }
  
  // CCA Phase - Active (7 days)
  if (isActive) {
    const raised = currencyRaised ? Number(formatUnits(currencyRaised, 18)).toFixed(4) : '0'
    return (
      <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/30">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-brand-400" />
          <span className="font-semibold text-brand-400 text-sm">CCA Phase</span>
        </div>
        <p className="text-xs text-brand-300/80 mb-1">
          7-day launch auction
        </p>
        <div className="flex items-baseline gap-1">
          <span className="text-white font-bold text-lg">{raised}</span>
          <span className="text-slate-400 text-xs">ETH raised</span>
        </div>
      </div>
    )
  }
  
  // Active Trading Phase
  return (
    <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="w-4 h-4 text-green-400" />
        <span className="font-semibold text-green-400 text-sm">Active</span>
      </div>
      <p className="text-xs text-green-300/80">
        Deposit & earn from trading fees
      </p>
    </div>
  )
}

export function Dashboard() {
  return (
    <div className="space-y-8 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-display text-3xl font-bold">Discover Vaults</h1>
          <Link to="/launch">
            <button className="btn-secondary flex items-center gap-2 text-sm px-4 py-2">
              <Plus className="w-4 h-4" />
              Create Vault
            </button>
          </Link>
        </div>
        <p className="text-slate-400 text-lg mb-3">
          Choose a vault. Deposit tokens. Earn from trading fees.
        </p>
        
        {/* Phase Explainer */}
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
          <Clock className="w-4 h-4 text-slate-500" />
          <p className="text-slate-500 text-xs">
            New vaults start with a <span className="text-brand-400 font-medium">7-day CCA launch phase</span>
          </p>
        </div>
      </motion.div>


      {/* Vault Cards - Marketplace Style */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Available Vaults</h2>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {vaults.map((vault) => (
            <motion.div key={vault.id} variants={item}>
              <Link to={`/vault/${vault.vault}`}>
                <div className="relative p-6 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl hover:border-brand-500/30 hover:bg-white/[0.04] transition-all group">
                  {/* Token Image & Name */}
                  <div className="flex items-center gap-3 mb-4">
                    <TokenImage
                      tokenAddress={vault.token as `0x${string}`}
                      symbol={vault.symbol}
                      size="lg"
                      fallbackColor={vault.color}
                    />
                    <div className="flex-1">
                      <h3 className="font-bold text-xl text-white mb-1">{vault.name}</h3>
                      <p className="text-slate-500 text-xs">
                        {vault.symbol}
                      </p>
                    </div>
                  </div>

                  {/* Phase Card - Prominent */}
                  <div className="mb-4">
                    <VaultPhaseCard ccaStrategy={vault.ccaStrategy} />
                  </div>

                  {/* View Details */}
                  <div className="flex items-center justify-end text-sm">
                    <div className="flex items-center gap-1 text-brand-500 group-hover:gap-2 transition-all">
                      <span className="font-medium text-sm">View Details</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Hover Glow */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/0 to-brand-500/0 group-hover:from-brand-500/5 group-hover:to-purple-500/5 transition-all pointer-events-none" />
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Creator CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="relative p-8 rounded-2xl bg-gradient-to-br from-purple-500/10 via-transparent to-transparent border border-purple-500/20 backdrop-blur-xl overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
        
        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-white mb-1">Have a Creator Coin?</h3>
              <p className="text-slate-400 text-sm">Launch a vault and let your community earn with you</p>
            </div>
          </div>
          <Link to="/launch">
            <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:scale-105 transition-transform whitespace-nowrap">
              Create Vault
            </button>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
