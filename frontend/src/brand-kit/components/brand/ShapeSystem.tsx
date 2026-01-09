import React, { useState } from 'react';

const SuperEllipsePath = ({ width, height, curvature }: { width: number, height: number, curvature: number }) => {
    // A rough approximation of a superellipse using SVG paths for visualization
    // M 0 c 0 (h/2) (w/2) 0
    // This is just a visualizer, true superellipse math is complex for simple SVG paths without many points.
    // Instead, we will simulate the "Squircle" look by adjusting bezier handles.
    
    const w = width;
    const h = height;
    const m = Math.min(w, h) / 2;
    const r = m * curvature; 

    // Standard rounded rect path for comparison
    const roundedRect = `
        M ${r},0 
        H ${w - r} 
        Q ${w},0 ${w},${r} 
        V ${h - r} 
        Q ${w},${h} ${w - r},${h} 
        H ${r} 
        Q 0,${h} 0,${h - r} 
        V ${r} 
        Q 0,0 ${r},0 
        Z
    `;

    // "Squircle" / Superellipse approximation (Figma logic: longer control points)
    // We extend the bezier handles to create a smoother curve entry
    const k = 0.552284749831; // Standard circular handle length ratio
    const sk = k + (1 - k) * 0.6; // Smoother handle
    
    // Creating a path that looks "more squarish" at corners but smoother (Superellipse-ish)
    // Actually, purely visual distinction:
    return (
        <path d={roundedRect} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    );
};

export const ShapeSystem: React.FC = () => {
    const [smoothness, setSmoothness] = useState(0.6);

    return (
        <div className="space-y-16">
            
            {/* The Dot System */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="p-8 border border-glass rounded-xl bg-vault-card/20 flex flex-col items-center justify-center relative overflow-hidden min-h-[300px]">
                    <div className="absolute top-4 left-4 text-[10px] font-mono text-vault-subtext uppercase tracking-widest">
                        PRIMITIVE_01: THE_DOT
                    </div>
                    
                    <div className="relative group">
                        {/* The Dot */}
                        <div className="w-16 h-16 bg-brand-primary rounded-full shadow-[0_0_30px_#0052FF] relative z-10 transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-125"></div>
                        
                        {/* Orbital Ring 1 */}
                        <div className="absolute inset-0 -m-4 border border-brand-primary/30 rounded-full scale-0 group-hover:scale-100 transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] delay-75"></div>
                        
                        {/* Orbital Ring 2 */}
                        <div className="absolute inset-0 -m-8 border border-brand-primary/10 rounded-full scale-0 group-hover:scale-100 transition-transform duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] delay-150"></div>
                        
                        {/* Connection Lines */}
                        <div className="absolute top-1/2 left-1/2 w-[200px] h-[1px] bg-gradient-to-r from-brand-primary/50 to-transparent -translate-y-1/2 -translate-x-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-200 origin-right scale-x-0 group-hover:scale-x-100"></div>
                        <div className="absolute top-1/2 left-1/2 w-[200px] h-[1px] bg-gradient-to-l from-brand-primary/50 to-transparent -translate-y-1/2 -translate-x-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-200 origin-left scale-x-0 group-hover:scale-x-100"></div>
                    </div>

                    <div className="absolute bottom-8 text-center">
                        <p className="text-white text-sm font-medium">The Origin</p>
                        <p className="text-vault-subtext text-xs mt-1">Foundational element of the Base identity.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-glass pb-4">Dot Behaviors</h3>
                    
                    {/* Status */}
                    <div className="flex items-center gap-4 p-4 border border-glass rounded-lg bg-black/40">
                        <div className="w-2 h-2 bg-brand-primary rounded-full"></div>
                        <div className="flex-1 text-xs font-mono text-vault-subtext">STATUS::IDLE</div>
                    </div>
                    
                    {/* Processing */}
                    <div className="flex items-center gap-4 p-4 border border-glass rounded-lg bg-black/40">
                        <div className="w-2 h-2 bg-brand-primary rounded-full animate-ping"></div>
                        <div className="flex-1 text-xs font-mono text-vault-subtext">STATUS::BROADCASTING</div>
                    </div>

                    {/* Cluster */}
                    <div className="flex items-center gap-4 p-4 border border-glass rounded-lg bg-black/40">
                         <div className="flex -space-x-1">
                             <div className="w-3 h-3 bg-brand-primary rounded-full border border-black"></div>
                             <div className="w-3 h-3 bg-brand-primary rounded-full border border-black opacity-80"></div>
                             <div className="w-3 h-3 bg-brand-primary rounded-full border border-black opacity-60"></div>
                         </div>
                        <div className="flex-1 text-xs font-mono text-vault-subtext">GROUP::CLUSTER</div>
                    </div>
                </div>
            </div>

            {/* The Superellipse System */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div className="space-y-6">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-glass pb-4">Geometry: The Superellipse</h3>
                    <p className="text-sm text-vault-subtext leading-relaxed">
                        Moving beyond the standard rounded rectangle. The Base "New Day" aesthetic utilizes continuous curvature (Squircle) logic for a more organic, premium feel. 
                        While CSS <code className="text-brand-primary">border-radius</code> is a circular arc, our brand aims for <code className="text-brand-primary">smooth-corners</code> where supported.
                    </p>

                    <div className="p-6 bg-vault-card/40 border border-glass rounded-xl space-y-4">
                        <div className="flex justify-between text-[10px] font-mono text-vault-subtext uppercase">
                            <span>Standard Radius</span>
                            <span>Super-Ellipse</span>
                        </div>
                        <div className="relative h-32 w-full flex items-center justify-center gap-8">
                            {/* Standard */}
                            <div className="w-24 h-24 border border-white/20 rounded-2xl flex items-center justify-center relative">
                                <span className="absolute -bottom-6 text-[9px] text-vault-subtext">CSS Rounded</span>
                            </div>
                            
                            {/* Super-Ellipse (Simulated via SVG) */}
                            <div className="w-24 h-24 relative flex items-center justify-center">
                                <svg viewBox="0 0 100 100" className="w-full h-full text-brand-primary overflow-visible">
                                    <path 
                                        d="M 50 0 C 15 0 0 15 0 50 C 0 85 15 100 50 100 C 85 100 100 85 100 50 C 100 15 85 0 50 0 Z" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        strokeWidth="1.5"
                                    />
                                    {/* Accent corner points */}
                                    <circle cx="15" cy="15" r="2" fill="white" />
                                    <circle cx="85" cy="15" r="2" fill="white" />
                                    <circle cx="85" cy="85" r="2" fill="white" />
                                    <circle cx="15" cy="85" r="2" fill="white" />
                                </svg>
                                <span className="absolute -bottom-6 text-[9px] text-brand-primary font-bold">Base Shape</span>
                            </div>
                        </div>
                    </div>
                 </div>

                 {/* Interactive Playground */}
                 <div className="p-8 border border-glass rounded-xl bg-vault-card/20 flex flex-col items-center justify-center relative">
                    <div className="absolute top-4 left-4 text-[10px] font-mono text-vault-subtext uppercase tracking-widest">
                        SHAPE_LAB
                    </div>

                    <div 
                        className="w-40 h-40 bg-brand-primary shadow-[0_0_50px_rgba(0,82,255,0.3)] transition-all duration-300"
                        style={{
                            borderRadius: `${100 - (smoothness * 50)}%` // Quick hack to visualize shape change
                        }}
                    ></div>

                    <div className="w-full max-w-xs mt-12 space-y-4">
                        <div className="flex justify-between text-xs font-mono text-white">
                            <span>Circle</span>
                            <span>Square</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={smoothness * 100} 
                            onChange={(e) => setSmoothness(Number(e.target.value) / 100)}
                            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-brand-primary [&::-webkit-slider-thumb]:rounded-full"
                        />
                    </div>
                 </div>
            </div>
        </div>
    );
};