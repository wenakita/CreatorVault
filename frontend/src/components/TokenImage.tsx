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

interface TokenImageProps {
  tokenAddress: `0x${string}`
  symbol: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  fallbackColor?: string
  isWrapped?: boolean
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-14 h-14 text-xl',
  xl: 'w-16 h-16 text-2xl',
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

  // Wrapped version with vault overlay
  return (
    <div className={`relative ${className}`}>
      <div className={`${sizeClass} rounded-xl overflow-hidden relative shadow-xl ring-2`} style={{ 
        '--tw-ring-color': 'rgba(0, 0, 255, 0.3)' 
      } as React.CSSProperties}>
        {/* Token image background */}
        <div className="absolute inset-0">
          {showFallback ? (
            <div className={`w-full h-full bg-gradient-to-br ${fallbackColor} flex items-center justify-center font-display font-bold text-white`}>
              {symbol[0]?.toUpperCase() || '?'}
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
        </div>
        
        {/* Vault overlay */}
        <div className="absolute inset-x-0 bottom-0 h-[40%] opacity-90">
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom right, #0052FF, #0000FF, #0000CC)'
          }} />
          <div className="absolute inset-0 shadow-[inset_0_4px_12px_rgba(0,0,0,0.5),inset_0_-2px_8px_rgba(0,0,0,0.3)]" />
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute inset-[8%] rounded-sm border border-white/10 shadow-lg" />
          
          {/* Vault dial */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-[40%] aspect-square">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 via-white/20 to-transparent shadow-2xl" />
              <div className="absolute inset-[12%] rounded-full shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]" style={{
                background: 'linear-gradient(to bottom right, #0000CC, #0000FF, #0052FF)'
              }} />
              <div className="absolute inset-[35%] rounded-full bg-gradient-to-br from-white/90 via-white/70 to-white/50 shadow-xl" />
            </div>
          </div>
        </div>
        
        <div className="absolute inset-x-0 top-[58%] h-[4%] bg-gradient-to-b from-black/0 via-black/20 to-black/30 pointer-events-none" />
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
    // Wrapped fallback
    return (
      <div className={`relative ${className}`}>
        <div className={`${sizeClass} rounded-xl overflow-hidden relative shadow-xl ring-2`} style={{ 
          '--tw-ring-color': 'rgba(0, 0, 255, 0.3)' 
        } as React.CSSProperties}>
          <div className="absolute inset-0">
            <div className={`w-full h-full bg-gradient-to-br ${fallbackColor} flex items-center justify-center font-display font-bold text-white`}>
              {symbol[0]?.toUpperCase() || '?'}
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[40%] opacity-90">
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(to bottom right, #0052FF, #0000FF, #0000CC)'
            }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[40%] aspect-square">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 via-white/20 to-transparent shadow-2xl" />
                <div className="absolute inset-[35%] rounded-full bg-gradient-to-br from-white/90 via-white/70 to-white/50 shadow-xl" />
              </div>
            </div>
          </div>
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
