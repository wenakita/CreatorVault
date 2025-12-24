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

  // Wrapped version: Token deposited into prominent Base blue vault
  return (
    <div className={`relative ${className}`}>
      <div className={`${sizeClass} rounded-xl overflow-hidden relative shadow-xl ring-2 ring-[#0000FF]/30`}>
        {/* Full token image (background) */}
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
        
        {/* Bottom 40%: Prominent 3D Base vault (#0000FF) - token is DEPOSITED INTO Base */}
        <div className="absolute inset-x-0 bottom-0 h-[40%] opacity-90">
          {/* Main vault body with proper Base blue gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0010FF] via-[#0000FF] to-[#0000DD]" />
          
          {/* Deep inset shadow for vault recess */}
          <div className="absolute inset-0 shadow-[inset_0_4px_12px_rgba(0,0,0,0.5),inset_0_-2px_8px_rgba(0,0,0,0.3)]" />
          
          {/* Top highlight edge */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          {/* Brushed metal texture */}
          <div className="absolute inset-0 opacity-[0.15]" style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)'
          }} />
          
          {/* Vault door frame */}
          <div className="absolute inset-[8%] rounded-sm border border-white/10 shadow-lg" />
          
          {/* Panel separator lines */}
          <div className="absolute inset-0">
            {/* Vertical line */}
            <div className="absolute top-[20%] bottom-[20%] left-1/2 w-[1px] bg-gradient-to-b from-transparent via-black/40 to-transparent" />
            <div className="absolute top-[20%] bottom-[20%] left-1/2 w-[1px] ml-[1px] bg-gradient-to-b from-transparent via-white/20 to-transparent" />
            
            {/* Horizontal line */}
            <div className="absolute left-[20%] right-[20%] top-1/2 h-[1px] bg-gradient-to-r from-transparent via-black/40 to-transparent" />
            <div className="absolute left-[20%] right-[20%] top-1/2 h-[1px] mt-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
          
          {/* Circular vault lock dial */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-[40%] aspect-square">
              {/* Outer bezel ring with shine */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 via-white/20 to-transparent shadow-2xl" />
              <div className="absolute inset-[4%] rounded-full bg-gradient-to-tl from-black/30 to-transparent" />
              
              {/* Middle ring - recessed */}
              <div className="absolute inset-[12%] rounded-full bg-gradient-to-br from-[#0000DD] via-[#0000FF] to-[#0010FF] shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]" />
              
              {/* Dial markings */}
              <div className="absolute inset-[20%] rounded-full">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-[2%] left-1/2 w-[2px] h-[15%] bg-white/30 origin-bottom"
                    style={{ transform: `translateX(-50%) rotate(${i * 45}deg)` }}
                  />
                ))}
              </div>
              
              {/* Center button */}
              <div className="absolute inset-[35%] rounded-full bg-gradient-to-br from-white/90 via-white/70 to-white/50 shadow-xl" />
              <div className="absolute inset-[38%] rounded-full bg-gradient-to-tl from-black/20 to-transparent" />
            </div>
          </div>
          
          {/* Subtle noise texture for realism */}
          <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <filter id={`noise-${symbol}`}>
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/>
              </filter>
              <rect width="100%" height="100%" filter={`url(#noise-${symbol})`}/>
            </svg>
          </div>
        </div>
        
        {/* Seamless blend transition - token submerged into vault */}
        <div className="absolute inset-x-0 top-[58%] h-[4%] bg-gradient-to-b from-black/0 via-black/20 to-black/30 pointer-events-none" />
        
        {/* Blue glow emanating from vault to emphasize Base blue */}
        <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-[#0000FF]/20 to-transparent pointer-events-none blur-sm" />
      </div>
    </div>
  )
}
