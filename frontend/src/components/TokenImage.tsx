import { useState } from 'react'
import { useTokenMetadata } from '../hooks/useTokenMetadata'

interface TokenImageProps {
  tokenAddress: `0x${string}`
  symbol: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  fallbackColor?: string
  isWrapped?: boolean // Indicates if this is a wsToken
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-14 h-14 text-xl',
  xl: 'w-16 h-16 text-2xl',
}

const badgeSizes = {
  sm: 'w-3 h-3 text-[8px]',
  md: 'w-4 h-4 text-[9px]',
  lg: 'w-5 h-5 text-[10px]',
  xl: 'w-6 h-6 text-[11px]',
}

export function TokenImage({
  tokenAddress,
  symbol,
  size = 'md',
  className = '',
  fallbackColor = 'from-orange-500 to-red-600',
  isWrapped = false,
}: TokenImageProps) {
  const { imageUrl, isLoading } = useTokenMetadata(tokenAddress)
  const [imgError, setImgError] = useState(false)

  const sizeClass = sizeClasses[size]
  const badgeSize = badgeSizes[size]

  // Show fallback if no image or loading or error
  const tokenElement = (!imageUrl || imgError || isLoading) ? (
    <div
      className={`${sizeClass} rounded-xl bg-gradient-to-br ${fallbackColor} flex items-center justify-center font-display font-bold text-white`}
    >
      {symbol[0]?.toUpperCase() || '?'}
    </div>
  ) : (
    <img
      src={imageUrl}
      alt={symbol}
      className={`${sizeClass} rounded-xl object-cover`}
      onError={() => setImgError(true)}
    />
  )

  // If not wrapped, return the token element directly
  if (!isWrapped) {
    return <div className={className}>{tokenElement}</div>
  }

  // Wrapped version with subtle frame and badge
  return (
    <div className={`relative ${className}`}>
      {/* Subtle gradient border */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#0052FF]/30 via-blue-400/20 to-[#0052FF]/30 p-[2px]">
        <div className="w-full h-full rounded-xl bg-slate-950" />
      </div>
      
      {/* Token image */}
      <div className="relative">
        {tokenElement}
      </div>
      
      {/* "ws" Badge - bottom right corner */}
      <div className={`absolute -bottom-0.5 -right-0.5 ${badgeSize} rounded-full bg-gradient-to-br from-[#0052FF] to-blue-600 flex items-center justify-center font-bold text-white border-2 border-slate-950 shadow-lg`}>
        <span className="tracking-tighter">ws</span>
      </div>
    </div>
  )
}

