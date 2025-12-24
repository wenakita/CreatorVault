import { TokenImage } from './TokenImage'
import { AKITA } from '../config/contracts'

interface VaultLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function VaultLogo({ size = 'md', className = '' }: VaultLogoProps) {
  return (
    <div className={`relative ${className}`}>
      <TokenImage
        tokenAddress={AKITA.token as `0x${string}`}
        symbol="AKITA"
        size={size}
        fallbackColor="from-orange-500 to-red-600"
        isWrapped={true}
      />
    </div>
  )
}

