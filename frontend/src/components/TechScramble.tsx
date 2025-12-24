import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

/**
 * TechScramble - Base's signature text reveal animation
 * From: https://www.base.org/brand/motion
 * 
 * "Our 'tech scramble' animation reveals text by cascading vertical glyph swaps
 * that resolve into the final message. Use it for product headlines, social teasers,
 * or keynotes—never body copy."
 */

interface TechScrambleProps {
  text: string
  className?: string
  delay?: number
  duration?: number
  trigger?: boolean
}

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function TechScramble({
  text,
  className = '',
  delay = 0,
  duration = 600,
  trigger = true,
}: TechScrambleProps) {
  const [displayText, setDisplayText] = useState(text)
  const [_isAnimating, setIsAnimating] = useState(false)

  const scramble = useCallback(() => {
    if (!trigger) return
    
    setIsAnimating(true)
    const iterations = Math.ceil(duration / 30) // ~30ms per frame
    const revealDelay = iterations * 0.3 // Start revealing at 30%
    
    let frame = 0
    const interval = setInterval(() => {
      setDisplayText(
        text
          .split('')
          .map((char, index) => {
            // Preserve spaces
            if (char === ' ') return ' '
            
            // Gradually reveal characters from left to right
            const revealPoint = revealDelay + (index * iterations * 0.7) / text.length
            if (frame > revealPoint) {
              return text[index]
            }
            
            // Random character
            return CHARS[Math.floor(Math.random() * CHARS.length)]
          })
          .join('')
      )

      frame++
      if (frame >= iterations) {
        clearInterval(interval)
        setDisplayText(text)
        setIsAnimating(false)
      }
    }, 30)

    return () => clearInterval(interval)
  }, [text, duration, trigger])

  useEffect(() => {
    const timer = setTimeout(scramble, delay)
    return () => clearTimeout(timer)
  }, [scramble, delay])

  return (
    <motion.span
      className={`inline-block font-mono ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.1, delay: delay / 1000 }}
    >
      {displayText}
    </motion.span>
  )
}

/**
 * Simpler version - just the scramble-in effect for headlines
 */
export function ScrambleHeadline({
  children,
  className = '',
  delay = 0,
}: {
  children: string
  className?: string
  delay?: number
}) {
  return (
    <TechScramble
      text={children}
      className={className}
      delay={delay}
      duration={600}
    />
  )
}
