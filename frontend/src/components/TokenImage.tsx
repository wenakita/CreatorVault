import { useState } from 'react'
import { useTokenMetadata } from '../hooks/useTokenMetadata'

interface TokenImageProps {
  tokenAddress: `0x${string}`
  symbol: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  fallbackColor?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-14 h-14 text-xl',
}

export function TokenImage({
  tokenAddress,
  symbol,
  size = 'md',
  className = '',
  fallbackColor = 'from-orange-500 to-red-600',
}: TokenImageProps) {
  const { imageUrl, isLoading } = useTokenMetadata(tokenAddress)
  const [imgError, setImgError] = useState(false)

  const sizeClass = sizeClasses[size]

  // Show fallback if no image or loading or error
  if (!imageUrl || imgError || isLoading) {
    return (
      <div
        className={`${sizeClass} rounded-xl bg-gradient-to-br ${fallbackColor} flex items-center justify-center font-display font-bold text-white ${className}`}
      >
        {symbol[0]?.toUpperCase() || '?'}
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={symbol}
      className={`${sizeClass} rounded-xl object-cover ${className}`}
      onError={() => setImgError(true)}
    />
  )
}

