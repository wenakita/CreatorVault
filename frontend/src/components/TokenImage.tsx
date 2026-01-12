/**
 * TokenImage Component - Optimized for Performance
 * 
 * RENDERING STRATEGY:
 * - Regular tokens: Fetch from IPFS/URL, display directly
 * - wsTokens: On-the-fly CSS transformation (no database storage)
 * - Gracefully handles case where web3 isn't loaded yet
 */

import { useState, memo } from 'react'
import { useWeb3 } from '@/web3/Web3Context'
import { useTokenMetadata } from '../hooks/useTokenMetadata'
import { OrbBorder } from './brand/OrbBorder'

interface TokenImageProps {
  tokenAddress: `0x${string}`
  symbol: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
  fallbackColor?: string
  isWrapped?: boolean
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-14 h-14 text-xl',
  xl: 'w-16 h-16 text-2xl',
  // Slightly bigger than xl (64px) without jumping to Tailwind's 80px scale.
  '2xl': 'w-[72px] h-[72px] text-3xl',
}

const innerPadBySize: Record<NonNullable<TokenImageProps['size']>, string> = {
  sm: 'p-[4px]',
  md: 'p-[5px]',
  lg: 'p-[6px]',
  xl: 'p-[7px]',
  '2xl': 'p-[8px]',
}

// Simple fallback component (no wagmi hooks)
function TokenFallback({
  symbol,
  sizeClass,
  fallbackColor,
}: {
  symbol: string
  sizeClass: string
  fallbackColor: string
}) {
  return (
    <div
      className={`${sizeClass} rounded-xl bg-gradient-to-br ${fallbackColor} flex items-center justify-center font-display font-bold text-white`}
    >
      {symbol[0]?.toUpperCase() || '?'}
    </div>
  )
}

// Inner component that uses wagmi hooks (only rendered when web3 is ready)
function TokenImageInner({
  tokenAddress,
  symbol,
  size,
  sizeClass,
  fallbackColor,
  isWrapped,
  className,
}: {
  tokenAddress: `0x${string}`
  symbol: string
  size: NonNullable<TokenImageProps['size']>
  sizeClass: string
  fallbackColor: string
  isWrapped: boolean
  className: string
}) {
  const { imageUrl, isLoading } = useTokenMetadata(tokenAddress)
  const [imgError, setImgError] = useState(false)

  const showFallback = !imageUrl || imgError || isLoading

  // Simple token (not wrapped)
  if (!isWrapped) {
    if (showFallback) {
      return (
        <div className={className}>
          <TokenFallback symbol={symbol} sizeClass={sizeClass} fallbackColor={fallbackColor} />
        </div>
      )
    }
    return (
      <div className={className}>
        <img
          src={imageUrl}
          alt={symbol}
          className={`${sizeClass} rounded-xl object-cover`}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    )
  }

  // Wrapped version: show creator coin icon inside an elegant Liquid Gold bezel (vault form)
  const padClass = innerPadBySize[size]
  return (
    <div className={`relative ${className}`}>
      <div className={`${sizeClass} relative`}>
        <OrbBorder intensity="low">
          <div className={`w-full h-full ${padClass} bg-obsidian rounded-full`}>
            <div className="w-full h-full rounded-full overflow-hidden relative shadow-[inset_0_0_20px_black]">
              {/* Token body */}
              <div className="absolute inset-0 rounded-full overflow-hidden bg-black">
                {showFallback ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-primary/25 via-brand-accent/10 to-black">
                    <span className="text-white/80 font-serif text-base leading-none select-none">
                      {symbol.trim()?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                ) : (
                  <img
                    src={imageUrl}
                    alt={symbol}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                    loading="lazy"
                  />
                )}

                {/* Cinematic vignette */}
                <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] pointer-events-none" />
              </div>

              {/* Static glass reflection (high-end “lens” feel) */}
              <div className="absolute inset-0 rounded-full pointer-events-none opacity-40 mix-blend-overlay bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.75)_0%,transparent_60%)]" />

              {/* Heavy glass lens rim */}
              <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none shadow-[inset_0_4px_20px_rgba(255,255,255,0.1)]" />
            </div>
          </div>
        </OrbBorder>
      </div>
    </div>
  )
}

/**
 * TokenImage - Main export
 * Shows fallback when web3 isn't ready, full image when it is
 */
export const TokenImage = memo(function TokenImage({
  tokenAddress,
  symbol,
  size = 'md',
  className = '',
  fallbackColor = 'from-orange-500 to-red-600',
  isWrapped = false,
}: TokenImageProps) {
  const { status } = useWeb3()
  const sizeClass = sizeClasses[size]
  const padClass = innerPadBySize[size]
  
  // If web3 isn't ready, show simple fallback
  if (status !== 'ready') {
    if (!isWrapped) {
      return (
        <div className={className}>
          <TokenFallback symbol={symbol} sizeClass={sizeClass} fallbackColor={fallbackColor} />
        </div>
      )
    }
    // Wrapped fallback (no wagmi hooks): still render the vault bezel.
    return (
      <div className={`relative ${className}`}>
        <div className={`${sizeClass} relative`}>
          <OrbBorder intensity="low">
            <div className={`w-full h-full ${padClass} bg-obsidian rounded-full`}>
              <div className="w-full h-full rounded-full overflow-hidden relative shadow-[inset_0_0_20px_black]">
                <div className="absolute inset-0 rounded-full overflow-hidden bg-black">
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-primary/25 via-brand-accent/10 to-black">
                    <span className="text-white/80 font-serif text-base leading-none select-none">
                      {symbol.trim()?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] pointer-events-none" />
                </div>
                <div className="absolute inset-0 rounded-full pointer-events-none opacity-40 mix-blend-overlay bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.75)_0%,transparent_60%)]" />
                <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none shadow-[inset_0_4px_20px_rgba(255,255,255,0.1)]" />
              </div>
            </div>
          </OrbBorder>
        </div>
      </div>
    )
  }
  
  // Web3 is ready - use full component with metadata
  return (
    <TokenImageInner
      tokenAddress={tokenAddress}
      symbol={symbol}
      size={size}
      sizeClass={sizeClass}
      fallbackColor={fallbackColor}
      isWrapped={isWrapped}
      className={className}
    />
  )
})
