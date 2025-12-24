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
        className="card p-6 hover:border-zinc-800 transition-all group"
      >
        <div className="flex items-center gap-4 mb-6">
          <TokenImage
            tokenAddress={vault.token as `0x${string}`}
            symbol={vault.symbol}
            size="md"
          />
          <div>
            <h3 className="font-semibold text-lg">{vault.name}</h3>
            <p className="text-sm text-zinc-500">{vault.symbol}</p>
          </div>
        </div>

        {/* Status */}
        {isActive && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-sm text-blue-400">CCA Active</span>
          </div>
        )}
        {isGraduated && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 mb-4">
            <span className="text-sm text-zinc-400">Vault Active</span>
          </div>
        )}
        {!isActive && !isGraduated && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 mb-4">
            <span className="text-sm text-zinc-500">Not Launched</span>
          </div>
        )}

        {/* Stats */}
        {isActive && (
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 mb-4">
            <div className="text-sm text-zinc-500 mb-1">Total Raised</div>
            <div className="text-lg font-semibold">
              {formatUnits(currencyRaised, 18)} ETH
            </div>
          </div>
        )}

        {/* Arrow */}
        <div className="flex items-center gap-2 text-sm text-zinc-400 group-hover:text-blue-500 transition-colors">
          <span>View Vault</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </motion.div>
    </Link>
  )
}

export function Dashboard() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-3">Creator Vaults</h1>
        <p className="text-zinc-400">
          Deposit creator coins, earn yield, and participate in community growth
        </p>
      </div>

      {/* How It Works */}
      <div className="card p-8">
        <h2 className="text-xl font-semibold mb-6">How Vault Strategies Work</h2>
        <p className="text-zinc-400 mb-8 text-sm">
          When creators deposit tokens, funds are automatically allocated across multiple yield-generating strategies:
        </p>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5">
            <div className="text-sm text-zinc-500 mb-2">WETH LP</div>
            <div className="text-2xl font-bold text-blue-500">25%</div>
            <div className="text-xs text-zinc-600 mt-2">Uniswap V3 liquidity</div>
          </div>
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5">
            <div className="text-sm text-zinc-500 mb-2">USDC LP</div>
            <div className="text-2xl font-bold text-blue-500">25%</div>
            <div className="text-xs text-zinc-600 mt-2">Stable pair liquidity</div>
          </div>
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5">
            <div className="text-sm text-zinc-500 mb-2">Ajna</div>
            <div className="text-2xl font-bold text-blue-500">25%</div>
            <div className="text-xs text-zinc-600 mt-2">Lending protocol</div>
          </div>
          <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-5">
            <div className="text-sm text-zinc-500 mb-2">Idle</div>
            <div className="text-2xl font-bold">25%</div>
            <div className="text-xs text-zinc-600 mt-2">Available reserve</div>
          </div>
        </div>
      </div>

      {/* Vaults */}
      <div>
        <h2 className="text-2xl font-semibold mb-6">Available Vaults</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {vaults.map((vault) => (
            <VaultCard key={vault.id} vault={vault} />
          ))}
        </div>
      </div>
    </div>
  )
}
