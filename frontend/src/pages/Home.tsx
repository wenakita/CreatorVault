import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Coins, TrendingUp, Users, Flame } from 'lucide-react'

export function Home() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-24">
      {/* Hero */}
      <section className="py-20 text-center space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <h1 className="text-6xl sm:text-7xl font-bold leading-tight">
            Turn Creator Coins
            <br />
            Into <span className="text-blue-500">Earnings</span>
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Deposit tokens, earn from trades, grow together
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/dashboard" className="btn-primary flex items-center gap-2 text-lg px-8 py-4">
            <Coins className="w-5 h-5" />
            Start Earning
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link to="/launch" className="btn-secondary flex items-center gap-2 text-lg px-8 py-4">
            Create Vault
          </Link>
        </motion.div>
      </section>

      {/* Features */}
      <section className="grid sm:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-8 space-y-4"
        >
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Coins className="w-6 h-6 text-blue-500" />
          </div>
          <h3 className="text-xl font-semibold">Earn Passively</h3>
          <p className="text-zinc-400">
            Deposit creator coins into vaults and earn from every trade automatically
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-8 space-y-4"
        >
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-blue-500" />
          </div>
          <h3 className="text-xl font-semibold">Multi-Strategy Yield</h3>
          <p className="text-zinc-400">
            Auto-deployed across Uniswap, Ajna, and more for optimized returns
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card p-8 space-y-4"
        >
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Flame className="w-6 h-6 text-blue-500" />
          </div>
          <h3 className="text-xl font-semibold">Deflationary Burns</h3>
          <p className="text-zinc-400">
            Vault tokens burn from fees, increasing everyone's share proportionally
          </p>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="card p-12 space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold">How It Works</h2>
          <p className="text-zinc-400 text-lg">Three simple steps to start earning</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-8">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500 text-white flex items-center justify-center text-2xl font-bold">
              1
            </div>
            <h3 className="text-xl font-semibold">Deposit Creator Coins</h3>
            <p className="text-zinc-400">
              Find a vault and deposit your creator coins to receive vault tokens (wsTokens)
            </p>
          </div>

          <div className="space-y-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500 text-white flex items-center justify-center text-2xl font-bold">
              2
            </div>
            <h3 className="text-xl font-semibold">Earn From Trades</h3>
            <p className="text-zinc-400">
              6.9% fees from swaps go to the jackpot, burns, and treasury automatically
            </p>
          </div>

          <div className="space-y-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500 text-white flex items-center justify-center text-2xl font-bold">
              3
            </div>
            <h3 className="text-xl font-semibold">Grow Together</h3>
            <p className="text-zinc-400">
              Your vault tokens grow in value as the ecosystem expands
            </p>
          </div>
        </div>
      </section>

      {/* For Creators */}
      <section className="card p-12 space-y-8 bg-gradient-to-br from-blue-500/5 to-transparent border-blue-500/20">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-blue-500">
            <Users className="w-5 h-5" />
            <span className="text-sm font-medium uppercase tracking-wider">For Creators</span>
          </div>
          <h2 className="text-4xl font-bold">Launch Your Vault</h2>
          <p className="text-zinc-400 text-lg max-w-2xl">
            Create a vault for your coin, run a fair CCA auction, and start earning with your community
          </p>
        </div>

        <Link to="/launch" className="btn-primary inline-flex items-center gap-2">
          Create Vault
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* CTA */}
      <section className="text-center py-12 space-y-8">
        <h2 className="text-5xl font-bold">
          Ready to start earning?
        </h2>
        <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4">
          <Coins className="w-5 h-5" />
          Browse Vaults
          <ArrowRight className="w-5 h-5" />
        </Link>
      </section>
    </div>
  )
}
