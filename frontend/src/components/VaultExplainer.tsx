import React, { useEffect, useState } from 'react'

// Animation phases
// 0: Initial "ERC-4626"
// 1: Expanded "ERCreator4626"
// 2: Contracted "ERC-4626"
// 3: Transform to "VAULT" (Glitch/Impact)
// 4: Final "CREATOR VAULT"

export interface VaultExplainerProps {
  className?: string
  minHeightClassName?: string
  variant?: 'card' | 'hero'
}

export const VaultExplainer: React.FC<VaultExplainerProps> = ({
  className = '',
  minHeightClassName = 'min-h-[320px]',
  variant = 'card',
}) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Timeline configuration
    const sequence = [
      { next: 1, delay: 2500 }, // Hold Start
      { next: 2, delay: 3500 }, // Hold Expansion
      { next: 3, delay: 1500 }, // Hold Contraction
      { next: 4, delay: 1200 }, // Hold Vault Impact
      { next: 0, delay: 5000 }, // Hold Final Result
    ];

    let timeoutId: ReturnType<typeof setTimeout>;

    const runSequence = (currentIndex: number) => {
      const { next, delay } = sequence[currentIndex];
      
      timeoutId = setTimeout(() => {
        setStep(next);
        runSequence(next); // Chain to next
      }, delay);
    };

    // Start loop
    // We start at step 0. runSequence schedules the move to step 1.
    runSequence(0);

    return () => clearTimeout(timeoutId);
  }, []);

  // Derived states for easier rendering logic
  const isTechVisible = step < 3;
  const isVaultVisible = step >= 3;
  const isExpanded = step === 1;
  const isFinal = step === 4;

  const techLayerStyle: React.CSSProperties = {
    opacity: isTechVisible ? 1 : 0,
    transform: isTechVisible ? 'rotateX(0deg) scale(1)' : 'rotateX(90deg) scale(1.5)',
    filter: isTechVisible ? 'blur(0px)' : 'blur(24px)',
    transformStyle: 'preserve-3d',
  }

  const isHero = variant === 'hero'
  const containerClassName = [
    'relative w-full overflow-hidden transition-all duration-1000 group',
    minHeightClassName,
    'flex flex-col items-center justify-center',
    isHero ? 'rounded-none border-0 bg-transparent backdrop-blur-none p-0' : 'rounded-2xl border border-white/10 bg-vault-card/80 backdrop-blur-xl p-8 md:p-16',
    className,
  ].join(' ')

  const contentClassName = [
    'relative z-10 flex flex-col items-center justify-center text-center w-full',
    isHero ? 'max-w-6xl mx-auto px-6 py-8 md:py-16' : '',
  ].join(' ')

  return (
    <div
      className={containerClassName}
    >
      {/* --- Ambient Background Effects --- */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-1/4 w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>
        <div className="absolute top-0 right-1/4 w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
      </div>
      
      <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,82,255,0.03)_50%,transparent_100%)] bg-[length:100%_200%] animate-scan pointer-events-none"></div>

      {/* --- Main Content Container --- */}
      <div className={contentClassName}>
        
        {/* Status Indicator (Top) */}
        <div className="absolute top-0 -translate-y-12 mb-8 inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md transition-opacity duration-500 opacity-60 hover:opacity-100">
           <div className={`relative w-2 h-2 transition-all duration-500 ${isVaultVisible ? 'bg-white' : 'bg-brand-primary'}`}>
               <div className={`absolute inset-0 rounded-full animate-ping opacity-75 ${isVaultVisible ? 'bg-white' : 'bg-brand-primary'}`}></div>
           </div>
           <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-vault-subtext min-w-[120px] text-left">
               {isVaultVisible ? "INTERFACE_LAYER" : "PROTOCOL_LAYER"}
           </span>
        </div>

        <div className="relative h-32 flex items-center justify-center w-full [perspective:1000px]">
            
            {/* 1. Technical Standard Layer (ERC-4626 -> ERCreator4626) */}
            <div 
                className="absolute inset-0 flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
                style={techLayerStyle}
            >
                <div className="flex items-baseline text-5xl md:text-7xl lg:text-8xl tracking-tighter select-none">
                    {/* Prefix */}
                    <span className="font-sans font-semibold text-white transition-colors duration-500">ERC</span>
                    
                    {/* Morphing Middle Section */}
                    <div 
                        className="overflow-hidden transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] flex justify-center relative mx-1"
                        style={{ 
                            maxWidth: isExpanded ? '3.5em' : '0.6em', // Approximate widths for "reator" vs "-"
                        }}
                    >
                        {/* The Hyphen (Collapsed State) */}
                        <span 
                            className={`absolute inset-0 flex items-center justify-center font-mono text-brand-primary transition-all duration-500 transform ${
                                isExpanded ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'
                            }`}
                        >
                            -
                        </span>
                        
                        {/* The Expansion Text (Expanded State) */}
                        <span 
                            className={`block font-sans font-semibold text-white whitespace-nowrap transition-all duration-700 transform ${
                                isExpanded 
                                ? 'opacity-100 translate-y-0 blur-0' 
                                : 'opacity-0 translate-y-full blur-sm'
                            }`}
                        >
                            reator
                        </span>
                    </div>

                    {/* Suffix */}
                    <span className="font-doto font-bold text-brand-primary drop-shadow-[0_0_15px_rgba(0,82,255,0.4)]">4626</span>
                </div>
            </div>

            {/* 2. Vault Concept Layer (VAULT -> CREATOR VAULT) */}
            <div 
                className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out ${
                    isVaultVisible 
                    ? 'opacity-100 scale-100 translate-y-0' 
                    : 'opacity-0 scale-50 translate-y-12'
                }`}
            >
                <div className="flex items-center text-5xl md:text-7xl lg:text-8xl tracking-tighter select-none">
                    {/* "CREATOR" - Slides in */}
                    <div 
                        className="overflow-hidden transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] flex justify-end"
                        style={{ 
                            maxWidth: isFinal ? '5em' : '0px',
                            opacity: isFinal ? 1 : 0,
                            marginRight: isFinal ? '0.3em' : '0'
                        }}
                    >
                        <span className="font-sans font-light text-white whitespace-nowrap">CREATOR</span>
                    </div>

                    {/* "VAULT" - The Anchor */}
                    <span className={`font-doto font-bold text-white transition-all duration-500 ${!isFinal ? 'scale-110 text-brand-primary drop-shadow-[0_0_30px_rgba(0,82,255,0.6)]' : ''}`}>
                        VAULTS
                    </span>
                </div>
            </div>

        </div>

        {/* Dynamic Definition Subtitle */}
        <div className="h-12 relative w-full max-w-2xl overflow-hidden mt-8">
            {/* Tech Subtitle */}
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ${isTechVisible ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0'}`}>
                 <p className="text-xs md:text-sm text-brand-primary font-mono tracking-wider bg-brand-primary/10 px-4 py-1.5 rounded border border-brand-primary/20">
                     {isExpanded ? "<Identity::Expanded />" : "<TokenizedYieldStandard />"}
                 </p>
            </div>
            
            {/* Vault Subtitle */}
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ${isVaultVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                <p className="text-xs md:text-sm text-vault-subtext font-sans tracking-[0.3em] uppercase">
                    {isFinal ? "The Sovereign Interface" : "Initializing Secure Container..."}
                </p>
            </div>
        </div>

        {/* Progress Bar (Visual Timer) */}
        <div className="absolute bottom-0 left-0 h-[2px] bg-brand-primary/30 transition-all duration-300 ease-linear w-full opacity-50">
             <div 
                className="h-full bg-brand-primary shadow-[0_0_10px_#0052FF]" 
                style={{ 
                    width: `${((step + 1) / 5) * 100}%`,
                    transition: 'width 0.5s ease-out'
                }}
             ></div>
        </div>

      </div>
    </div>
  )
}
