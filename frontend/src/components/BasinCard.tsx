import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface BasinCardProps {
  label?: string
  title: string
  children: ReactNode
  tag?: string
  className?: string
  accent?: 'cyan' | 'mint' | 'copper' | 'brand'
}

const accentColors = {
  cyan: 'border-t-tension-cyan',
  mint: 'border-t-magma-mint',
  copper: 'border-t-copper-bright',
  brand: 'border-t-brand-500',
}

export function BasinCard({ 
  label, 
  title, 
  children, 
  tag,
  accent = 'mint',
  className = '' 
}: BasinCardProps) {
  return (
    <motion.div
      className={`
        relative bg-basalt border border-basalt-light 
        ${accentColors[accent]} border-t-4
        overflow-hidden transition-all duration-300
        hover:border-magma-mint/30 hover:-translate-y-1
        shadow-void
        ${className}
      `}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ 
        boxShadow: '0 25px 60px rgba(0,0,0,0.9)' 
      }}
    >
      {/* Tag */}
      {tag && (
        <div className="absolute -top-3 right-10 bg-obsidian px-3 py-1 text-[10px] font-mono border border-basalt-light uppercase tracking-widest text-magma-mint/70">
          {tag}
        </div>
      )}

      <div className="p-10">
        {/* Label */}
        {label && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 bg-magma-mint rounded-full" />
            <span className="text-[11px] font-mono uppercase tracking-[0.3em] text-magma-mint/80">
              {label}
            </span>
          </div>
        )}

        {/* Title */}
        <h2 className="flex items-center gap-4 text-2xl font-bold tracking-tight mb-6">
          <span className="w-5 h-0.5 bg-magma-mint" />
          {title}
        </h2>

        {/* Content */}
        <div className="text-slate-300">
          {children}
        </div>
      </div>

      {/* Grain texture overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='filter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23filter)'/%3E%3C/svg%3E")`
        }}
      />
    </motion.div>
  )
}

