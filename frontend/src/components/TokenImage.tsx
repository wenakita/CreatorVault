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

  // Wrapped version: Top 69% = token, bottom 31% = Base vault
  return (
    <div className={`relative ${className}`}>
      <div className={`${sizeClass} rounded-xl overflow-hidden relative`}>
        {/* Top 69%: Token image */}
        <div className="absolute inset-0">
          {(!imageUrl || imgError || isLoading) ? (
            <div className={`w-full h-full bg-gradient-to-br ${fallbackColor} flex items-center justify-center font-display font-bold text-white`}>
              {symbol[0]?.toUpperCase() || '?'}
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={symbol}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          )}
        </div>
        
        {/* Bottom 31%: 3D Base vault */}
        <div className="absolute inset-x-0 bottom-0 h-[31%] bg-gradient-to-b from-[#0066FF] to-[#0052FF]">
          {/* Inner shadow for depth */}
          <div className="absolute inset-0 shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)]" />
          
          {/* Subtle metallic sheen */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/10" />
          
          {/* Panel lines for vault door effect */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-1/2 w-px h-full bg-white" />
            <div className="absolute top-1/2 left-0 w-full h-px bg-white" />
          </div>
          
          {/* Circular vault dial/lock */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-[35%] aspect-square">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 to-white/10 shadow-lg" />
              {/* Inner ring */}
              <div className="absolute inset-[15%] rounded-full bg-gradient-to-tl from-[#0052FF] to-[#0066FF] shadow-inner" />
              {/* Center dot */}
              <div className="absolute inset-[40%] rounded-full bg-white/90 shadow-md" />
            </div>
          </div>
          
          {/* Subtle dot pattern overlay */}
          <div className="absolute inset-0 opacity-5">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id={`base-pattern-${symbol}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="1" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#base-pattern-${symbol})`} />
            </svg>
          </div>
        </div>
        
        {/* Smooth gradient blend between token and vault */}
        <div className="absolute inset-x-0 top-[64%] h-[10%] bg-gradient-to-b from-transparent via-[#0052FF]/40 to-transparent pointer-events-none" />
      </div>
    </div>
  )
}

