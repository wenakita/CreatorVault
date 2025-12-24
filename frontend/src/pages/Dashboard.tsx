import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useReadContract } from 'wagmi'
import { formatUnits, formatEther } from 'viem'
import {
  ArrowUpRight,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Zap,
  Target,
} from 'lucide-react'
import { AKITA } from '../config/contracts'
import { TokenImage } from '../components/TokenImage'
import { BasinCard } from '../components/BasinCard'
import { ManifoldBackground } from '../components/ManifoldBackground'
import { TechnicalMetric, MetricGrid } from '../components/TechnicalMetric'

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
      <div className="p-4 bg-copper-bright/10 border border-copper-bright/30">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-copper-bright" />
          <span className="font-semibold font-mono text-copper-bright text-xs uppercase tracking-wider">
            CCA Ended
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
          Auction complete. Needs finalization.
        </p>
        <Link 
          to={`/complete-auction/${ccaStrategy}`}
          className="inline-flex items-center gap-1 text-xs text-copper-bright hover:text-copper-bright/80 font-mono transition-colors"
        >
          Complete Auction <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    )
  }
  
  // CCA Phase - Active (7 days)
  if (isActive) {
    const raised = currencyRaised ? Number(formatUnits(currencyRaised, 18)).toFixed(4) : '0'
    return (
      <div className="relative p-4 bg-tension-cyan/5 border border-tension-cyan/30 overflow-hidden">
        {/* Animated pulse */}
        <div className="absolute top-0 right-0 w-2 h-2 bg-tension-cyan rounded-full animate-pulse shadow-glow-cyan" />
        
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-tension-cyan" />
          <span className="font-semibold font-mono text-tension-cyan text-xs uppercase tracking-wider">
            CCA Phase
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
          7-day launch auction
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-white font-bold font-mono text-xl">{raised}</span>
          <span className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">ETH Raised</span>
        </div>
      </div>
    )
  }
  
  // Active Trading Phase
  return (
    <div className="p-4 bg-magma-mint/5 border border-magma-mint/30">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="w-4 h-4 text-magma-mint" />
        <span className="font-semibold font-mono text-magma-mint text-xs uppercase tracking-wider">
          Active
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        Deposit & earn from trading fees
      </p>
    </div>
  )
}

export function Dashboard() {
  return (
    <div className="relative space-y-8 py-6">
      {/* Manifold Background */}
      <ManifoldBackground opacity={0.08} variant="default" />
      
      {/* Wire Grid */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.015] z-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 bg-magma-mint rounded-full" />
              <span className="text-xs font-mono uppercase tracking-[0.3em] text-magma-mint/80">
                Vault Discovery
              </span>
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
              Discover Vaults
            </h1>
          </div>
          <Link to="/launch">
            <button className="bg-tension-cyan hover:bg-tension-cyan/90 text-black px-5 py-2.5 text-sm font-mono uppercase tracking-wider transition-all border border-tension-cyan/30 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Vault
            </button>
          </Link>
        </div>
        <p className="text-slate-400 text-base mb-6 font-light max-w-2xl">
          Choose a vault. Deposit tokens. Earn from trading fees.
        </p>
        
        {/* Phase Explainer */}
        <div className="inline-flex items-center gap-3 px-4 py-3 bg-basalt/50 backdrop-blur-sm border border-basalt-light">
          <Target className="w-4 h-4 text-tension-cyan" />
          <p className="text-slate-400 text-sm font-light">
            New vaults start with a <span className="text-tension-cyan font-medium font-mono">7-day CCA launch phase</span>
          </p>
        </div>
      </motion.div>


      {/* Vault Cards - Marketplace Style */}
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-1.5 bg-magma-mint rounded-full" />
          <h2 className="text-xl font-bold font-mono uppercase tracking-wider text-white">
            Available Vaults
          </h2>
        </div>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {vaults.map((vault) => (
            <motion.div key={vault.id} variants={item}>
              <Link to={`/vault/${vault.vault}`}>
                <div className="relative bg-basalt/80 backdrop-blur-md border border-basalt-light hover:border-magma-mint/30 transition-all duration-300 hover:-translate-y-1 group overflow-hidden shadow-void hover:shadow-glow-mint/20">
                  {/* Top accent line */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-magma-mint/30 to-transparent" />
                  
                  <div className="p-6">
                    {/* Token Image & Name */}
                    <div className="flex items-center gap-4 mb-5">
                      <TokenImage
                        tokenAddress={vault.token as `0x${string}`}
                        symbol={vault.symbol}
                        size="lg"
                        fallbackColor={vault.color}
                      />
                      <div className="flex-1">
                        <h3 className="font-bold text-xl text-white mb-1 tracking-tight">{vault.name}</h3>
                        <p className="text-slate-500 text-xs font-mono uppercase tracking-wider">
                          {vault.symbol}
                        </p>
                      </div>
                    </div>

                    {/* Phase Card - Prominent */}
                    <div className="mb-5">
                      <VaultPhaseCard ccaStrategy={vault.ccaStrategy} />
                    </div>

                    {/* View Details */}
                    <div className="flex items-center justify-end">
                      <div className="flex items-center gap-1 text-tension-cyan group-hover:gap-2 transition-all font-mono text-xs uppercase tracking-wider">
                        <span>View Details</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  {/* Grain overlay */}
                  <div 
                    className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='filter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23filter)'/%3E%3C/svg%3E")` }}
                  />
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
