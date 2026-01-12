import { useEffect, useRef, useState } from 'react'

export type TextScrambleFont = 'sans' | 'mono' | 'doto'
export type TextScrambleComplexity = 'simple' | 'complex'

export interface TextScrambleProps {
  text: string
  className?: string
  font?: TextScrambleFont
  trigger?: boolean
  speed?: number
  complexity?: TextScrambleComplexity
}

// Geometric primitives for the technical aesthetic
const SIMPLE_SYMBOLS = ['●', '■', '▲', '◆', '○', '□', '△', '◊', '⬡', '⬢', '✶', '✕', '✧', '✦', '✢']
const COMPLEX_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'

type ScrambleChar = { char: string; style: React.CSSProperties }

export function TextScramble({
  text,
  className = '',
  font = 'sans',
  trigger = true,
  speed = 1.0,
  complexity = 'simple',
}: TextScrambleProps) {
  const [output, setOutput] = useState<ScrambleChar[]>([])
  const frameRef = useRef<number>(0)
  const progressRef = useRef<number>(0)

  useEffect(() => {
    if (!trigger) {
      setOutput(text.split('').map((char) => ({ char, style: {} })))
      return
    }

    progressRef.current = 0

    const animate = () => {
      // Resolve speed tuned for a snappy “system decode”
      progressRef.current += speed * 0.5

      const resolved = Math.floor(progressRef.current)
      const isComplex = complexity === 'complex'

      const next = text.split('').map((char, index): ScrambleChar => {
        if (char === ' ') return { char: ' ', style: {} }

        if (index < resolved) return { char, style: {} }

        let randomChar = SIMPLE_SYMBOLS[Math.floor(Math.random() * SIMPLE_SYMBOLS.length)]
        if (isComplex && Math.random() > 0.3) {
          randomChar = COMPLEX_CHARS[Math.floor(Math.random() * COMPLEX_CHARS.length)]
        }

        let style: React.CSSProperties = {
          opacity: 0.7,
          display: 'inline-block',
          width: '1ch',
          textAlign: 'center',
        }

        if (isComplex) {
          const rotate = Math.floor(Math.random() * 180) - 90
          const scale = 0.8 + Math.random() * 0.4
          style = {
            ...style,
            transform: `rotate(${rotate}deg) scale(${scale})`,
            color: Math.random() > 0.8 ? '#0052FF' : 'inherit',
            filter: Math.random() > 0.9 ? 'blur(1px)' : 'none',
          }
        }

        return { char: randomChar, style }
      })

      setOutput(next)

      if (progressRef.current < text.length + 5) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [trigger, text, speed, complexity])

  const fontClass = font === 'doto' ? 'font-doto' : font === 'mono' ? 'font-mono' : 'font-sans'

  return (
    <span className={`${fontClass} ${className} inline-flex whitespace-pre`}>
      {output.map((item, i) => (
        <span key={i} style={item.style} className="transition-colors duration-75">
          {item.char}
        </span>
      ))}
    </span>
  )
}

