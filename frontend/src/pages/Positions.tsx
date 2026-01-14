import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

export function Positions() {
  return (
    <div className="relative pb-24 md:pb-0">
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-10">
            <span className="label">Positions</span>
            <h1 className="headline text-4xl sm:text-6xl mt-4">Positions</h1>
            <p className="text-zinc-600 text-sm font-light mt-3">
              Reserved route for Uniswap parity. This will become “Vault positions + coin positions”.
            </p>
          </motion.div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 sm:p-8">
            <div className="label">Coming soon</div>
            <div className="mt-4 text-sm text-zinc-600 font-light">
              For now, manage a vault directly from its page.
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/explore/creators" className="btn-accent inline-flex items-center justify-center rounded-full px-5 py-3 text-xs">
                Explore creators
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

