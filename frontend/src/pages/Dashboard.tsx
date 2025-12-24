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
        className="card p-6 hover:border-zinc-700 transition-all group"
      >
        {/* Token */}
        <div className="flex items-center gap-3 mb-4">
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
        <div className="mb-4">
          {isActive && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0052FF]/10 border border-[#0052FF]/20">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0052FF] animate-pulse" />
              <span className="text-sm text-[#0052FF]">CCA Active</span>
            </div>
          )}
          {isGraduated && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
              <span className="text-sm text-purple-400">CCA Ended</span>
            </div>
          )}
          {!isActive && !isGraduated && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700">
              <span className="text-sm text-zinc-400">Not Launched</span>
            </div>
          )}
        </div>

        {/* Stats */}
        {isActive && (
          <div className="text-sm text-zinc-400">
            Raised: <span className="text-white font-medium">{formatUnits(currencyRaised, 18)} ETH</span>
          </div>
        )}

        {/* Arrow */}
        <div className="flex justify-end mt-4">
          <ArrowUpRight className="w-5 h-5 text-zinc-600 group-hover:text-[#0052FF] transition-colors" />
        </div>
      </motion.div>
    </Link>
  )
}

export function Dashboard() {
  return (
    <div className="max-w-6xl mx-auto space-y-12 py-12">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-semibold mb-3">Vaults</h1>
        <p className="text-zinc-400 text-lg">
          Deposit creator tokens. Earn from trading fees.
        </p>
      </div>

      {/* Vaults Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vaults.map((vault) => (
          <VaultCard key={vault.id} vault={vault} />
        ))}
      </div>
    </div>
  )
}
