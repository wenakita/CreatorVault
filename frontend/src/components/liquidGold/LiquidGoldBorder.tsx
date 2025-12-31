import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

export type LiquidGoldBorderIntensity = 'low' | 'medium' | 'high'

export function LiquidGoldBorder({
  children,
  className = '',
  intensity = 'medium',
}: {
  children: ReactNode
  className?: string
  intensity?: LiquidGoldBorderIntensity
}) {
  // Speed multiplier based on intensity
  const duration = intensity === 'high' ? 4 : intensity === 'medium' ? 8 : 12

  return (
    // Important: this component is usually placed inside a fixed-size container (e.g. `w-56 h-56`).
    // Without `w-full h-full`, percentage heights in children collapse and the orb becomes tiny.
    <div className={`relative group w-full h-full ${className}`}>
      {/* Underglow */}
      <motion.div
        animate={{ opacity: [0.2, 0.3, 0.2], scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-full bg-gold-600/30 blur-[40px]"
      />

      {/* Layer 1: base liquid metal (clockwise) */}
      <div className="absolute -inset-[3px] rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-[-50%]"
          animate={{ rotate: 360 }}
          transition={{
            repeat: Infinity,
            duration,
            ease: 'linear',
          }}
          style={{
            background: `conic-gradient(
              from 0deg,
              #261C05 0%,
              #6B5216 15%,
              #F0E2A3 25%,
              #FFFFFF 28%,
              #F0E2A3 31%,
              #D4AF37 45%,
              #261C05 55%,
              #6B5216 70%,
              #D4AF37 85%,
              #261C05 100%
            )`,
          }}
        />

        {/* Layer 2: interference pattern (counter-clockwise) */}
        <motion.div
          className="absolute inset-[-50%] mix-blend-overlay opacity-70"
          animate={{ rotate: -360 }}
          transition={{
            repeat: Infinity,
            duration: duration * 1.5,
            ease: 'linear',
          }}
          style={{
            background: `conic-gradient(
              from 180deg,
              transparent 0%,
              #FFD700 20%,
              transparent 40%,
              #FFFFFF 50%,
              transparent 60%,
              #FFD700 80%,
              transparent 100%
            )`,
          }}
        />

        {/* Softener */}
        <div className="absolute inset-0 backdrop-blur-[0.5px]" />
      </div>

      {/* Layer 3: glass housing */}
      <div className="absolute inset-[2px] rounded-full bg-obsidian z-10 shadow-[inset_0_2px_8px_rgba(0,0,0,1),inset_0_0_2px_rgba(255,255,255,0.3)]" />

      {/* Layer 4: static specular highlight */}
      <div className="absolute inset-0 rounded-full z-10 pointer-events-none mix-blend-screen opacity-60 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.9)_0%,transparent_50%)]" />

      {/* Inner content container */}
      <div className="relative rounded-full z-20 h-full w-full flex items-center justify-center overflow-hidden">
        {children}
      </div>
    </div>
  )
}


