import { motion } from "framer-motion";

interface CreatorVaultLogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

export function CreatorVaultLogo({ size = 64, className = "", animated = false }: CreatorVaultLogoProps) {
  const Logo = animated ? motion.svg : "svg";
  
  return (
    <Logo
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="none"
      width={size}
      height={size}
      className={className}
      {...(animated ? {
        animate: { rotate: [0, 360] },
        transition: { duration: 20, repeat: Infinity, ease: "linear" }
      } : {})}
    >
      <defs>
        <linearGradient id="cvGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0052FF"/>
          <stop offset="100%" stopColor="#0033CC"/>
        </linearGradient>
        <filter id="cvGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <g filter="url(#cvGlow)">
        <rect x="68" y="68" width="120" height="120" rx="20" fill="url(#cvGradient)" transform="rotate(45 128 128)"/>
        <circle cx="128" cy="112" r="16" fill="#0a0a0a"/>
        <rect x="120" y="112" width="16" height="36" fill="#0a0a0a"/>
      </g>
    </Logo>
  );
}

export function CreatorVaultLogoFull({ size = 256, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <linearGradient id="vaultGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0052FF"/>
          <stop offset="50%" stopColor="#3B82F6"/>
          <stop offset="100%" stopColor="#0033CC"/>
        </linearGradient>
        <linearGradient id="innerGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA"/>
          <stop offset="100%" stopColor="#0052FF"/>
        </linearGradient>
        <filter id="glowFull" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <circle cx="256" cy="256" r="240" fill="#0a0a0a" stroke="url(#vaultGradient)" strokeWidth="4"/>
      <circle cx="256" cy="256" r="200" fill="none" stroke="url(#vaultGradient)" strokeWidth="3" opacity="0.6"/>
      <circle cx="256" cy="256" r="160" fill="none" stroke="#0052FF" strokeWidth="1" opacity="0.3" strokeDasharray="20 10"/>
      
      <g filter="url(#glowFull)">
        <rect x="196" y="196" width="120" height="120" rx="16" fill="url(#vaultGradient)" transform="rotate(45 256 256)"/>
        <rect x="216" y="216" width="80" height="80" rx="10" fill="url(#innerGlow)" transform="rotate(45 256 256)" opacity="0.6"/>
        <circle cx="256" cy="240" r="20" fill="#0a0a0a"/>
        <rect x="248" y="240" width="16" height="40" fill="#0a0a0a"/>
      </g>
      
      <circle cx="136" cy="136" r="8" fill="#0052FF" opacity="0.5"/>
      <circle cx="376" cy="136" r="8" fill="#0052FF" opacity="0.5"/>
      <circle cx="136" cy="376" r="8" fill="#0052FF" opacity="0.5"/>
      <circle cx="376" cy="376" r="8" fill="#0052FF" opacity="0.5"/>
      
      <text x="256" y="420" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize="48" fontWeight="300" fill="#0052FF" letterSpacing="8">CV</text>
    </svg>
  );
}