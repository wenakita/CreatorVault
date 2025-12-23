import { motion } from 'framer-motion'

interface Segment {
  label: string
  value: number
  color: string
  icon?: React.ReactNode
}

interface DistributionChartProps {
  segments: Segment[]
  size?: number
  strokeWidth?: number
  centerLabel?: string
  centerValue?: string
  className?: string
}

export function DistributionChart({
  segments,
  size = 180,
  strokeWidth = 24,
  centerLabel,
  centerValue,
  className = '',
}: DistributionChartProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  // Calculate cumulative offsets for each segment
  let cumulativePercent = 0
  const segmentData = segments.map((segment) => {
    const startPercent = cumulativePercent
    cumulativePercent += segment.value
    return {
      ...segment,
      startPercent,
      dashArray: `${(segment.value / 100) * circumference} ${circumference}`,
      dashOffset: -((startPercent / 100) * circumference),
    }
  })

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-800/50"
        />
        
        {/* Animated segments */}
        {segmentData.map((segment, index) => (
          <motion.circle
            key={segment.label}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={segment.dashArray}
            strokeDashoffset={segment.dashOffset}
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: segment.dashArray }}
            transition={{
              duration: 0.8,
              delay: index * 0.15,
              ease: [0.4, 0, 0.2, 1],
            }}
          />
        ))}
      </svg>

      {/* Center content */}
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && (
            <motion.span
              className="text-2xl font-bold text-white"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              {centerValue}
            </motion.span>
          )}
          {centerLabel && (
            <motion.span
              className="text-xs text-surface-500 uppercase tracking-wider"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.6 }}
            >
              {centerLabel}
            </motion.span>
          )}
        </div>
      )}
    </div>
  )
}

interface LegendItemProps {
  color: string
  label: string
  value: string
  description?: string
}

function LegendItem({ color, label, value, description }: LegendItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{label}</span>
          <span className="text-sm text-surface-400">{value}</span>
        </div>
        {description && (
          <p className="text-xs text-surface-500 truncate">{description}</p>
        )}
      </div>
    </div>
  )
}

// Pre-built lottery distribution chart
export function LotteryDistributionChart({ jackpotAmount = '0.1 ETH' }: { jackpotAmount?: string }) {
  const segments: Segment[] = [
    { label: 'Winner', value: 90, color: '#eab308' }, // yellow-500
    { label: 'Burn', value: 5, color: '#ef4444' },    // red-500
    { label: 'Protocol', value: 5, color: '#0052FF' }, // brand blue
  ]

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <DistributionChart
        segments={segments}
        size={160}
        strokeWidth={20}
        centerValue={jackpotAmount}
        centerLabel="Jackpot"
      />
      
      <div className="flex-1 space-y-3 min-w-0">
        <LegendItem
          color="#eab308"
          label="Winner"
          value="90%"
          description="Random VRF draw"
        />
        <LegendItem
          color="#ef4444"
          label="Burn"
          value="5%"
          description="Permanently removed"
        />
        <LegendItem
          color="#0052FF"
          label="Protocol"
          value="5%"
          description="Development fund"
        />
      </div>
    </div>
  )
}

// Compact version for dashboard
export function LotteryDistributionCompact({ jackpotAmount = '0.1 ETH' }: { jackpotAmount?: string }) {
  const segments: Segment[] = [
    { label: 'Winner', value: 90, color: '#eab308' },
    { label: 'Burn', value: 5, color: '#ef4444' },
    { label: 'Protocol', value: 5, color: '#0052FF' },
  ]

  return (
    <div className="flex items-center gap-4">
      <DistributionChart
        segments={segments}
        size={80}
        strokeWidth={10}
        centerValue={jackpotAmount}
        className="flex-shrink-0"
      />
      
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-surface-400">{seg.label}</span>
            <span className="font-medium">{seg.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

