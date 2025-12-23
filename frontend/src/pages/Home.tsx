import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Rocket, Globe, Zap, ArrowRight, Users, Heart, Sparkles, Trophy, Flame, Shield } from 'lucide-react'
import { TechScramble } from '../components/TechScramble'
import { BaseStep, BaseStepList } from '../components/BaseStep'
import { FeatureCard, FeatureGrid, HighlightCard } from '../components/FeatureCard'

// Base motion timing
const baseEase = [0.4, 0, 0.2, 1] as const

// Stats
const stats = [
  { label: 'Total Value Locked', value: '$420.69K', color: 'text-white' },
  { label: 'Creators', value: '1', color: 'text-brand-400' },
  { label: 'Jackpot Pool', value: '0.1 ETH', color: 'text-yellow-400' },
]

export function Home() {
  return (
    <div className="space-y-16 py-8">
      {/* Hero - Base-style with tech scramble */}
      <section className="text-center space-y-6">
        {/* Live badge */}
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-900 border border-surface-800 text-sm"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: baseEase }}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
          </span>
          <span className="text-surface-300">Now live on Base</span>
        </motion.div>

        {/* Headline with tech scramble effect */}
        <motion.h1
          className="font-display text-4xl sm:text-6xl font-black tracking-tight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.32, delay: 0.1, ease: baseEase }}
        >
          <span className="text-gradient">
            <TechScramble text="Earn Together" delay={200} duration={600} />
          </span>
          <br />
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.4, ease: baseEase }}
          >
            Creator Vaults
          </motion.span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-surface-400 text-lg max-w-xl mx-auto"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.5, ease: baseEase }}
        >
          One click to launch. Creators & communities aligned.
          Every trade builds the jackpot. Every buy is a chance to win.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.6, ease: baseEase }}
        >
          <Link to="/launch">
            <motion.button
              className="btn-primary flex items-center gap-2 text-lg px-8 py-4"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.12, ease: baseEase }}
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
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.12, ease: baseEase }}
            >
              <Users className="w-5 h-5" />
              Explore Vaults
            </motion.button>
          </Link>
        </motion.div>
      </section>

      {/* Stats - OnchainKit style */}
      <section className="grid grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            className="glass-card p-4 text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: 0.1 * index, ease: baseEase }}
          >
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-surface-500 uppercase tracking-wider mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </section>

      {/* Earn Together Highlight - Base Account style */}
      <HighlightCard
        subtitle="The Vision"
        title="What is 'Earn Together'?"
        description="Traditional creator tokens pit communities against each other. CreatorVault flips the script: 6.9% of every trade goes to a shared jackpot pool. Every buy is a lottery entry. Winners are picked randomly via Chainlink VRF."
      >
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Heart className="w-4 h-4 text-brand-500" />
            <span className="text-surface-300">Aligned incentives</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 text-brand-500" />
            <span className="text-surface-300">Fair & verifiable</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Globe className="w-4 h-4 text-brand-500" />
            <span className="text-surface-300">Omnichain</span>
          </div>
        </div>
      </HighlightCard>

      {/* Features - OnchainKit style grid */}
      <section className="space-y-8">
        <motion.h2
          className="font-display text-2xl font-bold text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.24, ease: baseEase }}
        >
          Why CreatorVault?
        </motion.h2>

        <FeatureGrid columns={2}>
          <FeatureCard
            icon={<Heart className="w-6 h-6" />}
            title="Earn Together"
            description="Creators & communities share in every trade. Aligned incentives from day one."
            delay={0}
          />
          <FeatureCard
            icon={<Globe className="w-6 h-6" />}
            title="Omnichain"
            description="Bridge to any chain via LayerZero. One vault, everywhere."
            delay={0.05}
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6" />}
            title="6.9% Trade Fee"
            description="Every buy AND sell funds the jackpot pool & token burns."
            delay={0.1}
          />
          <FeatureCard
            icon={<Sparkles className="w-6 h-6" />}
            title="Buy-To-Win"
            description="Every purchase = VRF lottery entry. Random draws, fair odds."
            delay={0.15}
          />
        </FeatureGrid>
      </section>

      {/* How it Works - Base Account numbered steps */}
      <section className="space-y-8">
        <motion.h2
          className="font-display text-2xl font-bold text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.24, ease: baseEase }}
        >
          How It Works
        </motion.h2>

        <BaseStepList>
          <BaseStep
            number={1}
            title="Connect & Deposit"
            description="Connect your wallet, enter your Creator Coin address, and deposit tokens. Everything deploys in a single gasless transaction via ERC-4337."
            icon={<Rocket className="w-5 h-5" />}
            delay={0}
          />
          <BaseStep
            number={2}
            title="Fair Launch via CCA"
            description="Your wrapped shares (wsToken) go live via Continuous Clearing Auction. No sniping, no front-running. Early participants get the best prices."
            icon={<Shield className="w-5 h-5" />}
            delay={0.1}
          />
          <BaseStep
            number={3}
            title="Earn Together"
            description="6.9% trade fee on buys AND sells. Every buy = VRF lottery entry. 90% to winner, 5% burned, 5% protocol. Random winners, fair odds."
            icon={<Trophy className="w-5 h-5" />}
            delay={0.2}
          />
        </BaseStepList>
      </section>

      {/* Buy-To-Win Explainer */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.32, ease: baseEase }}
        className="glass-card p-6 sm:p-8 border-yellow-500/20"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Buy-To-Win Lottery</h3>
            <p className="text-surface-500 text-sm">Powered by Chainlink VRF v2.5</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎫</span>
              <span className="font-medium text-yellow-400">Entry</span>
            </div>
            <p className="text-surface-400 text-sm">
              Every wsToken <span className="text-white font-medium">BUY</span> on Uniswap V4 enters you into the jackpot draw.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎲</span>
              <span className="font-medium text-yellow-400">Random Draw</span>
            </div>
            <p className="text-surface-400 text-sm">
              Chainlink VRF picks winners at random. Verifiably fair, no manipulation possible.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">💰</span>
              <span className="font-medium text-yellow-400">Distribution</span>
            </div>
            <p className="text-surface-400 text-sm">
              <span className="text-yellow-400">90%</span> winner • <span className="text-red-400">5%</span> burned • <span className="text-brand-400">5%</span> protocol
            </p>
          </div>
        </div>
      </motion.section>

      {/* Final CTA */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.32, ease: baseEase }}
        className="relative overflow-hidden rounded-3xl"
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 via-surface-900 to-surface-900" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl" />
        
        <div className="relative p-8 sm:p-12 text-center space-y-6">
          <h2 className="font-display text-3xl font-bold">
            Ready to <span className="text-gradient">Earn Together</span>?
          </h2>
          <p className="text-surface-400 max-w-md mx-auto">
            Be the next creator to unlock omnichain yield for your community.
          </p>
          <Link to="/launch">
            <motion.button
              className="btn-primary flex items-center gap-2 mx-auto text-lg px-8 py-4"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.12, ease: baseEase }}
            >
              <Rocket className="w-5 h-5" />
              Get Started
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </Link>
        </div>
      </motion.section>
    </div>
  )
}
