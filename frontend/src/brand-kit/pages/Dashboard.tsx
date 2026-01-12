import React, { useState, useMemo } from 'react';
import { AssetType, VaultAsset } from '../types';
import { Button } from '../components/Button';
import { TextScramble } from '../components/TextScramble';
import { VaultExplainer } from '../components/VaultExplainer';
import { TelemetryModule } from '../components/TelemetryModule';
import { logger } from '@/lib/logger';

interface DashboardProps {
  assets: VaultAsset[];
  onGenerate: () => void;
  onAssetClick?: (asset: VaultAsset) => void;
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

type SortOrder = 'NEWEST' | 'OLDEST' | 'A-Z';
type FilterType = 'ALL' | AssetType;

export const Dashboard: React.FC<DashboardProps> = ({ assets, onGenerate, onAssetClick, onNotify }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('NEWEST');
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async (e: React.MouseEvent, asset: VaultAsset) => {
    e.stopPropagation(); // Prevent card click
    
    try {
        if (asset.type === AssetType.IMAGE) {
            const link = document.createElement('a');
            link.href = asset.content;
            link.download = `vault-asset-${asset.id.slice(0, 8)}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            navigator.clipboard.writeText(asset.content);
            if (onNotify) onNotify('success', 'Content copied to clipboard');
        }
    } catch (err) {
        logger.error('Download failed', err);
    }
  };

  const handleExportAll = () => {
      if (assets.length === 0) {
          if (onNotify) onNotify('error', 'No assets to export.');
          return;
      }

      setIsExporting(true);
      if (onNotify) onNotify('info', 'Compressing vault assets for export...');

      // Simulate network request/compression delay
      setTimeout(() => {
          setIsExporting(false);
          if (onNotify) onNotify('success', `Export Complete. ${assets.length} assets archived.`);
          // In a real app, this would trigger a .zip download
      }, 2000);
  };

  const filteredAssets = useMemo(() => {
    let result = [...assets];

    // Filter by Type
    if (filterType !== 'ALL') {
        result = result.filter(a => a.type === filterType);
    }

    // Filter by Search
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        result = result.filter(a => 
            a.title.toLowerCase().includes(query) || 
            a.tags.some(t => t.toLowerCase().includes(query)) ||
            (a.type === AssetType.IDEA && a.content.toLowerCase().includes(query))
        );
    }

    // Sort
    result.sort((a, b) => {
        if (sortOrder === 'NEWEST') return b.createdAt - a.createdAt;
        if (sortOrder === 'OLDEST') return a.createdAt - b.createdAt;
        if (sortOrder === 'A-Z') return a.title.localeCompare(b.title);
        return 0;
    });

    return result;
  }, [assets, filterType, searchQuery, sortOrder]);

  return (
    <div className="p-6 md:p-10 animate-fade-in max-w-[1600px] mx-auto min-h-screen pb-20">
      
      {/* Dynamic Hero Section */}
      <div className="mb-10">
        <VaultExplainer />
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 relative z-10">
        <div className="flex items-center gap-3">
             <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></div>
             <span className="text-[10px] font-mono text-vault-subtext uppercase tracking-widest opacity-70">
                System Status: <span className="text-green-500">Optimal</span>
             </span>
             <div className="h-3 w-[1px] bg-glass mx-2"></div>
             <span className="text-[10px] font-mono text-vault-subtext uppercase tracking-widest opacity-50">
                Sync: 100%
             </span>
        </div>
        
        <div className="flex gap-4">
             <Button variant="outline" size="sm" className="font-mono text-xs uppercase tracking-wider hover:bg-white text-white hover:text-black transition-colors duration-300">Sync_Nodes</Button>
             <Button onClick={onGenerate} size="sm" className="shadow-[0_0_30px_rgba(0,82,255,0.2)] pl-4 pr-6 hover:scale-105 active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]">
                <span className="text-lg mr-2 leading-none">+</span> Mint Asset
             </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
         <TelemetryModule label="Total Assets" value={assets.length} change="+2.4%" trend />
         <TelemetryModule label="Concepts" value={assets.filter(a => a.type === AssetType.IDEA).length} trend />
         <TelemetryModule label="Visuals" value={assets.filter(a => a.type === AssetType.IMAGE).length} change="+12%" trend />
      </div>

      {/* Content Grid Header & Filters */}
      <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between pb-6 border-b border-glass sticky top-0 bg-vault-bg/95 backdrop-blur z-20 pt-4 gap-6">
         <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-[0.2em] flex items-center gap-3 mb-4">
                <span className="w-1.5 h-1.5 bg-brand-primary rounded-sm shadow-[0_0_10px_#0052FF]"></span>
                <TextScramble text="Data Retrieval" font="sans" className="tracking-[0.2em]" />
            </h2>
            {/* Search Input */}
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-vault-subtext group-focus-within:text-brand-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <input 
                    type="text" 
                    placeholder="Search by title, tag, or content..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#050505] border border-glass rounded-md pl-9 pr-4 py-2 text-xs font-mono text-white placeholder-vault-subtext focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/20 w-full lg:w-80 transition-all duration-300"
                />
            </div>
         </div>

         <div className="flex flex-wrap gap-4 items-center">
             <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
                 {(['ALL', AssetType.IMAGE, AssetType.IDEA] as const).map((type) => (
                     <button 
                        key={type} 
                        onClick={() => setFilterType(type)}
                        className={`px-4 py-1.5 text-[10px] uppercase tracking-wider font-bold font-mono rounded-md transition-all duration-300 ${filterType === type ? 'bg-brand-primary text-white shadow-lg' : 'text-vault-subtext hover:text-white hover:bg-white/10'}`}
                    >
                         {type === 'ALL' ? 'All' : type === AssetType.IMAGE ? 'Visuals' : 'Concepts'}
                     </button>
                 ))}
             </div>
             
             {/* Export Button (New) */}
             <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleExportAll} 
                isLoading={isExporting}
                className="text-[10px] font-mono uppercase tracking-wider text-vault-subtext hover:text-white hover:bg-white/5"
             >
                Export All
             </Button>

             <div className="h-8 w-[1px] bg-glass hidden lg:block"></div>
             
             <div className="flex items-center gap-2">
                 <span className="text-[9px] font-mono text-vault-subtext uppercase">Sort:</span>
                 <select 
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                    className="bg-[#050505] border border-glass rounded px-3 py-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-brand-primary/50 uppercase cursor-pointer hover:bg-white/5 transition-colors"
                 >
                     <option value="NEWEST">Newest</option>
                     <option value="OLDEST">Oldest</option>
                     <option value="A-Z">A-Z</option>
                 </select>
             </div>
         </div>
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredAssets.length === 0 ? (
          <div className="col-span-full py-40 flex flex-col items-center justify-center border border-dashed border-glass rounded-xl bg-white/[0.01] group hover:bg-white/[0.02] transition-colors cursor-pointer">
            <div className="w-20 h-20 rounded-full border border-glass flex items-center justify-center mb-6 bg-black shadow-2xl">
                 <span className="text-3xl text-vault-subtext transition-colors font-light">?</span>
            </div>
            <p className="text-vault-subtext text-sm font-mono tracking-widest uppercase">No Artifacts Found</p>
            <p className="text-xs text-vault-subtext/50 mt-2">Refine your search parameters</p>
          </div>
        ) : (
          filteredAssets.map((asset, i) => (
            <div 
              key={asset.id} 
              onClick={() => onAssetClick && onAssetClick(asset)}
              style={{ animationDelay: `${i * 50}ms` }}
              className="group relative bg-[#050505] rounded-xl overflow-hidden border border-glass hover:border-brand-primary transition-all duration-500 hover:scale-[1.02] hover:-translate-y-2 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8),0_0_20px_rgba(0,82,255,0.3)] animate-fade-in cursor-pointer z-0 hover:z-10"
            >
              {/* Asset Viewport */}
              <div className="aspect-[4/3] w-full bg-black relative overflow-hidden">
                {asset.type === AssetType.IMAGE ? (
                  <>
                    <div className="absolute inset-0 bg-brand-primary/20 mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"></div>
                    {/* Crosshair Overlay on Card Hover */}
                    <div className="absolute inset-0 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute top-4 left-4 w-4 h-[1px] bg-white"></div>
                        <div className="absolute top-4 left-4 h-4 w-[1px] bg-white"></div>
                        <div className="absolute bottom-4 right-4 w-4 h-[1px] bg-white"></div>
                        <div className="absolute bottom-4 right-4 h-4 w-[1px] bg-white"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-white/50 rounded-full scale-0 group-hover:scale-100 transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]"></div>
                    </div>

                    <img src={asset.content} alt={asset.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-out filter grayscale-[50%] group-hover:grayscale-0" />
                  </>
                ) : (
                  <div className="w-full h-full p-8 flex flex-col justify-center items-center text-center bg-black relative group-hover:bg-[#0A0A0A] transition-colors">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/5 to-transparent opacity-50"></div>
                    {/* Text Asset Icon */}
                    <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mb-4 group-hover:border-brand-primary group-hover:scale-110 transition-all duration-300">
                         <span className="font-serif italic text-2xl text-vault-subtext group-hover:text-white">¶</span>
                    </div>
                    <p className="text-[10px] text-vault-subtext line-clamp-3 font-mono leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity relative z-10">{asset.content}</p>
                  </div>
                )}
                
                {/* Type Badge */}
                <div className="absolute top-3 left-3 flex gap-2 z-30">
                    <div className="bg-black/90 backdrop-blur-md px-2 py-1 rounded text-[8px] font-mono text-white border border-white/10 uppercase tracking-wider shadow-lg group-hover:border-brand-primary/50 transition-colors">
                    {asset.type}
                    </div>
                </div>
              </div>

              {/* Asset Details */}
              <div className="p-5 border-t border-glass bg-[#080808] relative group-hover:bg-[#0A0A0A] transition-colors flex flex-col gap-2">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <h3 className="text-sm font-medium text-white truncate pr-4 group-hover:text-brand-primary transition-colors">{asset.title}</h3>
                
                <div className="flex justify-between items-center">
                    <span className="text-[9px] text-vault-subtext font-mono opacity-60">
                        {new Date(asset.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={(e) => handleDownload(e, asset)}
                            className="text-vault-subtext hover:text-white transition-colors"
                            title="Download Asset"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>
                        
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-2 group-hover:translate-x-0">
                            <span className="text-[8px] text-brand-primary font-mono uppercase tracking-wide">Secure</span>
                            <div className="h-1.5 w-1.5 rounded-full bg-brand-primary shadow-[0_0_5px_#0052FF]"></div>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};