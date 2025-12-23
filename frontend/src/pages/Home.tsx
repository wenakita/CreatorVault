import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Rocket, ArrowRight, Zap, Gift, Shield, Sparkles, Coins, Vault, TrendingUp, Ticket } from 'lucide-react'
import { TechScramble } from '../components/TechScramble'
import { JackpotSunburst } from '../components/JackpotSunburst'

// Base motion timing
const baseEase = [0.4, 0, 0.2, 1] as const

export function Home() {
  return (
    <div className="space-y-10 py-6">
      {/* Hero */}
      <section className="text-center space-y-5 pt-6">
        {/* Chain badges */}
        <motion.div
          className="inline-flex items-center gap-2"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: baseEase }}
        >
          <span className="px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-sm font-medium">
            Base
          </span>
          <span className="text-surface-600">+</span>
          <span className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-sm font-medium">
            Solana
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="font-display text-4xl sm:text-5xl font-black tracking-tight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1, ease: baseEase }}
        >
          <span className="text-gradient">
            <TechScramble text="Earn Together" delay={150} duration={500} />
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-surface-400 text-base max-w-sm mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.3, ease: baseEase }}
        >
          Creator Vaults with shared jackpots.
          <span className="text-white"> Every buy is a lottery entry.</span>
        </motion.p>

        {/* CTA */}
        <motion.div
          className="flex items-center justify-center gap-3 pt-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.4, ease: baseEase }}
        >
          <Link to="/launch">
            <motion.button
              className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Rocket className="w-4 h-4" />
              Launch Vault
            </motion.button>
          </Link>
          <Link to="/dashboard">
            <motion.button
              className="btn-secondary flex items-center gap-2 px-5 py-2.5 text-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Explore
            </motion.button>
          </Link>
        </motion.div>
      </section>

      {/* Jackpot Pool Sunburst */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5, ease: baseEase }}
      >
        <JackpotSunburst
          tokens={[
            { symbol: 'wsAKITA', name: 'Wrapped Staked AKITA', value: 280, color: '#f97316' },
            { symbol: 'wsCREATOR', name: 'Wrapped Staked CREATOR', value: 50, color: '#8b5cf6' },
            { symbol: 'wsDAWG', name: 'Wrapped Staked DAWG', value: 20, color: '#06b6d4' },
          ]}
          totalEth="0.1 ETH"
          totalUsd={350}
        />
      </motion.section>

      {/* Flow - Professional with icons */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3, ease: baseEase }}
        className="glass-card p-5"
      >
        <div className="flex items-center justify-between gap-2">
          {[
            { icon: Coins, label: 'Deposit', color: 'text-yellow-500' },
            { icon: Vault, label: 'Vault', color: 'text-brand-500' },
            { icon: TrendingUp, label: 'Trade', color: 'text-green-500' },
            { icon: Ticket, label: 'Lottery', color: 'text-purple-500' },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-2 flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`p-2 rounded-lg bg-surface-800/50 ${step.color}`}>
                  <step.icon className="w-4 h-4" />
                </div>
                <p className="text-xs text-surface-400 mt-1.5">{step.label}</p>
              </div>
              {i < arr.length - 1 && (
                <ArrowRight className="w-3 h-3 text-surface-700 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </motion.section>

      {/* Features */}
      <section className="grid grid-cols-2 gap-3">
        {[
          {
            icon: <Zap className="w-4 h-4" />,
            title: 'Fair Launch',
            desc: 'CCA prevents sniping',
            color: 'text-yellow-500',
          },
          {
            icon: <Gift className="w-4 h-4" />,
            title: 'Buy-To-Win',
            desc: 'VRF lottery entry',
            color: 'text-brand-500',
          },
          {
            icon: <Shield className="w-4 h-4" />,
            title: 'Transparent',
            desc: '90% • 5% • 5%',
            color: 'text-green-500',
          },
          {
            icon: <Sparkles className="w-4 h-4" />,
            title: 'Cross-Chain',
            desc: 'Base + Solana',
            color: 'text-purple-500',
          },
        ].map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.2, delay: i * 0.05, ease: baseEase }}
            className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-900/30 border border-surface-800/50"
          >
            <div className={`p-1.5 rounded-md bg-surface-800/50 ${feature.color}`}>
              {feature.icon}
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-sm">{feature.title}</h3>
              <p className="text-xs text-surface-500 truncate">{feature.desc}</p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Solana bridge */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3, ease: baseEase }}
        className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img 
              src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" 
              alt="Solana" 
              className="w-7 h-7"
            />
            <div>
              <p className="font-medium text-sm">SOL Users</p>
              <p className="text-xs text-surface-500">Bridge & participate</p>
            </div>
          </div>
          <a
            href="https://docs.base.org/guides/base-solana-bridge"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors"
          >
            Learn More
          </a>
        </div>
      </motion.section>

      {/* Final CTA */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3, ease: baseEase }}
        className="text-center py-4"
      >
        <Link to="/launch">
          <motion.button
            className="btn-primary inline-flex items-center gap-2 px-6 py-3"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Rocket className="w-4 h-4" />
            Create Your Vault
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </Link>
      </motion.section>
    </div>
  )
}
