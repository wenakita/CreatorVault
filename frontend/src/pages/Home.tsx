import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export function Home() {
  return (
    <div className="relative">
      {/* Subtle particle atmosphere */}
      <div className="particles">
        <div className="absolute top-1/4 left-1/3 w-px h-px bg-purple-500 rounded-full" style={{ animation: 'particle-float 8s ease-in-out infinite' }} />
        <div className="absolute top-1/2 right-1/4 w-px h-px bg-cyan-500 rounded-full" style={{ animation: 'particle-float 10s ease-in-out infinite', animationDelay: '2s' }} />
        <div className="absolute bottom-1/3 left-1/2 w-px h-px bg-amber-500 rounded-full" style={{ animation: 'particle-float 12s ease-in-out infinite', animationDelay: '4s' }} />
      </div>

      {/* Hero - Cinematic Letterbox */}
      <section className="cinematic-section min-h-screen flex items-center justify-center">
        <div className="max-w-6xl mx-auto px-6 text-center space-y-16">
          {/* Status Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="inline-flex items-center gap-3"
          >
            <div className="status-active">
              <span className="label">Live on Base</span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.428 }}
            className="space-y-6"
          >
            <h1 className="headline text-7xl sm:text-8xl lg:text-9xl leading-[1.05]">
              Turn Creator Coins
              <br />
              <span className="glow-purple">Into Earnings</span>
            </h1>
          </motion.div>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.856 }}
            className="text-xl text-zinc-500 font-light tracking-wide max-w-2xl mx-auto"
          >
            Deposit tokens · Earn from trades · Grow together
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.284 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8"
          >
            <Link to="/dashboard" className="btn-accent">
              Start Earning <ArrowRight className="w-4 h-4 inline ml-2" />
            </Link>
            <Link to="/launch" className="btn-primary">
              Create Vault
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features - Data Terminal Style */}
      <section className="cinematic-section">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-20"
          >
            <span className="label">Features</span>
            <h2 className="headline text-5xl mt-6">How It Works</h2>
          </motion.div>

          <div className="space-y-0">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="data-row group"
            >
              <div className="space-y-2">
                <span className="label">Step 01</span>
                <h3 className="text-2xl text-white font-light">Deposit Creator Coins</h3>
                <p className="text-zinc-600 text-sm font-light">
                  Find a vault and deposit to receive vault tokens
                </p>
              </div>
              <div className="text-right">
                <div className="value mono text-cyan-400">~1:1</div>
                <span className="label">Exchange Rate</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="data-row group"
            >
              <div className="space-y-2">
                <span className="label">Step 02</span>
                <h3 className="text-2xl text-white font-light">Earn From Trades</h3>
                <p className="text-zinc-600 text-sm font-light">
                  Fees from swaps distributed automatically
                </p>
              </div>
              <div className="text-right">
                <div className="value mono text-purple-400">6.9%</div>
                <span className="label">Trade Fee</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="data-row group"
            >
              <div className="space-y-2">
                <span className="label">Step 03</span>
                <h3 className="text-2xl text-white font-light">Grow Together</h3>
                <p className="text-zinc-600 text-sm font-light">
                  Value increases as ecosystem expands
                </p>
              </div>
              <div className="text-right">
                <div className="value mono text-amber-400">25%</div>
                <span className="label">Per Strategy</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Strategies - Terminal Display */}
      <section className="cinematic-section bg-zinc-950/20">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-20"
          >
            <span className="label">Multi-Strategy Allocation</span>
            <h2 className="headline text-5xl mt-6">Automated Yield</h2>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-900">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="bg-black p-8 space-y-4"
            >
              <span className="label">Uniswap V3</span>
              <div className="value mono text-4xl glow-cyan">25%</div>
              <div className="text-zinc-600 text-xs font-light">WETH LP</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-black p-8 space-y-4"
            >
              <span className="label">Stable Pair</span>
              <div className="value mono text-4xl glow-cyan">25%</div>
              <div className="text-zinc-600 text-xs font-light">USDC LP</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-black p-8 space-y-4"
            >
              <span className="label">Ajna Protocol</span>
              <div className="value mono text-4xl glow-purple">25%</div>
              <div className="text-zinc-600 text-xs font-light">Lending</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="bg-black p-8 space-y-4"
            >
              <span className="label">Reserve</span>
              <div className="value mono text-4xl">25%</div>
              <div className="text-zinc-600 text-xs font-light">Idle</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* For Creators - Minimal CTA */}
      <section className="cinematic-section">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <span className="label">For Creators</span>
              <h2 className="headline text-6xl leading-tight">
                Launch Your
                <br />
                <span className="glow-amber">Vault</span>
              </h2>
              <p className="text-zinc-500 text-lg font-light leading-relaxed">
                Create a vault for your coin, run a fair CCA auction, and start earning with your community
              </p>
              <Link to="/launch" className="btn-accent inline-block">
                Create Vault <ArrowRight className="w-4 h-4 inline ml-2" />
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="space-y-0"
            >
              <div className="data-row">
                <span className="label">CCA Duration</span>
                <div className="value mono">7 Days</div>
              </div>
              <div className="data-row">
                <span className="label">Min Deposit</span>
                <div className="value mono">50M Tokens</div>
              </div>
              <div className="data-row border-none">
                <span className="label">Fair Launch</span>
                <div className="value mono text-cyan-400">100%</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA - Minimal */}
      <section className="cinematic-section">
        <div className="max-w-3xl mx-auto px-6 text-center space-y-12">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="headline text-6xl lg:text-7xl mb-8">
              Ready to start earning?
            </h2>
            <Link to="/dashboard" className="btn-accent inline-block">
              Browse Vaults <ArrowRight className="w-4 h-4 inline ml-2" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
