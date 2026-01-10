import { useEffect, useState, type ReactNode } from 'react'
import { CheckCircle } from 'lucide-react'
import type { Address } from 'viem'

import { getTalentPassport, type TalentPassport } from '@/lib/talent-api'
import { resolveCreatorAddress } from '@/lib/creator-coin-resolver'

export function CreatorHeaderRow({
  creatorAddress,
  creatorName,
  children,
}: {
  creatorAddress: Address
  creatorName: string
  children: ReactNode
}) {
  const [passport, setPassport] = useState<TalentPassport | null>(null)
  const [resolvedAddress, setResolvedAddress] = useState<Address>(creatorAddress)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const resolved = await resolveCreatorAddress(creatorAddress)
      if (cancelled) return
      setResolvedAddress(resolved)

      const p = await getTalentPassport(resolved)
      if (cancelled) return
      setPassport(p)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [creatorAddress])

  const isVerified = Boolean(passport?.verified)
  const score = passport?.score ?? 0

  const displayName = creatorName || passport?.passport_profile?.name || 'Creator'
  const avatarUrl =
    passport?.passport_profile?.image_url ||
    passport?.passport_profile?.image_url ||
    `https://api.dicebear.com/7.x/shapes/svg?seed=${resolvedAddress}`

  return (
    <div className="flex items-center gap-4">
      {/* Creator avatar */}
      <div className="relative flex-shrink-0">
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border border-white/10"
          loading="lazy"
        />

        {/* Talent badge (single mark: score inside the old checkmark spot) */}
        {(score > 0 || loading) && (
          <div
            className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/70 border border-white/15 backdrop-blur shadow-sm"
            title={isVerified ? 'Talent score (verified)' : 'Talent score'}
            aria-label={isVerified ? 'Talent score verified' : 'Talent score'}
          >
            {isVerified && (
              <CheckCircle
                className="absolute inset-0 m-auto w-5 h-5 sm:w-6 sm:h-6 text-white/35 pointer-events-none"
                aria-hidden="true"
              />
            )}
            <span className="relative font-mono font-semibold text-[10px] sm:text-[11px] text-uniswap leading-none">
              {loading ? '—' : score > 0 ? score : '—'}
            </span>
          </div>
        )}
      </div>

      {/* Title/content */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}


