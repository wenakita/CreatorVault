import React from 'react';

export const TypeSpec = ({ role, sizeClass, weight, sample }: { role: string, sizeClass: string, weight: string, sample: string }) => (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-glass items-center group hover:bg-white/[0.02] px-6 -mx-6 rounded-xl transition-all duration-300">
        <div className="col-span-12 md:col-span-3">
            <span className="text-[9px] text-brand-primary font-mono uppercase block mb-1 tracking-widest opacity-80 border-l border-brand-primary/30 pl-2">{role}</span>
            <div className="flex gap-2 text-[9px] text-vault-subtext font-mono pl-2.5 mt-1.5">
                <span>{sizeClass.replace('text-', '')}</span>
                <span className="opacity-30">|</span>
                <span>{weight}</span>
            </div>
        </div>
        <div className="col-span-12 md:col-span-9">
            <p className={`${sizeClass} ${weight} text-white truncate opacity-90 group-hover:opacity-100 transition-opacity tracking-tight`}>{sample}</p>
        </div>
    </div>
);