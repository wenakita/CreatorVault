import React from 'react';

export const SectionHeader = ({ number, title }: { number: string, title: string }) => (
    <h2 className="text-3xl font-light text-white mb-10 flex items-center gap-4 pb-6 border-b border-glass sticky top-0 bg-vault-bg/95 backdrop-blur z-20 pt-4">
        <span className="font-mono text-brand-primary text-xs bg-brand-primary/5 px-2 py-1 rounded border border-brand-primary/20">{number}</span> 
        <span className="tracking-tight">{title}</span>
    </h2>
);