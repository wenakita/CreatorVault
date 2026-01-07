import { motion } from 'framer-motion'
import { useMemo } from 'react'

interface PricePoint {
  time: number // timestamp
  price: number // ETH per token
  volume?: number // optional bid volume
}

interface AuctionPriceChartProps {
  data: PricePoint[]
  currentPrice: number
  className?: string
}

export function AuctionPriceChart({ 
  data, 
  currentPrice,
  className = '' 
}: AuctionPriceChartProps) {
  const { points, maxPrice, minPrice, priceRange } = useMemo(() => {
    if (data.length === 0) {
      return { points: [], maxPrice: 0, minPrice: 0, priceRange: 0 }
    }

    const prices = data.map(d => d.price)
    const max = Math.max(...prices, currentPrice)
    const min = Math.min(...prices, currentPrice)
    const rawRange = max - min || max * 0.1 // 10% range if flat
    
    // Add 50% padding to top and bottom for better visibility
    const padding = rawRange * 0.5
    const paddedMax = max + padding
    const paddedMin = Math.max(0, min - padding) // Don't go below 0
    const paddedRange = paddedMax - paddedMin

    return {
      points: data,
      maxPrice: paddedMax,
      minPrice: paddedMin,
      priceRange: paddedRange,
    }
  }, [data, currentPrice])

  const chartPoints = useMemo(() => {
    if (points.length === 0) return ''
    
    const width = 100
    const height = 100
    const leftPadding = 10
    const rightPadding = 5
    const topPadding = 5
    const bottomPadding = 5

    return points.map((point, i) => {
      const x = (i / (points.length - 1 || 1)) * (width - leftPadding - rightPadding) + leftPadding
      const y = height - bottomPadding - ((point.price - minPrice) / priceRange) * (height - topPadding - bottomPadding)
      return `${x},${y}`
    }).join(' ')
  }, [points, minPrice, priceRange])

  const currentPriceY = useMemo(() => {
    if (!priceRange) return 50
    const topPadding = 5
    const bottomPadding = 5
    return 100 - bottomPadding - ((currentPrice - minPrice) / priceRange) * (100 - topPadding - bottomPadding)
  }, [currentPrice, minPrice, priceRange])

  if (data.length === 0) {
    return (
      <div className={`relative h-72 w-full flex items-center justify-center ${className}`}>
        <div className="text-zinc-600 text-sm">No price history yet</div>
      </div>
    )
  }

  return (
    <div className={`relative h-72 w-full ${className}`}>
      {/* Background grid */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Y-axis line */}
        <line
          x1="10"
          y1="5"
          x2="10"
          y2="95"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="0.15"
        />
        
        {/* X-axis line */}
        <line
          x1="10"
          y1="95"
          x2="95"
          y2="95"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="0.15"
        />
        
        {/* Horizontal grid lines */}
        {[25, 50, 75].map((y) => (
          <line
            key={`h-${y}`}
            x1="10"
            y1={y}
            x2="95"
            y2={y}
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="0.2"
            strokeDasharray="1,2"
          />
        ))}
        
        {/* Vertical grid lines */}
        {[30, 50, 70].map((x) => (
          <line
            key={`v-${x}`}
            x1={x}
            y1="5"
            x2={x}
            y2="95"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="0.2"
            strokeDasharray="1,2"
          />
        ))}

        {/* Price area fill */}
        <motion.polygon
          points={`10,95 ${chartPoints} 95,95`}
          fill="url(#priceGradient)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 0.8 }}
        />

        {/* Price line */}
        <motion.polyline
          points={chartPoints}
          fill="none"
          stroke="#ff007a"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />

        {/* Data points - elegant minimal dots */}
        {points.map((point, i) => {
          const x = (i / (points.length - 1 || 1)) * 85 + 10
          const y = 95 - ((point.price - minPrice) / priceRange) * 90
          
          return (
            <motion.g
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: "easeOut" }}
            >
              {/* Subtle glow ring */}
              <circle
                cx={x}
                cy={y}
                r="0.6"
                fill="#ff007a"
                opacity="0.15"
              />
              
              {/* Main dot */}
              <circle
                cx={x}
                cy={y}
                r="0.35"
                fill="#ff007a"
                opacity="0.85"
              />
              
              {/* Subtle pulse on most recent point only */}
              {i === points.length - 1 && (
                <motion.circle
                  cx={x}
                  cy={y}
                  r="0.8"
                  fill="none"
                  stroke="#ff007a"
                  strokeWidth="0.15"
                  opacity="0.6"
                  initial={{ scale: 0.5, opacity: 0.6 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeOut"
                  }}
                />
              )}
            </motion.g>
          )
        })}


        {/* Current price line */}
        <motion.line
          x1="10"
          y1={currentPriceY}
          x2="95"
          y2={currentPriceY}
          stroke="#ff007a"
          strokeWidth="0.3"
          strokeDasharray="2,2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 0.5, delay: 1 }}
        />

        {/* Gradient definitions */}
        <defs>
          <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff007a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ff007a" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Y-axis labels (price) - left side */}
      <div className="absolute left-0 top-0 flex flex-col justify-between h-full py-2 pr-2">
        <div className="text-[9px] text-zinc-500 font-mono text-right">
          {maxPrice.toFixed(6)}
        </div>
        <div className="text-[9px] text-zinc-500 font-mono text-right">
          {((maxPrice + minPrice) / 2).toFixed(6)}
        </div>
        <div className="text-[9px] text-zinc-500 font-mono text-right mb-1">
          {minPrice.toFixed(6)}
        </div>
      </div>

      {/* X-axis labels (time) - bottom */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between items-end px-12 pb-1">
        <div className="text-[9px] text-zinc-500">
          {points.length > 0 ? `${Math.floor((Date.now() - points[0].time) / 60000)}m ago` : ''}
        </div>
        <div className="text-[9px] text-zinc-500">now</div>
      </div>

      {/* Price labels - top right */}
      <div className="absolute top-2 right-2 text-right">
        <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Current</div>
        <div className="text-uniswap font-mono text-sm font-medium">
          {currentPrice.toFixed(6)} ETH
        </div>
      </div>

      {/* Bid count - bottom right */}
      <div className="absolute bottom-2 right-2">
        <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
          {points.length} bids
        </div>
      </div>
    </div>
  )
}

