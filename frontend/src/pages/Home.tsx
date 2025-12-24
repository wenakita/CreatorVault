import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Coins, TrendingUp, Users, Flame } from 'lucide-react'

export function Home() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-32">
      {/* Hero */}
      <section className="py-24 text-center space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-zinc-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            Live on Base
          </div>
          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold leading-[1.1] tracking-tighter">
            Turn Creator Coins
            <br />
            Into <span className="text-gradient bg-gradient-to-r from-blue-400 via-blue-500 to-purple-500">Earnings</span>
          </h1>
          <p className="text-xl sm:text-2xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Deposit tokens, earn from trades, grow together
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
        >
          <Link to="/dashboard">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary flex items-center gap-2 text-lg px-10 py-4 rounded-2xl"
            >
              <Coins className="w-5 h-5" />
              Start Earning
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </Link>
          <Link to="/launch">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-secondary flex items-center gap-2 text-lg px-10 py-4 rounded-2xl"
            >
              Create Vault
            </motion.button>
          </Link>
        </motion.div>
      </section>

      {/* Features */}
      <section className="grid sm:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-8 space-y-4 group"
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center transition-all group-hover:bg-blue-500/20 group-hover:scale-110">
            <Coins className="w-7 h-7 text-blue-500" />
          </div>
          <h3 className="text-xl font-semibold tracking-tight">Earn Passively</h3>
          <p className="text-zinc-400 leading-relaxed">
            Deposit creator coins into vaults and earn from every trade automatically
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-8 space-y-4 group"
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center transition-all group-hover:bg-blue-500/20 group-hover:scale-110">
            <TrendingUp className="w-7 h-7 text-blue-500" />
          </div>
          <h3 className="text-xl font-semibold tracking-tight">Multi-Strategy Yield</h3>
          <p className="text-zinc-400 leading-relaxed">
            Auto-deployed across Uniswap, Ajna, and more for optimized returns
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card p-8 space-y-4 group"
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center transition-all group-hover:bg-blue-500/20 group-hover:scale-110">
            <Flame className="w-7 h-7 text-blue-500" />
          </div>
          <h3 className="text-xl font-semibold tracking-tight">Deflationary Burns</h3>
          <p className="text-zinc-400 leading-relaxed">
            Vault tokens burn from fees, increasing everyone's share proportionally
          </p>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="card p-12 lg:p-16 space-y-16">
        <div className="text-center space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">How It Works</h2>
          <p className="text-zinc-400 text-lg lg:text-xl">Three simple steps to start earning</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-12">
          <div className="space-y-5 group">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-500/25 group-hover:scale-110 transition-transform">
              1
            </div>
            <h3 className="text-xl font-semibold tracking-tight">Deposit Creator Coins</h3>
            <p className="text-zinc-400 leading-relaxed">
              Find a vault and deposit your creator coins to receive vault tokens (wsTokens)
            </p>
          </div>

          <div className="space-y-5 group">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-500/25 group-hover:scale-110 transition-transform">
              2
            </div>
            <h3 className="text-xl font-semibold tracking-tight">Earn From Trades</h3>
            <p className="text-zinc-400 leading-relaxed">
              6.9% fees from swaps go to the jackpot, burns, and treasury automatically
            </p>
          </div>

          <div className="space-y-5 group">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-500/25 group-hover:scale-110 transition-transform">
              3
            </div>
            <h3 className="text-xl font-semibold tracking-tight">Grow Together</h3>
            <p className="text-zinc-400 leading-relaxed">
              Your vault tokens grow in value as the ecosystem expands
            </p>
          </div>
        </div>
      </section>

      {/* For Creators */}
      <section className="relative card p-12 lg:p-16 space-y-8 overflow-hidden border-blue-500/20">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/5 pointer-events-none" />
        <div className="relative space-y-6">
          <div className="flex items-center gap-2 text-blue-400">
            <Users className="w-5 h-5" />
            <span className="text-sm font-medium uppercase tracking-wider">For Creators</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">Launch Your Vault</h2>
          <p className="text-zinc-400 text-lg lg:text-xl max-w-2xl leading-relaxed">
            Create a vault for your coin, run a fair CCA auction, and start earning with your community
          </p>
        </div>

        <Link to="/launch" className="relative">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4 rounded-2xl"
          >
            Create Vault
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </Link>
      </section>

      {/* CTA */}
      <section className="text-center py-16 space-y-10">
        <h2 className="text-5xl lg:text-6xl font-bold tracking-tight">
          Ready to start earning?
        </h2>
        <Link to="/dashboard">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn-primary inline-flex items-center gap-3 text-lg px-10 py-5 rounded-2xl"
          >
            <Coins className="w-6 h-6" />
            Browse Vaults
            <ArrowRight className="w-6 h-6" />
          </motion.button>
        </Link>
      </section>
    </div>
  )
}
