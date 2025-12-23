import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Rocket, ArrowRight, Zap, Gift, Shield, Sparkles } from 'lucide-react'
import { TechScramble } from '../components/TechScramble'

// Base motion timing
const baseEase = [0.4, 0, 0.2, 1] as const

export function Home() {
  return (
    <div className="space-y-12 py-6">
      {/* Hero - Clean & focused */}
      <section className="text-center space-y-6 pt-8">
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
          className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight"
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
          className="text-surface-400 text-lg max-w-md mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.3, ease: baseEase }}
        >
          Creator Vaults with shared jackpots.
          <br />
          <span className="text-white">Every buy is a lottery entry.</span>
        </motion.p>

        {/* CTA */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.4, ease: baseEase }}
        >
          <Link to="/launch">
            <motion.button
              className="btn-primary flex items-center gap-2 px-6 py-3"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Rocket className="w-4 h-4" />
              Launch Vault
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </Link>
          <Link to="/dashboard">
            <motion.button
              className="btn-secondary flex items-center gap-2 px-6 py-3"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Explore
            </motion.button>
          </Link>
        </motion.div>
      </section>

      {/* Stats - Minimal */}
      <motion.section
        className="grid grid-cols-3 gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.5, ease: baseEase }}
      >
        {[
          { value: '$420K', label: 'TVL' },
          { value: '6.9%', label: 'Fee' },
          { value: '0.1 ETH', label: 'Jackpot' },
        ].map((stat) => (
          <div key={stat.label} className="text-center p-4 rounded-xl bg-surface-900/50 border border-surface-800/50">
            <p className="text-xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-surface-500 uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </motion.section>

      {/* How it works - Visual & compact */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3, ease: baseEase }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2">
          {[
            { icon: '🪙', label: 'Deposit', sub: 'Creator Coin' },
            { icon: '→', label: '', sub: '' },
            { icon: '🏦', label: 'Vault', sub: 'wsToken' },
            { icon: '→', label: '', sub: '' },
            { icon: '📈', label: 'Trade', sub: '6.9% fee' },
            { icon: '→', label: '', sub: '' },
            { icon: '🎰', label: 'Lottery', sub: 'VRF draw' },
          ].map((step, i) => (
            <div key={i} className={`flex-shrink-0 text-center ${step.icon === '→' ? 'text-surface-600' : ''}`}>
              <span className="text-2xl">{step.icon}</span>
              {step.label && (
                <>
                  <p className="text-sm font-medium mt-1">{step.label}</p>
                  <p className="text-xs text-surface-500">{step.sub}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </motion.section>

      {/* Features - Clean grid */}
      <section className="grid sm:grid-cols-2 gap-4">
        {[
          {
            icon: <Zap className="w-5 h-5 text-yellow-500" />,
            title: 'Fair Launch',
            desc: 'CCA auctions prevent sniping & front-running',
          },
          {
            icon: <Gift className="w-5 h-5 text-brand-500" />,
            title: 'Buy-To-Win',
            desc: 'Every purchase = VRF lottery entry',
          },
          {
            icon: <Shield className="w-5 h-5 text-green-500" />,
            title: 'Transparent',
            desc: '90% winner • 5% burn • 5% protocol',
          },
          {
            icon: <Sparkles className="w-5 h-5 text-purple-500" />,
            title: 'Cross-Chain',
            desc: 'Base native + Solana bridge support',
          },
        ].map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.2, delay: i * 0.05, ease: baseEase }}
            className="flex items-start gap-3 p-4 rounded-xl bg-surface-900/30 border border-surface-800/50 hover:border-surface-700/50 transition-colors"
          >
            <div className="p-2 rounded-lg bg-surface-800/50">{feature.icon}</div>
            <div>
              <h3 className="font-medium">{feature.title}</h3>
              <p className="text-sm text-surface-500">{feature.desc}</p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Solana bridge - Compact */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3, ease: baseEase }}
        className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <img 
              src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" 
              alt="Solana" 
              className="w-8 h-8"
            />
            <div>
              <p className="font-medium">SOL Users Welcome</p>
              <p className="text-sm text-surface-400">Bridge & enter lottery from Solana</p>
            </div>
          </div>
          <a
            href="https://docs.base.org/guides/base-solana-bridge"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 text-sm font-medium hover:bg-purple-500/20 transition-colors"
          >
            Learn More →
          </a>
        </div>
      </motion.section>

      {/* Final CTA - Minimal */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.3, ease: baseEase }}
        className="text-center py-8"
      >
        <p className="text-surface-500 mb-4">Ready to launch?</p>
        <Link to="/launch">
          <motion.button
            className="btn-primary inline-flex items-center gap-2 px-8 py-4 text-lg"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Rocket className="w-5 h-5" />
            Create Your Vault
          </motion.button>
        </Link>
      </motion.section>
    </div>
  )
}
