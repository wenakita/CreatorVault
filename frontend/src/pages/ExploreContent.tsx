import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'

export function ExploreContent() {
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
            <h1 className="headline text-4xl sm:text-6xl mt-4">Content</h1>
            <p className="text-zinc-600 text-sm font-light mt-3">
              Content Coin markets (attached to content). These are not “literal Uniswap pools” in the UX.
            </p>
          </motion.div>

          <ExploreSubnav searchPlaceholder="Search content markets by creator, symbol, or address…" />

          <div className="mt-10 rounded-2xl border border-white/5 bg-white/[0.03] p-6 sm:p-8">
            <div className="label">Coming soon</div>
            <div className="mt-4 text-sm text-zinc-600 font-light">
              This page will list <span className="font-mono text-zinc-400">coinType == CONTENT</span> from Zora and surface the originating content.
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/explore/creators" className="btn-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-xs">
                Browse creators
              </Link>
              <Link to="/" className="btn-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-xs">
                Back Home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

