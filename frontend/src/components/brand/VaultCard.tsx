import { motion } from 'framer-motion'
import { ArrowRight, BarChart3, Layers, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Address } from 'viem'
import { formatUnits } from 'viem'
import { useReadContract } from 'wagmi'

import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import { useZoraCoin } from '@/lib/zora/hooks'

import { OrbBorder } from './OrbBorder'
import { TokenOrb } from './TokenOrb'

// CCA Strategy ABI (minimal)
const CCA_STRATEGY_ABI = [
  {
    name: 'getAuctionStatus',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'auction', type: 'address' },
      { name: 'isActive', type: 'bool' },
      { name: 'isGraduated', type: 'bool' },
      { name: 'clearingPrice', type: 'uint256' },
      { name: 'currencyRaised', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const

export type VaultDescriptor = {
  id: string
  name: string
  symbol: string
  token: Address
  vault: Address
  ccaStrategy: Address
}

function fmtEth(wei: bigint): string {
  const n = Number(formatUnits(wei, 18))
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return '0'
  if (n < 0.001) return '<0.001'
  return n.toFixed(n < 1 ? 3 : 2)
}

function StatItem({
  label,
  value,
  icon,
  delay,
}: {
  label: string
  value: string
  icon: React.ReactNode
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="flex flex-col items-center justify-center border-r border-white/5 last:border-0"
    >
      <div className="flex items-center gap-1 text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5">
        {icon} {label}
      </div>
      <p className="text-xs sm:text-sm font-mono text-zinc-300 tabular-nums font-medium">{value}</p>
    </motion.div>
  )
}

export function VaultCard({ vault }: { vault: VaultDescriptor }) {
  const { data: auctionStatus } = useReadContract({
    address: vault.ccaStrategy,
    abi: CCA_STRATEGY_ABI,
    functionName: 'getAuctionStatus',
  })

  const isActive = auctionStatus?.[1] ?? false
  const isGraduated = auctionStatus?.[2] ?? false
  const currencyRaised = auctionStatus?.[4] ?? 0n

  const isUnlocked = isActive || isGraduated
  const phaseLabel = isActive ? 'Auction Phase' : isGraduated ? 'Vault Active' : 'Not Launched'

  // Prefer Zora indexed preview image (fast), then fall back to onchain tokenURI metadata.
  const { data: zoraCoin } = useZoraCoin(vault.token)
  const zoraPreview =
    zoraCoin?.mediaContent?.previewImage?.medium || zoraCoin?.mediaContent?.previewImage?.small || undefined

  const { imageUrl } = useTokenMetadata(vault.token)
  const image = zoraPreview || imageUrl || '/logo.svg'

  return (
    <div className="relative w-full max-w-[420px] mx-auto [perspective:1000px]">
      {/* Backlight */}
      <motion.div
        animate={{
          opacity: isUnlocked ? [0.55, 0.75, 0.55] : [0.08, 0.15, 0.08],
          scale: isUnlocked ? [1, 1.1, 1] : [1, 1.05, 1],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-brand-primary/12 blur-[100px] rounded-full pointer-events-none"
      />

      <motion.div
        className="relative bg-[#080808]/90 backdrop-blur-2xl border border-white/5 rounded-[40px] p-8 overflow-hidden shadow-2xl ring-1 ring-white/5"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none opacity-20 h-32" />

        <div className="flex justify-between items-center mb-10 relative z-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`w-1.5 h-1.5 rounded-full shadow-[0_0_10px_#0052FF] ${
                  isUnlocked ? 'bg-brand-primary' : 'bg-zinc-700'
                }`}
              />
              <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 uppercase">{phaseLabel}</span>
            </div>
            <h2 className="text-2xl font-sans text-white tracking-wide">
              {vault.name}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent">
                Vault
              </span>
            </h2>
          </div>
          <div className="bg-[#111] px-3 py-1.5 rounded-full border border-white/5 flex items-center gap-2 shadow-inner">
            <ShieldCheck size={12} className="text-brand-primary" />
            <span className="text-[10px] font-mono text-zinc-400">ERC-4626 • Base</span>
          </div>
        </div>

        <div className="flex justify-center mb-12 relative z-20 scale-105">
          <div className="w-56 h-56 relative">
            <OrbBorder intensity={isUnlocked ? 'high' : 'medium'}>
              <div className="w-full h-full p-[6px] bg-obsidian rounded-full">
                <div className="w-full h-full rounded-full overflow-hidden relative shadow-[inset_0_0_20px_black]">
                  <TokenOrb image={image} isUnlocked={isUnlocked} symbol={vault.symbol} />
                </div>
              </div>
            </OrbBorder>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-10 relative z-10 border-t border-white/5 pt-6">
          <StatItem label="Raised" value={isActive ? `${fmtEth(currencyRaised)} ETH` : '—'} icon={<BarChart3 size={10} />} delay={0.1} />
          <StatItem label="Status" value={isActive ? 'CCA' : isGraduated ? 'Active' : 'Idle'} icon={<Layers size={10} />} delay={0.2} />
          <StatItem label="Symbol" value={vault.symbol} icon={<Layers size={10} />} delay={0.3} />
        </div>

        <Link
          to={`/vault/${vault.vault}`}
          className="relative w-full h-16 rounded-full group cursor-pointer overflow-hidden transition-all duration-300 active:scale-95 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] flex items-center"
        >
          <div className="absolute inset-0 bg-[#0A0A0A] rounded-full" />
          <div className="absolute inset-0 rounded-full border border-white/5 opacity-50 group-hover:border-brand-primary/30 transition-colors duration-500" />

          <div className="absolute inset-0 rounded-full overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-primary/10 to-transparent -translate-x-full group-hover:animate-shimmer w-[200%]" />
          </div>

          <div className="absolute top-0 left-4 right-4 h-[40%] bg-gradient-to-b from-white/10 to-transparent rounded-full blur-[2px]" />

          <div className="relative z-10 h-full flex items-center justify-between px-4 w-full">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#151515] text-zinc-500 border border-white/5 group-hover:border-brand-primary/20 transition-colors">
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] tracking-[0.2em] uppercase font-semibold text-zinc-400 group-hover:text-white transition-colors">
                  View Vault
                </span>
                <span className="text-[10px] font-mono text-zinc-600">
                  {isActive ? 'Bid or deposit to participate' : isGraduated ? 'Deposit & earn' : 'Awaiting launch'}
                </span>
              </div>
            </div>
            <div className="text-zinc-600 group-hover:text-brand-primary transition-colors">
              <ArrowRight size={20} />
            </div>
          </div>
        </Link>
      </motion.div>
    </div>
  )
}

