import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Rocket, Shield, Globe, Zap, ArrowRight, TrendingUp, Users } from 'lucide-react'

const features = [
  {
    icon: Shield,
    title: 'Auto-Compounding',
    description: 'Your Creator Coin works for you. Yield auto-reinvested.',
  },
  {
    icon: Globe,
    title: 'Omnichain',
    description: 'Bridge to any chain via LayerZero. One vault, everywhere.',
  },
  {
    icon: Zap,
    title: '6.9% Tax Hook',
    description: 'Sell taxes fund your jackpot & token burns automatically.',
  },
  {
    icon: TrendingUp,
    title: 'Weekly Lottery',
    description: '90% jackpot to holders. 5% burned. 5% to protocol.',
  },
]

const stats = [
  { label: 'Total Value Locked', value: '$420.69K' },
  { label: 'Creators Onboarded', value: '1' },
  { label: 'Jackpot Pool', value: '0 ETH' },
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

export function Home() {
  return (
    <div className="space-y-16 py-8">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="text-center space-y-6"
      >
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <span className="w-2 h-2 rounded-full bg-vault-500 animate-pulse" />
          <span className="text-surface-300">Now live on Base</span>
        </motion.div>

        <h1 className="font-display text-4xl sm:text-6xl font-black tracking-tight">
          Turn your{' '}
          <span className="text-gradient">Creator Coin</span>
          <br />
          into a <span className="text-gradient">Vault Empire</span>
        </h1>

        <p className="text-surface-400 text-lg max-w-xl mx-auto">
          One click to launch. Auto-compounding yield. Cross-chain liquidity.
          Weekly jackpots for your community.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link to="/launch">
            <motion.button
              className="btn-primary flex items-center gap-2 text-lg px-8 py-4"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Rocket className="w-5 h-5" />
              Launch Your Vault
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </Link>
          <Link to="/dashboard">
            <motion.button
              className="btn-secondary flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Users className="w-5 h-5" />
              Explore Vaults
            </motion.button>
          </Link>
        </div>
      </motion.section>

      {/* Stats */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-3 gap-4"
      >
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={item} className="stat-card text-center">
            <p className="stat-value">{stat.value}</p>
            <p className="stat-label">{stat.label}</p>
          </motion.div>
        ))}
      </motion.section>

      {/* Features */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-8"
      >
        <h2 className="font-display text-2xl font-bold text-center">
          Why CreatorVault?
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={item}
              className="glass-card p-6 space-y-3 group hover:border-vault-500/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-vault-500/10 flex items-center justify-center group-hover:bg-vault-500/20 transition-colors">
                <feature.icon className="w-6 h-6 text-vault-500" />
              </div>
              <h3 className="font-semibold text-lg">{feature.title}</h3>
              <p className="text-surface-400 text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* How it works */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="space-y-8"
      >
        <h2 className="font-display text-2xl font-bold text-center">
          How It Works
        </h2>

        <div className="relative">
          {/* Connection line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-vault-500 via-vault-500/50 to-transparent hidden sm:block" />

          <div className="space-y-6">
            {[
              {
                step: 1,
                title: 'Connect & Deposit',
                desc: 'Connect your wallet, enter your Creator Coin address, and deposit tokens.',
              },
              {
                step: 2,
                title: 'Launch Auction',
                desc: 'Your wrapped shares (wsToken) go live via CCA fair launch.',
              },
              {
                step: 3,
                title: 'Community Grows',
                desc: '6.9% sell tax funds weekly jackpots. Holders win, tokens burn.',
              },
            ].map((step) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="flex items-start gap-4"
              >
                <div className="relative z-10 w-12 h-12 rounded-full bg-vault-500 flex items-center justify-center font-display font-bold text-lg shrink-0">
                  {step.step}
                </div>
                <div className="glass-card p-4 flex-1">
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-surface-400 text-sm mt-1">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* CTA */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass-card p-8 text-center space-y-4 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-vault-500/10 via-transparent to-vault-500/10" />
        <h2 className="font-display text-2xl font-bold relative">
          Ready to launch?
        </h2>
        <p className="text-surface-400 relative">
          Be the next creator to unlock omnichain yield.
        </p>
        <Link to="/launch" className="relative inline-block">
          <motion.button
            className="btn-primary flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Rocket className="w-5 h-5" />
            Get Started
          </motion.button>
        </Link>
      </motion.section>
    </div>
  )
}

