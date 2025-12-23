import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Rocket, Shield, Globe, Zap, ArrowRight, TrendingUp, Users, Heart, Sparkles } from 'lucide-react'

const features = [
  {
    icon: Heart,
    title: 'Earn Together',
    description: 'Creators & communities share in every trade. Aligned incentives.',
  },
  {
    icon: Globe,
    title: 'Omnichain',
    description: 'Bridge to any chain via LayerZero. One vault, everywhere.',
  },
  {
    icon: Zap,
    title: '6.9% Trade Fee',
    description: 'Every buy AND sell funds the jackpot pool & token burns.',
  },
  {
    icon: Sparkles,
    title: 'Buy-To-Win',
    description: 'Every purchase = VRF lottery entry. Random draws, fair odds.',
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
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
          <span className="text-surface-300">Now live on Base</span>
        </motion.div>

        <h1 className="font-display text-4xl sm:text-6xl font-black tracking-tight">
          <span className="text-gradient">Earn Together</span>
          <br />
          Creator Vaults
        </h1>

        <p className="text-surface-400 text-lg max-w-xl mx-auto">
          One click to launch. Creators & communities aligned.
          Every trade builds the jackpot. Every buy is a chance to win.
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

      {/* Earn Together Explainer */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-6 sm:p-8 border-brand-500/30"
      >
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shrink-0">
            <Heart className="w-10 h-10 text-white" />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="font-display text-xl font-bold mb-2">
              What is "Earn Together"?
            </h2>
            <p className="text-surface-400">
              Traditional creator tokens pit communities against each other. CreatorVault flips the script:
              <span className="text-white font-medium"> 6.9% of every trade</span> goes to a shared jackpot pool.
              <span className="text-brand-400 font-medium"> Every buy is a lottery entry</span>.
              Winners are picked randomly via Chainlink VRF. Everyone has a fair shot.
            </p>
          </div>
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
              className="glass-card p-6 space-y-3 group hover:border-brand-500/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
                <feature.icon className="w-6 h-6 text-brand-500" />
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
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-500 via-brand-500/50 to-transparent hidden sm:block" />

          <div className="space-y-6">
            {[
              {
                step: 1,
                title: 'Connect & Deposit',
                desc: 'Connect your wallet, enter your Creator Coin address, and deposit tokens.',
              },
              {
                step: 2,
                title: 'Fair Launch via CCA',
                desc: 'Your wrapped shares (wsToken) go live via Continuous Clearing Auction. No sniping.',
              },
              {
                step: 3,
                title: 'Earn Together',
                desc: '6.9% trade fee on buys AND sells. Every buy = VRF lottery entry. Random winners!',
              },
            ].map((step) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="flex items-start gap-4"
              >
                <div className="relative z-10 w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center font-display font-bold text-lg shrink-0">
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

      {/* Buy-To-Win Explainer */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="glass-card p-6 border-yellow-500/30 bg-yellow-500/5"
      >
        <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          Buy-To-Win: How the Lottery Works
        </h3>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-yellow-400 font-medium mb-1">🎫 Entry</p>
            <p className="text-surface-400">Every wsToken <span className="text-white">BUY</span> automatically enters you into the jackpot draw.</p>
          </div>
          <div>
            <p className="text-yellow-400 font-medium mb-1">🎲 Random Draw</p>
            <p className="text-surface-400">Chainlink VRF v2.5 picks winners at random intervals. Fair & verifiable.</p>
          </div>
          <div>
            <p className="text-yellow-400 font-medium mb-1">💰 Distribution</p>
            <p className="text-surface-400">90% to winner, 5% burned forever, 5% to protocol.</p>
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
        <div className="absolute inset-0 bg-gradient-to-r from-brand-500/10 via-transparent to-brand-500/10" />
        <h2 className="font-display text-2xl font-bold relative">
          Ready to Earn Together?
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
