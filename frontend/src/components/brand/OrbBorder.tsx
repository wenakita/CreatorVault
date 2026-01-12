import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

export type OrbBorderIntensity = 'low' | 'medium' | 'high'

export function OrbBorder({
  children,
  className = '',
  intensity = 'medium',
}: {
  children: ReactNode
  className?: string
  intensity?: OrbBorderIntensity
}) {
  const duration = intensity === 'high' ? 6 : intensity === 'medium' ? 10 : 15

  return (
    <div className={`relative group w-full h-full ${className}`}>
      {/* Underglow */}
      <motion.div
        animate={{ opacity: [0.12, 0.22, 0.12], scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-full bg-brand-primary/30 blur-[50px]"
      />

      {/* Layer 1: electric ring (clockwise) */}
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
              #0033CC 0%,
              #001F7A 15%,
              #004AD9 25%,
              #0052FF 35%,
              #FFFFFF 42%,
              #0052FF 48%,
              #004AD9 58%,
              #001F7A 72%,
              #3B82F6 86%,
              #0033CC 100%
            )`,
          }}
        />

        {/* Layer 2: interference (counter-clockwise) */}
        <motion.div
          className="absolute inset-[-50%] mix-blend-overlay opacity-70"
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
              #0052FF 20%,
              transparent 40%,
              #EDEDED 50%,
              transparent 60%,
              #0052FF 80%,
              transparent 100%
            )`,
          }}
        />

        <div className="absolute inset-0 backdrop-blur-[1px]" />
      </div>

      {/* Layer 3: housing */}
      <div className="absolute inset-[2px] rounded-full bg-obsidian z-10 shadow-[inset_0_2px_8px_rgba(0,0,0,1),inset_0_0_2px_rgba(255,255,255,0.3)]" />

      {/* Layer 4: specular highlight */}
      <div className="absolute inset-0 rounded-full z-10 pointer-events-none mix-blend-screen opacity-50 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.8)_0%,transparent_60%)]" />

      {/* Layer 5: bottom rim light */}
      <div className="absolute inset-0 rounded-full z-10 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_50%_100%,rgba(0,82,255,0.35)_0%,transparent_55%)]" />

      {/* Inner content */}
      <div className="relative rounded-full z-20 h-full w-full flex items-center justify-center overflow-hidden">
        {children}
      </div>
    </div>
  )
}

