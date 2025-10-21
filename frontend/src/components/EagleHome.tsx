import { useState, useEffect } from 'react';
import { BrowserProvider, Contract, formatEther } from 'ethers';
import { motion } from 'framer-motion';
import { CONTRACTS } from '../config/contracts';

const VAULT_ABI = [
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
];

interface Props {
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  provider: BrowserProvider | null;
}

export default function EagleHome({ onNavigateUp, onNavigateDown, provider }: Props) {
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
    <div className="h-full bg-gradient-to-b from-[#0a0a0a] via-[#0d0d0d] to-[#0a0a0a] flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-5xl">
          {/* Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <img 
              src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafybeigzyatm2pgrkqbnskyvflnagtqli6rgh7wv7t2znaywkm2pixmkxy" 
              alt="Eagle"
              className="w-40 h-40 mx-auto mb-8"
            />
          </motion.div>

          {/* Title */}
          <motion.h1 
            className="text-8xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent mb-4"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            EAGLE
          </motion.h1>
          
          <motion.p 
            className="text-2xl text-gray-400 mb-12"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Multi-Chain Yield Aggregator Ecosystem
          </motion.p>

          {/* Quick Stats */}
          <motion.div 
            className="grid grid-cols-3 gap-8 max-w-3xl mx-auto mb-16"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all">
              <p className="text-sm text-gray-400 mb-2">Total Value Locked</p>
              <p className="text-3xl font-bold text-white">${stats.tvl}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all">
              <p className="text-sm text-gray-400 mb-2">Token Holders</p>
              <p className="text-3xl font-bold text-white">{stats.holders}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all">
              <p className="text-sm text-gray-400 mb-2">Average APY</p>
              <p className="text-3xl font-bold text-yellow-500">{stats.apy}%</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Navigation Cards */}
      <motion.div 
        className="grid grid-cols-2 gap-6 px-12 pb-12"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        {/* Go Up to LP */}
        <button
          onClick={onNavigateUp}
          className="group relative bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-blue-500/30 rounded-2xl p-10 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/20 transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/10 group-hover:to-purple-500/10 transition-all" />
          
          <div className="relative">
            <div className="absolute -top-2 -right-2 text-6xl opacity-20 group-hover:opacity-40 group-hover:-translate-y-2 transition-all">
              ↑
            </div>
            
            <div className="text-left">
              <h3 className="text-3xl font-bold text-white mb-3">EAGLE/ETH LP</h3>
              <p className="text-gray-400 mb-6 text-lg">
                Provide liquidity and earn trading fees on the EAGLE/ETH pair
              </p>
              <div className="flex items-center gap-3 text-blue-400 font-medium">
                <span>Explore liquidity pool</span>
                <svg className="w-6 h-6 group-hover:-translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </div>
              <div className="mt-4 text-sm text-gray-500">
                Coming Soon
              </div>
            </div>
          </div>
        </button>

        {/* Go Down to Vault */}
        <button
          onClick={onNavigateDown}
          className="group relative bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border-2 border-yellow-500/30 rounded-2xl p-10 hover:border-yellow-500/50 hover:shadow-2xl hover:shadow-yellow-500/20 transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/0 to-amber-500/0 group-hover:from-yellow-500/10 group-hover:to-amber-500/10 transition-all" />
          
          <div className="relative">
            <div className="absolute -top-2 -right-2 text-6xl opacity-20 group-hover:opacity-40 group-hover:translate-y-2 transition-all">
              ↓
            </div>
            
            <div className="text-left">
              <h3 className="text-3xl font-bold text-white mb-3">Vault Engine</h3>
              <p className="text-gray-400 mb-6 text-lg">
                Deposit WLFI + USD1 to receive vEAGLE shares and earn yield
              </p>
              <div className="flex items-center gap-3 text-yellow-400 font-medium">
                <span>Enter the vault</span>
                <svg className="w-6 h-6 group-hover:translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-emerald-400">Active & Earning</span>
              </div>
            </div>
          </div>
        </button>
      </motion.div>
    </div>
  );
}

