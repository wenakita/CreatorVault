import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { ConnectButton } from '@/components/ConnectButton'
import { Logo } from './Logo'

type NavItem = {
  label: string
  to: string
  activePrefixes?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'HOME', to: '/', activePrefixes: ['/'] },
  { label: 'EXPLORE', to: '/explore/creators', activePrefixes: ['/explore', '/dashboard'] },
  { label: 'DEPLOY', to: '/deploy', activePrefixes: ['/deploy', '/launch', '/status'] },
  { label: 'FAQ', to: '/faq', activePrefixes: ['/faq'] },
]

function isActivePath(pathname: string, item: NavItem): boolean {
  if (item.to === '/') return pathname === '/'
  const prefixes = item.activePrefixes && item.activePrefixes.length > 0 ? item.activePrefixes : [item.to]
  return prefixes.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)))
}

export function VaultNavBar() {
  const location = useLocation()
  const [isHovered, setIsHovered] = useState<number | null>(null)

  return (
    <header className="sticky top-0 left-0 right-0 z-50 transition-all duration-500">
      <div className="absolute inset-0 bg-vault-bg/70 backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]" />

      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-primary/25 to-transparent opacity-60" />

      <div className="relative max-w-[1400px] mx-auto px-6 md:px-12 h-24 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-4 group cursor-pointer">
          <Logo showText={false} width={40} height={40} />
          <div className="flex flex-col justify-center">
            <span className="text-sm tracking-[0.1em] text-white font-medium transition-colors duration-300 leading-none">
              Creator
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent ml-1">
                Vaults
              </span>
            </span>
            <span className="mt-1 text-[9px] tracking-[0.22em] uppercase text-zinc-600 leading-none">
              <span className="font-mono uppercase">erc</span>
              <span className="font-mono text-zinc-500">4626</span>
            </span>
          </div>
        </Link>

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
                    active ? 'text-white' : 'text-zinc-500 group-hover:text-brand-accent'
                  }`}
                >
                  {item.label}
                </span>

                {active && (
                  <motion.div
                    layoutId="vaultNavActiveDot"
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-primary shadow-[0_0_10px_#0052FF]"
                  />
                )}

                <AnimatePresence>
                  {isHovered === i && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0 bg-brand-primary/5 blur-lg rounded-full -z-10"
                    />
                  )}
                </AnimatePresence>
              </Link>
            )
          })}
        </nav>

        <div className="hidden md:block">
          <ConnectButton />
        </div>

        <div className="md:hidden text-white/50 hover:text-white cursor-pointer" title="Menu">
          <Menu />
        </div>
      </div>
    </header>
  )
}

