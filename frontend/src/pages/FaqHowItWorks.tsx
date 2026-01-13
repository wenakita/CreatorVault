import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { TokenImage } from '@/components/TokenImage'
import { AKITA } from '@/config/contracts'
import { SHARE_SYMBOL_PREFIX } from '@/lib/tokenSymbols'

const SHARE_TOKEN = `${SHARE_SYMBOL_PREFIX}TOKEN`

export function FaqHowItWorks() {
  const surface =
    'glass-card ring-1 ring-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.6)]'

  return (
    <div className="relative">
      <section className="cinematic-section">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="mb-10">
            <Link
              to="/faq"
              className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="label">Back to FAQ</span>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div>
              <span className="label">FAQ</span>
              <h1 className="headline text-4xl sm:text-6xl mt-4">How it works</h1>
              <p className="text-zinc-500 text-sm sm:text-base font-light mt-4 max-w-2xl">
                The short version: deposit a creator coin → receive a vault share token (
                <span className="mono text-brand-accent">{SHARE_TOKEN}</span>) → the vault earns fees and runs strategies → you can redeem by burning{' '}
                <span className="mono text-brand-accent">{SHARE_TOKEN}</span>.
              </p>
            </div>

            <div className={`${surface} p-6 sm:p-8`}>
              <span className="label">The 30-second flow</span>
              <div className="mt-6 space-y-0 border-t border-white/5">
                <div className="data-row group border-white/5">
                  <div className="space-y-2">
                    <span className="label">Step 01</span>
                    <h2 className="text-2xl text-white font-light">Deposit</h2>
                    <p className="text-zinc-600 text-sm font-light">
                      Deposit the creator coin into its vault. You receive <span className="mono text-brand-accent">{SHARE_TOKEN}</span> shares.
                    </p>
                  </div>
                </div>

                <div className="data-row group border-white/5">
                  <div className="space-y-2">
                    <span className="label">Step 02</span>
                    <h2 className="text-2xl text-white font-light">Earn</h2>
                    <p className="text-zinc-600 text-sm font-light">
                      The vault can earn from fee routing and from strategy results. This is not guaranteed yield.
                    </p>
                  </div>
                </div>

                <div className="data-row group border-none">
                  <div className="space-y-2">
                    <span className="label">Step 03</span>
                    <h2 className="text-2xl text-white font-light">Redeem</h2>
                    <p className="text-zinc-600 text-sm font-light">
                      Burn <span className="mono text-brand-accent">{SHARE_TOKEN}</span> to redeem the underlying creator coin from the vault.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 items-stretch">
              <div className={`${surface} p-6 sm:p-8 space-y-5`}>
                <span className="label">Deposit → shares</span>
                <div className="flex items-center justify-center gap-5 py-2">
                  <TokenImage tokenAddress={AKITA.token as `0x${string}`} symbol="AKITA" size="md" isWrapped={false} />
                  <ArrowRight className="w-5 h-5 text-zinc-700" />
                  <TokenImage tokenAddress={AKITA.token as `0x${string}`} symbol="AKITA" size="md" isWrapped />
                </div>
                <p className="text-zinc-600 text-sm font-light leading-relaxed">
                  You deposit the creator coin and receive <span className="mono text-brand-accent">{SHARE_TOKEN}</span>. Your ownership is represented by shares, not a fixed “1:1.”
                  As vault assets change, the share price changes.
                </p>
              </div>

              <div className={`${surface} p-6 sm:p-8 space-y-5`}>
                <span className="label">Earning sources</span>
                <ul className="list-disc list-inside space-y-2 text-zinc-600 text-sm font-light">
                  <li>Fee routing from trading activity (when pools are live)</li>
                  <li>Strategy results (e.g. LP ranges, lending/borrowing)</li>
                  <li>Some capital may be kept idle for withdrawals</li>
                </ul>
                <p className="text-zinc-700 text-xs font-light">
                  Nothing here implies a promised APY. The vault can make or lose money depending on market conditions and strategy behavior.
                </p>
              </div>

              <div className={`${surface} p-6 sm:p-8 space-y-5`}>
                <span className="label">Launch (optional)</span>
                <p className="text-zinc-600 text-sm font-light leading-relaxed">
                  New vaults can use a Uniswap Continuous Clearing Auction (CCA) to bootstrap fair price discovery and initial liquidity.
                </p>
                <div className="flex flex-col gap-2">
                  <Link to="/dashboard" className="text-brand-accent hover:text-brand-400 underline underline-offset-4 text-sm">
                    Explore vaults
                  </Link>
                  <Link to="/faq" className="text-brand-accent hover:text-brand-400 underline underline-offset-4 text-sm">
                    Read the full FAQ
                  </Link>
                </div>
              </div>
            </div>

            <div className={`${surface} p-6 sm:p-8`}>
              <span className="label">What to verify</span>
              <div className="mt-4 space-y-3 text-sm text-zinc-500 font-light leading-relaxed">
                <p>
                  If you’re about to deploy or bid, verify contracts and configuration on the{' '}
                  <Link to="/status" className="text-brand-accent hover:text-brand-400 underline underline-offset-4">
                    Status
                  </Link>{' '}
                  page first.
                </p>
                <p className="text-zinc-600">
                  Creator Vaults is experimental software. Start small and avoid signing transactions you don’t understand.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}


