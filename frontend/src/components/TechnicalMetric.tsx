import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface TechnicalMetricProps {
  label: string
  value: string | number
  suffix?: string
  icon?: ReactNode
  highlight?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
  className?: string
}

const sizes = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
  xl: 'text-6xl',
}

export function TechnicalMetric({ 
  label, 
  value, 
  suffix,
  icon,
  highlight = false,
  size = 'md',
  loading = false,
  className = '' 
}: TechnicalMetricProps) {
  return (
    <motion.div
      className={`flex flex-col gap-2 ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Label */}
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-slate-500">
        {icon}
        {label}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-2">
        {loading ? (
          <motion.div 
            className={`${sizes[size]} font-mono font-light text-slate-600`}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            --
          </motion.div>
        ) : (
          <>
            <motion.div
              className={`
                ${sizes[size]} font-mono font-light tracking-tight
                ${highlight 
                  ? 'text-tension-cyan drop-shadow-[0_0_20px_rgba(0,242,255,0.4)]' 
                  : 'text-white'
                }
              `}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                type: 'spring',
                stiffness: 200,
                damping: 10 
              }}
            >
              {value}
            </motion.div>
            {suffix && (
              <span className="text-sm text-slate-500 font-mono">
                {suffix}
              </span>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}

interface MetricGridProps {
  children: ReactNode
  columns?: 2 | 3 | 4
  className?: string
}

export function MetricGrid({ 
  children, 
  columns = 3,
  className = '' 
}: MetricGridProps) {
  return (
    <div 
      className={`
        grid gap-8 
        ${columns === 2 && 'grid-cols-1 md:grid-cols-2'}
        ${columns === 3 && 'grid-cols-1 md:grid-cols-3'}
        ${columns === 4 && 'grid-cols-2 md:grid-cols-4'}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

