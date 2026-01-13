import { useId } from 'react'
import { motion } from 'framer-motion'

export type ManifoldBackgroundVariant = 'default' | 'cyan' | 'copper'

interface ManifoldBackgroundProps {
  opacity?: number
  variant?: ManifoldBackgroundVariant
}

const gradients: Record<ManifoldBackgroundVariant, { start: string; end: string }> = {
  default: {
    start: '#0052FF',
    end: '#3B82F6',
  },
  cyan: {
    start: '#00f2ff',
    end: '#0044ff',
  },
  copper: {
    start: '#f59e0b',
    end: '#4a3321',
  },
}

export function ManifoldBackground({ 
  opacity = 0.15,
  variant = 'default' 
}: ManifoldBackgroundProps) {
  const rawId = useId()
  const stableId = rawId.replace(/:/g, '')
  const gradient = gradients[variant]
  const gradientId = `manifold-${stableId}-${variant}`

  return (
    <motion.svg
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] pointer-events-none"
      style={{ zIndex: -1, opacity }}
      viewBox="0 0 1000 1000"
      initial={{ opacity: 0 }}
      animate={{ opacity }}
      transition={{ duration: 1 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: gradient.start, stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: gradient.end, stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      
      {/* Flowing curves */}
      <motion.path
        d="M100,500 Q250,100 500,500 T900,500"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="0.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, ease: 'easeInOut' }}
      />
      <motion.path
        d="M100,550 Q250,150 500,550 T900,550"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="0.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, delay: 0.2, ease: 'easeInOut' }}
      />
      <motion.path
        d="M100,450 Q250,50 500,450 T900,450"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="0.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, delay: 0.4, ease: 'easeInOut' }}
      />
      
      {/* Diagonal lines */}
      <line 
        x1="100" 
        y1="100" 
        x2="900" 
        y2="900" 
        stroke="rgba(255,255,255,0.05)" 
        strokeWidth="0.5" 
      />
      <line 
        x1="900" 
        y1="100" 
        x2="100" 
        y2="900" 
        stroke="rgba(255,255,255,0.05)" 
        strokeWidth="0.5" 
      />
    </motion.svg>
  )
}
