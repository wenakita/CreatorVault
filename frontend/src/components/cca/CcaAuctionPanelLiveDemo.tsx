import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { formatUnits, parseEther, type Address } from 'viem'
import { AuctionPriceChart } from './AuctionPriceChart'
import { CreatorHeaderRow } from './CreatorHeaderRow'
import { Twitter } from 'lucide-react'
import { InfoPopover } from './InfoPopover'

function trimDecimals(value: string, maxDecimals: number): string {
  const [a, b] = value.split('.')
  if (!b) return value
  return `${a}.${b.slice(0, maxDecimals)}`
}

type PricePoint = { time: number; price: number; volume?: number }

interface CcaAuctionPanelLiveDemoProps {
  tokenSymbol: string
  clearingPrice: number
  totalRaised: number
  tokenSupply?: number // Total tokens available for auction (in millions)
  priceHistory: PricePoint[]
  isActive?: boolean
  isConnected?: boolean
  showPriceTimeline?: boolean
  creator?: {
    address: Address
    name: string
    twitter?: string
  }
}

function normalizeHandle(handle?: string) {
  if (!handle) return undefined
  const trimmed = handle.trim()
  if (!trimmed) return undefined
  return trimmed.replace(/^@/, '')
}

export function CcaAuctionPanelLiveDemo({
  tokenSymbol,
  clearingPrice,
  totalRaised,
  tokenSupply = 25, // Default to 25M tokens
  priceHistory,
  isActive = true,
  isConnected = true,
  showPriceTimeline = false,
  creator,
}: CcaAuctionPanelLiveDemoProps) {
  const prefersReducedMotion = useReducedMotion()
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')
  const [spendEth, setSpendEth] = useState('')
  const [maxPriceEthPerToken, setMaxPriceEthPerToken] = useState('')
  const [priceUpdating, setPriceUpdating] = useState(false)

  const clearingPriceWei = useMemo(() => {
    return parseEther(clearingPrice.toString())
  }, [clearingPrice])

  const clearingPriceText = trimDecimals(formatUnits(clearingPriceWei, 18), 6)

  const [spendWei, spendParseError] = useMemo((): [bigint, string | null] => {
    if (!spendEth || spendEth.trim().length === 0) return [0n, null]
    try {
      return [parseEther(spendEth), null]
    } catch (e: any) {
      return [0n, e?.message ?? 'Invalid ETH amount']
    }
  }, [spendEth])

  const maxPriceText = useMemo(() => {
    const basePrice = clearingPrice
    if (mode === 'simple') {
      return (basePrice * 1.2).toFixed(6)
    }
    if (!maxPriceEthPerToken.trim()) {
      return (basePrice * 1.2).toFixed(6)
    }
    try {
      const val = parseFloat(maxPriceEthPerToken)
      return isNaN(val) ? '—' : val.toFixed(6)
    } catch {
      return '—'
    }
  }, [mode, maxPriceEthPerToken])

  const estTokens = useMemo(() => {
    if (!spendWei || spendWei === 0n) return null
    const ethAmount = Number(formatUnits(spendWei, 18))
    const tokens = ethAmount / clearingPrice
    return trimDecimals(tokens.toFixed(18), 2)
  }, [spendWei, clearingPrice])

  // Drive "price updating" highlight from incoming clearingPrice changes.
  useEffect(() => {
    if (prefersReducedMotion) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    setPriceUpdating(true)
    const t = setTimeout(() => setPriceUpdating(false), 650)
    return () => clearTimeout(t)
  }, [clearingPrice, prefersReducedMotion])

  return (
    <div className="card p-0 overflow-hidden">
      {/* Hero Header with LIVE animation */}
      <div className="relative bg-transparent border-b border-white/10 p-6 sm:p-8">

        <div className="relative z-10">
          {creator ? (
            <CreatorHeaderRow
              creatorAddress={creator.address}
              creatorName={creator.name}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="label">Continuous Clearing Auction</span>

                {/* Social icons (strategic placement: near the title, not far right) */}
                {creator.twitter && (
                  <a
                    href={`https://x.com/${normalizeHandle(creator.twitter)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 w-8 h-8 rounded-full border border-white/10 bg-transparent hover:border-uniswap/40 transition-colors inline-flex items-center justify-center"
                    aria-label="Twitter"
                    title="Twitter"
                  >
                    <Twitter className="w-4 h-4 text-zinc-300" />
                  </a>
                )}
              </div>

              <h3 className="headline text-3xl sm:text-4xl tracking-tight mb-2">{tokenSymbol} Price Discovery</h3>

              <div className="flex items-center gap-2 text-zinc-600 text-sm font-light">
                <img
                  src="/protocols/uniswap.png"
                  alt="Uniswap"
                  width={18}
                  height={18}
                  className="w-[18px] h-[18px] object-contain opacity-60"
                  loading="lazy"
                />
                <span>Powered by Uniswap CCA</span>
              </div>
            </CreatorHeaderRow>
          ) : (
            <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="label">Continuous Clearing Auction</span>
              {/* LIVE badge */}
              <motion.div 
                className="flex items-center gap-1.5 bg-uniswap/10 border border-uniswap/20 rounded-full px-3 py-1"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-uniswap"
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : {
                          boxShadow: [
                            '0 0 4px rgba(255, 0, 122, 0.55)',
                            '0 0 10px rgba(255, 0, 122, 0.75)',
                            '0 0 4px rgba(255, 0, 122, 0.55)',
                          ],
                        }
                  }
                  transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity }}
                />
                <span className="text-[10px] uppercase tracking-wider text-uniswap font-medium">Live</span>
              </motion.div>
            </div>
            
            <h3 className="headline text-3xl sm:text-4xl mb-3">{tokenSymbol} Price Discovery</h3>
            
            <div className="flex items-center gap-2 text-zinc-600 text-sm font-light">
              <img
                src="/protocols/uniswap.png"
                alt="Uniswap"
                width={18}
                height={18}
                className="w-[18px] h-[18px] object-contain opacity-60"
                loading="lazy"
              />
              <span>
                Powered by Uniswap CCA
              </span>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Metrics Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/5">
        <motion.div 
          className="bg-black/60 p-6 hover:bg-black/80 transition-colors"
        >
          <div className="label mb-3 flex items-center justify-between">
            <span>Auction Status</span>
            {isActive && (
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-uniswap">
                <span className="w-1.5 h-1.5 rounded-full bg-uniswap" />
                Live
              </span>
            )}
          </div>
          <div className="value text-2xl text-white">{isActive ? 'Active' : 'Inactive'}</div>
        </motion.div>

        <motion.div 
          className="bg-black/60 p-6 hover:bg-black/80 transition-colors relative overflow-hidden"
        >
          <AnimatePresence>
            {priceUpdating && (
              <motion.div
                className="absolute inset-0 bg-uniswap/5"
                initial={{ opacity: 0, x: '-100%' }}
                animate={{ opacity: [0, 1, 0], x: ['0%', '100%'] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
              />
            )}
          </AnimatePresence>
          
          <div className="label mb-3 flex items-center gap-2">
            Clearing Price
            <InfoPopover
              size="sm"
              label="Why can the clearing price move down?"
              title="Clearing price ≠ last trade"
              align="right"
            >
              <div className="space-y-2">
                <p>
                  This price moves to where active demand can clear remaining supply. It can move down even while
                  commitments are coming in.
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>New commitments come in at lower max prices</li>
                  <li>Earlier high-max demand fills first</li>
                  <li>Demand slows or commitments are reduced</li>
                </ul>
              </div>
            </InfoPopover>
            <motion.span 
              className="text-[8px] text-uniswap"
              animate={prefersReducedMotion ? undefined : { opacity: [0.5, 1, 0.5] }}
              transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity }}
            >
              LIVE
            </motion.span>
          </div>
          <div className="value mono text-2xl sm:text-3xl relative z-10 text-white">
            {clearingPriceText}
            <span className="text-zinc-400 text-base ml-2">ETH</span>
          </div>
          <div className="text-zinc-600 text-xs font-light mt-1">per {tokenSymbol}</div>
        </motion.div>

        <motion.div 
          className="bg-black/60 p-6 hover:bg-black/80 transition-colors"
        >
          <div className="label mb-3">Total Raised</div>
          <div className="value mono text-2xl sm:text-3xl">
            {totalRaised.toFixed(2)}
            <span className="text-zinc-400 text-base ml-2">ETH</span>
          </div>
          <div className="text-zinc-600 text-xs font-light mt-1">
            ≈ ${(totalRaised * 3500).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
          </div>
        </motion.div>

        <motion.div 
          className="bg-black/60 p-6 hover:bg-black/80 transition-colors"
        >
          <div className="label mb-3">Token Supply</div>
          <div className="value text-2xl sm:text-3xl text-white">
            {tokenSupply}M
            <span className="text-zinc-400 text-base ml-2">{tokenSymbol}</span>
          </div>
          <div className="text-zinc-600 text-xs font-light mt-1">
            Available for auction
          </div>
        </motion.div>
      </div>

      {/* Price Timeline (optional) */}
      {showPriceTimeline && (
        <div className="border-t border-white/5 bg-black/40 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="label mb-1">Price Timeline</h4>
              <p className="text-zinc-600 text-xs">Real-time updates as bids arrive</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-uniswap" />
              <span className="text-uniswap text-[10px] uppercase tracking-wider">Live</span>
            </div>
          </div>
          <AuctionPriceChart data={priceHistory} currentPrice={clearingPrice} />
        </div>
      )}

      {/* Active Bidding Interface */}
      <div className="p-6 sm:p-8">
        <motion.div 
          className="bg-gradient-to-br from-black/60 to-black/40 border border-white/10 rounded-xl overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Mode selector */}
          <div className="bg-black/40 border-b border-white/5 p-5 flex items-center justify-between gap-4">
            <div>
              <h4 className="label mb-1.5">Place Your Bid</h4>
              <p className="text-zinc-600 text-xs">
                {mode === 'simple' 
                  ? `Simple mode auto-sets max price to ${maxPriceText} ETH (120%)`
                  : 'Advanced mode lets you set a custom max price'
                }
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-zinc-600 font-light">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-uniswap" />
                  <span>Commit ETH + max price</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-uniswap" />
                  <span>Clears over time at the clearing price</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-uniswap" />
                  <span>Claim after settlement (unused ETH returned)</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <motion.button
                className={`px-4 py-2 text-xs font-medium tracking-wide transition-all ${
                  mode === 'simple'
                    ? 'bg-uniswap/15 border border-uniswap/40 text-white'
                    : 'bg-transparent border border-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
                onClick={() => setMode('simple')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Simple
              </motion.button>
              <motion.button
                className={`px-4 py-2 text-xs font-medium tracking-wide transition-all ${
                  mode === 'advanced'
                    ? 'bg-uniswap/15 border border-uniswap/40 text-white'
                    : 'bg-transparent border border-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
                onClick={() => setMode('advanced')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Advanced
              </motion.button>
            </div>
          </div>

          {/* Bid form */}
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Amount input */}
              <div className="space-y-2">
                <label className="label flex items-center justify-between">
                  <span>ETH to Commit</span>
                  <span className="text-[9px] text-zinc-600">ETH</span>
                </label>
                <div className="relative">
                  <input
                    value={spendEth}
                    onChange={(e) => setSpendEth(e.target.value)}
                    placeholder="0.05"
                    className="bg-black/60 border border-white/10 focus:border-uniswap/50 text-white text-xl px-4 py-4 w-full transition-colors font-mono focus:outline-none"
                    inputMode="decimal"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">
                    ETH
                  </div>
                </div>
                <AnimatePresence mode="wait">
                  {spendParseError && (
                    <motion.div 
                      className="text-xs text-red-400 flex items-center gap-1.5"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                    >
                      <span>Invalid</span>
                      <span>{spendParseError}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Estimated tokens */}
              <div className="space-y-2">
                <label className="label flex items-center justify-between">
                  <span>Estimated Allocation</span>
                  <span className="text-[9px] text-zinc-600">{tokenSymbol}</span>
                </label>
                <div className="bg-black/80 border border-white/5 rounded-lg p-4 h-[72px] flex flex-col justify-center">
                  <AnimatePresence mode="wait">
                    {estTokens ? (
                      <motion.div
                        key={estTokens}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="value mono text-2xl text-uniswap"
                      >
                        ≈ {estTokens}
                      </motion.div>
                    ) : (
                      <div className="value mono text-2xl text-zinc-700">—</div>
                    )}
                  </AnimatePresence>
                  <div className="text-zinc-600 text-[10px] font-light mt-1">
                    Claimable after the auction clears · at {clearingPriceText} ETH per token
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced mode */}
            <AnimatePresence>
              {mode === 'advanced' && (
                <motion.div 
                  className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-4 border-t border-white/5"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="space-y-2">
                    <label className="label flex items-center justify-between">
                      <span>Max Price (ETH per token)</span>
                      <span className="text-[9px] text-uniswap">CUSTOM</span>
                    </label>
                    <input
                      value={maxPriceEthPerToken}
                      onChange={(e) => setMaxPriceEthPerToken(e.target.value)}
                      placeholder={clearingPriceText}
                      className="bg-black/60 border border-zinc-700 focus:border-uniswap text-white text-xl px-4 py-4 w-full transition-colors font-mono focus:outline-none"
                      inputMode="decimal"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="label">Effective Max Price</label>
                    <div className="bg-black/80 border border-white/5 rounded-lg p-4 h-[72px] flex flex-col justify-center">
                      <div className="value mono text-2xl text-uniswap">
                        {maxPriceText} ETH
                      </div>
                      <div className="text-zinc-600 text-[10px] font-light mt-1">
                        Q96 fixed-point format
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <motion.button
              className="w-full py-4 text-lg font-light tracking-wide bg-white/5 border-2 border-uniswap/40 text-white hover:bg-uniswap/10 hover:border-uniswap/60 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={!isConnected}
            >
              Commit Bid
            </motion.button>
            <div className="text-[11px] text-zinc-600 font-light">
              Bids commit ETH with a max price. Tokens are distributed after settlement; unused ETH is returned.
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  )
}

