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
    <div className="h-full bg-gradient-to-b from-[#0a0a0a] via-[#0d0d0d] to-[#0a0a0a] flex flex-col overflow-y-auto">
      <div className="flex-1 px-8 py-12 max-w-6xl mx-auto w-full">
        {/* Hero Section - Compact */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <img 
            src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafybeigzyatm2pgrkqbnskyvflnagtqli6rgh7wv7t2znaywkm2pixmkxy" 
            alt="Eagle"
            className="w-20 h-20 mx-auto mb-4"
          />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent mb-2">
            EAGLE
          </h1>
          <p className="text-lg text-gray-400">Multi-Chain Yield Aggregator Ecosystem</p>
        </motion.div>

        {/* Quick Stats - Compact */}
        <motion.div 
          className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mb-12"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Value Locked</p>
            <p className="text-2xl font-bold text-white">${stats.tvl}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <p className="text-xs text-gray-500 mb-1">Token Holders</p>
            <p className="text-2xl font-bold text-white">{stats.holders}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <p className="text-xs text-gray-500 mb-1">Average APY</p>
            <p className="text-2xl font-bold text-yellow-500">{stats.apy}%</p>
          </div>
        </motion.div>

        {/* Products Grid */}
        <div className="grid lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* EAGLE/ETH LP Card - Top Priority */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <button
              onClick={onNavigateUp}
              className="w-full text-left group relative bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 rounded-2xl p-8 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 overflow-hidden"
            >
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 transition-all duration-300" />
              
              <div className="relative">
                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>

                {/* Title */}
                <h3 className="text-2xl font-bold text-white mb-2">EAGLE/ETH LP</h3>
                
                {/* Description */}
                <p className="text-gray-400 text-sm mb-6">
                  Provide liquidity to the EAGLE/ETH pair on Uniswap V3 and earn trading fees plus incentives
                </p>

                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-black/20 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Est. APR</div>
                    <div className="text-lg font-bold text-blue-400">---%</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Your Liquidity</div>
                    <div className="text-lg font-bold text-white">$0.00</div>
                  </div>
                </div>

                {/* CTA */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 bg-orange-500/20 border border-orange-500/40 rounded-full">
                      <span className="text-xs font-medium text-orange-400">Coming Soon</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-blue-400 font-medium">
                    <span className="text-sm">Explore Pool</span>
                    <svg className="w-5 h-5 group-hover:-translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>
          </motion.div>

          {/* Vault Engine Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <button
              onClick={onNavigateDown}
              className="w-full text-left group relative bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-2 border-yellow-500/30 rounded-2xl p-8 hover:border-yellow-500/50 hover:shadow-2xl hover:shadow-yellow-500/20 transition-all duration-300 overflow-hidden"
            >
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/0 to-amber-500/0 group-hover:from-yellow-500/5 group-hover:to-amber-500/5 transition-all duration-300" />
              
              <div className="relative">
                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>

                {/* Title */}
                <h3 className="text-2xl font-bold text-white mb-2">Vault Engine</h3>
                
                {/* Description */}
                <p className="text-gray-400 text-sm mb-6">
                  Deposit WLFI + USD1 to receive vEAGLE shares and earn auto-compounding yield
                </p>

                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-black/20 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Current APY</div>
                    <div className="text-lg font-bold text-yellow-400">22.22%</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Total Deposited</div>
                    <div className="text-lg font-bold text-white">${stats.tvl}</div>
                  </div>
                </div>

                {/* CTA */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-emerald-400">Active & Earning</span>
                  </div>
                  <div className="flex items-center gap-2 text-yellow-400 font-medium">
                    <span className="text-sm">Enter Vault</span>
                    <svg className="w-5 h-5 group-hover:translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>
          </motion.div>
        </div>

        {/* Additional Info - Optional */}
        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-sm text-gray-500">
            Built on Ethereum • Powered by{' '}
            <a href="https://worldlibertyfinancial.com/" target="_blank" rel="noopener noreferrer" className="text-yellow-500 hover:underline">
              World Liberty Financial
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
