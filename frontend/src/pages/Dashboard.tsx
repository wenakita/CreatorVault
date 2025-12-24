import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { ArrowUpRight } from 'lucide-react'
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
        className="neu-card p-6 hover:translate-y-[-2px] transition-all duration-300 group"
      >
        {/* Token */}
        <div className="flex items-center gap-4 mb-6">
          <div className="neu-card-inset p-3 rounded-xl">
            <TokenImage
              tokenAddress={vault.token as `0x${string}`}
              symbol={vault.symbol}
              size="md"
            />
          </div>
          <div>
            <h3 className="font-semibold text-xl">{vault.name}</h3>
            <p className="text-sm text-zinc-500">{vault.symbol}</p>
          </div>
        </div>

        {/* Status */}
        <div className="mb-6">
          {isActive && (
            <div className="neu-badge inline-flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#0052FF] animate-pulse" />
              <span className="text-[#0052FF]">CCA Active</span>
            </div>
          )}
          {isGraduated && (
            <div className="neu-badge inline-flex items-center gap-2">
              <span className="text-purple-400">CCA Ended</span>
            </div>
          )}
          {!isActive && !isGraduated && (
            <div className="neu-badge inline-flex items-center gap-2">
              <span className="text-zinc-500">Not Launched</span>
            </div>
          )}
        </div>

        {/* Stats */}
        {isActive && (
          <div className="neu-card-inset p-4 rounded-xl mb-6">
            <div className="text-sm text-zinc-400 mb-1">Raised</div>
            <div className="text-xl font-semibold text-white">
              {formatUnits(currencyRaised, 18)} ETH
            </div>
          </div>
        )}

        {/* Arrow */}
        <div className="flex justify-end">
          <div className="neu-dot w-10 h-10 rounded-full flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5 text-zinc-400 group-hover:text-[#0052FF] transition-colors" />
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

export function Dashboard() {
  return (
    <div className="max-w-6xl mx-auto space-y-12 py-12 px-6">
      {/* Header */}
      <div>
        <div className="neu-card p-8 mb-8">
          <h1 className="text-5xl font-bold mb-4">Vaults</h1>
          <p className="text-zinc-400 text-lg">
            Deposit creator tokens. Earn from trading fees.
          </p>
        </div>
      </div>

      {/* How It Works */}
      <div className="neu-card p-8">
        <h2 className="text-2xl font-semibold mb-6">How Vault Strategies Work</h2>
        <p className="text-zinc-400 mb-8">
          When creators deposit tokens, funds are automatically allocated across multiple yield-generating strategies:
        </p>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="neu-card-inset p-5 rounded-xl">
            <div className="text-sm text-zinc-500 mb-2">WETH LP</div>
            <div className="text-2xl font-bold text-[#0052FF]">25%</div>
            <div className="text-xs text-zinc-600 mt-2">Uniswap V3 liquidity</div>
          </div>
          <div className="neu-card-inset p-5 rounded-xl">
            <div className="text-sm text-zinc-500 mb-2">USDC LP</div>
            <div className="text-2xl font-bold text-[#0052FF]">25%</div>
            <div className="text-xs text-zinc-600 mt-2">Stable pair liquidity</div>
          </div>
          <div className="neu-card-inset p-5 rounded-xl">
            <div className="text-sm text-zinc-500 mb-2">Ajna</div>
            <div className="text-2xl font-bold text-[#0052FF]">25%</div>
            <div className="text-xs text-zinc-600 mt-2">Lending protocol</div>
          </div>
          <div className="neu-card-inset p-5 rounded-xl">
            <div className="text-sm text-zinc-500 mb-2">Idle</div>
            <div className="text-2xl font-bold text-purple-500">25%</div>
            <div className="text-xs text-zinc-600 mt-2">Available reserve</div>
          </div>
        </div>
      </div>

      {/* Vaults Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {vaults.map((vault) => (
          <VaultCard key={vault.id} vault={vault} />
        ))}
      </div>
    </div>
  )
}
