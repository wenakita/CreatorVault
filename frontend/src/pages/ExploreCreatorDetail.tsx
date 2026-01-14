import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getAddress, isAddress } from 'viem'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'

function isSupportedChain(chain: string): boolean {
  return chain.toLowerCase() === 'base'
}

export function ExploreCreatorDetail() {
  const params = useParams()
  const chain = String(params.chain ?? '').trim()
  const tokenAddressRaw = String(params.tokenAddress ?? '').trim()

  const tokenAddress = isAddress(tokenAddressRaw) ? getAddress(tokenAddressRaw) : null

  if (!chain || !isSupportedChain(chain)) {
    return <Navigate replace to="/explore/creators" />
  }

  if (!tokenAddress) {
    return <Navigate replace to="/explore/creators" />
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
            <span className="label">Creator</span>
            <h1 className="headline text-3xl sm:text-5xl mt-4">Creator Coin</h1>
            <div className="mt-3 text-[11px] font-mono text-zinc-600 break-all">{tokenAddress}</div>
          </motion.div>

          <ExploreSubnav searchPlaceholder="Search creators…" />

          <div className="mt-10 rounded-2xl border border-white/5 bg-white/[0.03] p-6 sm:p-8">
            <div className="label">Coming soon</div>
            <div className="mt-4 text-sm text-zinc-600 font-light">
              This page will show market metrics + actions (Trade / Deploy Vault / View Vault).
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/deploy" className="btn-accent inline-flex items-center justify-center rounded-full px-5 py-3 text-xs">
                Deploy Vault
              </Link>
              <Link
                to={`/explore/creators/base/${tokenAddress}/transactions`}
                className="btn-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-xs"
              >
                View transactions
              </Link>
              <a
                href={`https://basescan.org/address/${tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-xs"
              >
                Basescan <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

