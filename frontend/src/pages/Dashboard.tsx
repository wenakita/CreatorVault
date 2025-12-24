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
        transition={{ duration: 0.6 }}
        className="card p-8 group hover:bg-zinc-950/50 transition-all duration-300"
      >
        {/* Token Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="transition-opacity group-hover:opacity-70">
            <TokenImage
              tokenAddress={vault.token as `0x${string}`}
              symbol={vault.symbol}
              size="md"
            />
          </div>
          <div>
            <h3 className="headline text-2xl mb-1">{vault.name}</h3>
            <span className="label">{vault.symbol}</span>
          </div>
        </div>

        {/* Status */}
        <div className="mb-6">
          {isActive && (
            <div className="status-active">
              <span className="label text-cyan-400">CCA Active</span>
            </div>
          )}
          {isGraduated && (
            <span className="label">Vault Active</span>
          )}
          {!isActive && !isGraduated && (
            <span className="label">Not Launched</span>
          )}
        </div>

        {/* Stats */}
        {isActive && (
          <div className="space-y-3 mb-6 pb-6 border-b border-zinc-900/50">
            <span className="label">Total Raised</span>
            <div className="value mono text-2xl glow-cyan">
              {formatUnits(currencyRaised, 18)} ETH
            </div>
          </div>
        )}

        {/* Action */}
        <div className="flex items-center gap-2 text-zinc-600 group-hover:text-zinc-400 transition-colors">
          <span className="label">View Vault</span>
          <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
        </div>
      </motion.div>
    </Link>
  )
}

export function Dashboard() {
  return (
    <div className="relative">
      {/* Particle atmosphere */}
      <div className="particles">
        <div className="absolute top-1/4 left-1/3 w-px h-px bg-purple-500 rounded-full" style={{ animation: 'particle-float 8s ease-in-out infinite' }} />
        <div className="absolute top-1/2 right-1/4 w-px h-px bg-cyan-500 rounded-full" style={{ animation: 'particle-float 10s ease-in-out infinite', animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <span className="label">Vault Marketplace</span>
            <h1 className="headline text-7xl lg:text-8xl leading-[1.05]">
              Creator Vaults
            </h1>
            <p className="text-zinc-500 text-xl font-light max-w-2xl">
              Deposit creator coins · Earn yield · Grow together
            </p>
          </motion.div>
        </div>
      </section>

      {/* Token Transformation Flow */}
      <section className="cinematic-section">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16"
          >
            <span className="label">How It Works</span>
            <h2 className="headline text-5xl mt-6">Token Transformation</h2>
          </motion.div>

          <div className="relative">
            {/* Flow Container */}
            <div className="grid lg:grid-cols-3 gap-8 items-center">
              {/* Step 1: Underlying Token */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="card p-8 space-y-6"
              >
                <span className="label">Step 1: Deposit</span>
                <div className="flex items-center justify-center py-8">
                  <TokenImage
                    tokenAddress={AKITA.token as `0x${string}`}
                    symbol="AKITA"
                    size="lg"
                    wrapped={false}
                  />
                </div>
                <div className="text-center space-y-2">
                  <div className="headline text-2xl">AKITA</div>
                  <p className="text-zinc-600 text-sm font-light">Underlying Creator Token</p>
                </div>
                <div className="pt-4 border-t border-zinc-900/50 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Type</span>
                    <span className="value mono">ERC-20</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Status</span>
                    <span className="value mono">Tradeable</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Yield</span>
                    <span className="value mono text-zinc-600">None</span>
                  </div>
                </div>
              </motion.div>

              {/* Arrow */}
              <div className="hidden lg:flex justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                    <ArrowRight className="w-6 h-6 text-purple-400" />
                  </div>
                  <span className="label text-purple-400">Vault Wraps</span>
                </motion.div>
              </div>

              {/* Step 2: ShareOFT Token */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="card p-8 space-y-6 border-purple-500/30"
              >
                <span className="label text-purple-400">Step 2: Receive</span>
                <div className="flex items-center justify-center py-8">
                  <TokenImage
                    tokenAddress={AKITA.token as `0x${string}`}
                    symbol="AKITA"
                    size="lg"
                    wrapped={true}
                  />
                </div>
                <div className="text-center space-y-2">
                  <div className="headline text-2xl glow-purple">wsAKITA</div>
                  <p className="text-zinc-600 text-sm font-light">Vault Share Token (OFT)</p>
                </div>
                <div className="pt-4 border-t border-zinc-900/50 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Type</span>
                    <span className="value mono text-cyan-400">LayerZero OFT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Status</span>
                    <span className="value mono text-cyan-400">Cross-Chain</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Yield</span>
                    <span className="value mono glow-cyan">Auto-Compound</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Strategy Allocation Below */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-12"
            >
              <div className="card p-10 space-y-8">
                <div className="text-center space-y-4">
                  <span className="label">Underlying Assets Deployed To</span>
                  <h3 className="headline text-3xl">Multi-Strategy Allocation</h3>
                  <p className="text-zinc-600 text-sm font-light max-w-2xl mx-auto">
                    Your underlying AKITA tokens are automatically deployed across multiple yield strategies.
                    Your wsAKITA represents proportional ownership of all strategies.
                  </p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-900">
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.5 }}
                    className="bg-black p-8 space-y-4"
                  >
                    <span className="label">Uniswap V3 WETH</span>
                    <div className="value mono text-4xl glow-cyan">25%</div>
                    <p className="text-zinc-700 text-xs font-light">LP Fees + Charm Rebalancing</p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.6 }}
                    className="bg-black p-8 space-y-4"
                  >
                    <span className="label">Stable Pair USDC</span>
                    <div className="value mono text-4xl glow-cyan">25%</div>
                    <p className="text-zinc-700 text-xs font-light">Low Volatility LP Position</p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.7 }}
                    className="bg-black p-8 space-y-4"
                  >
                    <span className="label">Ajna Lending</span>
                    <div className="value mono text-4xl glow-purple">25%</div>
                    <p className="text-zinc-700 text-xs font-light">Permissionless Lending Yield</p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.8 }}
                    className="bg-black p-8 space-y-4"
                  >
                    <span className="label">Idle Reserve</span>
                    <div className="value mono text-4xl">25%</div>
                    <p className="text-zinc-700 text-xs font-light">Available for Withdrawals</p>
                  </motion.div>
                </div>

                {/* Key Difference */}
                <div className="pt-8 border-t border-zinc-900/50">
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <span className="label">You Hold</span>
                      <div className="value mono text-2xl glow-purple">wsAKITA</div>
                      <p className="text-zinc-600 text-sm font-light">
                        Redeemable share token that auto-compounds earnings from all strategies
                      </p>
                    </div>
                    <div className="space-y-3">
                      <span className="label">Vault Holds</span>
                      <div className="value mono text-2xl">AKITA</div>
                      <p className="text-zinc-600 text-sm font-light">
                        Underlying tokens deployed across LP, lending, and reserves
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Vaults */}
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16"
          >
            <span className="label">Available Now</span>
            <h2 className="headline text-5xl mt-6">Active Vaults</h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {vaults.map((vault) => (
              <VaultCard key={vault.id} vault={vault} />
            ))}
          </div>
        </div>
      </section>

      {/* Fee Mechanism */}
      <section className="cinematic-section bg-zinc-950/20">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16"
          >
            <span className="label">Fee Architecture</span>
            <h2 className="headline text-5xl mt-6">How Earnings Work</h2>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Liquidity Pool */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="card p-8 space-y-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="label block mb-4">Trading Pair</span>
                  <div className="headline text-3xl mb-2">wsAKITA/ETH</div>
                  <p className="text-zinc-600 text-sm font-light">Uniswap V3 Liquidity Pool</p>
                </div>
                <div className="text-right">
                  <span className="label block mb-2">Fee Tier</span>
                  <div className="value mono text-2xl">1%</div>
                </div>
              </div>

              <div className="h-px bg-zinc-900" />

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 font-light">Trading Volume</span>
                  <div className="value mono text-sm">Real-time</div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 font-light">LP Rewards</span>
                  <div className="value mono text-sm text-cyan-400">Auto-compound</div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 font-light">Your Share</span>
                  <div className="value mono text-sm text-cyan-400">Proportional</div>
                </div>
              </div>
            </motion.div>

            {/* Fee Distribution */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="card p-8 space-y-6"
            >
              <div>
                <span className="label block mb-4">Buy & Sell Fees</span>
                <div className="headline text-3xl mb-2">6.9% Total</div>
                <p className="text-zinc-600 text-sm font-light">Applied on every trade</p>
              </div>

              <div className="h-px bg-zinc-900" />

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 font-light">To Jackpot</span>
                  <div className="value mono text-sm glow-purple">69%</div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 font-light">Burned</span>
                  <div className="value mono text-sm glow-amber">21.4%</div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 font-light">To Treasury</span>
                  <div className="value mono text-sm">9.6%</div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Flow Diagram */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8"
          >
            <div className="card p-10">
              <span className="label block mb-8">Fee Flow</span>
              
              <div className="space-y-0">
                <div className="data-row group">
                  <div className="flex items-center gap-6">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    </div>
                    <div>
                      <span className="label block mb-1">Trade Executed</span>
                      <p className="text-zinc-600 text-sm font-light">User buys or sells wsAKITA</p>
                    </div>
                  </div>
                  <div className="value mono text-xl">6.9%</div>
                </div>

                <div className="data-row group">
                  <div className="flex items-center gap-6">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-purple-400" />
                    </div>
                    <div>
                      <span className="label block mb-1">Jackpot Funded</span>
                      <p className="text-zinc-600 text-sm font-light">Largest portion goes to global prize pool</p>
                    </div>
                  </div>
                  <div className="value mono text-xl glow-purple">4.8%</div>
                </div>

                <div className="data-row group">
                  <div className="flex items-center gap-6">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                    </div>
                    <div>
                      <span className="label block mb-1">Tokens Burned</span>
                      <p className="text-zinc-600 text-sm font-light">Deflationary mechanism increases value</p>
                    </div>
                  </div>
                  <div className="value mono text-xl glow-amber">1.5%</div>
                </div>

                <div className="data-row border-none group">
                  <div className="flex items-center gap-6">
                    <div className="w-8 h-8 rounded-full bg-zinc-800/50 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-zinc-600" />
                    </div>
                    <div>
                      <span className="label block mb-1">Treasury</span>
                      <p className="text-zinc-600 text-sm font-light">Protocol development and sustainability</p>
                    </div>
                  </div>
                  <div className="value mono text-xl">0.6%</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
