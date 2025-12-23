import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  Users,
  Coins,
  ArrowUpRight,
  Sparkles,
  Gift,
  Flame,
} from 'lucide-react'
import { AKITA } from '../config/contracts'

// Example vault data - in production this comes from the registry
const vaults = [
  {
    id: 'akita',
    name: 'AKITA',
    symbol: 'sAKITA',
    wrappedSymbol: 'wsAKITA',
    token: AKITA.token,
    vault: AKITA.vault,
    tvl: '$420,690',
    apy: '42.0%',
    holders: 69,
    jackpot: '0.1 ETH',
    nextDraw: '6d 12h',
    status: 'active',
    color: 'from-orange-500 to-red-600',
  },
]

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export function Dashboard() {
  return (
    <div className="space-y-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="font-display text-3xl font-bold">Creator Vaults</h1>
        <p className="text-surface-400">
          Explore and invest in creator-powered omnichain vaults
        </p>
      </motion.div>

      {/* Stats Overview */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        <motion.div variants={item} className="stat-card">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-vault-500/10 flex items-center justify-center">
              <Coins className="w-4 h-4 text-vault-500" />
            </div>
          </div>
          <p className="stat-value">$420.69K</p>
          <p className="stat-label">Total TVL</p>
        </motion.div>

        <motion.div variants={item} className="stat-card">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
          </div>
          <p className="stat-value">42.0%</p>
          <p className="stat-label">Avg APY</p>
        </motion.div>

        <motion.div variants={item} className="stat-card">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <p className="stat-value">{vaults.length}</p>
          <p className="stat-label">Active Vaults</p>
        </motion.div>

        <motion.div variants={item} className="stat-card">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Gift className="w-4 h-4 text-yellow-500" />
            </div>
          </div>
          <p className="stat-value">0.1 ETH</p>
          <p className="stat-label">Total Jackpots</p>
        </motion.div>
      </motion.div>

      {/* Vault Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-vault-500" />
          Featured Vaults
        </h2>

        <div className="grid gap-4">
          {vaults.map((vault) => (
            <motion.div key={vault.id} variants={item}>
              <Link to={`/vault/${vault.vault}`}>
                <div className="glass-card p-6 hover:border-vault-500/50 transition-all group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-14 h-14 rounded-xl bg-gradient-to-br ${vault.color} flex items-center justify-center font-display font-bold text-xl text-white`}
                      >
                        {vault.symbol[0]}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          {vault.name}
                          {vault.status === 'active' && (
                            <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                              Active
                            </span>
                          )}
                        </h3>
                        <p className="text-surface-400 text-sm">
                          {vault.symbol} → {vault.wrappedSymbol}
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-surface-500 group-hover:text-vault-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>

                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-surface-500 uppercase tracking-wider">TVL</p>
                      <p className="font-semibold text-lg">{vault.tvl}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-500 uppercase tracking-wider">APY</p>
                      <p className="font-semibold text-lg text-green-400">{vault.apy}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-500 uppercase tracking-wider flex items-center gap-1">
                        <Gift className="w-3 h-3" /> Jackpot
                      </p>
                      <p className="font-semibold text-lg text-yellow-400">{vault.jackpot}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-500 uppercase tracking-wider flex items-center gap-1">
                        <Flame className="w-3 h-3" /> Next Draw
                      </p>
                      <p className="font-semibold text-lg">{vault.nextDraw}</p>
                    </div>
                  </div>

                  {/* Progress bar showing time to next lottery */}
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-xs text-surface-500">
                      <span>Lottery Progress</span>
                      <span>~65%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-vault-500 to-vault-400"
                        initial={{ width: 0 }}
                        animate={{ width: '65%' }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Empty State / CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="glass-card p-8 text-center space-y-4 border-dashed"
      >
        <div className="w-12 h-12 rounded-xl bg-vault-500/10 flex items-center justify-center mx-auto">
          <Sparkles className="w-6 h-6 text-vault-500" />
        </div>
        <h3 className="font-semibold text-lg">Launch Your Vault</h3>
        <p className="text-surface-400 text-sm max-w-md mx-auto">
          Are you a creator with your own token? Turn it into an omnichain vault and
          reward your community with weekly jackpots.
        </p>
        <Link to="/launch">
          <button className="btn-primary">Get Started</button>
        </Link>
      </motion.div>
    </div>
  )
}

