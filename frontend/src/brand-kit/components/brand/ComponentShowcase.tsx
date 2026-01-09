import React from 'react';

export const ComponentShowcase = ({ title, children, className = "" }: { title: string, children?: React.ReactNode, className?: string }) => (
    <div className={`border border-glass rounded-xl bg-vault-card/20 p-8 flex flex-col gap-6 ${className}`}>
        <h3 className="text-[10px] font-bold text-white uppercase tracking-widest border-b border-glass pb-4 flex justify-between items-center">
            {title}
            <div className="flex gap-1">
                <div className="w-1 h-1 bg-white/20 rounded-full"></div>
                <div className="w-1 h-1 bg-white/20 rounded-full"></div>
                <div className="w-1 h-1 bg-white/20 rounded-full"></div>
            </div>
        </h3>
        <div className="flex flex-wrap gap-6 items-center justify-center min-h-[140px] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEgMUgyVjJIMUMxeiIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] rounded-lg border border-white/5 p-8 relative overflow-hidden">
            {/* Inner shadow for depth */}
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"></div>
            {children}
        </div>
    </div>
);