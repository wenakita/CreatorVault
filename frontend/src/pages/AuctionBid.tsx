import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { isAddress, type Address } from 'viem'

import { AKITA } from '@/config/contracts'
import { CcaAuctionPanel } from '@/components/cca/CcaAuctionPanel'

function resolveCcaStrategyFromRouteParam(addr: string | undefined): Address {
  // Preserve backwards compatibility with older links in this repo that passed
  // vault/wrapper/shareOFT into `/auction/bid/:address` even though the page
  // historically ignored the param.
  const fallback = AKITA.ccaStrategy as Address
  if (!addr) return fallback
  if (!isAddress(addr)) return fallback

  const lower = addr.toLowerCase()
  const isAkitaKnown =
    lower === String(AKITA.ccaStrategy).toLowerCase() ||
    lower === String(AKITA.vault).toLowerCase() ||
    lower === String(AKITA.wrapper).toLowerCase() ||
    lower === String(AKITA.shareOFT).toLowerCase()

  if (isAkitaKnown) return AKITA.ccaStrategy as Address

  // Otherwise, treat the route param as the CCALaunchStrategy address.
  return addr as Address
}

export function AuctionBid() {
  const { address } = useParams()
  const ccaStrategy = resolveCcaStrategyFromRouteParam(address)

  return (
    <div className="relative min-h-screen">
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Link
            to={`/vault/${AKITA.vault}`}
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-400 transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="label">Back to vault</span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <CcaAuctionPanel
              ccaStrategy={ccaStrategy}
              wsSymbol="wsAKITA"
              vaultAddress={AKITA.vault as Address}
            />
          </motion.div>
        </div>
      </section>
    </div>
  )
}



