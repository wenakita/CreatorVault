import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Rocket, ArrowRight, Sparkles, 
  Shield, Zap, Users, 
  Coins, Gift, TrendingUp, Trophy, Flame, Building2,
  CheckCircle2, ChevronRight
} from 'lucide-react'
import { LotteryDistributionCompact } from '../components/DistributionChart'
import { 
  TechScramble, 
  SlideUp, 
  FadeIn, 
  Stagger, 
  StaggerItem,
  BASE_EASE,
  DURATION
} from '../components/BaseMotion'

export function Home() {
  return (
    <div className="relative">
      {/* Ambient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/4 w-[600px] h-[600px] bg-[#0052FF]/5 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24 py-12">
        
        {/* HERO - Massive, centered, impactful */}
        <section className="relative min-h-[70vh] flex flex-col items-center justify-center text-center space-y-8">
          {/* Status badge */}
          <FadeIn delay={0.1}>
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-slate-400 text-sm">Now live on</span>
              <div className="flex items-center gap-1.5">
                <img src="/base-logo.svg" alt="Base" className="w-4 h-4" />
                <span className="text-white font-semibold text-sm">base</span>
              </div>
              <span className="text-slate-600">+</span>
              <span className="text-purple-400 font-medium text-sm">solana</span>
            </div>
          </FadeIn>

          {/* Massive headline */}
          <div className="space-y-4">
            <SlideUp delay={0.2}>
              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-[1.1]">
                <span className="text-white block">Turn Your</span>
                <span className="text-gradient block">
                  <TechScramble text="Creator Coins" delay={400} duration={800} />
                </span>
                <span className="text-white block">Into Earnings</span>
              </h1>
            </SlideUp>

            <FadeIn delay={1}>
              <p className="text-slate-400 text-xl sm:text-2xl max-w-3xl mx-auto leading-relaxed">
                Deposit your existing creator coins. Earn from every trade. Win jackpots.
                <br />
                <span className="text-white font-medium">Everyone earns together.</span>
              </p>
            </FadeIn>
          </div>

          {/* Hero CTA */}
          <FadeIn delay={1.2}>
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              <Link to="/dashboard">
                <motion.button 
                  className="group relative px-8 py-4 rounded-2xl bg-brand-500 text-white font-bold text-lg shadow-2xl shadow-brand-500/30 overflow-hidden"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: DURATION.fast, ease: BASE_EASE }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  
                  <span className="relative flex items-center gap-2">
                    <Coins className="w-5 h-5" />
                    Start Earning
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </motion.button>
              </Link>

              <Link to="/launch">
                <motion.button 
                  className="px-8 py-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white font-semibold text-lg backdrop-blur-xl transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: DURATION.fast, ease: BASE_EASE }}
                >
                  Create New Vault
                </motion.button>
              </Link>
            </div>
          </FadeIn>

          {/* Scroll indicator */}
          <FadeIn delay={1.4}>
            <motion.div 
              className="absolute bottom-8 left-1/2 -translate-x-1/2"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
                <motion.div 
                  className="w-1.5 h-1.5 rounded-full bg-white/60"
                  animate={{ y: [0, 12, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          </FadeIn>
        </section>

        {/* VALUE PROPS - Large, visual cards */}
        <section>
          <FadeIn delay={0.1}>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Stop Holding. Start Earning.
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Got creator coins sitting in your wallet? Put them to work.
              </p>
            </div>
          </FadeIn>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Problem */}
            <StaggerItem>
              <div className="relative p-8 rounded-3xl bg-gradient-to-br from-red-500/5 via-transparent to-transparent border border-red-500/20 backdrop-blur-xl">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-red-500/5 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                    <Coins className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Idle Tokens</h3>
                  <p className="text-slate-400 leading-relaxed">
                    You hold creator coins, but they just sit there. No yield. No rewards. Just hoping for price action.
                  </p>
                </div>
              </div>
            </StaggerItem>

            {/* Arrow */}
            <div className="hidden lg:flex items-center justify-center">
              <ArrowRight className="w-12 h-12 text-brand-500" />
            </div>

            {/* Solution */}
            <StaggerItem>
              <div className="relative p-8 rounded-3xl bg-gradient-to-br from-brand-500/10 via-transparent to-transparent border border-brand-500/30 backdrop-blur-xl">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand-500/10 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-brand-500/20 flex items-center justify-center mb-4">
                    <TrendingUp className="w-6 h-6 text-brand-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Productive Assets</h3>
                  <p className="text-slate-400 leading-relaxed">
                    Deposit into vaults. Earn fees from trading. Enter lotteries. Win with your community.
                  </p>
                </div>
              </div>
            </StaggerItem>
          </div>
        </section>

        {/* DEFLATIONARY MECHANISM - Key differentiator */}
        <section>
          <FadeIn delay={0.1}>
            <div className="relative max-w-4xl mx-auto">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-red-500/10 to-orange-500/10 blur-3xl rounded-3xl" />
              
              <div className="relative bg-gradient-to-br from-orange-500/5 via-transparent to-red-500/5 border-2 border-orange-500/20 rounded-3xl p-8 sm:p-12 backdrop-blur-xl overflow-hidden">
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                    backgroundSize: '32px 32px'
                  }} />
                </div>

                <div className="relative grid md:grid-cols-2 gap-8 items-center">
                  {/* Left: Visual */}
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      {/* Animated flame icon */}
                      <motion.div
                        className="w-32 h-32 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center"
                        animate={{ 
                          scale: [1, 1.1, 1],
                          opacity: [0.5, 0.8, 0.5]
                        }}
                        transition={{ 
                          duration: 3, 
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        <Flame className="w-16 h-16 text-orange-400" />
                      </motion.div>
                      
                      {/* Orbiting tokens */}
                      {[0, 120, 240].map((rotation, i) => (
                        <motion.div
                          key={rotation}
                          className="absolute top-1/2 left-1/2 w-12 h-12"
                          style={{ originX: 0.5, originY: 0.5 }}
                          animate={{ 
                            rotate: 360,
                          }}
                          transition={{ 
                            duration: 8,
                            repeat: Infinity,
                            ease: "linear",
                            delay: i * 0.3
                          }}
                        >
                          <div 
                            className="absolute w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold shadow-lg"
                            style={{ 
                              transform: `rotate(${rotation}deg) translateX(80px)`
                            }}
                          >
                            ws
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Content */}
                  <div className="space-y-6">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-4">
                        <TrendingUp className="w-4 h-4 text-orange-400" />
                        <span className="text-orange-400 text-sm font-semibold uppercase tracking-wider">Deflationary</span>
                      </div>
                      <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                        Tokens Burned.
                        <br />
                        <span className="text-gradient">Your Share Grows.</span>
                      </h2>
                      <p className="text-slate-400 text-lg leading-relaxed">
                        21.4% of every trade permanently burns vault tokens. As supply decreases, your share of the underlying assets automatically increases.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                          <div className="text-white font-semibold mb-1">Proportional Gains</div>
                          <div className="text-slate-400 text-sm">Hold 1% of supply? You always own 1% of the vault—even as total supply shrinks</div>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                          <div className="text-white font-semibold mb-1">No Action Required</div>
                          <div className="text-slate-400 text-sm">Passive appreciation. Burns happen automatically with every trade</div>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                          <div className="text-white font-semibold mb-1">Compound Effect</div>
                          <div className="text-slate-400 text-sm">More trades = more burns = greater value per token over time</div>
                        </div>
                      </div>
                    </div>

                    {/* Example calculation */}
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                      <div className="text-sm text-slate-500 mb-2">Example:</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">You hold</span>
                          <span className="text-white font-mono">100 wsTokens</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total supply</span>
                          <span className="text-white font-mono">10,000 wsTokens</span>
                        </div>
                        <div className="flex justify-between border-t border-white/5 pt-1 mt-1">
                          <span className="text-slate-400">Your share</span>
                          <span className="text-green-400 font-bold">1.0%</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 pt-2">
                          <span>After 50% burn</span>
                          <span className="text-green-400 font-semibold">Still 1.0% (of larger pie)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* HOW IT WORKS - Clean, numbered flow */}
        <section>
          <FadeIn delay={0.1}>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Three Steps to Earnings
              </h2>
              <p className="text-slate-400 text-lg">
                Simple, transparent, and fully onchain
              </p>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { 
                num: '01', 
                icon: Coins, 
                title: 'Deposit Your Tokens', 
                desc: 'Anyone can deposit—creators and holders alike. Get wsTokens that represent your share of the vault.',
                color: 'from-blue-500/20 to-cyan-500/20',
                iconBg: 'bg-blue-500/10',
                iconColor: 'text-blue-400'
              },
              { 
                num: '02', 
                icon: Users, 
                title: 'Earn Together', 
                desc: '6.9% fee on all trades flows to the community. As the vault grows, everyone benefits proportionally.',
                color: 'from-purple-500/20 to-pink-500/20',
                iconBg: 'bg-purple-500/10',
                iconColor: 'text-purple-400'
              },
              { 
                num: '03', 
                icon: Trophy, 
                title: 'Win the Jackpot', 
                desc: 'Every buy is a lottery entry. Winners split 69% of the prize pool. Fair and transparent.',
                color: 'from-yellow-500/20 to-orange-500/20',
                iconBg: 'bg-yellow-500/10',
                iconColor: 'text-yellow-400'
              },
            ].map(({ num, icon: Icon, title, desc, color, iconBg, iconColor }) => (
              <StaggerItem key={num}>
                <motion.div 
                  className="relative h-full"
                  whileHover={{ y: -8 }}
                  transition={{ duration: 0.3, ease: BASE_EASE }}
                >
                  <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${color} blur-xl opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="relative p-8 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-xl h-full">
                    {/* Number badge */}
                    <div className="text-6xl font-black text-white/5 absolute top-4 right-4">
                      {num}
                    </div>
                    
                    <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center mb-6`}>
                      <Icon className={`w-7 h-7 ${iconColor}`} />
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
                    <p className="text-slate-400 leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              </StaggerItem>
            ))}
          </div>
        </section>

        {/* JACKPOT - Prominent, glowing */}
        <section>
          <FadeIn delay={0.1}>
            <div className="relative max-w-2xl mx-auto">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-red-500/20 blur-3xl opacity-20 rounded-3xl" />
              
              <div className="relative bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-xl rounded-3xl border border-yellow-500/20 p-8 shadow-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 mb-4">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    <span className="text-yellow-400 text-sm font-semibold uppercase tracking-wider">Live Prize Pool</span>
                  </div>
                  <h2 className="text-4xl font-bold text-white mb-2">
                    <span className="text-gradient">0.1 ETH</span>
                  </h2>
                  <p className="text-slate-400">≈ $350 USD</p>
                </div>

                {/* Distribution */}
                <div className="space-y-4">
                  <LotteryDistributionCompact jackpotAmount="0.1 ETH" />
                  
                  <div className="grid grid-cols-3 gap-4 pt-4">
                    {[
                      { icon: Trophy, label: 'Winner', pct: '69%', color: 'yellow' },
                      { icon: Flame, label: 'Burned', pct: '21.4%', color: 'red' },
                      { icon: Building2, label: 'Treasury', pct: '9.6%', color: 'blue' },
                    ].map(({ icon: Icon, label, pct, color }) => (
                      <div key={label} className="text-center p-4 rounded-2xl bg-white/[0.02]">
                        <Icon className={`w-5 h-5 text-${color}-400 mx-auto mb-2`} />
                        <div className={`text-2xl font-bold text-${color}-400 mb-1`}>{pct}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Details */}
                <div className="mt-6 pt-6 border-t border-white/[0.06] space-y-3">
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span>Every buy automatically enters the lottery</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span>Chainlink VRF ensures provably fair randomness</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span>6.9% of every trade funds the prize pool</span>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* FEATURES - Tight grid */}
        <section>
          <FadeIn delay={0.1}>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Built Different
              </h2>
              <p className="text-slate-400 text-lg">
                Not your average creator coin platform
              </p>
            </div>
          </FadeIn>

          <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Zap,
                title: 'Fair Launch',
                desc: 'Continuous clearing auction. No snipers.',
                gradient: 'from-yellow-500/10 to-orange-500/10',
                iconColor: 'text-yellow-400',
              },
              {
                icon: Shield,
                title: 'Battle-Tested',
                desc: 'Audited contracts. Proven security.',
                gradient: 'from-green-500/10 to-emerald-500/10',
                iconColor: 'text-green-400',
              },
              {
                icon: Users,
                title: 'Anyone Can Join',
                desc: 'Creators and holders deposit together. Everyone earns from the same pool.',
                gradient: 'from-blue-500/10 to-cyan-500/10',
                iconColor: 'text-blue-400',
              },
              {
                icon: Gift,
                title: 'Real Yield',
                desc: 'Actual earnings from trading fees and lottery wins.',
                gradient: 'from-purple-500/10 to-pink-500/10',
                iconColor: 'text-purple-400',
              },
            ].map(({ icon: Icon, title, desc, gradient, iconColor }) => (
              <StaggerItem key={title}>
                <motion.div 
                  className={`relative p-6 rounded-2xl bg-gradient-to-br ${gradient} border border-white/5 backdrop-blur-xl h-full group`}
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: DURATION.fast, ease: BASE_EASE }}
                >
                  <div className="absolute inset-0 rounded-2xl bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <Icon className={`w-8 h-8 ${iconColor} mb-4`} />
                    <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                    <p className="text-slate-400 text-sm">{desc}</p>
                  </div>
                </motion.div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* CROSS-CHAIN - Sleek banner */}
        <FadeIn delay={0.1}>
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0052FF]/10 via-purple-500/10 to-[#0052FF]/10 border border-white/10 p-8">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDM0djItMnptMC0ydjJoLTJ2LTJoMnptLTItMnYyaC0ydi0yaDJ6bS0yLTJ2MmgtMnYtMmgyem0tMi0ydjJoLTJ2LTJoMnptLTItMnYyaC0ydi0yaDJ6bS0yLTJ2MmgtMnYtMmgyem0tMi0ydjJoLTJ2LTJoMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
            
            <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
                    <img src="/base-logo.svg" alt="Base" className="w-8 h-8" />
                  </div>
                  <span className="text-3xl text-slate-600">+</span>
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
                    <img 
                      src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" 
                      alt="Solana" 
                      className="w-8 h-8 rounded-full"
                    />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Cross-Chain Ready</h3>
                  <p className="text-slate-400">Bridge and participate from Base or Solana</p>
                </div>
              </div>
              
              <a
                href="https://docs.base.org/guides/base-solana-bridge"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
              >
                <motion.button
                  className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold backdrop-blur-xl transition-colors flex items-center gap-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: DURATION.fast, ease: BASE_EASE }}
                >
                  Learn More
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </a>
            </div>
          </section>
        </FadeIn>

        {/* FINAL CTA - Big, bold */}
        <FadeIn delay={0.1}>
          <section className="relative py-20">
            <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-transparent rounded-3xl blur-3xl" />
            
            <div className="relative text-center space-y-8">
              <div>
                <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                  Have Creator Coins?
                </h2>
                <p className="text-slate-400 text-xl max-w-2xl mx-auto">
                  Stop letting them sit idle. Deposit into vaults and start earning.
                  <br />
                  <span className="text-white font-semibold">Join your community. Win together.</span>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/dashboard">
                  <motion.button 
                    className="group relative px-12 py-6 rounded-2xl bg-brand-500 text-white font-bold text-xl shadow-2xl shadow-brand-500/40 overflow-hidden"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: DURATION.fast, ease: BASE_EASE }}
                  >
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    
                    <span className="relative flex items-center gap-3">
                      <Coins className="w-6 h-6" />
                      Browse Vaults
                      <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                    </span>
                  </motion.button>
                </Link>

                <Link to="/launch">
                  <motion.button 
                    className="px-12 py-6 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white font-semibold text-xl backdrop-blur-xl transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: DURATION.fast, ease: BASE_EASE }}
                  >
                    Or Create a Vault
                  </motion.button>
                </Link>
              </div>

              <p className="text-slate-500 text-sm">
                Deposit anytime • Withdraw anytime • Earn automatically
              </p>
            </div>
          </section>
        </FadeIn>

      </div>
    </div>
  )
}
