import React from 'react';
import { Sparkline } from './Sparkline';

interface TelemetryModuleProps {
    label: string;
    value: string | number;
    change?: string;
    trend?: boolean;
}

export const TelemetryModule: React.FC<TelemetryModuleProps> = ({ label, value, change, trend }) => (
    <div className="relative bg-[#050505] p-6 rounded-xl border border-glass transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] hover:border-brand-primary/50 group overflow-hidden hover:shadow-[0_0_30px_-10px_rgba(0,82,255,0.15)]">
        {/* Active Corner Mechanics - Base Motion Style */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-brand-primary opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1 group-hover:translate-y-1"></div>
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-brand-primary opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:-translate-x-1 group-hover:translate-y-1"></div>
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-brand-primary opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-brand-primary opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:-translate-x-1 group-hover:-translate-y-1"></div>
        
        <div className="flex justify-between items-start mb-6 relative z-10">
             <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-vault-subtext group-hover:bg-brand-primary transition-colors duration-300 group-hover:scale-125"></div>
                 <p className="text-vault-subtext group-hover:text-white transition-colors duration-300 text-[10px] font-mono uppercase tracking-[0.2em]">{label}</p>
             </div>
             {change && (
                 <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${change.includes('+') ? 'text-green-400 border-green-400/20 bg-green-400/5' : 'text-brand-primary border-brand-primary/20 bg-brand-primary/5'}`}>
                     {change}
                 </span>
             )}
        </div>
        
        <div className="flex items-end justify-between relative z-10">
            <h3 className="text-4xl font-medium text-white tracking-tighter group-hover:translate-x-1 transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]">{value}</h3>
            {trend && <div className="w-24 opacity-60 group-hover:opacity-100 transition-opacity"><Sparkline /></div>}
        </div>
    </div>
);