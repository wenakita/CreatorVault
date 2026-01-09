import React from 'react';
import { Logo } from './Logo';
import { NavItem } from '../types';

interface SidebarProps {
  items: NavItem[];
  activePath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ items, activePath, onNavigate }) => {
  return (
    <div className="w-64 h-screen bg-vault-bg/95 backdrop-blur-xl border-r border-glass flex flex-col fixed left-0 top-0 z-50">
      <div className="p-8">
        <Logo width={24} height={24} className="opacity-100" />
      </div>

      <nav className="flex-1 px-3 py-6 space-y-2">
        {items.map((item) => {
          const isActive = activePath === item.path;
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`relative w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-300 group overflow-visible ${
                isActive 
                  ? 'bg-white/[0.03]' 
                  : 'hover:bg-white/[0.02]'
              }`}
            >
              {/* Active State Laser Line */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 bg-brand-primary shadow-[0_0_12px_#0052FF] rounded-r-full"></div>
              )}

              <span className={`relative z-10 transition-colors duration-300 ${isActive ? 'text-brand-primary' : 'text-vault-subtext group-hover:text-white'}`}>
                {item.icon}
                
                {/* Tech Tooltip */}
                <div className="absolute left-8 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none z-50">
                    <div className="bg-[#050505] border border-glass px-2 py-1 rounded text-[9px] font-mono text-white uppercase tracking-widest shadow-xl whitespace-nowrap flex items-center gap-2">
                        <div className="w-1 h-1 bg-brand-primary rounded-full"></div>
                        {item.label}
                    </div>
                </div>
              </span>
              
              <span className={`relative z-10 text-sm font-medium tracking-wide transition-colors duration-300 ${isActive ? 'text-white' : 'text-vault-subtext group-hover:text-white'}`}>
                {item.label}
              </span>
              
              {/* Hover shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out rounded-lg overflow-hidden pointer-events-none"></div>
            </button>
          );
        })}
      </nav>

      <div className="p-6 border-t border-glass">
        <div className="p-5 rounded-xl bg-[#050505] border border-glass group cursor-pointer relative overflow-hidden transition-all duration-300 hover:border-brand-primary/30">
            {/* Background Mesh */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgNDBMMDQgMCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMDIiLz48L3N2Zz4=')] opacity-30"></div>
            
            <div className="relative z-10">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-[9px] uppercase tracking-widest font-bold text-vault-subtext group-hover:text-white transition-colors">Vault Storage</span>
                    <span className="text-[10px] font-mono text-brand-primary shadow-[0_0_10px_rgba(0,82,255,0.2)] px-1.5 py-0.5 rounded border border-brand-primary/20 bg-brand-primary/5">45%</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-brand-primary to-blue-400 w-[45%] h-full shadow-[0_0_15px_#0052FF]"></div>
                </div>
                <div className="flex items-center gap-2 mt-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                    <p className="text-[9px] text-vault-subtext font-mono truncate">ID: 0x82...3f1</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};