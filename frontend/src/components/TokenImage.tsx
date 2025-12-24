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

  // Wrapped version: Token nested inside Base square logo
  return (
    <div className={`relative ${className}`}>
      {/* Base square logo background */}
      <div className={`${sizeClass} rounded-xl bg-[#0052FF] flex items-center justify-center relative overflow-hidden`}>
        {/* Base square subtle pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="base-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#base-pattern)" />
          </svg>
        </div>
        
        {/* Token image positioned to show top half */}
        <div className="absolute inset-0 flex items-start justify-center pt-[15%]">
          <div className="w-[70%] h-[70%] relative">
            {(!imageUrl || imgError || isLoading) ? (
              <div className={`w-full h-full rounded-lg bg-gradient-to-br ${fallbackColor} flex items-center justify-center font-display font-bold text-white text-xs`}>
                {symbol[0]?.toUpperCase() || '?'}
              </div>
            ) : (
              <img
                src={imageUrl}
                alt={symbol}
                className="w-full h-full rounded-lg object-cover shadow-lg"
                onError={() => setImgError(true)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

