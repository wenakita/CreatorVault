function safeRandomHex(bytes: number): string {
  const n = Math.max(1, Math.min(64, Math.floor(bytes)))
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint8Array(n)
    crypto.getRandomValues(arr)
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  // Fallback: deterministic (demo-only)
  return '00'.repeat(n)
}

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useState, useEffect } from 'react'

interface Bid {
  id: string
  address: string
  amount: number // ETH committed
  maxPriceEthPerToken: number
  timestamp: number
  txHash: string
}

function rand(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const a = new Uint32Array(1)
    crypto.getRandomValues(a)
    return a[0]! / 2 ** 32
  }
  return 0.123456789
}

function randInt(maxExclusive: number): number {
  const m = Math.max(1, Math.floor(maxExclusive))
  return Math.floor(rand() * m)
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${randInt(1_000_000_000)}`
}

// Generate mock recent commitments (CCA bids are commitments that settle later)
function generateMockBid(): Bid {
  const addresses = [
    '0x1234...5678',
    '0xabcd...ef12',
    '0x9876...4321',
    '0xdead...beef',
    '0xcafe...babe',
    '0x1111...2222',
  ]
  
  return {
    id: randomId(),
    address: addresses[randInt(addresses.length)],
    amount: rand() * 0.5 + 0.01,
    // "Max price" is what the bidder is willing to pay per token (simulated)
    maxPriceEthPerToken: 0.00004 + rand() * 0.00004,
    timestamp: Date.now(),
    txHash: `0x${safeRandomHex(32)}`,
  }
}

export function RecentBidsActivity({
  showLive = true,
  variant = 'card',
}: {
  showLive?: boolean
  variant?: 'card' | 'embedded'
}) {
  const prefersReducedMotion = useReducedMotion()
  const [bids, setBids] = useState<Bid[]>(() =>
    Array.from({ length: 5 }, generateMockBid).sort((a, b) => b.timestamp - a.timestamp)
  )

    // Simulate new commitments arriving
  useEffect(() => {
    if (!showLive) return

    const interval = setInterval(() => {
      const newBid = generateMockBid()
      setBids(prev => [newBid, ...prev.slice(0, 4)])
    }, rand() * 15000 + 10000) // 10-25 seconds

    return () => clearInterval(interval)
  }, [showLive])

  const formatTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  const wrapperClass =
    variant === 'embedded'
      ? 'bg-transparent border border-white/10 rounded-2xl p-6'
      : 'bg-zinc-900/50 border border-zinc-800 rounded-xl p-6'

  const listClass = 'space-y-2'

  const footerBorderClass = variant === 'embedded' ? 'border-white/10' : 'border-zinc-800'

  const rowMotion =
    variant === 'embedded'
      ? {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: 8 },
          transition: { duration: 0.2 },
        }
      : {
          initial: { opacity: 0, x: -20, height: 0 },
          animate: { opacity: 1, x: 0, height: 'auto' },
          exit: { opacity: 0, x: 20, height: 0 },
          transition: { duration: 0.3 },
        }

  return (
    <div className={wrapperClass}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="headline text-lg mb-1">Recent Commitments</h4>
          <p className="text-zinc-600 text-xs">
            Commitments settle later; tokens are claimable after the auction clears
          </p>
        </div>
        {showLive && (
          <div className="flex items-center gap-2">
            <motion.div
              className="w-2 h-2 rounded-full bg-uniswap"
              animate={
                prefersReducedMotion
                  ? undefined
                  : { 
                      boxShadow: [
                        '0 0 4px rgba(255, 0, 122, 0.55)',
                        '0 0 12px rgba(255, 0, 122, 0.75)',
                        '0 0 4px rgba(255, 0, 122, 0.55)',
                      ]
                    }
              }
              transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity }}
            />
            <span className="text-uniswap text-xs uppercase tracking-wider">Live</span>
          </div>
        )}
      </div>

      <div className={listClass}>
        <AnimatePresence mode="popLayout">
          {bids.map((bid) => (
            <motion.div
              key={bid.id}
              initial={rowMotion.initial}
              animate={rowMotion.animate}
              exit={rowMotion.exit}
              transition={rowMotion.transition}
              className="bg-black/60 border border-zinc-800 rounded-lg p-3 hover:border-uniswap/30 transition-colors group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-uniswap/15 border border-uniswap/25 flex items-center justify-center">
                      <span className="text-uniswap text-[10px] font-bold">
                        {bid.address.slice(2, 3).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-zinc-400 text-sm font-mono">{bid.address}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="text-white font-medium">Commit {bid.amount.toFixed(4)} ETH</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-400">
                      Max <span className="font-mono">{bid.maxPriceEthPerToken.toFixed(6)}</span> ETH/token
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
                    {formatTime(bid.timestamp)}
                  </div>
                  <a
                    href={`https://basescan.org/tx/${bid.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-uniswap hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                  >
                    View TX ↗
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <motion.div 
        className={`mt-4 pt-4 border-t ${footerBorderClass} flex items-center justify-center gap-2 text-xs text-zinc-500`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <span className="w-1 h-1 rounded-full bg-uniswap" />
        <span>Join {40 + randInt(10)} other participants</span>
      </motion.div>
    </div>
  )
}

