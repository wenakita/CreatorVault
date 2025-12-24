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
        {/* Base blue to tension cyan gradient */}
        <linearGradient id="cvGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0052FF"/>
          <stop offset="50%" stopColor="#00f2ff"/>
          <stop offset="100%" stopColor="#00ffa3"/>
        </linearGradient>
        <filter id="cvGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <g filter="url(#cvGlow)">
        {/* Vault square - rotated 45deg */}
        <rect x="68" y="68" width="120" height="120" rx="20" fill="url(#cvGradient)" transform="rotate(45 128 128)"/>
        
        {/* Lock mechanism */}
        <circle cx="128" cy="112" r="16" fill="#0a0a0a"/>
        <rect x="120" y="112" width="16" height="36" fill="#0a0a0a"/>
        
        {/* Base blue accent ring */}
        <circle cx="128" cy="128" r="85" fill="none" stroke="#0052FF" strokeWidth="2" opacity="0.3"/>
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
        {/* Base blue to tension cyan gradient */}
        <linearGradient id="vaultGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0052FF"/>
          <stop offset="50%" stopColor="#00f2ff"/>
          <stop offset="100%" stopColor="#00ffa3"/>
        </linearGradient>
        <linearGradient id="innerGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00f2ff"/>
          <stop offset="100%" stopColor="#0052FF"/>
        </linearGradient>
        <filter id="glowFull" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Outer rings */}
      <circle cx="256" cy="256" r="240" fill="#0a0a0a" stroke="url(#vaultGradient)" strokeWidth="4"/>
      <circle cx="256" cy="256" r="200" fill="none" stroke="url(#vaultGradient)" strokeWidth="3" opacity="0.6"/>
      <circle cx="256" cy="256" r="160" fill="none" stroke="#00f2ff" strokeWidth="1" opacity="0.3" strokeDasharray="20 10"/>
      
      <g filter="url(#glowFull)">
        {/* Main vault square */}
        <rect x="196" y="196" width="120" height="120" rx="16" fill="url(#vaultGradient)" transform="rotate(45 256 256)"/>
        <rect x="216" y="216" width="80" height="80" rx="10" fill="url(#innerGlow)" transform="rotate(45 256 256)" opacity="0.6"/>
        
        {/* Lock mechanism */}
        <circle cx="256" cy="240" r="20" fill="#0a0a0a"/>
        <rect x="248" y="240" width="16" height="40" fill="#0a0a0a"/>
      </g>
      
      {/* Corner accents - tension cyan */}
      <circle cx="136" cy="136" r="8" fill="#00f2ff" opacity="0.5"/>
      <circle cx="376" cy="136" r="8" fill="#00f2ff" opacity="0.5"/>
      <circle cx="136" cy="376" r="8" fill="#00f2ff" opacity="0.5"/>
      <circle cx="376" cy="376" r="8" fill="#00f2ff" opacity="0.5"/>
      
      {/* Text - tension cyan */}
      <text x="256" y="420" textAnchor="middle" fontFamily="Space Grotesk, Inter, system-ui, sans-serif" fontSize="48" fontWeight="700" fill="#00f2ff" letterSpacing="12">CV</text>
    </svg>
  );
}