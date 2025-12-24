import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Rocket, ArrowRight, Sparkles, 
  Shield, Zap, Users, 
  Coins, Gift, TrendingUp, Trophy, Flame, Building2,
  CheckCircle2, ChevronRight
} from 'lucide-react'
import { LotteryDistributionCompact } from '../components/DistributionChart'
import { TokenImage } from '../components/TokenImage'
import { AKITA } from '../config/contracts'
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
                Deposit tokens. Earn from trades.
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
                    Tokens sit in your wallet. No yield. No rewards.
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
                  <h3 className="text-xl font-bold text-white mb-3">Earning Assets</h3>
                  <p className="text-slate-400 leading-relaxed">
                    Deposit. Earn fees. Grow your share.
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
                  {/* Left: Visual - Burn & Grow Animation */}
                  <div className="flex items-center justify-center">
                    <div className="relative w-64 h-64">
                      {/* Center: Growing wsAKITA (your share grows) */}
                      <motion.div
                        className="absolute inset-0 flex items-center justify-center"
                        animate={{ 
                          scale: [1, 1.15, 1],
                        }}
                        transition={{ 
                          duration: 4,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        <div className="relative">
                          {/* Glow effect */}
                          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/30 blur-2xl" />
                          <TokenImage
                            tokenAddress={AKITA.token as `0x${string}`}
                            symbol="wsAKITA"
                            size="xl"
                            fallbackColor="from-orange-500 to-red-600"
                            isWrapped={true}
                          />
                        </div>
                      </motion.div>
                      
                      {/* Burning tokens floating up and fading */}
                      {[...Array(6)].map((_, i) => {
                        const angle = (i * 60) * (Math.PI / 180);
                        const startX = Math.cos(angle) * 100;
                        const startY = Math.sin(angle) * 100;
                        
                        return (
                          <motion.div
                            key={i}
                            className="absolute top-1/2 left-1/2"
                            style={{
                              x: startX,
                              y: startY,
                            }}
                            animate={{ 
                              y: [startY, startY - 80],
                              opacity: [0.8, 0],
                              scale: [1, 0.3],
                            }}
                            transition={{ 
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeOut",
                              delay: i * 0.5,
                            }}
                          >
                            <div className="relative">
                              {/* Flame effect on burning token */}
                              <motion.div
                                className="absolute -inset-2 rounded-full bg-gradient-to-t from-orange-500/40 via-red-500/20 to-transparent blur-md"
                                animate={{ 
                                  opacity: [0.8, 0.3],
                                  scale: [1, 1.3],
                                }}
                                transition={{ 
                                  duration: 0.8,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                  delay: i * 0.5,
                                }}
                              />
                              <TokenImage
                                tokenAddress={AKITA.token as `0x${string}`}
                                symbol="wsAKITA"
                                size="sm"
                                fallbackColor="from-orange-500 to-red-600"
                                isWrapped={true}
                              />
                            </div>
                          </motion.div>
                        );
                      })}
                      
                      {/* Burn particles */}
                      {[...Array(12)].map((_, i) => {
                        const angle = (i * 30) * (Math.PI / 180);
                        const distance = 90 + (i % 3) * 20;
                        const x = Math.cos(angle) * distance;
                        const y = Math.sin(angle) * distance;
                        
                        return (
                          <motion.div
                            key={`particle-${i}`}
                            className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full bg-orange-400"
                            style={{ x, y }}
                            animate={{ 
                              y: [y, y - 60],
                              opacity: [0.6, 0],
                              scale: [1, 0],
                            }}
                            transition={{ 
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeOut",
                              delay: i * 0.2,
                            }}
                          />
                        );
                      })}
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
                        Tokens Burn.
                        <br />
                        <span className="text-gradient">You Own More.</span>
                      </h2>
                      <p className="text-slate-400 text-lg leading-relaxed">
                        21% of trades burn vault tokens. Your share of creator coins grows automatically.
                      </p>
                    </div>

                    {/* Example calculation */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/5 to-emerald-500/5 border border-green-500/20">
                      <div className="text-xs text-slate-500 mb-3">Example: Depositing AKITA</div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 rounded-xl bg-white/[0.03]">
                          <div className="text-slate-500 text-xs mb-2">BEFORE BURN</div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-400">You hold</span>
                              <span className="text-white font-mono">100</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Total</span>
                              <span className="text-white font-mono">10K</span>
                            </div>
                            <div className="flex justify-between pt-1 mt-1 border-t border-white/5">
                              <span className="text-slate-400 text-xs">AKITA owned</span>
                              <span className="text-white font-semibold">1,000</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
                          <div className="text-xs text-green-400 font-semibold mb-2">AFTER 50% BURN</div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-400">You hold</span>
                              <span className="text-white font-mono">100</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Total</span>
                              <span className="text-white font-mono">5K</span>
                            </div>
                            <div className="flex justify-between pt-1 mt-1 border-t border-green-500/20">
                              <span className="text-green-400 text-xs">AKITA owned</span>
                              <span className="text-green-400 font-semibold">2,000</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-center pt-3 mt-3 border-t border-white/5">
                        <div className="text-green-400 font-bold">2x more AKITA</div>
                        <div className="text-slate-500 text-xs">No action needed</div>
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
                How It Works
              </h2>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { 
                num: '01', 
                icon: Coins, 
                title: 'Deposit', 
                desc: 'Lock creator coins. Get vault tokens representing your share.',
                color: 'from-blue-500/20 to-cyan-500/20',
                iconBg: 'bg-blue-500/10',
                iconColor: 'text-blue-400'
              },
              { 
                num: '02', 
                icon: TrendingUp, 
                title: 'Earn Fees', 
                desc: '6.9% of every trade flows back to the vault.',
                color: 'from-purple-500/20 to-pink-500/20',
                iconBg: 'bg-purple-500/10',
                iconColor: 'text-purple-400'
              },
              { 
                num: '03', 
                icon: Flame, 
                title: 'Burns Increase Value', 
                desc: '21% of fees burn tokens. Less supply = bigger share.',
                color: 'from-orange-500/20 to-red-500/20',
                iconBg: 'bg-orange-500/10',
                iconColor: 'text-orange-400'
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

        {/* FEE DISTRIBUTION - Simple, clear */}
        <section>
          <FadeIn delay={0.1}>
            <div className="relative max-w-2xl mx-auto">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-brand-500/10 via-purple-500/10 to-brand-500/10 blur-3xl rounded-3xl" />
              
              <div className="relative bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-xl rounded-3xl border border-brand-500/20 p-8 shadow-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/20 mb-4">
                    <Zap className="w-4 h-4 text-brand-500" />
                    <span className="text-brand-400 text-sm font-semibold uppercase tracking-wider">Fee Distribution</span>
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    6.9% Trading Fee
                  </h2>
                  <p className="text-slate-400">On every buy and sell</p>
                </div>

                {/* Distribution */}
                <div className="space-y-4">
                  <LotteryDistributionCompact jackpotAmount="0.1 ETH" />
                  
                  <div className="grid grid-cols-3 gap-4 pt-4">
                    {[
                      { icon: Trophy, label: 'Jackpot', pct: '69%', color: 'brand' },
                      { icon: Flame, label: 'Burned', pct: '21%', color: 'orange' },
                      { icon: Building2, label: 'Treasury', pct: '10%', color: 'slate' },
                    ].map(({ icon: Icon, label, pct, color }) => (
                      <div key={label} className="text-center p-4 rounded-2xl bg-white/[0.02]">
                        <Icon className={`w-5 h-5 ${color === 'brand' ? 'text-brand-500' : color === 'orange' ? 'text-orange-400' : 'text-slate-400'} mx-auto mb-2`} />
                        <div className={`text-2xl font-bold ${color === 'brand' ? 'text-brand-500' : color === 'orange' ? 'text-orange-400' : 'text-slate-400'} mb-1`}>{pct}</div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Details */}
                <div className="mt-6 pt-6 border-t border-white/[0.06] space-y-2">
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span>Jackpot builds from 69% of fees</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span>21% permanently burns tokens</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span>10% sustains the protocol</span>
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
                Why CreatorVault
              </h2>
            </div>
          </FadeIn>

          <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Zap,
                title: 'Fair Launch',
                desc: 'No snipers. Equal opportunity.',
                gradient: 'from-yellow-500/10 to-orange-500/10',
                iconColor: 'text-yellow-400',
              },
              {
                icon: Shield,
                title: 'Secure',
                desc: 'Audited contracts. Battle-tested.',
                gradient: 'from-green-500/10 to-emerald-500/10',
                iconColor: 'text-green-400',
              },
              {
                icon: Users,
                title: 'Open to All',
                desc: 'Anyone deposits. Everyone earns.',
                gradient: 'from-blue-500/10 to-cyan-500/10',
                iconColor: 'text-blue-400',
              },
              {
                icon: Gift,
                title: 'Real Yield',
                desc: 'Trading fees + deflationary burns.',
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
                  <h3 className="text-xl font-bold text-white mb-1">Cross-Chain</h3>
                  <p className="text-slate-400">Base + Solana</p>
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
                  Ready to Earn?
                </h2>
                <p className="text-slate-400 text-xl max-w-2xl mx-auto">
                  Deposit tokens. Earn together.
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
                Deposit anytime • Withdraw anytime
              </p>
            </div>
          </section>
        </FadeIn>

      </div>
    </div>
  )
}
