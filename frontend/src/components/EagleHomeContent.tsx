import { useState, useEffect } from 'react';
import { BrowserProvider, Contract, formatEther } from 'ethers';
import { motion } from 'framer-motion';
import { CONTRACTS } from '../config/contracts';
import { ICONS } from '../config/icons';

const VAULT_ABI = [
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
];

interface Props {
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  provider: BrowserProvider | null;
}

export default function EagleHomeContent({ onNavigateUp, onNavigateDown, provider }: Props) {
  const [stats, setStats] = useState({
    tvl: '0',
    holders: '247',
    apy: '22.22'
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!provider) return;
      
      try {
        const vault = new Contract(CONTRACTS.VAULT, VAULT_ABI, provider);
        const totalAssets = await vault.totalAssets();
        setStats(prev => ({
          ...prev,
          tvl: Number(formatEther(totalAssets)).toFixed(2)
        }));
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, [provider]);

  return (
    <div className="h-full flex items-center justify-center px-6 bg-[#0a0a0a] relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-yellow-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-4xl mx-auto w-full relative z-10">
        {/* Hero Section */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <img 
            src={ICONS.EAGLE}
            alt="Eagle"
            className="w-16 h-16 mx-auto mb-5 opacity-90"
          />
          
          <h1 className="text-7xl font-bold mb-3 tracking-tight">
            <span className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent">
              EAGLE
            </span>
          </h1>
          
          <p className="text-base text-gray-400 mb-8">Multi-Chain Yield Aggregator</p>

          {/* Stats Row */}
          <div className="flex items-center justify-center gap-6 mb-10">
            <div className="bg-white/5 border border-white/10 rounded-lg px-6 py-3 min-w-[140px]">
              <div className="text-2xl font-bold text-white">${stats.tvl}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-6 py-3 min-w-[140px]">
              <div className="text-2xl font-bold text-white">{stats.holders}</div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-6 py-3 min-w-[140px]">
              <div className="text-2xl font-bold text-yellow-500">{stats.apy}%</div>
            </div>
          </div>
        </motion.div>

        {/* Main Navigation Cards */}
        <motion.div 
          className="grid grid-cols-2 gap-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {/* LP Card */}
          <button
            onClick={onNavigateUp}
            className="group relative bg-gradient-to-br from-white/5 to-white/[0.02] hover:from-white/10 hover:to-white/5 border border-white/10 hover:border-white/20 rounded-2xl p-8 transition-all duration-300 text-left overflow-hidden"
          >
            {/* Hover gradient effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 transition-all duration-300"></div>
            
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-white">EAGLE/ETH LP</h3>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-400 group-hover:-translate-y-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </div>
              <p className="text-sm text-gray-400 mb-4">Provide liquidity, earn fees</p>
              <div className="inline-block px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <span className="text-xs text-orange-400 font-medium">Coming Soon</span>
              </div>
            </div>
          </button>

          {/* Vault Card */}
          <button
            onClick={onNavigateDown}
            className="group relative bg-gradient-to-br from-white/5 to-white/[0.02] hover:from-white/10 hover:to-white/5 border border-white/10 hover:border-yellow-500/30 rounded-2xl p-8 transition-all duration-300 text-left overflow-hidden"
          >
            {/* Hover gradient effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/0 to-amber-500/0 group-hover:from-yellow-500/5 group-hover:to-amber-500/5 transition-all duration-300"></div>
            
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Vault Engine</h3>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-yellow-400 group-hover:translate-y-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
              <p className="text-sm text-gray-400 mb-4">Deposit & earn yield</p>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-emerald-400 font-medium">APR: ~86-97%</span>
              </div>
            </div>
          </button>
        </motion.div>

        {/* Bottom Navigation */}
        <motion.div
          className="flex items-center justify-center gap-8 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <a 
            href="https://docs.47eagle.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-gray-500 hover:text-yellow-500 transition-colors"
          >
            Docs
          </a>
          <a 
            href="#" 
            className="text-gray-500 hover:text-yellow-500 transition-colors"
          >
            Summary
          </a>
          <a 
            href="https://x.com/teameagle47" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-gray-500 hover:text-yellow-500 transition-colors"
          >
            Twitter
          </a>
          <a 
            href="https://t.me/Eagle_community_47" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-gray-500 hover:text-yellow-500 transition-colors"
          >
            Telegram
          </a>
        </motion.div>
      </div>
    </div>
  );
}
