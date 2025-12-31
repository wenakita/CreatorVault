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
import { LiquidGoldBorder } from './liquidGold/LiquidGoldBorder'

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
  sizeClass,
  fallbackColor,
  isWrapped,
  className,
}: {
  tokenAddress: `0x${string}`
  symbol: string
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
  return (
    <div className={`relative ${className}`}>
      <div className={`${sizeClass} relative`}>
        <LiquidGoldBorder intensity="low">
          <div className="w-full h-full p-[5px] bg-obsidian rounded-full">
            <div className="w-full h-full rounded-full overflow-hidden relative shadow-[inset_0_0_20px_black]">
              {showFallback ? (
                <div
                  className={`w-full h-full rounded-full bg-gradient-to-br ${fallbackColor} flex items-center justify-center font-display font-bold text-white`}
                >
                  {symbol[0]?.toUpperCase() || '?'}
                </div>
              ) : (
                <img
                  src={imageUrl}
                  alt={symbol}
                  className="w-full h-full object-cover rounded-full"
                  onError={() => setImgError(true)}
                  loading="lazy"
                />
              )}
            </div>
          </div>
        </LiquidGoldBorder>
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
          <LiquidGoldBorder intensity="low">
            <div className="w-full h-full p-[5px] bg-obsidian rounded-full">
              <div className="w-full h-full rounded-full overflow-hidden relative shadow-[inset_0_0_20px_black]">
                <div
                  className={`w-full h-full rounded-full bg-gradient-to-br ${fallbackColor} flex items-center justify-center font-display font-bold text-white`}
                >
                  {symbol[0]?.toUpperCase() || '?'}
                </div>
              </div>
            </div>
          </LiquidGoldBorder>
        </div>
      </div>
    )
  }
  
  // Web3 is ready - use full component with metadata
  return (
    <TokenImageInner
      tokenAddress={tokenAddress}
      symbol={symbol}
      sizeClass={sizeClass}
      fallbackColor={fallbackColor}
      isWrapped={isWrapped}
      className={className}
    />
  )
})
