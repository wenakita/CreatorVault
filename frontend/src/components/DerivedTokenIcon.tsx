import { memo, useState } from 'react'
import { useWeb3 } from '@/web3/Web3Context'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'

type DerivedTokenVariant = 'vault' | 'share'

type TokenSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const sizeClasses: Record<TokenSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-14 h-14',
  xl: 'w-16 h-16',
  '2xl': 'w-[72px] h-[72px]',
}

const badgeTextSize: Record<TokenSize, string> = {
  sm: 'text-[9px] px-1.5 py-0.5',
  md: 'text-[10px] px-2 py-0.5',
  lg: 'text-[10px] px-2 py-0.5',
  xl: 'text-[11px] px-2 py-0.5',
  '2xl': 'text-[11px] px-2 py-0.5',
}

function DerivedTokenIconInner({
  tokenAddress,
  symbol,
  variant,
  size,
  className,
}: {
  tokenAddress: `0x${string}`
  symbol: string
  variant: DerivedTokenVariant
  size: TokenSize
  className: string
}) {
  const { imageUrl, isLoading } = useTokenMetadata(tokenAddress)
  const [imgError, setImgError] = useState(false)

  const showFallback = !imageUrl || imgError || isLoading
  const badge = variant === 'vault' ? 's' : 'ws'
  const derived = `${badge}${symbol}`
  const ariaLabel =
    variant === 'vault' ? `Vault share token (${derived})` : `Wrapped vault share token (${derived})`
  const showCornerMark = variant === 'vault'
  const showGoldRing = variant === 'share'

  return (
    <div
      className={`relative ${sizeClasses[size]} ${className} select-none`}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Compact liquid-gold ring for wrapped shares (wsTOKEN) */}
      {showGoldRing ? (
        <>
          <div className="absolute -inset-[2px] rounded-full bg-[conic-gradient(from_0deg,#4D3A11_0%,#140E02_15%,#8F711E_25%,#D4AF37_35%,#FFFFFF_40%,#D4AF37_45%,#8F711E_55%,#140E02_70%,#B5922B_85%,#4D3A11_100%)] opacity-90 motion-safe:animate-[spin_18s_linear_infinite] motion-reduce:animate-none" />
          <div className="absolute -inset-[2px] rounded-full blur-[1.5px] bg-[conic-gradient(from_180deg,transparent_0%,#C5A028_20%,transparent_40%,#FFF7D6_50%,transparent_60%,#C5A028_80%,transparent_100%)] opacity-55" />
        </>
      ) : null}

      <div className="absolute inset-0 rounded-full overflow-hidden bg-black border border-white/10 shadow-[inset_0_0_24px_rgba(0,0,0,0.9)]">
        {showFallback ? (
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-black to-black" />
        ) : (
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        )}

        {/* Cinematic vignette */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_40px_rgba(0,0,0,0.85)]" />

        {/* Specular highlight (static lens feel) */}
        <div className="absolute inset-0 pointer-events-none opacity-35 mix-blend-overlay bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.75)_0%,transparent_60%)]" />
      </div>

      {/* Corner mark: indicates derived token type */}
      {showCornerMark ? (
        <div
          className={`absolute -bottom-1 -right-1 rounded-full backdrop-blur-md border border-white/10 bg-black/70 text-zinc-100 font-mono leading-none ${badgeTextSize[size]}`}
          aria-hidden="true"
        >
          {badge}
        </div>
      ) : null}
    </div>
  )
}

export const DerivedTokenIcon = memo(function DerivedTokenIcon({
  tokenAddress,
  symbol,
  variant,
  size = 'sm',
  className = '',
}: {
  tokenAddress: `0x${string}`
  symbol: string
  variant: DerivedTokenVariant
  size?: TokenSize
  className?: string
}) {
  const { status } = useWeb3()

  // Avoid wagmi hooks until Web3 providers are ready (same pattern as TokenImage).
  if (status !== 'ready') {
    const badge = variant === 'vault' ? 's' : 'ws'
    const derived = `${badge}${symbol}`
    const ariaLabel =
      variant === 'vault' ? `Vault share token (${derived})` : `Wrapped vault share token (${derived})`
    const showCornerMark = variant === 'vault'
    const showGoldRing = variant === 'share'
    return (
      <div
        className={`relative ${sizeClasses[size]} ${className} select-none`}
        role="img"
        aria-label={ariaLabel}
      >
        {showGoldRing ? (
          <>
            <div className="absolute -inset-[2px] rounded-full bg-[conic-gradient(from_0deg,#4D3A11_0%,#140E02_15%,#8F711E_25%,#D4AF37_35%,#FFFFFF_40%,#D4AF37_45%,#8F711E_55%,#140E02_70%,#B5922B_85%,#4D3A11_100%)] opacity-90 motion-safe:animate-[spin_18s_linear_infinite] motion-reduce:animate-none" />
            <div className="absolute -inset-[2px] rounded-full blur-[1.5px] bg-[conic-gradient(from_180deg,transparent_0%,#C5A028_20%,transparent_40%,#FFF7D6_50%,transparent_60%,#C5A028_80%,transparent_100%)] opacity-55" />
          </>
        ) : null}
        <div className="absolute inset-0 rounded-full overflow-hidden bg-black border border-white/10 shadow-[inset_0_0_24px_rgba(0,0,0,0.9)]">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-black to-black" />
          <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_40px_rgba(0,0,0,0.85)]" />
          <div className="absolute inset-0 pointer-events-none opacity-35 mix-blend-overlay bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.75)_0%,transparent_60%)]" />
        </div>
        {showCornerMark ? (
          <div
            className={`absolute -bottom-1 -right-1 rounded-full backdrop-blur-md border border-white/10 bg-black/70 text-zinc-100 font-mono leading-none ${badgeTextSize[size]}`}
            aria-hidden="true"
          >
            {badge}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <DerivedTokenIconInner
      tokenAddress={tokenAddress}
      symbol={symbol}
      variant={variant}
      size={size}
      className={className}
    />
  )
})


