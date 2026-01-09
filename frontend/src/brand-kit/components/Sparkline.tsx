import React from 'react';

export const Sparkline = ({ color = "#0052FF" }) => (
    <svg className="w-full h-12 overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
        <path d="M0 40 L10 35 L20 38 L30 20 L40 25 L50 15 L60 18 L70 5 L80 10 L90 0 L100 20" 
              fill="none" 
              stroke={color} 
              strokeWidth="1.5" 
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="drop-shadow-[0_0_4px_rgba(0,82,255,0.5)]"
        />
        <path d="M0 40 L10 35 L20 38 L30 20 L40 25 L50 15 L60 18 L70 5 L80 10 L90 0 L100 20 V 40 H 0 Z" 
              fill={`url(#gradient-${color})`} 
              stroke="none" 
              opacity="0.2" 
        />
        <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
        </defs>
    </svg>
);