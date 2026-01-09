import React, { useState } from 'react';
import { TextScramble } from './TextScramble';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  showText?: boolean;
  colorMode?: 'light' | 'dark';
  forceHover?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  width = 32, 
  height = 32, 
  showText = true,
  colorMode = 'dark',
  forceHover = false
}) => {
  const isLight = colorMode === 'light';
  const mainTextColor = isLight ? 'text-black' : 'text-white';
  const [internalHover, setInternalHover] = useState(false);
  const isHovered = forceHover || internalHover;

  return (
    <div 
        className={`flex items-center gap-3.5 ${className} group cursor-default`}
        onMouseEnter={() => setInternalHover(true)}
        onMouseLeave={() => setInternalHover(false)}
    >
      <div className="relative flex items-center justify-center" style={{ width, height }}>
        <svg
          width={width} 
          height={height}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
          role="img"
          aria-label="ERCreator 4626 Logo"
        >
            <defs>
                <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                
                {/* Base-Style Gradient: Vibrant Electric Blue to Deep Blue */}
                <linearGradient id="base-gradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#0052FF" />
                    <stop offset="100%" stopColor="#0033CC" />
                </linearGradient>

                {/* Glassy reflection overlay for the sphere look */}
                <radialGradient id="sphere-shine" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(16 16) rotate(90) scale(24)">
                     <stop offset="0%" stopColor="white" stopOpacity="0.4"/>
                     <stop offset="100%" stopColor="white" stopOpacity="0"/>
                </radialGradient>
                
                <linearGradient id="stroke-sheen" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="white" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#0052FF" stopOpacity="0.2" />
                </linearGradient>
            </defs>

            {/* --- Main Core (Square morphs to Base Zorb Sphere) --- */}
            <g 
                className="relative transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)]" 
                style={{ 
                    transformOrigin: 'center',
                    // Increased rotation to 180deg and reduced scale to 0.55 for a more pronounced fluid transition
                    transform: isHovered ? 'rotate(180deg) scale(0.55)' : 'rotate(0deg) scale(1)' 
                }}
            >
                <rect 
                    x="10" 
                    y="10" 
                    width="28" 
                    height="28" 
                    rx={isHovered ? 14 : 2} // 14px radius on 28px box = Perfect Circle
                    fill={isHovered ? "url(#base-gradient)" : "transparent"}
                    stroke={isHovered ? "transparent" : "url(#stroke-sheen)"}
                    strokeWidth={1.5}
                    className="transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{
                        filter: isHovered ? 'url(#soft-glow)' : 'none'
                    }}
                />
                
                {/* Sphere Shine Overlay (Only visible in Zorb mode) */}
                 <rect 
                    x="10" 
                    y="10" 
                    width="28" 
                    height="28" 
                    rx={14}
                    fill="url(#sphere-shine)"
                    className="transition-opacity duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
                    style={{
                        opacity: isHovered ? 1 : 0
                    }}
                 />

                {/* Internal Refraction Highlight (Appears on Sphere state) */}
                <ellipse 
                    cx="18" cy="16" rx="6" ry="3" 
                    fill="white"
                    className="transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none blur-[2px]"
                    style={{ 
                        opacity: isHovered ? 0.3 : 0, 
                        transform: isHovered ? 'translateY(0)' : 'translateY(4px)',
                        transformOrigin: '24px 24px'
                    }}
                />
            </g>

        </svg>
      </div>
      
      {showText && (
        <div className="flex flex-col justify-center leading-none" aria-hidden="true">
            <div className="flex items-center gap-1.5">
                <div className={`font-sans text-lg font-semibold tracking-tight ${mainTextColor} select-none`}>
                    <TextScramble 
                        text="ERCreator" 
                        trigger={isHovered} 
                        complexity="simple"
                        speed={forceHover ? 1.5 : 0.6}
                    />
                </div>
                <div className="font-sans text-lg font-bold tracking-tight text-brand-primary select-none">
                    <TextScramble 
                        text="4626" 
                        font="doto" 
                        trigger={isHovered} 
                        className="tracking-tighter"
                        complexity="simple"
                        speed={0.8}
                    />
                </div>
            </div>
        </div>
      )}
    </div>
  );
};