/**
 * Base Motion System
 * Following official guidelines: https://www.base.org/brand/motion
 * 
 * Principles:
 * - Intention first: Each animation communicates state change
 * - Playful restraint: Small bounces, subtle overshoot
 * - Consistency: One cubic-bezier curve (0.4, 0, 0.2, 1)
 * - Snappy pace: 120-240ms for UI feedback
 * - Square-led choreography: Motion begins/ends with the Square
 * - Tech-positive polish: Upgraded performance, not decorative flair
 */

import { motion, Variants, Transition } from 'framer-motion'
import { ReactNode, useState, useEffect, useCallback } from 'react'

// Base's signature easing curve
export const BASE_EASE = [0.4, 0, 0.2, 1] as const

// Standard durations (snappy pace: 120-240ms)
export const DURATION = {
  instant: 0.08,   // 80ms - micro interactions
  fast: 0.12,      // 120ms - button feedback
  normal: 0.2,     // 200ms - most UI
  slow: 0.32,      // 320ms - larger elements
  headline: 0.6,   // 600ms - tech scramble
  max: 0.8,        // 800ms - never exceed
} as const

// Base transition preset
export const baseTransition: Transition = {
  duration: DURATION.normal,
  ease: BASE_EASE,
}

// ============================================
// SQUARE-WIPE ANIMATION
// "Content slides on as the Square travels left to right"
// ============================================

interface SquareWipeProps {
  children: ReactNode
  delay?: number
  className?: string
}

export function SquareWipe({ children, delay = 0, className = '' }: SquareWipeProps) {
  return (
    <motion.div
      className={`relative overflow-hidden ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.01, delay }}
    >
      {/* The Square traveling left to right */}
      <motion.div
        className="absolute inset-y-0 left-0 w-8 bg-[#0052FF] z-10"
        initial={{ x: '-100%' }}
        animate={{ x: '100vw' }}
        transition={{
          duration: DURATION.slow,
          delay,
          ease: BASE_EASE,
        }}
      />
      {/* Content reveals behind */}
      <motion.div
        initial={{ clipPath: 'inset(0 100% 0 0)' }}
        animate={{ clipPath: 'inset(0 0% 0 0)' }}
        transition={{
          duration: DURATION.slow,
          delay: delay + 0.05,
          ease: BASE_EASE,
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

// ============================================
// TECH SCRAMBLE - Refined
// "Cascading vertical glyph swaps that resolve into the final message"
// ============================================

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'

interface TechScrambleProps {
  text: string
  className?: string
  delay?: number
  duration?: number
}

export function TechScramble({
  text,
  className = '',
  delay = 0,
  duration = DURATION.headline * 1000, // Convert to ms
}: TechScrambleProps) {
  const [display, setDisplay] = useState('')
  const [started, setStarted] = useState(false)

  const scramble = useCallback(() => {
    const chars = text.split('')
    const totalFrames = Math.floor(duration / 25) // ~25ms per frame
    let frame = 0

    const interval = setInterval(() => {
      const progress = frame / totalFrames

      setDisplay(
        chars
          .map((char, i) => {
            if (char === ' ') return ' '
            
            // Each character reveals at a different time (cascade effect)
            const charProgress = (progress - (i * 0.03)) * 2
            
            if (charProgress >= 1) return char
            if (charProgress < 0) return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
            
            // Transition zone - mix of scramble and reveal
            return Math.random() > charProgress 
              ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
              : char
          })
          .join('')
      )

      frame++
      if (frame >= totalFrames) {
        clearInterval(interval)
        setDisplay(text)
      }
    }, 25)

    return () => clearInterval(interval)
  }, [text, duration])

  useEffect(() => {
    const timer = setTimeout(() => {
      setStarted(true)
      scramble()
    }, delay)
    return () => clearTimeout(timer)
  }, [delay, scramble])

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: started ? 1 : 0, y: started ? 0 : 4 }}
      transition={{ duration: 0.15, ease: BASE_EASE }}
      style={{ fontFeatureSettings: '"tnum"' }} // Tabular nums for stability
    >
      {display || text}
    </motion.span>
  )
}

// ============================================
// STAGGER CONTAINER
// For coordinated reveal of multiple elements
// ============================================

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.normal,
      ease: BASE_EASE,
    },
  },
}

interface StaggerProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function Stagger({ children, className = '', delay = 0 }: StaggerProps) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      transition={{ delayChildren: delay }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  )
}

// ============================================
// SLIDE UP WITH BOUNCE
// "Playful restraint: Small bounces and subtle overshoot"
// ============================================

interface SlideUpProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function SlideUp({ children, className = '', delay = 0 }: SlideUpProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: DURATION.slow,
        delay,
        ease: [0.34, 1.56, 0.64, 1], // Slight overshoot
      }}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// FADE IN
// Clean, simple fade for supporting content
// ============================================

interface FadeInProps {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
}

export function FadeIn({ 
  children, 
  className = '', 
  delay = 0,
  duration = DURATION.normal 
}: FadeInProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay, ease: BASE_EASE }}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// SCALE IN
// For buttons and interactive elements
// ============================================

interface ScaleInProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function ScaleIn({ children, className = '', delay = 0 }: ScaleInProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: DURATION.normal,
        delay,
        ease: BASE_EASE,
      }}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// HOVER SCALE
// Snappy button feedback (120ms)
// ============================================

interface HoverScaleProps {
  children: ReactNode
  className?: string
  scale?: number
}

export function HoverScale({ children, className = '', scale = 1.02 }: HoverScaleProps) {
  return (
    <motion.div
      className={className}
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: DURATION.fast, ease: BASE_EASE }}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// THE SQUARE
// Base's logo with motion capabilities
// ============================================

interface BaseSquareProps {
  size?: number
  className?: string
  animate?: boolean
}

export function BaseSquare({ size = 32, className = '', animate = false }: BaseSquareProps) {
  return (
    <motion.div
      className={className}
      initial={animate ? { scale: 0, rotate: -90 } : undefined}
      animate={animate ? { scale: 1, rotate: 0 } : undefined}
      transition={{
        duration: DURATION.slow,
        ease: [0.34, 1.56, 0.64, 1], // Playful overshoot
      }}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="6" fill="#0052FF"/>
        <path d="M16 26C21.5228 26 26 21.5228 26 16C26 10.4772 21.5228 6 16 6C10.4772 6 6 10.4772 6 16C6 21.5228 10.4772 26 16 26Z" fill="white"/>
        <path d="M16 22C19.3137 22 22 19.3137 22 16C22 12.6863 19.3137 10 16 10V22Z" fill="#0052FF"/>
      </svg>
    </motion.div>
  )
}

// ============================================
// PAGE TRANSITION
// Standard intro pattern
// ============================================

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: DURATION.slow,
      ease: BASE_EASE,
    }
  },
  exit: { 
    opacity: 0, 
    y: -8,
    transition: {
      duration: DURATION.fast,
      ease: BASE_EASE,
    }
  },
}

export function PageTransition({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  )
}
