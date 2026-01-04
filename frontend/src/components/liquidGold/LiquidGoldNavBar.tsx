import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { ConnectButton } from '@/components/ConnectButton'

type NavItem = {
  label: string
  to: string
  activePrefixes?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'HOME', to: '/', activePrefixes: ['/'] },
  { label: 'VAULTS', to: '/dashboard', activePrefixes: ['/dashboard', '/vault'] },
  { label: 'DEPLOY', to: '/deploy', activePrefixes: ['/deploy', '/launch', '/status'] },
  { label: 'FAQ', to: '/faq', activePrefixes: ['/faq'] },
]

function isActivePath(pathname: string, item: NavItem): boolean {
  if (item.to === '/') return pathname === '/'
  const prefixes = item.activePrefixes && item.activePrefixes.length > 0 ? item.activePrefixes : [item.to]
  return prefixes.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)))
}

function LiquidGoldMark() {
  return (
    <div className="relative w-11 h-11">
      {/* Rotating glow behind logo */}
      <div className="absolute inset-0 bg-gold-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      {/* The container */}
      <div className="relative w-full h-full rounded-xl overflow-hidden bg-obsidian border border-white/10 shadow-[inset_0_0_10px_rgba(0,0,0,1)] group-hover:border-gold-500/30 transition-colors duration-500 p-1.5">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <radialGradient id="orb-gold" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(30 30) rotate(0) scale(70)">
              <stop offset="0" stopColor="#FBF8F1" />
              <stop offset="0.3" stopColor="#F0E2A3" />
              <stop offset="0.7" stopColor="#B5922B" />
              <stop offset="1" stopColor="#4D3A11" />
            </radialGradient>
            <filter id="inner-glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="arithmetic" k2="1" k3="1" />
            </filter>
          </defs>

          {/* The liquid sphere base */}
          <circle cx="50" cy="50" r="40" fill="url(#orb-gold)" />

          {/* Metal rim */}
          <circle cx="50" cy="50" r="38" stroke="#4D3A11" strokeWidth="1" opacity="0.5" />

          {/* Gloss highlight */}
          <path d="M50 15 C35 15 22 25 18 40 Q 30 25 50 25 Q 70 25 82 40 C 78 25 65 15 50 15 Z" fill="white" fillOpacity="0.6" filter="url(#inner-glow)" />

          {/* Bottom reflection */}
          <path d="M25 70 Q 50 85 75 70" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
        </svg>

        {/* Glass glint overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none mix-blend-overlay" />
      </div>
    </div>
  )
}

export function LiquidGoldNavBar() {
  const location = useLocation()
  const [isHovered, setIsHovered] = useState<number | null>(null)

  return (
    <header className="sticky top-0 left-0 right-0 z-50 transition-all duration-500">
      {/* Cinematic glass background */}
      <div className="absolute inset-0 bg-[#020202]/60 backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]" />

      {/* Bottom horizon line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold-500/20 to-transparent opacity-50" />

      <div className="relative max-w-[1400px] mx-auto px-6 md:px-12 h-24 flex items-center justify-between">
        {/* Logo section */}
        <Link to="/" className="flex items-center gap-5 group cursor-pointer">
          <LiquidGoldMark />

          <div className="flex flex-col justify-center">
            <span className="text-sm tracking-[0.1em] text-white font-medium group-hover:text-gold-100 transition-colors duration-300 font-serif">
              CREATOR
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-300 to-gold-600 italic ml-1">
                VAULTS
              </span>
            </span>
          </div>
        </Link>

        {/* Navigation links */}
        <nav className="hidden md:flex items-center gap-10">
          {NAV_ITEMS.map((item, i) => {
            const active = isActivePath(location.pathname, item)
            return (
              <Link
                key={item.to}
                to={item.to}
                onMouseEnter={() => setIsHovered(i)}
                onMouseLeave={() => setIsHovered(null)}
                className="relative py-4 px-2 group"
              >
                <span
                  className={`text-[10px] tracking-[0.25em] font-medium transition-colors duration-300 relative z-10 ${
                    active ? 'text-white' : 'text-zinc-500 group-hover:text-gold-200'
                  }`}
                >
                  {item.label}
                </span>

                {/* Active dot */}
                {active && (
                  <motion.div
                    layoutId="liquidGoldActiveDot"
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold-400 shadow-[0_0_8px_#D4AF37]"
                  />
                )}

                {/* Hover glow */}
                <AnimatePresence>
                  {isHovered === i && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0 bg-gold-400/5 blur-lg rounded-full -z-10"
                    />
                  )}
                </AnimatePresence>
              </Link>
            )
          })}
        </nav>

        {/* Connect Wallet */}
        <div className="hidden md:block">
          <ConnectButton />
        </div>

        {/* Mobile menu icon (visual only for now) */}
        <div className="md:hidden text-white/50 hover:text-white cursor-pointer" title="Menu">
          <Menu />
        </div>
      </div>
    </header>
  )
}



