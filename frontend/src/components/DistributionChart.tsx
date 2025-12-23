import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { motion } from 'framer-motion'

interface DistributionData {
  name: string
  value: number
  color: string
  description?: string
}

interface DistributionChartProps {
  data: DistributionData[]
  centerLabel?: string
  centerValue?: string
  height?: number
  className?: string
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-surface-900 border border-surface-700 rounded-xl p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: data.color }}
          />
          <span className="font-semibold text-white">{data.name}</span>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-6">
            <span className="text-surface-400">Share:</span>
            <span className="font-bold" style={{ color: data.color }}>
              {data.value}%
            </span>
          </div>
          {data.description && (
            <p className="text-surface-500 text-xs pt-1 border-t border-surface-800">
              {data.description}
            </p>
          )}
        </div>
      </div>
    )
  }
  return null
}

export function DistributionChart({
  data,
  centerLabel,
  centerValue,
  height = 220,
  className = '',
}: DistributionChartProps) {
  return (
    <div className={`relative ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
            animationBegin={0}
            animationDuration={800}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                className="hover:opacity-80 transition-opacity cursor-pointer"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Center content */}
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerValue && (
            <motion.span
              className="text-xl font-bold text-white"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              {centerValue}
            </motion.span>
          )}
          {centerLabel && (
            <motion.span
              className="text-[10px] text-surface-500 uppercase tracking-wider"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4 }}
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
  name: string
  value: string
  description?: string
}

function LegendItem({ color, name, value, description }: LegendItemProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-surface-800/50 last:border-0">
      <div className="flex items-center gap-2.5">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <div>
          <span className="text-sm font-medium text-white">{name}</span>
          {description && (
            <p className="text-xs text-surface-500">{description}</p>
          )}
        </div>
      </div>
      <span className="text-sm font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

// Pre-built lottery distribution chart
export function LotteryDistributionChart({
  jackpotAmount = '0.1 ETH',
}: {
  jackpotAmount?: string
}) {
  const data: DistributionData[] = [
    {
      name: 'Winner',
      value: 90,
      color: '#eab308',
      description: 'Random VRF draw',
    },
    {
      name: 'Burn',
      value: 5,
      color: '#ef4444',
      description: 'Permanently removed',
    },
    {
      name: 'Protocol',
      value: 5,
      color: '#0052FF',
      description: 'Development fund',
    },
  ]

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="flex-shrink-0">
        <DistributionChart
          data={data}
          centerValue={jackpotAmount}
          centerLabel="Jackpot"
          height={180}
        />
      </div>

      <div className="flex-1 w-full sm:max-w-[200px]">
        {data.map((item) => (
          <LegendItem
            key={item.name}
            color={item.color}
            name={item.name}
            value={`${item.value}%`}
            description={item.description}
          />
        ))}
      </div>
    </div>
  )
}

// Compact version for dashboard
export function LotteryDistributionCompact({
  jackpotAmount = '0.1 ETH',
}: {
  jackpotAmount?: string
}) {
  const data: DistributionData[] = [
    { name: 'Winner', value: 90, color: '#eab308' },
    { name: 'Burn', value: 5, color: '#ef4444' },
    { name: 'Protocol', value: 5, color: '#0052FF' },
  ]

  return (
    <div className="flex items-center gap-4">
      <div className="flex-shrink-0">
        <DistributionChart
          data={data}
          centerValue={jackpotAmount}
          height={100}
          className="w-[100px]"
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-surface-400">{item.name}</span>
            <span className="font-medium text-white">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
