import { motion } from 'framer-motion'

interface ManifoldBackgroundProps {
  opacity?: number
  variant?: 'default' | 'purple' | 'blue'
}

const gradients = {
  default: {
    id: 'grad-default',
    start: '#3B82F6',
    end: '#A855F7',
  },
  purple: {
    id: 'grad-purple',
    start: '#A855F7',
    end: '#7C3AED',
  },
  blue: {
    id: 'grad-blue',
    start: '#3B82F6',
    end: '#1D4ED8',
  },
}

export function ManifoldBackground({ 
  opacity = 0.15,
  variant = 'default' 
}: ManifoldBackgroundProps) {
  const gradient = gradients[variant]

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
        <linearGradient id={gradient.id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: gradient.start, stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: gradient.end, stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      
      {/* Flowing curves */}
      <motion.path
        d="M100,500 Q250,100 500,500 T900,500"
        fill="none"
        stroke={`url(#${gradient.id})`}
        strokeWidth="0.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, ease: 'easeInOut' }}
      />
      <motion.path
        d="M100,550 Q250,150 500,550 T900,550"
        fill="none"
        stroke={`url(#${gradient.id})`}
        strokeWidth="0.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, delay: 0.2, ease: 'easeInOut' }}
      />
      <motion.path
        d="M100,450 Q250,50 500,450 T900,450"
        fill="none"
        stroke={`url(#${gradient.id})`}
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

