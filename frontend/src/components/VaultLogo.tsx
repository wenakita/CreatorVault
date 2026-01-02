import { DerivedTokenIcon } from './DerivedTokenIcon'
import { AKITA } from '../config/contracts'

interface VaultLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function VaultLogo({ size = 'md', className = '' }: VaultLogoProps) {
  return (
    <div className={`relative ${className}`}>
      <DerivedTokenIcon tokenAddress={AKITA.token as `0x${string}`} symbol="AKITA" variant="share" size={size} />
    </div>
  )
}
