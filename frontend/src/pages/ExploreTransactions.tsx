import { motion } from 'framer-motion'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'

export function ExploreTransactions() {
  return (
    <div className="relative pb-24 md:pb-0">
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <span className="label">Explore</span>
            <h1 className="headline text-4xl sm:text-6xl mt-4">Transactions</h1>
            <p className="text-zinc-600 text-sm font-light mt-3">
              Global activity across creator coins, content coins, and vault actions.
            </p>
          </motion.div>

          <ExploreSubnav searchPlaceholder="Filter by address, creator, or coin…" />

          <div className="mt-10 rounded-2xl border border-white/5 bg-white/[0.03] p-6 sm:p-8">
            <div className="label">Coming soon</div>
            <div className="mt-4 text-sm text-zinc-600 font-light">
              Global transactions, plus contextual routes for creators/content detail pages.
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

