import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { ArrowRight } from 'lucide-react'
import { AKITA } from '../config/contracts'
import { TokenImage } from '../components/TokenImage'

// CCA Strategy ABI
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

const vaults = [
  {
    id: 'akita',
    name: 'AKITA',
    symbol: 'AKITA',
    token: AKITA.token,
    vault: AKITA.vault,
    ccaStrategy: AKITA.ccaStrategy,
  },
]

function VaultCard({ vault }: { vault: typeof vaults[0] }) {
  const { data: auctionStatus } = useReadContract({
    address: vault.ccaStrategy as `0x${string}`,
    abi: CCA_STRATEGY_ABI,
    functionName: 'getAuctionStatus',
  })

  const isActive = auctionStatus?.[1] || false
  const isGraduated = auctionStatus?.[2] || false
  const currencyRaised = auctionStatus?.[4] || 0n

  return (
    <Link to={`/vault/${vault.vault}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -6 }}
        transition={{ duration: 0.2 }}
        className="card p-8 group"
      >
        <div className="flex items-center gap-5 mb-7">
          <div className="relative transition-transform group-hover:scale-110 group-hover:rotate-3">
            <TokenImage
              tokenAddress={vault.token as `0x${string}`}
              symbol={vault.symbol}
              size="md"
            />
          </div>
          <div>
            <h3 className="font-semibold text-2xl tracking-tight mb-1">{vault.name}</h3>
            <p className="text-sm text-zinc-500 font-medium">{vault.symbol}</p>
          </div>
        </div>

        {/* Status */}
        {isActive && (
          <div className="badge bg-blue-500/10 border-blue-500/20 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            <span className="text-blue-400 font-semibold">CCA Active</span>
          </div>
        )}
        {isGraduated && (
          <div className="badge mb-6">
            <span className="text-zinc-400 font-semibold">Vault Active</span>
          </div>
        )}
        {!isActive && !isGraduated && (
          <div className="badge mb-6">
            <span className="text-zinc-500 font-semibold">Not Launched</span>
          </div>
        )}

        {/* Stats */}
        {isActive && (
          <div className="stat-card mb-6">
            <div className="text-sm font-medium text-zinc-500 mb-2">Total Raised</div>
            <div className="text-2xl font-bold text-gradient-blue">
              {formatUnits(currencyRaised, 18)} ETH
            </div>
          </div>
        )}

        {/* Arrow */}
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-400 group-hover:text-blue-500 transition-colors">
          <span>View Vault</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
        </div>
      </motion.div>
    </Link>
  )
}

export function Dashboard() {
  return (
    <div className="relative max-w-7xl mx-auto px-6 py-20 space-y-24">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] animate-gradient" />
      </div>

      {/* Header */}
      <div className="relative space-y-6">
        <h1 className="text-6xl lg:text-7xl font-bold tracking-[-0.02em]">Creator Vaults</h1>
        <p className="text-zinc-400 text-xl lg:text-2xl max-w-3xl leading-relaxed font-light">
          Deposit creator coins, earn yield, and participate in community growth
        </p>
      </div>

      {/* How It Works */}
      <div className="relative card p-12 lg:p-16">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-transparent" />
        
        <h2 className="text-3xl lg:text-4xl font-semibold mb-6 tracking-tight">How Vault Strategies Work</h2>
        <p className="text-zinc-400 mb-12 text-lg lg:text-xl leading-relaxed font-light max-w-3xl">
          When creators deposit tokens, funds are automatically allocated across multiple yield-generating strategies:
        </p>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="stat-card group">
            <div className="text-sm font-medium text-zinc-500 mb-4">WETH LP</div>
            <div className="text-4xl font-bold text-gradient-blue mb-3 group-hover:scale-110 transition-transform">25%</div>
            <div className="text-sm text-zinc-500 leading-relaxed">Uniswap V3 liquidity</div>
          </div>
          <div className="stat-card group">
            <div className="text-sm font-medium text-zinc-500 mb-4">USDC LP</div>
            <div className="text-4xl font-bold text-gradient-blue mb-3 group-hover:scale-110 transition-transform">25%</div>
            <div className="text-sm text-zinc-500 leading-relaxed">Stable pair liquidity</div>
          </div>
          <div className="stat-card group">
            <div className="text-sm font-medium text-zinc-500 mb-4">Ajna</div>
            <div className="text-4xl font-bold text-gradient-blue mb-3 group-hover:scale-110 transition-transform">25%</div>
            <div className="text-sm text-zinc-500 leading-relaxed">Lending protocol</div>
          </div>
          <div className="stat-card group">
            <div className="text-sm font-medium text-zinc-500 mb-4">Idle</div>
            <div className="text-4xl font-bold mb-3 group-hover:scale-110 transition-transform">25%</div>
            <div className="text-sm text-zinc-500 leading-relaxed">Available reserve</div>
          </div>
        </div>
      </div>

      {/* Vaults */}
      <div className="relative">
        <h2 className="text-4xl font-semibold mb-10 tracking-tight">Available Vaults</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {vaults.map((vault) => (
            <VaultCard key={vault.id} vault={vault} />
          ))}
        </div>
      </div>
    </div>
  )
}
