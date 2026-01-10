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
  const duration = intensity === 'high' ? 6 : intensity === 'medium' ? 10 : 15

  return (
    // Important: this component is usually placed inside a fixed-size container (e.g. `w-56 h-56`).
    // Without `w-full h-full`, percentage heights in children collapse and the orb becomes tiny.
    <div className={`relative group w-full h-full ${className}`}>
      {/* Underglow */}
      <motion.div
        animate={{ opacity: [0.15, 0.25, 0.15], scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-full bg-gold-500/40 blur-[50px]"
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
              #4D3A11 0%,
              #140E02 15%,
              #8F711E 25%,
              #D4AF37 35%,
              #FFFFFF 40%,
              #D4AF37 45%,
              #8F711E 55%,
              #140E02 70%,
              #B5922B 85%,
              #4D3A11 100%
            )`,
          }}
        />

        {/* Layer 2: interference pattern (counter-clockwise) */}
        <motion.div
          className="absolute inset-[-50%] mix-blend-overlay opacity-80"
          animate={{ rotate: -360 }}
          transition={{
            repeat: Infinity,
            duration: duration * 1.8,
            ease: 'linear',
          }}
          style={{
            background: `conic-gradient(
              from 180deg,
              transparent 0%,
              #C5A028 20%,
              transparent 40%,
              #FFF7D6 50%,
              transparent 60%,
              #C5A028 80%,
              transparent 100%
            )`,
          }}
        />

        {/* Softener */}
        <div className="absolute inset-0 backdrop-blur-[1px]" />
      </div>

      {/* Layer 3: glass housing */}
      <div className="absolute inset-[2px] rounded-full bg-obsidian z-10 shadow-[inset_0_2px_8px_rgba(0,0,0,1),inset_0_0_2px_rgba(255,255,255,0.3)]" />

      {/* Layer 4: static specular highlight */}
      <div className="absolute inset-0 rounded-full z-10 pointer-events-none mix-blend-screen opacity-50 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.8)_0%,transparent_60%)]" />

      {/* Layer 5: bottom rim light (bounce) */}
      <div className="absolute inset-0 rounded-full z-10 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_50%_100%,rgba(212,175,55,0.5)_0%,transparent_50%)]" />

      {/* Inner content container */}
      <div className="relative rounded-full z-20 h-full w-full flex items-center justify-center overflow-hidden">
        {children}
      </div>
    </div>
  )
}


