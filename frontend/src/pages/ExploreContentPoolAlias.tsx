import { motion } from 'framer-motion'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getAddress, isAddress } from 'viem'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'

function isSupportedChain(chain: string): boolean {
  return chain.toLowerCase() === 'base'
}

export function ExploreContentPoolAlias() {
  const params = useParams()
  const chain = String(params.chain ?? '').trim()
  const poolIdOrPoolKeyHashRaw = String(params.poolIdOrPoolKeyHash ?? '').trim()

  if (!chain || !isSupportedChain(chain)) {
    return <Navigate replace to="/explore/content" />
  }

  // Phase 1 behavior:
  // - If the segment is actually a content coin address, canonicalize to the coin route.
  // - Otherwise show a placeholder (pool-key resolution comes in Phase 3).
  if (isAddress(poolIdOrPoolKeyHashRaw)) {
    const contentCoinAddress = getAddress(poolIdOrPoolKeyHashRaw)
    return <Navigate replace to={`/explore/content/${chain.toLowerCase()}/${contentCoinAddress.toLowerCase()}`} />
  }

  return (
    <div className="relative pb-24 md:pb-0">
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-10">
            <span className="label">Content market</span>
            <h1 className="headline text-3xl sm:text-5xl mt-4">Pool key alias</h1>
            <p className="text-zinc-600 text-sm font-light mt-3">
              This URL is reserved for pool-key-based addressing. We’ll resolve it to a canonical content coin address once we wire Zora pool keys / onchain events.
            </p>
            <div className="mt-3 text-[11px] font-mono text-zinc-600 break-all">{poolIdOrPoolKeyHashRaw}</div>
          </motion.div>

          <ExploreSubnav searchPlaceholder="Search content markets…" />

          <div className="mt-10 rounded-2xl border border-white/5 bg-white/[0.03] p-6 sm:p-8">
            <div className="label">Next steps</div>
            <div className="mt-4 text-sm text-zinc-600 font-light">
              For now, use the canonical market URL by content coin address.
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/explore/content" className="btn-accent inline-flex items-center justify-center rounded-full px-5 py-3 text-xs">
                Browse content markets
              </Link>
              <Link to="/explore/creators" className="btn-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-xs">
                Browse creators
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

