import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { VaultAsset, AssetType } from '../types';
import { Button } from './Button';
import { TextScramble } from './TextScramble';

interface AssetInspectorProps {
    asset: VaultAsset | null;
    onClose: () => void;
    onDelete: (id: string) => void;
    onUpdate?: (asset: VaultAsset) => void;
}

// Track last action for Undo
interface UndoState {
    type: 'ADD' | 'REMOVE';
    tag: string;
    timestamp: number;
}

export const AssetInspector: React.FC<AssetInspectorProps> = ({ asset, onClose, onDelete, onUpdate }) => {
    const [mounted, setMounted] = useState(false);
    const [active, setActive] = useState(false);
    const [newTag, setNewTag] = useState('');
    const [undoState, setUndoState] = useState<UndoState | null>(null);

    useEffect(() => {
        if (asset) {
            setMounted(true);
            setTimeout(() => setActive(true), 50);
            setUndoState(null); // Reset undo state on new asset load
        } else {
            setActive(false);
            setTimeout(() => setMounted(false), 500);
        }
    }, [asset]);

    // Auto-clear undo state after 5 seconds
    useEffect(() => {
        if (undoState) {
            const timer = setTimeout(() => {
                setUndoState(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [undoState]);

    if (!mounted || !asset) return null;

    const handleAddTag = () => {
        if (!newTag.trim() || !onUpdate) return;
        const tag = newTag.trim();
        if (asset.tags.includes(tag)) return;

        const updatedAsset = { ...asset, tags: [...asset.tags, tag] };
        onUpdate(updatedAsset);
        setNewTag('');
        setUndoState({ type: 'ADD', tag, timestamp: Date.now() });
    };

    const handleRemoveTag = (tagToRemove: string) => {
        if (!onUpdate) return;
        const updatedAsset = { ...asset, tags: asset.tags.filter(t => t !== tagToRemove) };
        onUpdate(updatedAsset);
        setUndoState({ type: 'REMOVE', tag: tagToRemove, timestamp: Date.now() });
    };

    const handleUndo = () => {
        if (!undoState || !onUpdate) return;

        let updatedTags = [...asset.tags];
        if (undoState.type === 'ADD') {
            // Undo Add -> Remove it
            updatedTags = updatedTags.filter(t => t !== undoState.tag);
        } else {
            // Undo Remove -> Add it back
            if (!updatedTags.includes(undoState.tag)) {
                updatedTags.push(undoState.tag);
            }
        }
        
        const updatedAsset = { ...asset, tags: updatedTags };
        onUpdate(updatedAsset);
        setUndoState(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddTag();
        }
    };

    const modalContent = (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 transition-all duration-500 ${active ? 'backdrop-blur-xl bg-black/60' : 'backdrop-blur-none bg-black/0 pointer-events-none'}`}>
            <div 
                className={`w-full max-w-6xl h-[85vh] bg-[#050505] border border-glass rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col md:flex-row relative transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${active ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-12'}`}
            >
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 z-50 w-10 h-10 rounded-full border border-glass bg-black/50 hover:bg-white hover:text-black text-white flex items-center justify-center transition-all duration-300 group"
                >
                    <svg className="w-5 h-5 transition-transform duration-300 group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Left: Content Viewer */}
                <div className="md:w-2/3 h-1/2 md:h-full bg-[#020202] relative group overflow-hidden border-b md:border-b-0 md:border-r border-glass">
                    {/* Background Grid */}
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgNDBMMDQgMCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMDMiLz48L3N2Zz4=')] opacity-50"></div>
                    
                    <div className="w-full h-full flex items-center justify-center p-12 relative z-10">
                        {asset.type === AssetType.IMAGE ? (
                            <div className="relative shadow-2xl">
                                <img src={asset.content} alt={asset.title} className="max-w-full max-h-[70vh] object-contain rounded-lg border border-white/10" />
                                {/* Holographic Borders */}
                                <div className="absolute -top-4 -left-4 w-8 h-8 border-t border-l border-brand-primary"></div>
                                <div className="absolute -bottom-4 -right-4 w-8 h-8 border-b border-r border-brand-primary"></div>
                            </div>
                        ) : (
                            <div className="max-w-2xl text-center">
                                <span className="text-6xl text-brand-primary/20 font-serif italic mb-8 block">¶</span>
                                <p className="text-xl md:text-2xl font-light leading-relaxed text-white">{asset.content}</p>
                            </div>
                        )}
                    </div>

                    {/* Overlay Info */}
                    <div className="absolute bottom-8 left-8 text-xs font-mono text-vault-subtext bg-black/80 backdrop-blur px-3 py-2 border border-glass rounded">
                        VIEWER_MODE::PREVIEW_HQ
                    </div>
                </div>

                {/* Right: Metadata Panel */}
                <div className="md:w-1/3 h-1/2 md:h-full bg-[#080808] p-6 md:p-8 flex flex-col relative overflow-hidden">
                    {/* Background Pattern for Panel */}
                    <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
                         <div className="w-20 h-20 bg-brand-primary/20 blur-3xl rounded-full"></div>
                    </div>

                    <div className="mb-6 shrink-0 z-10">
                        {/* Header Content */}
                        <div className="flex items-center gap-3 mb-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold font-mono uppercase tracking-wide border ${asset.type === AssetType.IMAGE ? 'text-blue-400 border-blue-400/20 bg-blue-400/5' : 'text-purple-400 border-purple-400/20 bg-purple-400/5'}`}>
                                {asset.type}
                            </span>
                            <span className="text-[10px] font-mono text-vault-subtext">{new Date(asset.createdAt).toISOString().split('T')[0]}</span>
                        </div>
                        <h2 className="text-2xl font-medium text-white leading-tight mb-2 line-clamp-2">{asset.title}</h2>
                        <div className="h-1 w-12 bg-brand-primary mt-4"></div>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto pr-2 -mr-2 relative z-10 scrollbar-thin">
                        
                        {/* Two-Column Grid Layout */}
                        <div className="grid grid-cols-2 gap-6 mb-6">
                            
                            {/* Column 1: Technical Data */}
                            <div className="flex flex-col gap-3">
                                <h3 className="text-[10px] font-bold text-vault-subtext uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1 h-1 bg-brand-primary rounded-full"></span>
                                    Tech Data
                                </h3>
                                <div className="space-y-2">
                                    <div className="p-2 bg-white/5 border border-glass rounded group hover:border-brand-primary/30 transition-colors">
                                        <div className="text-[9px] text-vault-subtext uppercase tracking-wider mb-0.5">ID_HASH</div>
                                        <div className="text-[10px] text-white font-mono truncate" title={asset.id}>{asset.id.substring(0, 8)}...</div>
                                    </div>
                                    <div className="p-2 bg-white/5 border border-glass rounded group hover:border-brand-primary/30 transition-colors">
                                        <div className="text-[9px] text-vault-subtext uppercase tracking-wider mb-0.5">SIZE</div>
                                        <div className="text-[10px] text-white font-mono">{asset.content.length > 1000 ? Math.round(asset.content.length / 1024) + ' KB' : asset.content.length + ' B'}</div>
                                    </div>
                                    <div className="p-2 bg-white/5 border border-glass rounded group hover:border-brand-primary/30 transition-colors">
                                        <div className="text-[9px] text-vault-subtext uppercase tracking-wider mb-0.5">FORMAT</div>
                                        <div className="text-[10px] text-white font-mono">{asset.type === AssetType.IMAGE ? 'PNG' : 'TXT'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Tags */}
                            <div className="flex flex-col gap-3">
                                <h3 className="text-[10px] font-bold text-vault-subtext uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1 h-1 bg-white rounded-full"></span>
                                    Tags
                                </h3>
                                <div className="flex flex-wrap gap-2 content-start">
                                    {asset.tags.map(tag => (
                                        <span key={tag} className="px-2 py-1 bg-brand-primary/10 border border-brand-primary/20 rounded text-[9px] text-brand-primary font-mono flex items-center gap-1 group/tag hover:bg-brand-primary/20 transition-colors cursor-default">
                                            #{tag}
                                            {onUpdate && (
                                                <button 
                                                    onClick={() => handleRemoveTag(tag)}
                                                    className="hover:text-red-400 ml-0.5 opacity-0 group-hover/tag:opacity-100 transition-opacity"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                    {onUpdate && (
                                        <div className="relative w-full mt-1">
                                            <input 
                                                type="text" 
                                                placeholder="+ TAG" 
                                                value={newTag}
                                                onChange={(e) => setNewTag(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                className="w-full bg-black/50 border border-glass rounded px-2 py-1 text-[10px] font-mono text-white placeholder-vault-subtext/50 focus:outline-none focus:border-brand-primary focus:bg-black transition-all"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Blockchain Status Box */}
                        <div className="p-4 rounded-lg bg-gradient-to-br from-brand-primary/5 to-transparent border border-brand-primary/10 mb-4 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-brand-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex items-start gap-3 relative z-10">
                                <div className="mt-1 w-2 h-2 rounded-full bg-brand-primary animate-pulse shadow-[0_0_8px_#0052FF]"></div>
                                <div>
                                    <h4 className="text-xs font-bold text-white mb-1">Vault Secure</h4>
                                    <p className="text-[10px] text-vault-subtext leading-relaxed">
                                        Asset is cryptographically hashed and ready for on-chain storage.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Spacer for sticky bottom content if needed */}
                        <div className="h-12"></div>
                    </div>

                    {/* Undo Notification - Positioned absolutely at bottom of content area */}
                    {undoState && (
                        <div className="absolute bottom-24 left-8 right-8 z-20 animate-fade-in">
                            <div className="bg-[#0A0A0A] border border-brand-primary/30 shadow-[0_0_20px_rgba(0,82,255,0.15)] rounded p-3 flex items-center justify-between backdrop-blur-md">
                                <div className="flex items-center gap-2">
                                    <svg className="w-3 h-3 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                    </svg>
                                    <span className="text-[10px] font-mono text-white">
                                        {undoState.type === 'ADD' ? 'Tag Added' : 'Tag Removed'}
                                    </span>
                                </div>
                                <button 
                                    onClick={handleUndo}
                                    className="text-[10px] font-bold text-brand-primary hover:text-white uppercase tracking-wider px-2 py-1 bg-brand-primary/10 hover:bg-brand-primary/20 rounded transition-colors"
                                >
                                    Undo
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Footer Buttons */}
                    <div className="pt-6 border-t border-glass mt-auto flex flex-col gap-3 relative z-30 bg-[#080808]">
                        <Button className="w-full shadow-lg hover:shadow-brand-primary/20" onClick={() => {
                             navigator.clipboard.writeText(asset.content);
                        }}>
                            Copy Data
                        </Button>
                        <div className="grid grid-cols-2 gap-3">
                             <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
                             <Button variant="danger" className="w-full" onClick={() => onDelete(asset.id)}>Burn Asset</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
    
    // Portal to root to ensure z-index correctness
    const root = document.getElementById('root');
    return root ? createPortal(modalContent, root) : null;
};