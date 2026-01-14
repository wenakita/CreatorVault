import { motion } from 'framer-motion'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getAddress, isAddress } from 'viem'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'

function isSupportedChain(chain: string): boolean {
  return chain.toLowerCase() === 'base'
}

export function ExploreContentTransactions() {
  const params = useParams()
  const chain = String(params.chain ?? '').trim()
  const contentCoinAddressRaw = String(params.contentCoinAddress ?? '').trim()
  const contentCoinAddress = isAddress(contentCoinAddressRaw) ? getAddress(contentCoinAddressRaw) : null

  if (!chain || !isSupportedChain(chain) || !contentCoinAddress) {
    return <Navigate replace to="/explore/transactions" />
  }

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
            <span className="label">Transactions</span>
            <h1 className="headline text-3xl sm:text-5xl mt-4">Content Coin</h1>
            <div className="mt-3 text-[11px] font-mono text-zinc-600 break-all">{contentCoinAddress}</div>
          </motion.div>

          <ExploreSubnav searchPlaceholder="Filter transactions…" />

          <div className="mt-10 rounded-2xl border border-white/5 bg-white/[0.03] p-6 sm:p-8">
            <div className="label">Coming soon</div>
            <div className="mt-4 text-sm text-zinc-600 font-light">
              This page will show swaps/mints for this content market and link back to the originating content.
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to={`/explore/content/base/${contentCoinAddress}`}
                className="btn-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-xs"
              >
                Back to market
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

