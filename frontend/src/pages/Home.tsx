import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Rocket, ArrowRight, TrendingDown, TrendingUp, 
  Shield, Zap, Users, ChevronRight,
  Coins, Gift, Lock, Trophy, Flame, Building2
} from 'lucide-react'
import { LotteryDistributionCompact } from '../components/DistributionChart'
import { 
  TechScramble, 
  SlideUp, 
  FadeIn, 
  Stagger, 
  StaggerItem,
  BASE_EASE,
  DURATION,
  BaseSquare
} from '../components/BaseMotion'

export function Home() {
  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="relative">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#0052FF]/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-500/8 rounded-full blur-[100px]" />
        </div>

        <div className="text-center space-y-6 pt-8">
          {/* Badge with Square-led animation */}
          <FadeIn delay={0.1}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-slate-400">Now live on</span>
              <span className="text-white font-medium">Base</span>
              <span className="text-slate-600">+</span>
              <span className="text-purple-400 font-medium">Solana</span>
            </div>
          </FadeIn>

          {/* Main headline with Tech Scramble */}
          <SlideUp delay={0.15}>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="text-white">Creator Coins</span>
              <br />
              <span className="text-gradient">
                <TechScramble text="That Pay You Back" delay={300} duration={700} />
              </span>
            </h1>
          </SlideUp>

          {/* Subtitle - fades in after scramble */}
          <FadeIn delay={0.8}>
            <p className="text-slate-400 text-lg max-w-lg mx-auto leading-relaxed">
              Deposit creator coins. Earn from every trade. Win the jackpot.
            </p>
          </FadeIn>

          {/* CTA - snappy hover states */}
          <FadeIn delay={0.9}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link to="/launch">
                <motion.button 
                  className="group relative px-6 py-3 rounded-xl bg-[#0052FF] hover:bg-[#0052FF]/90 text-white font-semibold transition-colors shadow-lg shadow-[#0052FF]/25 hover:shadow-[#0052FF]/40 flex items-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: DURATION.fast, ease: BASE_EASE }}
                >
                  <Rocket className="w-4 h-4" />
                  Launch Your Vault
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </motion.button>
              </Link>
              <Link to="/dashboard">
                <motion.button 
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-colors flex items-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: DURATION.fast, ease: BASE_EASE }}
                >
                  Explore Vaults
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Problem → Solution */}
      <Stagger className="grid md:grid-cols-2 gap-4" delay={0.2}>
        {/* Problem */}
        <StaggerItem>
          <div className="relative p-6 rounded-2xl bg-gradient-to-br from-red-500/5 to-transparent border border-red-500/10 h-full">
            <div className="flex items-center gap-2 text-red-400 mb-4">
              <TrendingDown className="w-5 h-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">The Problem</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Creator Coins Only Benefit Creators
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              You buy. Creator sells. You hold the bag.
              <br />
              Same cycle as memecoins, different face.
            </p>
          </div>
        </StaggerItem>

        {/* Solution */}
        <StaggerItem>
          <div className="relative p-6 rounded-2xl bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/10 h-full">
            <div className="flex items-center gap-2 text-green-400 mb-4">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">The Solution</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Vaults That Share the Upside
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Deposit creator coins. Earn from every trade.
              <br />
              6.9% fee split: 69% jackpot, 21% burned, 10% treasury.
            </p>
          </div>
        </StaggerItem>
      </Stagger>

      {/* How It Works - Simple with stagger */}
      <FadeIn delay={0.1}>
        <section className="text-center">
          <h2 className="text-2xl font-bold text-white mb-8">How It Works</h2>
          <Stagger className="grid grid-cols-3 gap-4 max-w-2xl mx-auto" delay={0.1}>
            {[
              { step: '1', icon: Coins, title: 'Deposit', desc: 'Your creator coin' },
              { step: '2', icon: Lock, title: 'Vault', desc: 'Get wsTokens' },
              { step: '3', icon: Gift, title: 'Earn', desc: 'From every trade' },
            ].map(({ step, icon: Icon, title, desc }, i) => (
              <StaggerItem key={step}>
                <div className="relative">
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-[#0052FF]/10 flex items-center justify-center mx-auto mb-3">
                      <Icon className="w-5 h-5 text-[#0052FF]" />
                    </div>
                    <div className="text-white font-semibold text-sm">{title}</div>
                    <div className="text-slate-500 text-xs mt-1">{desc}</div>
                  </div>
                  {i < 2 && (
                    <ArrowRight className="hidden sm:block absolute top-1/2 -right-3 w-4 h-4 text-slate-700 -translate-y-1/2" />
                  )}
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      </FadeIn>

      {/* Live Jackpot */}
      <FadeIn delay={0.1}>
        <section className="max-w-xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white">Live Jackpot</h2>
            <p className="text-slate-500 text-sm mt-1">Buy. Enter. Win. All onchain.</p>
          </div>
          
          <div className="bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-xl rounded-2xl border border-white/[0.06] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-yellow-500" />
                <h3 className="font-semibold text-white">Prize Pool</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-medium">
                VRF
              </span>
            </div>
            
            <LotteryDistributionCompact jackpotAmount="0.1 ETH" />
            
            <div className="mt-4 pt-4 border-t border-white/[0.04] space-y-2">
              {[
                { icon: Trophy, label: 'Winner', pct: '69%', color: 'text-yellow-400' },
                { icon: Flame, label: 'Burn', pct: '21.4%', color: 'text-red-400' },
                { icon: Building2, label: 'Treasury', pct: '9.6%', color: 'text-blue-400' },
              ].map(({ icon: Icon, label, pct, color }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-slate-400">{label}</span>
                  </div>
                  <span className={`font-semibold ${color}`}>{pct}</span>
                </div>
              ))}
            </div>
            
            <p className="text-[10px] text-slate-500 mt-4 pt-4 border-t border-white/[0.04] text-center">
              6.9% trade fees fund the pool • Every buy = lottery entry
            </p>
          </div>
        </section>
      </FadeIn>

      {/* Features */}
      <FadeIn delay={0.1}>
        <section>
          <h2 className="text-2xl font-bold text-white text-center mb-8">Why CreatorVault?</h2>
          <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Zap,
                title: 'Fair Launch',
                desc: 'No snipers. No front-running. Just fair price discovery.',
                color: 'text-yellow-400',
                bg: 'bg-yellow-400/10',
              },
              {
                icon: Gift,
                title: 'Every Trade = Entry',
                desc: 'Buy to enter. Random winner via Chainlink VRF.',
                color: 'text-purple-400',
                bg: 'bg-purple-400/10',
              },
              {
                icon: Shield,
                title: 'Clear Split',
                desc: '69% jackpot. 21% burned. 10% treasury.',
                color: 'text-green-400',
                bg: 'bg-green-400/10',
              },
              {
                icon: Users,
                title: 'Built for Holders',
                desc: 'Earn together. Not against each other.',
                color: 'text-blue-400',
                bg: 'bg-blue-400/10',
              },
            ].map(({ icon: Icon, title, desc, color, bg }) => (
              <StaggerItem key={title}>
                <motion.div 
                  className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors h-full"
                  whileHover={{ y: -2 }}
                  transition={{ duration: DURATION.fast, ease: BASE_EASE }}
                >
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <h3 className="text-white font-semibold mb-1">{title}</h3>
                  <p className="text-slate-500 text-sm">{desc}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      </FadeIn>

      {/* Cross-chain with Base Square */}
      <FadeIn delay={0.1}>
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 via-transparent to-[#0052FF]/10 border border-white/5 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                <BaseSquare size={40} className="border-2 border-slate-900 rounded-lg" />
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
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              Learn More
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </section>
      </FadeIn>

      {/* Final CTA */}
      <FadeIn delay={0.1}>
        <section className="text-center py-8">
          <h2 className="text-2xl font-bold text-white mb-3">Turn Creator Coins Into Earnings</h2>
          <p className="text-slate-400 mb-6">Launch your vault. Reward your holders. Build onchain.</p>
          <Link to="/launch">
            <motion.button 
              className="group px-8 py-4 rounded-xl bg-[#0052FF] hover:bg-[#0052FF]/90 text-white font-semibold text-lg transition-colors shadow-lg shadow-[#0052FF]/25 hover:shadow-[#0052FF]/40 flex items-center gap-2 mx-auto"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: DURATION.fast, ease: BASE_EASE }}
            >
              <Rocket className="w-5 h-5" />
              Launch Your Vault
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </motion.button>
          </Link>
        </section>
      </FadeIn>
    </div>
  )
}
