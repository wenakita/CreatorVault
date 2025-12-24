import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
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
  const [carouselPage, setCarouselPage] = useState(0)

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

      {/* Token Transformation + Fee Architecture Carousel */}
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-12"
          >
            <span className="label">How It Works</span>
            <h2 className="headline text-5xl mt-6">Deposit · Wrap · Earn</h2>
          </motion.div>

          {/* Carousel Container */}
          <div className="relative">
            <AnimatePresence mode="wait">
              {carouselPage === 0 && (
                <motion.div
                  key="page-0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4 }}
                >
                  {/* Page 1: Token Transformation */}
                  <div className="grid lg:grid-cols-3 gap-8 items-center mb-12">
                    {/* Step 1: Underlying Token */}
                    <div className="card p-8 space-y-6">
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
                        <p className="text-zinc-600 text-sm font-light">Creator Token</p>
                      </div>
                      <div className="pt-4 border-t border-zinc-900/50 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Type</span>
                          <span className="value mono">ERC-20</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Yield</span>
                          <span className="value mono text-zinc-600">None</span>
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="hidden lg:flex justify-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                          <ArrowRight className="w-6 h-6 text-purple-400" />
                        </div>
                        <span className="label text-purple-400">Vault Wraps</span>
                      </div>
                    </div>

                    {/* Step 2: ShareOFT Token */}
                    <div className="card p-8 space-y-6 border-purple-500/30">
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
                        <p className="text-zinc-600 text-sm font-light">Vault Share (OFT)</p>
                      </div>
                      <div className="pt-4 border-t border-zinc-900/50 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Type</span>
                          <span className="value mono text-cyan-400">OFT</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Yield</span>
                          <span className="value mono glow-cyan">Auto-Compound</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Key Difference */}
                  <div className="card p-10">
                    <div className="grid lg:grid-cols-2 gap-12">
                      <div className="space-y-4">
                        <span className="label">You Hold</span>
                        <div className="value mono text-3xl glow-purple">wsAKITA</div>
                        <p className="text-zinc-600 font-light leading-relaxed">
                          Vault share token that auto-compounds earnings from all underlying strategies
                        </p>
                      </div>
                      <div className="space-y-4">
                        <span className="label">Vault Deploys</span>
                        <div className="value mono text-3xl">AKITA</div>
                        <p className="text-zinc-600 font-light leading-relaxed">
                          Your deposited tokens work across LP, lending, and reserves
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {carouselPage === 1 && (
                <motion.div
                  key="page-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4 }}
                >
                  {/* Page 2: Fee Architecture */}
                  <div className="space-y-8">
                    <div className="grid lg:grid-cols-2 gap-8">
                      {/* Liquidity Pool */}
                      <div className="card p-8 space-y-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="label block mb-4">Trading Pair</span>
                            <div className="headline text-3xl mb-2">wsAKITA/ETH</div>
                            <p className="text-zinc-600 text-sm font-light">Uniswap V4 with Hook</p>
                          </div>
                          <div className="text-right">
                            <span className="label block mb-2">Fee Tier</span>
                            <div className="value mono text-2xl">0.3%</div>
                          </div>
                        </div>

                        <div className="h-px bg-zinc-900" />

                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-zinc-500 font-light">Protocol</span>
                            <div className="value mono text-sm text-cyan-400">Uniswap V4</div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-zinc-500 font-light">Hook Enabled</span>
                            <div className="value mono text-sm text-purple-400">6.9% Tax</div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-zinc-500 font-light">Status</span>
                            <div className="value mono text-sm text-cyan-400">Live Trading</div>
                          </div>
                        </div>
                      </div>

                      {/* Fee Distribution */}
                      <div className="card p-8 space-y-6">
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
                      </div>
                    </div>

                    {/* Flow Diagram */}
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
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Carousel Navigation - Arrows Only */}
            <button
              onClick={() => setCarouselPage((prev) => (prev === 0 ? 1 : 0))}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-4 rounded-full bg-zinc-900/80 hover:bg-purple-900/80 border border-zinc-800 hover:border-purple-500/50 transition-all group"
            >
              <ChevronRight className="w-6 h-6 text-zinc-400 group-hover:text-purple-400 transition-colors" />
            </button>

            {/* Dot Indicators */}
            <div className="flex justify-center gap-3 mt-12">
              <button
                onClick={() => setCarouselPage(0)}
                className={`transition-all ${
                  carouselPage === 0
                    ? 'w-8 h-2 bg-purple-500'
                    : 'w-2 h-2 bg-zinc-700 hover:bg-zinc-600'
                } rounded-full`}
              />
              <button
                onClick={() => setCarouselPage(1)}
                className={`transition-all ${
                  carouselPage === 1
                    ? 'w-8 h-2 bg-purple-500'
                    : 'w-2 h-2 bg-zinc-700 hover:bg-zinc-600'
                } rounded-full`}
              />
            </div>
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

    </div>
  )
}
