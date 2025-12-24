import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Coins, TrendingUp, Users, Flame, Sparkles, Zap } from 'lucide-react'

export function Home() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center justify-center px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[120px] animate-gradient" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] animate-gradient" style={{ animationDelay: '-10s' }} />
        </div>

        <div className="relative max-w-5xl mx-auto text-center space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-3 badge mb-8">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
              <span className="text-zinc-400">Live on Base</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-8"
          >
            <h1 className="text-6xl sm:text-7xl lg:text-8xl xl:text-9xl font-bold leading-[1.05] tracking-[-0.02em]">
              <span className="block text-white">Turn Creator Coins</span>
              <span className="block text-gradient-blue glow-blue">Into Earnings</span>
            </h1>
            <p className="text-xl sm:text-2xl lg:text-3xl text-zinc-400 max-w-3xl mx-auto leading-relaxed font-light">
              Deposit tokens, earn from trades, grow together
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8"
          >
            <Link to="/dashboard">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group btn-primary flex items-center gap-3 text-lg px-10 py-5"
              >
                <Sparkles className="w-5 h-5" />
                Start Earning
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </motion.button>
            </Link>
            <Link to="/launch">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-secondary flex items-center gap-3 text-lg px-10 py-5"
              >
                Create Vault
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="relative max-w-7xl mx-auto px-6 py-32">
        <div className="grid lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="card p-10 group"
          >
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/20 flex items-center justify-center mb-8 transition-transform group-hover:scale-110 group-hover:rotate-3">
              <Coins className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-2xl font-semibold mb-4 tracking-tight">Earn Passively</h3>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Deposit creator coins and earn from every trade automatically
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="card p-10 group"
          >
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/20 flex items-center justify-center mb-8 transition-transform group-hover:scale-110 group-hover:rotate-3">
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-2xl font-semibold mb-4 tracking-tight">Multi-Strategy Yield</h3>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Auto-deployed across Uniswap, Ajna, and more for optimized returns
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="card p-10 group"
          >
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/20 flex items-center justify-center mb-8 transition-transform group-hover:scale-110 group-hover:rotate-3">
              <Flame className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-2xl font-semibold mb-4 tracking-tight">Deflationary Burns</h3>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Vault tokens burn from fees, increasing everyone's share proportionally
            </p>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative max-w-6xl mx-auto px-6 py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl lg:text-6xl font-bold mb-6 tracking-tight">How It Works</h2>
          <p className="text-xl lg:text-2xl text-zinc-400 font-light">Three simple steps to start earning</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <div className="absolute -left-4 top-0 w-1 h-full bg-gradient-to-b from-blue-500 via-blue-500/50 to-transparent rounded-full" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl font-bold text-white mb-8 shadow-2xl shadow-blue-500/30">
              1
            </div>
            <h3 className="text-2xl font-semibold mb-4 tracking-tight">Deposit Creator Coins</h3>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Find a vault and deposit your creator coins to receive vault tokens
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative"
          >
            <div className="absolute -left-4 top-0 w-1 h-full bg-gradient-to-b from-blue-500 via-blue-500/50 to-transparent rounded-full" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl font-bold text-white mb-8 shadow-2xl shadow-blue-500/30">
              2
            </div>
            <h3 className="text-2xl font-semibold mb-4 tracking-tight">Earn From Trades</h3>
            <p className="text-zinc-400 text-lg leading-relaxed">
              6.9% fees from swaps go to jackpot, burns, and treasury automatically
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -left-4 top-0 w-1 h-full bg-gradient-to-b from-blue-500 via-blue-500/50 to-transparent rounded-full" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl font-bold text-white mb-8 shadow-2xl shadow-blue-500/30">
              3
            </div>
            <h3 className="text-2xl font-semibold mb-4 tracking-tight">Grow Together</h3>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Your vault tokens grow in value as the ecosystem expands
            </p>
          </motion.div>
        </div>
      </section>

      {/* For Creators */}
      <section className="relative max-w-6xl mx-auto px-6 py-32">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative card p-16 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]" />
          
          <div className="relative max-w-2xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm font-semibold uppercase tracking-wider text-blue-400">For Creators</span>
            </div>
            
            <h2 className="text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
              Launch Your Vault
            </h2>
            <p className="text-xl lg:text-2xl text-zinc-400 mb-12 leading-relaxed font-light">
              Create a vault for your coin, run a fair CCA auction, and start earning with your community
            </p>
            
            <Link to="/launch">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary flex items-center gap-3 text-lg"
              >
                <Zap className="w-5 h-5" />
                Create Vault
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className="relative max-w-4xl mx-auto px-6 py-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-12"
        >
          <h2 className="text-6xl lg:text-7xl font-bold tracking-tight">
            Ready to start earning?
          </h2>
          <Link to="/dashboard">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-primary flex items-center gap-3 text-xl px-12 py-6 mx-auto"
            >
              <Coins className="w-6 h-6" />
              Browse Vaults
              <ArrowRight className="w-6 h-6" />
            </motion.button>
          </Link>
        </motion.div>
      </section>
    </div>
  )
}
