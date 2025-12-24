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

  // Wrapped version with vault overlay covering bottom half
  return (
    <div className={`relative ${className}`}>
      {/* Original token image (slightly faded at bottom) */}
      <div className="relative">
        {tokenElement}
        {/* Gradient overlay to fade into vault */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-slate-900/60 via-transparent to-transparent pointer-events-none" />
      </div>
      
      {/* Vault icon overlay - bottom half */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 flex items-end justify-center pb-1">
        <svg 
          className="w-[45%] h-[45%] text-[#0052FF] drop-shadow-lg" 
          viewBox="0 0 24 24" 
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Vault/Safe icon */}
          <rect x="3" y="6" width="18" height="14" rx="2" fill="currentColor" opacity="0.9"/>
          <circle cx="12" cy="13" r="3" fill="white" opacity="0.3"/>
          <circle cx="12" cy="13" r="2" fill="white" opacity="0.5"/>
          <circle cx="12" cy="13" r="0.8" fill="currentColor"/>
        </svg>
      </div>
    </div>
  )
}

