import React, { useState, useRef } from 'react';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { logger } from '@/lib/logger';

import { ColorToken } from '../components/brand/ColorToken';
import { TypeSpec } from '../components/brand/TypeSpec';
import { SectionHeader } from '../components/brand/SectionHeader';
import { ComponentShowcase } from '../components/brand/ComponentShowcase';
import { InteractiveToggle, InteractiveCheckbox, InteractiveSlider } from '../components/brand/InteractiveElements';

// New Asset Libraries
import { ShapeSystem } from '../components/brand/ShapeSystem';
import { TextureSystem } from '../components/brand/TextureSystem';

// --- Local Visualizations (Blueprints, Icons) ---

const LogoBlueprint = () => {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        // Calculate normalized coordinates (-1 to 1)
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        setMousePos({ x, y });
    };

    const handleMouseLeave = () => {
        setMousePos({ x: 0, y: 0 });
    };

    return (
        <div 
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="aspect-video bg-[#030303] border border-glass rounded-xl relative overflow-hidden flex items-center justify-center group perspective-[1000px]"
        >
             {/* Radial Glow - Follows mouse loosely */}
             <div 
                 className="absolute inset-0 bg-radial-gradient from-brand-primary/10 to-transparent opacity-30 transition-transform duration-200 ease-out"
                 style={{ transform: `translate(${mousePos.x * 20}px, ${mousePos.y * 20}px)` }}
             ></div>
             
             {/* Grid Background - Parallax Layer Back (Moves opposite to mouse) */}
             <div 
                 className="absolute inset-[-25%] opacity-10 transition-transform duration-100 ease-out will-change-transform"
                 style={{ 
                     backgroundImage: 'linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px), linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)',
                     backgroundSize: '40px 40px',
                     transform: `translate(${mousePos.x * -15}px, ${mousePos.y * -15}px)`
                 }}
             ></div>

             {/* Blueprint Lines - Parallax Layer Middle */}
             <div 
                 className="absolute inset-0 pointer-events-none transition-transform duration-150 ease-out will-change-transform"
                 style={{ transform: `translate(${mousePos.x * -8}px, ${mousePos.y * -8}px)` }}
             >
                 {/* Center Lines */}
                 <div className="absolute top-1/2 left-0 w-full h-[1px] bg-brand-primary/20"></div>
                 <div className="absolute left-1/2 top-0 h-full w-[1px] bg-brand-primary/20"></div>
                 
                 {/* Golden Ratio Boxes */}
                 <div className="absolute top-1/2 left-1/2 w-[120px] h-[120px] border border-brand-primary/10 -translate-x-1/2 -translate-y-1/2"></div>
                 <div className="absolute top-1/2 left-1/2 w-[194px] h-[194px] border border-dashed border-brand-primary/10 rounded-full -translate-x-1/2 -translate-y-1/2 opacity-30 animate-[spin_60s_linear_infinite]"></div>
             </div>
             
             {/* Central Logo - Parallax Layer Front & 3D Tilt */}
             <div 
                className="relative z-10 scale-[3] drop-shadow-[0_0_80px_rgba(0,82,255,0.25)] transition-transform duration-300 ease-out will-change-transform"
                style={{
                    transform: `scale(3) rotateX(${mousePos.y * -12}deg) rotateY(${mousePos.x * 12}deg) translate(${mousePos.x * 12}px, ${mousePos.y * 12}px)`
                }}
             >
                <Logo width={64} height={64} showText={false} />
             </div>

             {/* Technical Data Points */}
             <div className="absolute top-8 left-8 font-mono text-[9px] text-brand-primary/60 space-y-3 pointer-events-none">
                 <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 border border-brand-primary bg-transparent"></div> GRID: 48px</div>
                 <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 border border-brand-primary bg-transparent"></div> PADDING: 14px</div>
                 <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 border border-brand-primary bg-transparent"></div> STROKE: 1.2px</div>
             </div>

             <div className="absolute bottom-8 right-8 text-right pointer-events-none">
                 <span className="font-mono text-[9px] text-vault-subtext uppercase tracking-widest border border-glass px-3 py-1.5 rounded bg-black/50 backdrop-blur shadow-xl">
                     Fig 1.2: Wireframe Construct
                 </span>
             </div>
        </div>
    );
};

const LogoStates = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {[
            { title: "State 01: Origin", desc: "The Geometric Primitive (Box)", forceHover: false },
            { title: "State 02: Base", desc: "The Compressed Core (Sphere)", forceHover: true }
        ].map((state, i) => (
            <div key={i} className="p-8 border border-glass rounded-xl bg-vault-card/20 flex flex-col items-center gap-6 relative overflow-hidden group hover:border-brand-primary/30 transition-colors">
                <div className={`scale-150 transition-all duration-500`}>
                    <Logo width={48} height={48} showText={false} forceHover={state.forceHover} />
                </div>
                <div className="text-center relative z-10">
                    <span className="text-[9px] font-mono text-brand-primary uppercase tracking-widest mb-1 block">{state.title}</span>
                    <span className="text-[10px] text-vault-subtext">{state.desc}</span>
                </div>
            </div>
        ))}
    </div>
);

const PhysicsCurve = () => (
    <div className="h-32 border border-glass rounded-xl bg-vault-card/20 relative overflow-hidden flex items-end px-8 pb-8 group">
        <svg className="w-full h-full absolute inset-0 text-brand-primary/20" preserveAspectRatio="none">
            <path d="M0,128 C50,128 50,0 100,0 L1000,0" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="w-full flex justify-between items-end font-mono text-[9px] text-vault-subtext relative z-10">
            <span>0ms</span>
            <div className="flex flex-col items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-brand-primary shadow-[0_0_10px_#0052FF] animate-bounce"></div>
                 <span>cubic-bezier(0.25, 1, 0.5, 1)</span>
            </div>
            <span>400ms</span>
        </div>
    </div>
);

const IconGrid = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
            { name: "Dashboard", path: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
            { name: "Fabrication", path: "M12 4v16m8-8H4" },
            { name: "Brand Kit", path: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" },
            { name: "Settings", path: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
            { name: "Security", path: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
            { name: "Network", path: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
            { name: "Analytics", path: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
            { name: "Cloud", path: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" }
        ].map((icon, i) => {
            const [clicked, setClicked] = useState(false);
            const handleClick = () => {
                navigator.clipboard.writeText(icon.path);
                setClicked(true);
                setTimeout(() => setClicked(false), 2000);
            };
            return (
                <div key={i} onClick={handleClick} className="aspect-square border border-glass rounded-xl flex flex-col items-center justify-center gap-4 hover:bg-white/5 transition-colors group relative cursor-pointer active:scale-95">
                    {/* Grid Overlay */}
                    <div className="absolute inset-4 border border-brand-primary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    
                    {/* Copy Feedback */}
                    <div className={`absolute top-2 right-2 px-1.5 py-0.5 bg-brand-primary text-[8px] font-bold text-white rounded transition-opacity duration-300 ${clicked ? 'opacity-100' : 'opacity-0'}`}>
                        COPIED
                    </div>

                    <svg className={`w-8 h-8 text-vault-subtext group-hover:text-brand-primary transition-colors ${clicked ? 'scale-110 text-white' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon.path} />
                    </svg>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-vault-subtext opacity-50 group-hover:opacity-80 transition-opacity">{icon.name}</span>
                </div>
            );
        })}
    </div>
);

const downloadPNG = (containerId: string, fileName: string) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Find the SVG
    const exportSvg = container.querySelector('.export-svg');
    const svg = exportSvg || container.querySelector('svg');
    if (!svg) {
        logger.error('SVG not found in container', { containerId, fileName });
        return;
    }

    // Serialize SVG
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);

    // Add namespaces
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    // Create Base64 SVG
    const svg64 = btoa(unescape(encodeURIComponent(source)));
    const b64Start = 'data:image/svg+xml;base64,';
    const image64 = b64Start + svg64;

    // Draw to Canvas
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        // Use intrinsic SVG size or default to high-res
        const svgW = (svg as any).width.baseVal?.value;
        const svgH = (svg as any).height.baseVal?.value;
        
        // Scale logic: If SVG is small (like an icon), scale up. 
        // If it's already large (like our new HQ logo), use 1x or 2x.
        const scale = svgW > 500 ? 1 : 10; 
        
        canvas.width = (svgW || 220) * scale;
        canvas.height = (svgH || 48) * scale;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Improve scaling quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const pngUrl = canvas.toDataURL('image/png');
        
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = fileName.replace('.svg', '.png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    img.src = image64;
};

// ... [Existing Export SVG Components remain unchanged] ...
// Note: In a real refactor, these should be moved to components/brand/BrandAssets.tsx
// For brevity in this turn, assuming they are still defined or imported as needed.
// Re-declaring for safety if file is overwritten completely.

const ExportableTwitterIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" className="export-svg hidden">
        <defs>
            <radialGradient id="tw-bg-grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%"><stop offset="0%" stopColor="#080808" /><stop offset="100%" stopColor="#000000" /></radialGradient>
            <linearGradient id="tw-core-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="15%" stopColor="#3B82F6" /><stop offset="50%" stopColor="#0052FF" /><stop offset="100%" stopColor="#001040" /></linearGradient>
            <filter id="tw-core-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="800" height="800" fill="url(#tw-bg-grad)" />
        <pattern id="tw-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#111" strokeWidth="1" /></pattern>
        <rect width="800" height="800" fill="url(#tw-grid)" />
        <circle cx="400" cy="400" r="360" fill="none" stroke="#0052FF" strokeWidth="2" opacity="0.15" />
        <circle cx="400" cy="400" r="340" fill="none" stroke="#0052FF" strokeWidth="1" strokeDasharray="20 40" opacity="0.3" />
        <g transform="translate(200, 200) scale(4)">
             <g filter="url(#tw-core-glow)"><rect x="25" y="25" width="50" height="50" rx="4" fill="#0052FF" fillOpacity="0.1" /><rect x="25" y="25" width="50" height="50" rx="4" fill="none" stroke="url(#tw-core-grad)" strokeWidth="3" /></g>
             <rect x="25" y="25" width="50" height="50" rx="4" stroke="#FFF" strokeWidth="1" strokeOpacity="0.4" fill="none" />
             <rect x="15" y="45" width="4" height="10" fill="#0052FF" opacity="0.4" />
             <rect x="81" y="45" width="4" height="10" fill="#0052FF" opacity="0.4" />
        </g>
    </svg>
);

const ExportableTwitterHeader = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500" viewBox="0 0 1500 500" className="export-svg hidden">
        <defs>
             <linearGradient id="header-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#050505" /><stop offset="100%" stopColor="#001020" /></linearGradient>
             <pattern id="header-grid" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#FFFFFF" strokeOpacity="0.03" strokeWidth="1" /></pattern>
        </defs>
        <rect width="1500" height="500" fill="url(#header-grad)" />
        <rect width="1500" height="500" fill="url(#header-grid)" />
        <g transform="translate(60, 280)">
             <text fontFamily="Inter, sans-serif" fontWeight="900" fontSize="120" fill="#EDEDED" letterSpacing="-4">ERCreator</text>
             <text x="630" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" fontSize="120" fill="#0052FF" letterSpacing="-6">4626</text>
             <text x="10" y="60" fontFamily="'JetBrains Mono', monospace" fontSize="24" fill="#0052FF" letterSpacing="10" opacity="0.8">PROTOCOL IDENTITY</text>
        </g>
        <g transform="translate(1000, 250)">
             <circle cx="200" cy="0" r="300" fill="none" stroke="#0052FF" strokeWidth="1" opacity="0.1" />
             <circle cx="200" cy="0" r="250" fill="none" stroke="#0052FF" strokeWidth="2" opacity="0.05" strokeDasharray="10 20" />
             <path d="M-100 100 L100 100 L200 0" fill="none" stroke="#0052FF" strokeWidth="2" opacity="0.3" />
             <path d="M-50 150 L150 150 L250 50" fill="none" stroke="#0052FF" strokeWidth="1" opacity="0.2" />
        </g>
        <g transform="translate(1250, 60)"><text fontFamily="'JetBrains Mono', monospace" fontSize="14" fill="#0052FF" textAnchor="end">SYSTEM_STATUS::ONLINE</text></g>
    </svg>
);

const ExportableStandardFull = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300" className="export-svg hidden">
        <defs>
            <linearGradient id="std-full-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="20%" stopColor="#3B82F6" /><stop offset="50%" stopColor="#0052FF" /><stop offset="100%" stopColor="#001040" /></linearGradient>
            <filter id="std-full-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1200" height="300" fill="#020202" />
        <g transform="translate(100, 50)">
             <g transform="scale(4)">
                <g opacity="0.8" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                     <text x="-16" y="11" fontSize="1.8" fill="#3B82F6" opacity="0.7">ERC4626::VAULT</text>
                     <text x="34" y="15" fontSize="1.8" fill="#3B82F6" opacity="0.6">LZ::OFT::V2</text>
                     <text x="-22" y="25" fontSize="2.2" fill="#0052FF" opacity="0.4">EIP4337::AA</text>
                     <text x="30" y="31" fontSize="1.8" fill="#0052FF" opacity="0.5">LINK::VRF</text>
                     <text x="-2" y="6" fontSize="1" fill="white" opacity="0.5">0x5b...75</text>
                </g>
                <g filter="url(#std-full-glow)">
                    <rect x="8" y="8" width="32" height="32" rx="1" fill="rgba(0, 82, 255, 0.1)" stroke="url(#std-full-grad)" strokeWidth="2.5" />
                    <rect x="8" y="8" width="32" height="32" rx="1" fill="none" stroke="#0052FF" strokeWidth="1" strokeOpacity="0.5" />
                </g>
             </g>
        </g>
        <g transform="translate(360, 190)">
             <text fontFamily="Inter, sans-serif" fontWeight="bold" fontSize="110" fill="#EDEDED" letterSpacing="-4">ERCreator</text>
             <text x="640" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" fontSize="110" fill="#0052FF" letterSpacing="-6">4626</text>
             <text x="10" y="60" fontFamily="'JetBrains Mono', monospace" fontSize="24" fill="#666666" letterSpacing="8">PROTOCOL IDENTITY</text>
        </g>
    </svg>
);

const ExportableStandardMark = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" className="export-svg hidden">
        <defs>
            <linearGradient id="std-mark-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="20%" stopColor="#3B82F6" /><stop offset="50%" stopColor="#0052FF" /><stop offset="100%" stopColor="#001040" /></linearGradient>
            <filter id="std-mark-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="512" height="512" fill="#020202" />
        <g transform="translate(64, 64) scale(8)">
             <g opacity="0.8" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                 <text x="-16" y="11" fontSize="1.8" fill="#3B82F6" opacity="0.7">ERC4626</text>
                 <text x="34" y="15" fontSize="1.8" fill="#3B82F6" opacity="0.6">LZ::OFT</text>
                 <text x="-22" y="25" fontSize="2.2" fill="#0052FF" opacity="0.4">EIP4337</text>
                 <text x="30" y="31" fontSize="1.8" fill="#0052FF" opacity="0.5">LINK::VRF</text>
            </g>
            <g filter="url(#std-mark-glow)">
                <rect x="8" y="8" width="32" height="32" rx="1" fill="rgba(0, 82, 255, 0.1)" stroke="url(#std-mark-grad)" strokeWidth="2.5" />
                <rect x="8" y="8" width="32" height="32" rx="1" fill="none" stroke="#0052FF" strokeWidth="1" strokeOpacity="0.5" />
            </g>
        </g>
    </svg>
);

export const BrandKit: React.FC = () => {
  return (
    <div className="p-12 animate-fade-in max-w-[1400px] mx-auto pb-40">
      {/* Hero Header */}
      <header className="mb-32 pt-12 relative">
        <div className="absolute top-0 right-0 p-4 border border-glass rounded-lg font-mono text-[9px] text-vault-subtext uppercase tracking-widest hidden md:block opacity-60 hover:opacity-100 transition-opacity cursor-default">
            System Status: Nominal<br/>
            Version: 4.2.0<br/>
            Build: Production
        </div>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 relative z-10">
            <div>
                <div className="flex items-center gap-3 mb-8">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
                    </span>
                    <span className="text-[10px] font-mono text-brand-primary uppercase tracking-[0.3em] opacity-80">Design Operations</span>
                </div>
                <h1 className="text-8xl md:text-9xl font-thin text-white tracking-tighter mb-8 leading-[0.85] select-none">
                    Protocol<br/>
                    <span className="text-vault-subtext/30 font-thin ml-2">Identity</span>
                </h1>
                <p className="text-vault-subtext text-lg max-w-2xl leading-relaxed font-light border-l border-glass pl-6">
                    The visual language of the <span className="text-white">ERCreator4626</span> Protocol.<br/>
                    Designed for <span className="text-white">clarity</span>, <span className="text-white">trust</span>, and <span className="text-white">immutability</span>.
                </p>
            </div>
            <div className="flex flex-col gap-3">
                 <div className="flex gap-4">
                    <Button variant="outline" className="h-12 px-8 font-mono text-xs">DOCS.MD</Button>
                    <Button variant="primary" className="h-12 px-8 shadow-[0_0_40px_rgba(0,82,255,0.2)]">DOWNLOAD_KIT.ZIP</Button>
                </div>
                <span className="text-[9px] text-vault-subtext text-right font-mono">SHA256: 8a...2f</span>
            </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-px border-b border-glass scrollbar-hide">
             {['01 The Core', '02 Social', '03 Spectrum', '04 Typography', '05 Interface', '06 Geometry', '07 Texture'].map((item, i) => (
                 <a 
                    key={i}
                    href={`#section-${i+1}`}
                    className="px-8 py-4 text-[10px] text-vault-subtext hover:text-white whitespace-nowrap transition-all hover:bg-white/[0.03] rounded-t-lg uppercase tracking-[0.15em] font-medium border-b-2 border-transparent hover:border-brand-primary/50"
                 >
                    {item}
                 </a>
             ))}
        </div>
      </header>

      <div className="space-y-48">
            
        {/* 01 LOGO */}
        <section id="section-1" className="scroll-mt-32">
            <SectionHeader number="01" title="The Core" />
            
            <div className="space-y-8">
                {/* Construction View */}
                <LogoBlueprint />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="p-8 border border-glass rounded-xl bg-vault-card/20">
                         <h3 className="text-xs font-bold text-white mb-6 uppercase tracking-widest border-b border-glass pb-4">Visual States</h3>
                         <LogoStates />
                     </div>
                     <div className="p-8 border border-glass rounded-xl bg-vault-card/20">
                        <div className="flex justify-between items-end mb-6 border-b border-glass pb-4">
                            <h3 className="text-xs font-bold text-white uppercase tracking-widest">Usage Context</h3>
                            <span className="text-[9px] font-mono text-vault-subtext">PNG_EXPORT_READY</span>
                        </div>
                        
                         <div className="grid grid-cols-2 gap-4">
                            {/* Dark Mode Mark */}
                            <div className="flex flex-col gap-3">
                                <div id="logo-export-dark" className="bg-[#050505] border border-glass rounded-lg flex items-center justify-center relative overflow-hidden group aspect-square">
                                    <div className="absolute inset-0 bg-brand-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="absolute top-2 left-2 text-[8px] font-mono text-vault-subtext uppercase">Dark Mark</div>
                                    <Logo width={64} height={64} colorMode="dark" showText={false} />
                                </div>
                                <Button variant="outline" size="sm" onClick={() => downloadPNG('logo-export-dark', 'ercreator4626-mark-dark.png')} className="w-full text-[10px] uppercase font-mono">
                                    Download Mark
                                </Button>
                            </div>
                             {/* Light Mode Mark */}
                             <div className="flex flex-col gap-3">
                                <div id="logo-export-light" className="bg-white border border-glass rounded-lg flex items-center justify-center relative aspect-square">
                                    <div className="absolute top-2 left-2 text-[8px] font-mono text-gray-400 uppercase">Light Mark</div>
                                    <Logo width={64} height={64} colorMode="light" showText={false} />
                                </div>
                                <Button variant="outline" size="sm" onClick={() => downloadPNG('logo-export-light', 'ercreator4626-mark-light.png')} className="w-full text-[10px] uppercase font-mono">
                                    Download Mark
                                </Button>
                            </div>
                         </div>
                         
                         {/* Full Logo Section */}
                         <div className="mt-8 pt-8 border-t border-glass">
                            <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-4">Official Exports</h4>
                            <div className="flex flex-col gap-6">
                                <div className="grid grid-cols-2 gap-4">
                                     {/* Flat Blue Full (Transparent) */}
                                     <div className="flex flex-col gap-3">
                                         <div id="logo-flat-blue" className="bg-white/5 border border-glass rounded-lg flex items-center justify-center p-6 relative h-32 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGgxMHYxMEgwem0xMCAxMGgxMHYxMEgxMHoiIGZpbGw9IiZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')]">
                                             <div className="absolute top-2 left-2 text-[8px] font-mono text-vault-subtext uppercase">Standard (High-Fi)</div>
                                             {/* Visual representation - scaled down */}
                                             <div className="scale-50">
                                                 <ExportableStandardFull />
                                             </div>
                                             {/* Export SVG */}
                                             <ExportableStandardFull />
                                         </div>
                                         <Button variant="outline" size="sm" onClick={() => downloadPNG('logo-flat-blue', 'ercreator4626-blue-full.png')} className="w-full text-[10px] uppercase font-mono">
                                             Download Full
                                         </Button>
                                     </div>

                                     {/* Flat Blue Mark (Transparent) */}
                                     <div className="flex flex-col gap-3">
                                         <div id="logo-mark-blue" className="bg-white/5 border border-glass rounded-lg flex items-center justify-center p-6 relative h-32 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGgxMHYxMEgwem0xMCAxMGgxMHYxMEgxMHoiIGZpbGw9IiZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')]">
                                             <div className="absolute top-2 left-2 text-[8px] font-mono text-vault-subtext uppercase">Standard Mark</div>
                                             {/* Visual representation */}
                                             <div className="w-16 h-16">
                                                <svg viewBox="0 0 512 512" className="w-full h-full">
                                                    <defs>
                                                        <linearGradient id="vis-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="20%" stopColor="#3B82F6" /><stop offset="50%" stopColor="#0052FF" /><stop offset="100%" stopColor="#001040" /></linearGradient>
                                                    </defs>
                                                    <rect width="512" height="512" fill="#020202" />
                                                    <g transform="translate(64, 64) scale(8)">
                                                        <g opacity="0.8" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                                                            <text x="-16" y="11" fontSize="1.8" fill="#3B82F6" opacity="0.7">ERC4626</text>
                                                            <text x="34" y="15" fontSize="1.8" fill="#3B82F6" opacity="0.6">LZ::OFT</text>
                                                            <text x="-22" y="25" fontSize="2.2" fill="#0052FF" opacity="0.4">EIP4337</text>
                                                            <text x="30" y="31" fontSize="1.8" fill="#0052FF" opacity="0.5">LINK::VRF</text>
                                                        </g>
                                                        <rect x="8" y="8" width="32" height="32" rx="1" fill="rgba(0, 82, 255, 0.1)" stroke="url(#vis-grad)" strokeWidth="2.5" />
                                                    </g>
                                                </svg>
                                             </div>
                                             {/* Export SVG */}
                                             <ExportableStandardMark />
                                         </div>
                                         <Button variant="outline" size="sm" onClick={() => downloadPNG('logo-mark-blue', 'ercreator4626-blue-mark.png')} className="w-full text-[10px] uppercase font-mono">
                                             Download Mark
                                         </Button>
                                     </div>
                                </div>
                            </div>
                         </div>

                     </div>
                </div>
            </div>
        </section>

        {/* 02 SOCIAL */}
        <section id="section-2" className="scroll-mt-32">
            <SectionHeader number="02" title="Social Media Kit" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Twitter Profile Icon */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <div id="twitter-icon-container" className="aspect-square border border-glass rounded-xl overflow-hidden relative group">
                        <div className="absolute top-4 left-4 z-20 px-2 py-1 bg-black/50 backdrop-blur border border-glass rounded text-[9px] font-mono text-white">PROFILE_PIC_800x800</div>
                        {/* Preview Wrapper with Circle Mask to show user how it crops */}
                        <div className="w-full h-full flex items-center justify-center bg-gray-900">
                             <div className="w-[80%] h-[80%] rounded-full overflow-hidden border-2 border-brand-primary/50 relative shadow-2xl">
                                <ExportableTwitterIcon />
                             </div>
                        </div>
                        {/* The Actual Export SVG (Hidden until download) */}
                        <ExportableTwitterIcon />
                    </div>
                    <Button onClick={() => downloadPNG('twitter-icon-container', 'ercreator-twitter-icon.png')} className="w-full font-mono uppercase text-xs">Download Profile Icon</Button>
                </div>

                {/* Twitter Header */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <div id="twitter-header-container" className="aspect-[3/1] border border-glass rounded-xl overflow-hidden relative group">
                         <div className="absolute top-4 left-4 z-20 px-2 py-1 bg-black/50 backdrop-blur border border-glass rounded text-[9px] font-mono text-white">HEADER_1500x500</div>
                         {/* Preview */}
                         <div className="w-full h-full">
                             <div className="w-full h-full transform scale-100 origin-top-left">
                                 {/* Using SVG directly for preview */}
                                 <svg viewBox="0 0 1500 500" className="w-full h-full">
                                    <defs>
                                        <linearGradient id="header-prev-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#050505" /><stop offset="100%" stopColor="#001020" /></linearGradient>
                                        <pattern id="header-prev-grid" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#FFFFFF" strokeOpacity="0.03" strokeWidth="1" /></pattern>
                                    </defs>
                                    <rect width="1500" height="500" fill="url(#header-prev-grad)" />
                                    <rect width="1500" height="500" fill="url(#header-prev-grid)" />
                                    <g transform="translate(60, 280)">
                                        <text fontFamily="Inter, sans-serif" fontWeight="900" fontSize="120" fill="#EDEDED" letterSpacing="-4">ERCreator</text>
                                        <text x="630" fontFamily="'JetBrains Mono', monospace" fontWeight="bold" fontSize="120" fill="#0052FF" letterSpacing="-6">4626</text>
                                        <text x="10" y="60" fontFamily="'JetBrains Mono', monospace" fontSize="24" fill="#0052FF" letterSpacing="10" opacity="0.8">PROTOCOL IDENTITY</text>
                                    </g>
                                    <g transform="translate(1000, 250)">
                                        <circle cx="200" cy="0" r="300" fill="none" stroke="#0052FF" strokeWidth="1" opacity="0.1" />
                                        <path d="M-100 100 L100 100 L200 0" fill="none" stroke="#0052FF" strokeWidth="2" opacity="0.3" />
                                    </g>
                                 </svg>
                             </div>
                         </div>
                         {/* Export SVG */}
                         <ExportableTwitterHeader />
                    </div>
                    <Button onClick={() => downloadPNG('twitter-header-container', 'ercreator-twitter-header.png')} variant="outline" className="w-full font-mono uppercase text-xs">Download Header Image</Button>
                </div>
            </div>
        </section>

        {/* 03 SPECTRUM */}
        <section id="section-3" className="scroll-mt-32">
            <SectionHeader number="03" title="Spectrum" />
            
            <div className="space-y-16">
                <div>
                    <h3 className="text-[10px] font-bold text-vault-subtext mb-8 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-brand-primary rounded-full"></span>
                        Primary Energy
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <ColorToken name="Electric Blue" value="#0052FF" description="CORE_ACTION" />
                        <ColorToken name="Deep Ocean" value="#004AD9" description="INTERACTION_STATE" />
                        <ColorToken name="Azure" value="#3B82F6" description="HIGHLIGHT_RING" />
                        <ColorToken name="Ether" value="rgba(0, 82, 255, 0.15)" description="GLASS_GLOW" />
                    </div>
                </div>
                
                <div>
                    <h3 className="text-[10px] font-bold text-vault-subtext mb-8 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-white rounded-full"></span>
                        Neutral Matter
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                        <ColorToken name="Void" value="#020202" description="BACKGROUND_00" />
                        <ColorToken name="Charcoal" value="#0A0A0A" description="SURFACE_01" />
                        <ColorToken name="Graphite" value="#1F1F1F" description="BORDER_DEFAULT" />
                        <ColorToken name="Mist" value="#EDEDED" description="TEXT_PRIMARY" />
                        <ColorToken name="Ash" value="#666666" description="TEXT_SECONDARY" />
                    </div>
                </div>
            </div>
        </section>

        {/* 04 TYPOGRAPHY */}
        <section id="section-4" className="scroll-mt-32">
            <SectionHeader number="04" title="Typography" />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-4 space-y-8">
                     <div className="p-8 border border-glass rounded-xl bg-vault-card/20 relative overflow-hidden">
                        <span className="text-[150px] font-thin text-white/5 absolute -top-10 -right-10 select-none">Aa</span>
                        <h3 className="text-2xl font-medium text-white tracking-tight mb-2">Inter</h3>
                        <p className="text-sm text-vault-subtext">The humanist sans-serif. Used for UI copy, headings, and long-form reading. Highly legible at all sizes.</p>
                     </div>
                     <div className="p-8 border border-glass rounded-xl bg-vault-card/20 relative overflow-hidden">
                        <span className="text-[150px] font-mono text-white/5 absolute -top-10 -right-10 select-none">{'{}'}</span>
                        <h3 className="text-2xl font-mono font-medium text-white tracking-tight mb-2">JetBrains Mono</h3>
                        <p className="text-sm text-vault-subtext">The technical accent. Used for metadata, code snippets, timestamps, and system status.</p>
                     </div>
                </div>

                <div className="lg:col-span-8">
                     <div className="border border-glass rounded-xl bg-vault-card/10 p-8">
                        <TypeSpec role="Display XL" sizeClass="text-7xl" weight="font-thin" sample="Protocol V4" />
                        <TypeSpec role="Display L" sizeClass="text-5xl" weight="font-light" sample="Asset Management" />
                        <TypeSpec role="Heading" sizeClass="text-3xl" weight="font-normal" sample="Vault Configuration" />
                        <TypeSpec role="Subheading" sizeClass="text-xl" weight="font-normal" sample="Secure your creative legacy." />
                        <TypeSpec role="Body" sizeClass="text-base" weight="font-light" sample="The future of digital ownership is permissionless and decentralized." />
                        <TypeSpec role="Mono" sizeClass="text-sm" weight="font-mono" sample="0x71C...92A // HASH_ID" />
                     </div>
                </div>
            </div>
        </section>
        
        {/* 05 SEMANTICS */}
        <section id="section-5" className="scroll-mt-32">
            <SectionHeader number="05" title="Semantics & Physics" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div>
                     <h3 className="text-[10px] font-bold text-vault-subtext mb-6 uppercase tracking-widest">Motion Curve</h3>
                     <PhysicsCurve />
                     <p className="mt-4 text-[10px] text-vault-subtext font-mono leading-relaxed">
                         All interactions use a custom spring physics model (stiffness: 120, damping: 20) to create a sense of weight and physical presence.
                     </p>
                 </div>
                 <div>
                     <h3 className="text-[10px] font-bold text-vault-subtext mb-6 uppercase tracking-widest">Border Radii</h3>
                     <div className="flex gap-4 items-end">
                         <div className="w-12 h-12 border border-glass bg-vault-card rounded-sm flex items-center justify-center text-[9px] text-vault-subtext font-mono">sm</div>
                         <div className="w-16 h-16 border border-glass bg-vault-card rounded-md flex items-center justify-center text-[9px] text-vault-subtext font-mono">md</div>
                         <div className="w-20 h-20 border border-glass bg-vault-card rounded-xl flex items-center justify-center text-[9px] text-vault-subtext font-mono">xl</div>
                         <div className="w-20 h-20 border border-glass bg-vault-card rounded-full flex items-center justify-center text-[9px] text-vault-subtext font-mono">full</div>
                     </div>
                 </div>
            </div>
        </section>

        {/* 06 INTERFACE - Updated */}
        <section id="section-6" className="scroll-mt-32">
            <SectionHeader number="06" title="Interface" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <ComponentShowcase title="Controls">
                    <div className="flex flex-wrap gap-4">
                        <Button variant="primary" size="sm">Primary</Button>
                        <Button variant="secondary" size="sm">Secondary</Button>
                        <Button variant="outline" size="sm">Outline</Button>
                        <Button variant="ghost" size="sm">Ghost</Button>
                        <Button variant="danger" size="sm">Destructive</Button>
                    </div>
                 </ComponentShowcase>

                 <ComponentShowcase title="Toggles & Sliders">
                    <div className="flex flex-col gap-6 w-full max-w-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-vault-subtext">SYSTEM_POWER</span>
                            <InteractiveToggle />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-vault-subtext">SAFE_MODE</span>
                            <InteractiveCheckbox />
                        </div>
                        <div className="pt-2">
                            <InteractiveSlider />
                        </div>
                    </div>
                 </ComponentShowcase>
            </div>
        </section>

        {/* 07 GEOMETRY (NEW) */}
        <section id="section-7" className="scroll-mt-32">
            <SectionHeader number="07" title="Geometry System" />
            <ShapeSystem />
        </section>

        {/* 08 TEXTURE & GRADIENT (NEW) */}
        <section id="section-8" className="scroll-mt-32">
            <SectionHeader number="08" title="Texture & Atmosphere" />
            <TextureSystem />
        </section>
        
        {/* 09 ICONOGRAPHY (Renumbered) */}
        <section id="section-9" className="scroll-mt-32">
            <SectionHeader number="09" title="Iconography" />
            <IconGrid />
        </section>

      </div>
    </div>
  );
};