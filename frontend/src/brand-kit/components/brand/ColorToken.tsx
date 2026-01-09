import React, { useState } from 'react';

export const ColorToken = ({ name, value, description }: { name: string, value: string, description?: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button 
        onClick={handleCopy}
        className="group flex flex-col text-left w-full focus:outline-none"
    >
        <div 
            className="w-full h-24 rounded-lg border border-glass mb-3 relative overflow-hidden transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-[0_0_20px_rgba(0,0,0,0.5)]" 
            style={{ background: value }}
        >
             <div className={`absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${copied ? 'opacity-100' : 'opacity-0'}`}>
                <span className="text-white font-mono text-[10px] font-bold bg-black/50 px-2 py-1 rounded border border-white/20">COPIED</span>
             </div>
             {/* Tech Pattern overlay */}
             <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-20"></div>
             <div className="absolute inset-0 border border-white/5 rounded-lg"></div>
        </div>
        <div className="flex justify-between items-baseline w-full">
            <span className="text-sm font-medium text-white group-hover:text-brand-primary transition-colors tracking-tight">{name}</span>
            <span className="text-[10px] font-mono text-vault-subtext opacity-60 uppercase tracking-wide">{value.includes('gradient') ? 'GRADIENT' : value}</span>
        </div>
        {description && <p className="text-[11px] text-vault-subtext mt-1 leading-relaxed opacity-50 font-light">{description}</p>}
    </button>
  );
};