import { motion } from 'framer-motion'
import { ReactNode } from 'react'

/**
 * FeatureCard - Clean feature display inspired by OnchainKit
 * From: https://www.base.org/build/onchainkit
 * 
 * "Full-stack", "AI-friendly", "Serverless", etc. feature cards
 */

interface FeatureCardProps {
  icon: ReactNode
  title: string
  description: string
  delay?: number
  className?: string
}

export function FeatureCard({
  icon,
  title,
  description,
  delay = 0,
  className = '',
}: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.24,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={`group relative p-6 rounded-2xl bg-surface-900/60 border border-surface-800 overflow-hidden ${className}`}
      style={{
        transitionProperty: 'all',
        transitionDuration: '200ms',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Hover gradient overlay */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-brand-500/[0.03] to-transparent opacity-0 group-hover:opacity-100"
        style={{
          transitionProperty: 'opacity',
          transitionDuration: '200ms',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
      
      {/* Icon */}
      <div 
        className="relative w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20"
        style={{
          transitionProperty: 'background-color',
          transitionDuration: '200ms',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <span className="text-brand-500">{icon}</span>
      </div>

      {/* Content */}
      <h3 className="relative font-semibold text-white mb-2">{title}</h3>
      <p className="relative text-surface-400 text-sm leading-relaxed">{description}</p>
    </motion.div>
  )
}

/**
 * FeatureGrid - Grid container for feature cards
 */
interface FeatureGridProps {
  children: ReactNode
  columns?: 2 | 3 | 4
  className?: string
}

export function FeatureGrid({ children, columns = 3, className = '' }: FeatureGridProps) {
  const gridCols = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={`grid gap-4 ${gridCols[columns]} ${className}`}>
      {children}
    </div>
  )
}

/**
 * CommandDisplay - Terminal command display like "npx create-onchain@latest"
 * From: https://www.base.org/build/onchainkit
 */
interface CommandDisplayProps {
  command: string
  className?: string
  copyable?: boolean
}

export function CommandDisplay({ command, className = '', copyable = true }: CommandDisplayProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(command)
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-900 border border-surface-800 font-mono text-sm ${className}`}
    >
      <span className="text-surface-500">$</span>
      <code className="text-brand-400 flex-1">{command}</code>
      {copyable && (
        <button
          onClick={handleCopy}
          className="text-surface-500 hover:text-white transition-colors duration-120"
          style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      )}
    </div>
  )
}

/**
 * HighlightCard - Large highlight card for key features
 */
interface HighlightCardProps {
  title: string
  subtitle?: string
  description: string
  children?: ReactNode
  className?: string
}

export function HighlightCard({
  title,
  subtitle,
  description,
  children,
  className = '',
}: HighlightCardProps) {
  return (
    <div
      className={`relative p-8 rounded-3xl bg-gradient-to-br from-surface-900 to-surface-900/80 border border-surface-800 overflow-hidden ${className}`}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }} />
      </div>
      
      {/* Blue glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500/20 rounded-full blur-3xl" />
      
      <div className="relative">
        {subtitle && (
          <span className="inline-block px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 text-xs font-medium mb-4">
            {subtitle}
          </span>
        )}
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-3">{title}</h2>
        <p className="text-surface-400 text-lg leading-relaxed max-w-2xl">{description}</p>
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  )
}


import { ReactNode } from 'react'

/**
 * FeatureCard - Clean feature display inspired by OnchainKit
 * From: https://www.base.org/build/onchainkit
 * 
 * "Full-stack", "AI-friendly", "Serverless", etc. feature cards
 */

interface FeatureCardProps {
  icon: ReactNode
  title: string
  description: string
  delay?: number
  className?: string
}

export function FeatureCard({
  icon,
  title,
  description,
  delay = 0,
  className = '',
}: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.24,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={`group relative p-6 rounded-2xl bg-surface-900/60 border border-surface-800 overflow-hidden ${className}`}
      style={{
        transitionProperty: 'all',
        transitionDuration: '200ms',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Hover gradient overlay */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-brand-500/[0.03] to-transparent opacity-0 group-hover:opacity-100"
        style={{
          transitionProperty: 'opacity',
          transitionDuration: '200ms',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
      
      {/* Icon */}
      <div 
        className="relative w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20"
        style={{
          transitionProperty: 'background-color',
          transitionDuration: '200ms',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <span className="text-brand-500">{icon}</span>
      </div>

      {/* Content */}
      <h3 className="relative font-semibold text-white mb-2">{title}</h3>
      <p className="relative text-surface-400 text-sm leading-relaxed">{description}</p>
    </motion.div>
  )
}

/**
 * FeatureGrid - Grid container for feature cards
 */
interface FeatureGridProps {
  children: ReactNode
  columns?: 2 | 3 | 4
  className?: string
}

export function FeatureGrid({ children, columns = 3, className = '' }: FeatureGridProps) {
  const gridCols = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={`grid gap-4 ${gridCols[columns]} ${className}`}>
      {children}
    </div>
  )
}

/**
 * CommandDisplay - Terminal command display like "npx create-onchain@latest"
 * From: https://www.base.org/build/onchainkit
 */
interface CommandDisplayProps {
  command: string
  className?: string
  copyable?: boolean
}

export function CommandDisplay({ command, className = '', copyable = true }: CommandDisplayProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(command)
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-900 border border-surface-800 font-mono text-sm ${className}`}
    >
      <span className="text-surface-500">$</span>
      <code className="text-brand-400 flex-1">{command}</code>
      {copyable && (
        <button
          onClick={handleCopy}
          className="text-surface-500 hover:text-white transition-colors duration-120"
          style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      )}
    </div>
  )
}

/**
 * HighlightCard - Large highlight card for key features
 */
interface HighlightCardProps {
  title: string
  subtitle?: string
  description: string
  children?: ReactNode
  className?: string
}

export function HighlightCard({
  title,
  subtitle,
  description,
  children,
  className = '',
}: HighlightCardProps) {
  return (
    <div
      className={`relative p-8 rounded-3xl bg-gradient-to-br from-surface-900 to-surface-900/80 border border-surface-800 overflow-hidden ${className}`}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }} />
      </div>
      
      {/* Blue glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500/20 rounded-full blur-3xl" />
      
      <div className="relative">
        {subtitle && (
          <span className="inline-block px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 text-xs font-medium mb-4">
            {subtitle}
          </span>
        )}
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-3">{title}</h2>
        <p className="text-surface-400 text-lg leading-relaxed max-w-2xl">{description}</p>
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  )
}

