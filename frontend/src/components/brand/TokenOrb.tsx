import { useRef, useState } from 'react'
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { Lock } from 'lucide-react'

export function TokenOrb({
  image,
  isUnlocked,
  onClick,
  symbol,
}: {
  image: string
  isUnlocked: boolean
  onClick?: () => void
  symbol?: string
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [imgError, setImgError] = useState(false)

  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const mouseX = useSpring(x, { stiffness: 150, damping: 15 })
  const mouseY = useSpring(y, { stiffness: 150, damping: 15 })

  const rotateX = useTransform(mouseY, [-0.5, 0.5], ['15deg', '-15deg'])
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ['-15deg', '15deg'])

  const glossX = useTransform(mouseX, [-0.5, 0.5], ['0%', '100%'])
  const glossY = useTransform(mouseY, [-0.5, 0.5], ['0%', '100%'])
  const glossBg = useMotionTemplate`radial-gradient(circle at ${glossX} ${glossY}, rgba(255,255,255,0.8) 0%, transparent 60%)`

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    x.set((e.clientX - rect.left) / width - 0.5)
    y.set((e.clientY - rect.top) / height - 0.5)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    x.set(0)
    y.set(0)
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      className="relative w-full h-full rounded-full cursor-pointer group focus:outline-none [perspective:500px]"
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      style={{
        rotateX: isHovered ? rotateX : 0,
        rotateY: isHovered ? rotateY : 0,
        transformStyle: 'preserve-3d',
      }}
      aria-label={onClick ? 'Token' : 'Token image'}
    >
      <div className="absolute inset-0 rounded-full overflow-hidden bg-black [backface-visibility:hidden]">
        {image && !imgError ? (
          <img
            src={image}
            alt="Creator"
            className={`w-full h-full object-cover transition-all duration-1000 ease-out ${
              isUnlocked ? 'grayscale-0 opacity-100 scale-100' : 'grayscale opacity-90 contrast-110 scale-100'
            }`}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-primary/25 via-brand-accent/10 to-black">
            <span className="text-white/80 font-sans text-4xl select-none">
              {(symbol?.trim()?.[0] ?? '?').toUpperCase()}
            </span>
          </div>
        )}

        <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] z-10 pointer-events-none" />

        <div className={`absolute inset-0 bg-black/20 transition-opacity duration-500 z-10 ${isUnlocked ? 'opacity-0' : 'opacity-100'}`} />
      </div>

      <motion.div className="absolute inset-0 rounded-full z-20 pointer-events-none opacity-40 mix-blend-overlay" style={{ background: glossBg }} />

      <div className="absolute inset-0 rounded-full border border-white/10 z-20 pointer-events-none shadow-[inset_0_4px_20px_rgba(255,255,255,0.1)]" />

      {!isUnlocked ? (
        <div className="absolute inset-0 flex items-center justify-center z-30" style={{ transformStyle: 'preserve-3d', transform: 'translateZ(10px)' }}>
          <div className="relative">
            <div className="absolute inset-0 bg-black/50 blur-xl rounded-full" />
            <div className="relative text-white/90 drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]">
              <Lock size={28} strokeWidth={1.5} />
            </div>
          </div>
        </div>
      ) : null}
    </motion.button>
  )
}

