import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Rocket, ArrowRight, TrendingDown, TrendingUp, 
  Sparkles, Shield, Zap, Users, ChevronRight,
  Coins, Gift, Lock
} from 'lucide-react'
import { JackpotSunburst } from '../components/JackpotSunburst'

const ease = [0.16, 1, 0.3, 1]

export function Home() {
  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="relative">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="text-center space-y-6 pt-8">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm"
          >
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-slate-400">Now live on</span>
            <span className="text-white font-medium">Base</span>
            <span className="text-slate-600">+</span>
            <span className="text-purple-400 font-medium">Solana</span>
          </motion.div>

          {/* Main headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease }}
            className="space-y-3"
          >
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="text-white">Creator Coins</span>
              <br />
              <span className="text-gradient">That Pay You Back</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-lg mx-auto leading-relaxed">
              Stop holding bags. Deposit your creator coins into vaults 
              and earn from every trade — including a shot at the jackpot.
            </p>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2"
          >
            <Link to="/launch">
              <button className="group relative px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-all shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 flex items-center gap-2">
                <Rocket className="w-4 h-4" />
                Launch Your Vault
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </Link>
            <Link to="/dashboard">
              <button className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all flex items-center gap-2">
                Explore Vaults
                <ChevronRight className="w-4 h-4" />
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Problem → Solution */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease }}
        className="grid md:grid-cols-2 gap-4"
      >
        {/* Problem */}
        <div className="relative p-6 rounded-2xl bg-gradient-to-br from-red-500/5 to-transparent border border-red-500/10">
          <div className="flex items-center gap-2 text-red-400 mb-4">
            <TrendingDown className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">The Problem</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Creator Coins Only Benefit Creators
          </h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            You buy the hype. Creator sells. You're left holding the bag. 
            It's the same pump-and-dump cycle as memecoins — dressed up with a face.
          </p>
        </div>

        {/* Solution */}
        <div className="relative p-6 rounded-2xl bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/10">
          <div className="flex items-center gap-2 text-green-400 mb-4">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">The Solution</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Vaults That Share The Upside
          </h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Deposit your creator coins into CreatorVault. Every trade pays a 6.9% fee 
            that goes back to holders — 90% to a random winner, the rest burned.
          </p>
        </div>
      </motion.section>

      {/* How It Works - Simple */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease }}
        className="text-center"
      >
        <h2 className="text-2xl font-bold text-white mb-8">How It Works</h2>
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {[
            { step: '1', icon: Coins, title: 'Deposit', desc: 'Your creator coin' },
            { step: '2', icon: Lock, title: 'Vault', desc: 'Get wsTokens' },
            { step: '3', icon: Gift, title: 'Earn', desc: 'From every trade' },
          ].map(({ step, icon: Icon, title, desc }, i) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1, ease }}
              className="relative"
            >
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-5 h-5 text-brand-400" />
                </div>
                <div className="text-white font-semibold text-sm">{title}</div>
                <div className="text-slate-500 text-xs mt-1">{desc}</div>
              </div>
              {i < 2 && (
                <ArrowRight className="hidden sm:block absolute top-1/2 -right-3 w-4 h-4 text-slate-700 -translate-y-1/2" />
              )}
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Jackpot Sunburst */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease }}
      >
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white">Live Jackpot</h2>
          <p className="text-slate-500 text-sm mt-1">Every buy is a lottery entry. Winners picked by Chainlink VRF.</p>
        </div>
        <JackpotSunburst
          tokens={[
            { symbol: 'wsAKITA', name: 'Wrapped Staked AKITA', value: 280, color: '#f97316' },
            { symbol: 'wsCREATOR', name: 'Wrapped Staked CREATOR', value: 50, color: '#a855f7' },
            { symbol: 'wsDAWG', name: 'Wrapped Staked DAWG', value: 20, color: '#06b6d4' },
          ]}
          totalEth="0.1 ETH"
          totalUsd={350}
        />
      </motion.section>

      {/* Features */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease }}
      >
        <h2 className="text-2xl font-bold text-white text-center mb-8">Why CreatorVault?</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Zap,
              title: 'Fair Launch',
              desc: 'CCA auctions prevent sniping and front-running',
              color: 'text-yellow-400',
            },
            {
              icon: Gift,
              title: 'Buy-To-Win',
              desc: 'Every purchase is a lottery entry via Chainlink VRF',
              color: 'text-purple-400',
            },
            {
              icon: Shield,
              title: 'Transparent',
              desc: '90% to winner, 5% burned, 5% to protocol',
              color: 'text-green-400',
            },
            {
              icon: Users,
              title: 'Community First',
              desc: 'Holders earn together instead of competing',
              color: 'text-blue-400',
            },
          ].map(({ icon: Icon, title, desc, color }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05, ease }}
              className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
            >
              <Icon className={`w-6 h-6 ${color} mb-3`} />
              <h3 className="text-white font-semibold mb-1">{title}</h3>
              <p className="text-slate-500 text-sm">{desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Cross-chain */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 via-transparent to-brand-500/10 border border-white/5 p-6 sm:p-8"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center border-2 border-slate-900">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <img 
                src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" 
                alt="Solana" 
                className="w-10 h-10 rounded-full border-2 border-slate-900"
              />
            </div>
            <div>
              <h3 className="text-white font-semibold">Base + Solana</h3>
              <p className="text-slate-400 text-sm">Bridge and participate from either chain</p>
            </div>
          </div>
          <a
            href="https://docs.base.org/guides/base-solana-bridge"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-all flex items-center gap-2"
          >
            Learn More
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </motion.section>

      {/* Final CTA */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease }}
        className="text-center py-8"
      >
        <h2 className="text-2xl font-bold text-white mb-3">Ready to earn together?</h2>
        <p className="text-slate-400 mb-6">Turn your creator coins into yield-generating assets.</p>
        <Link to="/launch">
          <button className="group px-8 py-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-lg transition-all shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 flex items-center gap-2 mx-auto">
            <Rocket className="w-5 h-5" />
            Launch Your Vault
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </Link>
      </motion.section>
    </div>
  )
}
