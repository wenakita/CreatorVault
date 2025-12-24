import { motion } from 'framer-motion'
import { useMemo } from 'react'

interface PriceDiscoveryChartProps {
  data?: number[] // Array of bid amounts or prices
  currentPrice?: number
  className?: string
}

export function PriceDiscoveryChart({ 
  data, 
  currentPrice,
  className = '' 
}: PriceDiscoveryChartProps) {
  // Generate default data if none provided
  const chartData = useMemo(() => {
    if (data && data.length > 0) return data
    // Default visualization data
    return [30, 35, 42, 55, 68, 85, 70, 50, 40, 30]
  }, [data])

  const maxValue = Math.max(...chartData)
  const currentIndex = Math.floor(chartData.length / 2) // Middle bar as current

  return (
    <div className={`relative h-64 w-full flex items-end gap-1 ${className}`}>
      {chartData.map((value, index) => {
        const height = (value / maxValue) * 100
        const isCurrent = index === currentIndex && currentPrice !== undefined
        
        return (
          <motion.div
            key={index}
            className={`flex-1 relative group cursor-pointer transition-all duration-300 ${
              isCurrent
                ? 'bg-blue-500 shadow-lg shadow-blue-500/20'
                : 'bg-white/5 hover:bg-blue-500/20'
            }`}
            style={{ height: `${height}%` }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: `${height}%`, opacity: 1 }}
            transition={{ 
              duration: 0.5, 
              delay: index * 0.05,
              type: 'spring',
              stiffness: 100 
            }}
            whileHover={{ 
              backgroundColor: isCurrent ? 'rgba(0, 242, 255, 1)' : 'rgba(0, 242, 255, 0.3)',
              scale: 1.05 
            }}
          >
            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="bg-black/90 text-white text-xs font-mono px-2 py-1 rounded whitespace-nowrap">
                {value.toFixed(4)} ETH
              </div>
              <div className="w-2 h-2 bg-black/90 rotate-45 -mt-1 mx-auto"></div>
            </div>
          </motion.div>
        )
      })}
      
      {/* Clearing price line */}
      {currentPrice !== undefined && (
        <motion.div 
          className="absolute bottom-0 left-0 w-full h-px bg-blue-500/50"
          style={{ bottom: `${(currentIndex / chartData.length) * 100}%` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
        />
      )}
    </div>
  )
}

