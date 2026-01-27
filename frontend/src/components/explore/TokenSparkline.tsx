import { useMemo } from 'react'

type SparklineProps = {
  data: number[]
  width?: number
  height?: number
  positive?: boolean
  strokeWidth?: number
}

export function TokenSparkline({
  data,
  width = 124,
  height = 36,
  positive = true,
  strokeWidth = 1.5,
}: SparklineProps) {
  const pathD = useMemo(() => {
    if (!data || data.length < 2) return ''

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const points = data.map((value, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    })

    return `M${points.join(' L')}`
  }, [data, width, height])

  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="bg-zinc-900/50 rounded" />
  }

  const strokeColor = positive ? '#22c55e' : '#ef4444'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={`sparkline-gradient-${positive ? 'up' : 'down'}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
