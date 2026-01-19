import { useMemo, useState, useEffect } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { CcaAuctionPanelLiveDemo } from '@/components/cca/CcaAuctionPanelLiveDemo'
import { AuctionPriceChart } from '@/components/cca/AuctionPriceChart'
import { AuctionFAQ } from '@/components/cca/AuctionFAQ'
import { AuctionRecentBidsPanel } from '@/components/cca/AuctionRecentBidsPanel'
import { InfoPopover } from '@/components/cca/InfoPopover'
import { toShareSymbol } from '@/lib/tokenSymbols'

function rand(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const a = new Uint32Array(1)
    crypto.getRandomValues(a)
    return a[0]! / 2 ** 32
  }
  return 0.123456789
}

// Generate realistic price history
function generatePriceHistory(count: number = 20) {
  const basePrice = 0.000045
  const history = []
  let currentPrice = basePrice * 0.7 // Start at 70% of current
  
  for (let i = 0; i < count; i++) {
    // Price generally trends up with some volatility
    const trend = (i / count) * basePrice * 0.5
    const volatility = (rand() - 0.5) * basePrice * 0.1
    currentPrice = Math.max(basePrice * 0.5, currentPrice + trend / count + volatility)
    
    history.push({
      time: Date.now() - (count - i) * 300000, // 5 min intervals
      price: currentPrice,
      volume: rand() * 0.5 + 0.1,
    })
  }
  
  return history
}

export default function AuctionDemo() {
  const SHARE_SYMBOL = toShareSymbol('AKITA')
  const [priceHistory, setPriceHistory] = useState(() => generatePriceHistory(20))
  const totalRaised = 12.45
  const bidCount = 47
  const uniqueBidders = useMemo(() => Math.floor(bidCount * 0.6), [bidCount])
  const currentPrice = useMemo(() => {
    return priceHistory[priceHistory.length - 1]?.price ?? 0.000045
  }, [priceHistory])

  // Simulate new bids coming in
  useEffect(() => {
    function shouldTick() {
      return typeof document === 'undefined' ? true : document.visibilityState === 'visible'
    }

    const interval = setInterval(() => {
      if (!shouldTick()) return
      setPriceHistory(prev => {
        const lastPrice = prev[prev.length - 1]?.price || currentPrice
        const newPrice = lastPrice * (1 + (rand() - 0.3) * 0.05) // Slight variation
        
        return [
          ...prev.slice(-19), // Keep last 19 points
          {
            time: Date.now(),
            price: Math.max(currentPrice * 0.8, newPrice),
            volume: rand() * 0.5 + 0.1,
          },
        ]
      })
    }, 15000) // New bid every 15 seconds

    return () => clearInterval(interval)
  }, [currentPrice])

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <main className="flex-1">
        {/* Editorial Hero (CCA-like) */}
        <section className="cinematic-section bg-black">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <div className="flex flex-col gap-8">
              <div className="text-sm text-zinc-500">Continuous Clearing Auctions</div>

              <div className="max-w-4xl">
                <h1 className="headline text-5xl sm:text-6xl tracking-tight leading-[1.02]">
                  <span className="block">The new standard for</span>
                  <span className="block">bootstrapping liquidity</span>
                </h1>
                <p className="mt-6 text-lg sm:text-xl text-zinc-500 leading-relaxed max-w-3xl">
                  DeFi-native, fully onchain price discovery with open participation and transparent settlement.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="#demo"
                  className="inline-flex items-center justify-center rounded-full bg-uniswap px-6 py-3 text-sm font-medium text-white hover:opacity-90 transition"
                >
                  Start here
                </a>
                <a
                  href="https://docs.uniswap.org/contracts/liquidity-launchpad/Overview"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white hover:border-white/30 transition"
                >
                  Read docs <ArrowUpRight className="w-4 h-4 ml-2" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits (CCA-like) */}
        <section className="cinematic-section bg-black border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
            <h2 className="headline text-3xl sm:text-4xl tracking-tight mb-10">
              A better way to distribute your token
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div>
                <h3 className="headline text-lg mb-2">Customizable parameters</h3>
                <p className="text-zinc-500 leading-relaxed">
                  Define supply, duration, and participation rules to fit your distribution goals.
                </p>
              </div>
              <div>
                <h3 className="headline text-lg mb-2">Fully onchain and transparent</h3>
                <p className="text-zinc-500 leading-relaxed">
                  Key parts of market creation run onchain, making the process auditable and verifiable.
                </p>
              </div>
              <div>
                <h3 className="headline text-lg mb-2">Market-driven pricing</h3>
                <p className="text-zinc-500 leading-relaxed">
                  Open participation enables fair price discovery rooted in demand, not insider pricing.
                </p>
              </div>
              <div>
                <h3 className="headline text-lg mb-2">Liquidity from day one</h3>
                <p className="text-zinc-500 leading-relaxed">
                  Discover market value and seed liquidity at the discovered price so trading can begin immediately.
                </p>
              </div>
            </div>

            <div className="mt-10">
              <a
                href="https://docs.uniswap.org/whitepaper_cca.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white/80 hover:text-uniswap transition-colors text-sm"
              >
                <span>Read the whitepaper</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* How it works (CCA-like) */}
        <section className="cinematic-section bg-black border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
            <div className="text-xs tracking-wider text-zinc-500 mb-4">HOW IT WORKS</div>
            <h2 className="headline text-3xl sm:text-4xl tracking-tight mb-10">
              Continuous Clearing Auctions
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div>
                <h3 className="headline text-2xl tracking-tight mb-2">Commit supply</h3>
                <p className="text-zinc-500 leading-relaxed">
                  Projects commit a portion of supply and set core auction parameters.
                </p>
              </div>
              <div>
                <h3 className="headline text-2xl tracking-tight mb-2">Price discovery</h3>
                <p className="text-zinc-500 leading-relaxed">
                  Orders clear continuously, discovering market price as participation evolves.
                </p>
              </div>
              <div>
                <h3 className="headline text-2xl tracking-tight mb-2">Long-term liquidity</h3>
                <p className="text-zinc-500 leading-relaxed">
                  Settlement distributes tokens and seeds liquidity at the discovered price.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Demo section */}
        <section id="demo" className="cinematic-section bg-black border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
            <div className="flex items-end justify-between gap-6 mb-8">
              <div className="max-w-3xl">
                <div className="text-sm text-zinc-500 mb-2">Live Demo</div>
                <h2 className="headline text-3xl sm:text-4xl tracking-tight">
                  Explore price discovery in real time
                </h2>
              </div>
                <div className="hidden sm:flex items-center gap-6 text-sm text-zinc-500">
                  <div><span className="text-white">{bidCount}</span> bids</div>
                  <div><span className="text-white">{uniqueBidders}</span> bidders</div>
                  <div><span className="text-white">{totalRaised.toFixed(2)}</span> ETH raised</div>
                  <div><span className="text-white">25M</span> tokens</div>
                </div>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs tracking-wider text-zinc-500">PRICE DISCOVERY</div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="text-white font-medium">Clearing price timeline</div>
                    <InfoPopover label="Why can the price move down?" title="Why the clearing price can go down" align="left">
                      <div className="space-y-2">
                        <p>
                          This is the <span className="text-white">clearing price</span>, not a “last trade” price. It moves to
                          the level where active demand can clear remaining supply.
                        </p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>New commitments arrive with lower max prices</li>
                          <li>Higher-priced demand fills first; remaining demand supports a lower level</li>
                          <li>Demand slows or commitments are reduced/cancelled</li>
                        </ul>
                      </div>
                    </InfoPopover>
                  </div>
                </div>
                <div className="text-sm text-zinc-500">
                  <span className="text-white font-mono">{currentPrice.toFixed(6)}</span> ETH / token
                </div>
              </div>
              <AuctionPriceChart data={priceHistory} currentPrice={currentPrice} />
            </div>

            <div>
              <CcaAuctionPanelLiveDemo
                tokenSymbol={SHARE_SYMBOL}
                clearingPrice={currentPrice}
                totalRaised={totalRaised}
                tokenSupply={25}
                priceHistory={priceHistory.slice(-15)}
                creator={{
                  address: `0x${'5b674196812451B7cEC024FE9d22D2c0b172fa75'}`,
                  name: 'AKITA',
                  twitter: 'stkmaakita',
                }}
              />
            </div>

            {/* Recent bids (centered relative to the full section, not the left column) */}
            <div className="mt-6">
              <div className="mx-auto w-full max-w-5xl">
                <AuctionRecentBidsPanel />
              </div>
            </div>

            <div className="mt-10 mx-auto w-full max-w-5xl">
              <AuctionFAQ />
            </div>
          </div>
        </section>

        {/* Bottom CTA (CCA-like) */}
        <section className="cinematic-section bg-black border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <div className="bg-black/40 border border-white/10 rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <h2 className="headline text-2xl sm:text-3xl tracking-tight mb-2">
                  Move your token distribution onchain
                </h2>
                <p className="text-zinc-500">
                  Deploy a vault and launch with CCA-style price discovery.
                </p>
              </div>
              <a
                href="/deploy"
                className="inline-flex items-center justify-center rounded-full bg-uniswap px-6 py-3 text-sm font-medium text-white hover:opacity-90 transition"
              >
                Deploy a vault <ArrowUpRight className="w-4 h-4 ml-2" />
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

