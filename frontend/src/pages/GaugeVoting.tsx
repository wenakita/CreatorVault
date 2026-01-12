import { motion } from 'framer-motion'
import { VaultGaugeVotingPanel } from '../components/ve33'
import { AKITA } from '../config/contracts'
import { toShareSymbol } from '@/lib/tokenSymbols'

// Example vaults - in production, fetch from registry
const EXAMPLE_VAULTS = [
  {
    address: AKITA.vault,
    name: 'AKITA Vault',
    tvl: '$1.2M',
  },
  // Add more vaults as they're deployed
]

const SHARE_SYMBOL = toShareSymbol('AKITA')

export default function GaugeVoting() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-primary/10 to-transparent" />
        
        <div className="max-w-4xl mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
                ve(3,3) Gauge Voting
              </span>
            </h1>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              Lock your {SHARE_SYMBOL} to earn veAKITA voting power. Vote weekly to direct 
              jackpot probability to your favorite creator vaults.
            </p>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-4 mb-12"
          >
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-brand-primary">69%</div>
              <div className="text-sm text-zinc-500">Jackpot Pool</div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-brand-primary">21.39%</div>
              <div className="text-sm text-zinc-500">PPS Burn</div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-brand-primary">9.61%</div>
              <div className="text-sm text-zinc-500">Protocol</div>
            </div>
          </motion.div>

          {/* How It Works */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 mb-12"
          >
            <h2 className="text-xl font-bold text-white mb-4">How ve(3,3) Works</h2>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-brand-primary/15 text-brand-primary flex items-center justify-center mx-auto mb-2 font-bold">1</div>
                <div className="text-sm text-zinc-300 font-medium">Lock {SHARE_SYMBOL}</div>
                <div className="text-xs text-zinc-500 mt-1">Get veAKITA power</div>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-brand-primary/15 text-brand-primary flex items-center justify-center mx-auto mb-2 font-bold">2</div>
                <div className="text-sm text-zinc-300 font-medium">Vote Weekly</div>
                <div className="text-xs text-zinc-500 mt-1">Direct probability</div>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-brand-primary/15 text-brand-primary flex items-center justify-center mx-auto mb-2 font-bold">3</div>
                <div className="text-sm text-zinc-300 font-medium">Boost Vaults</div>
                <div className="text-xs text-zinc-500 mt-1">Higher jackpot odds</div>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-brand-primary/15 text-brand-primary flex items-center justify-center mx-auto mb-2 font-bold">4</div>
                <div className="text-sm text-zinc-300 font-medium">Personal Boost</div>
                <div className="text-xs text-zinc-500 mt-1">Up to 2.5x odds</div>
              </div>
            </div>
          </motion.div>

          {/* Voting Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <VaultGaugeVotingPanel vaults={EXAMPLE_VAULTS} />
          </motion.div>

          {/* Formula Explanation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12 bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6"
          >
            <h2 className="text-xl font-bold text-white mb-4">Probability Formula</h2>
            <div className="font-mono text-sm bg-zinc-800/50 rounded-lg p-4 overflow-x-auto">
              <div className="text-brand-primary">Final Probability = Base × Personal Boost × Vault Weight</div>
              <div className="mt-4 text-zinc-400 space-y-2">
                <div>• <span className="text-zinc-300">Base</span> = f(swap size) → $1 = 0.0004%, $10K = 4%</div>
                <div>• <span className="text-zinc-300">Personal Boost</span> = f(veAKITA lock) → 1.0x to 2.5x</div>
                <div>• <span className="text-zinc-300">Vault Weight</span> = f(votes for vault) → 1% min to 100%</div>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-brand-primary/10 border border-brand-primary/30 rounded-lg">
              <div className="text-brand-accent font-medium mb-2">Example</div>
              <div className="text-sm text-zinc-300">
                User swaps $1,000 → base 0.4% probability<br />
                User has 2.5x boost from 4-year veAKITA lock<br />
                Vault has 30% of total votes<br />
                <span className="text-brand-primary font-medium">Final: 0.4% × 2.5 × 0.30 = 0.30% probability</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}


