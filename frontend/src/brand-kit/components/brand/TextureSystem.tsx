import React from 'react';

const GradientCard = ({ title, gradient, classes }: { title: string, gradient: string, classes: string }) => (
    <div className="group relative overflow-hidden rounded-xl border border-glass aspect-[4/3] transition-all duration-500 hover:scale-[1.02] hover:border-white/20">
        <div className={`absolute inset-0 ${classes}`} style={{ background: gradient }}></div>
        <div className="absolute inset-0 p-6 flex flex-col justify-between">
            <div className="w-full flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-[10px] font-mono text-white/70 uppercase tracking-widest border border-white/10 px-2 py-1 rounded bg-black/20 backdrop-blur-md">CSS / SVG</span>
            </div>
            <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-lg translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                <h4 className="text-white text-sm font-medium mb-1">{title}</h4>
                <p className="text-[10px] text-white/60 font-mono">.bg-{title.toLowerCase().replace(' ', '-')}</p>
            </div>
        </div>
    </div>
);

export const TextureSystem: React.FC = () => {
    return (
        <div className="space-y-16">
            
            {/* Gradients */}
            <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-glass pb-4 mb-8">Atmospheric Gradients</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <GradientCard 
                        title="Electric Dawn" 
                        gradient="linear-gradient(135deg, #0052FF 0%, #0033CC 100%)" 
                        classes=""
                    />
                    <GradientCard 
                        title="Deep Void" 
                        gradient="radial-gradient(circle at 50% 0%, #001030 0%, #020202 100%)" 
                        classes=""
                    />
                    <GradientCard 
                        title="Holographic Sheen" 
                        gradient="linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%)" 
                        classes=""
                    />
                </div>
            </div>

            {/* Mesh & Noise */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                     <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-glass pb-4 mb-8">Digital Grain</h3>
                     <div className="aspect-video bg-[#050505] border border-glass rounded-xl relative overflow-hidden group">
                         {/* Noise Layer */}
                         <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
                         
                         <div className="absolute inset-0 flex items-center justify-center">
                             <div className="text-center">
                                <h4 className="text-2xl font-light text-white tracking-tight">Film Noise</h4>
                                <p className="text-vault-subtext text-xs font-mono mt-2">OPACITY: 3.5% // BLEND: OVERLAY</p>
                             </div>
                         </div>
                     </div>
                </div>

                <div>
                     <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-glass pb-4 mb-8">Grid Mesh</h3>
                     <div className="aspect-video bg-[#0052FF] border border-glass rounded-xl relative overflow-hidden group">
                         {/* Grid Pattern */}
                         <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`, backgroundSize: '24px 24px', opacity: 0.2 }}></div>
                         
                         <div className="absolute inset-0 bg-gradient-to-t from-brand-primary via-transparent to-transparent"></div>

                         <div className="absolute bottom-8 left-8">
                            <h4 className="text-2xl font-light text-white tracking-tight">Dot Grid</h4>
                            <p className="text-white/60 text-xs font-mono mt-2">SPACING: 24px // RADIUS: 1px</p>
                         </div>
                     </div>
                </div>
            </div>

            {/* Material Stack */}
             <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-widest border-b border-glass pb-4 mb-8">Material Composability</h3>
                <div className="relative h-64 w-full flex items-center justify-center bg-black/20 rounded-xl border border-glass border-dashed">
                    {/* Layer 1: Base */}
                    <div className="absolute w-64 h-40 bg-[#050505] rounded-xl border border-glass transform -translate-x-12 -translate-y-4 shadow-xl flex items-center justify-center z-10 group hover:-translate-y-8 transition-transform duration-500">
                        <span className="text-[10px] font-mono text-vault-subtext">LAYER_01::BASE</span>
                    </div>

                    {/* Layer 2: Mesh */}
                    <div className="absolute w-64 h-40 bg-brand-primary/5 rounded-xl border border-glass/50 transform translate-x-0 translate-y-0 shadow-xl backdrop-blur-sm flex items-center justify-center z-20 group hover:-translate-y-4 transition-transform duration-500">
                         <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`, backgroundSize: '12px 12px' }}></div>
                        <span className="text-[10px] font-mono text-white">LAYER_02::MESH</span>
                    </div>

                    {/* Layer 3: Glass UI */}
                    <div className="absolute w-64 h-40 bg-white/5 rounded-xl border border-white/10 transform translate-x-12 translate-y-4 shadow-2xl backdrop-blur-md flex items-center justify-center z-30 group hover:translate-y-0 transition-transform duration-500">
                         {/* Highlight */}
                         <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
                        <span className="text-[10px] font-mono text-brand-primary font-bold">LAYER_03::INTERFACE</span>
                    </div>
                </div>
            </div>

        </div>
    );
};