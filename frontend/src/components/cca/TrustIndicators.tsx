import { motion } from 'framer-motion'
import { Shield, CheckCircle, Lock, ExternalLink, Clock, Zap } from 'lucide-react'

interface TrustIndicatorsProps {
  strategyAddress: string
  auctionAddress?: string
}

export function TrustIndicators({ strategyAddress, auctionAddress }: TrustIndicatorsProps) {
  const indicators = [
    {
      icon: Shield,
      label: 'Verified Contract',
      status: 'Verified on BaseScan',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      link: `https://basescan.org/address/${strategyAddress}`,
    },
    {
      icon: CheckCircle,
      label: 'Uniswap Protocol',
      status: 'Battle-tested CCA mechanism',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
      link: 'https://cca.uniswap.org',
    },
    {
      icon: Lock,
      label: 'Non-Custodial',
      status: 'You control your funds',
      color: 'text-brand-accent',
      bgColor: 'bg-brand-primary/10',
      borderColor: 'border-brand-primary/20',
    },
  ]

  return (
    <div className="bg-black/40 border border-white/5 rounded-xl p-6">
      <div className="mb-4">
        <h4 className="headline text-lg mb-1">Trust & Security</h4>
        <p className="text-zinc-600 text-xs">
          Built on transparent, audited, battle-tested infrastructure
        </p>
      </div>

      <div className="space-y-3">
        {indicators.map((indicator, index) => (
          <motion.div
            key={indicator.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`${indicator.bgColor} border ${indicator.borderColor} rounded-lg p-4 group hover:scale-[1.02] transition-transform`}
          >
            <div className="flex items-start gap-3">
              <div className={`${indicator.color} mt-0.5`}>
                <indicator.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h5 className={`font-medium ${indicator.color}`}>
                    {indicator.label}
                  </h5>
                  {indicator.link && (
                    <a
                      href={indicator.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="w-3 h-3 text-zinc-600 hover:text-zinc-400" />
                    </a>
                  )}
                </div>
                <p className="text-zinc-600 text-xs mt-1">{indicator.status}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Additional security info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-4 pt-4 border-t border-white/5"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-black/40 border border-white/5 rounded-lg p-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-500" />
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">
              Time-lock Protected
            </div>
          </div>
          <div className="bg-black/40 border border-white/5 rounded-lg p-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-zinc-500" />
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">
              Instant Settlement
            </div>
          </div>
        </div>
      </motion.div>

      {auctionAddress && (
        <div className="mt-4 text-[10px] text-zinc-600 font-mono text-center">
          Auction: {auctionAddress.slice(0, 10)}...{auctionAddress.slice(-8)}
        </div>
      )}
    </div>
  )
}

