import { useState, useEffect } from 'react';
import { BrowserProvider, Contract, formatEther } from 'ethers';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { CONTRACTS } from '../config/contracts';
import { ICONS } from '../config/icons';
import { NeoTaskBadge, NeoStatusIndicator } from './neumorphic';

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
    <div className="h-full flex items-center justify-center px-6 bg-neo-bg relative overflow-hidden">
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
            <span className="bg-gradient-to-r from-yellow-500 via-yellow-600 to-amber-700 bg-clip-text text-transparent">
              EAGLE
            </span>
          </h1>
          
          <p className="text-base text-gray-600 mb-8">Multi-Chain Yield Aggregator</p>

          {/* Stats Row */}
          <div className="flex items-center justify-center gap-6 mb-10">
            <motion.div 
              whileHover={{ scale: 1.05, y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="bg-neo-bg shadow-neo-raised hover:shadow-neo-raised-lift rounded-full px-8 py-4 min-w-[160px] text-center transition-all duration-300"
            >
              <div className="text-xs text-gray-600 font-medium uppercase tracking-wider mb-1">TVL</div>
              <div className="text-2xl font-bold text-gray-900">${stats.tvl}</div>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.05, y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="bg-neo-bg shadow-neo-raised hover:shadow-neo-raised-lift rounded-full px-8 py-4 min-w-[160px] text-center transition-all duration-300"
            >
              <div className="text-xs text-gray-600 font-medium uppercase tracking-wider mb-1">Holders</div>
              <div className="text-2xl font-bold text-gray-900">{stats.holders}</div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <NeoTaskBadge
                primaryLabel={`${stats.apy}%`}
                secondaryLabel="APY"
                secondaryColor="orange"
                className="min-w-[160px] justify-center shadow-neo-raised hover:shadow-neo-raised-lift transition-all duration-300"
              />
            </motion.div>
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
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="bg-neo-bg shadow-neo-raised hover:shadow-neo-raised-lift rounded-2xl p-8 transition-all duration-300 text-left cursor-pointer group relative overflow-hidden"
            onClick={onNavigateUp}
          >
            {/* Gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">EAGLE/ETH LP</h3>
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ArrowUp className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
              </motion.div>
            </div>
            <p className="text-sm text-gray-700 mb-5 font-medium">Provide liquidity, earn fees</p>
            <NeoTaskBadge
              primaryLabel="Status"
              secondaryLabel="Coming Soon"
              secondaryColor="orange"
            />
          </motion.div>

          {/* Vault Card */}
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="bg-neo-bg shadow-neo-raised hover:shadow-neo-raised-lift rounded-2xl p-8 transition-all duration-300 text-left cursor-pointer group relative overflow-hidden"
            onClick={onNavigateDown}
          >
            {/* Gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 to-orange-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 group-hover:text-yellow-600 transition-colors">Vault Engine</h3>
              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ArrowDown className="w-5 h-5 text-gray-600 group-hover:text-yellow-600 transition-colors" />
              </motion.div>
            </div>
            <p className="text-sm text-gray-700 mb-5 font-medium">Deposit & earn yield</p>
            <div className="flex items-center gap-2">
              <NeoStatusIndicator
                status="Active"
                subtitle="APR: ~86-97%"
                active={true}
                className="!px-4 !py-2 !rounded-full"
              />
            </div>
          </motion.div>
        </motion.div>

        {/* Bottom Navigation */}
        <motion.div
          className="flex items-center justify-center gap-4 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.a 
            href="https://docs.47eagle.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            whileHover={{ scale: 1.05, y: -2 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="px-5 py-2.5 bg-neo-bg shadow-neo-raised hover:shadow-neo-raised-lift rounded-full text-gray-700 hover:text-yellow-700 transition-all font-medium"
          >
            Docs
          </motion.a>
          <motion.a 
            href="#" 
            whileHover={{ scale: 1.05, y: -2 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="px-5 py-2.5 bg-neo-bg shadow-neo-raised hover:shadow-neo-raised-lift rounded-full text-gray-700 hover:text-yellow-700 transition-all font-medium"
          >
            Summary
          </motion.a>
          <motion.a 
            href="https://x.com/teameagle47" 
            target="_blank" 
            rel="noopener noreferrer" 
            whileHover={{ scale: 1.05, y: -2 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="px-5 py-2.5 bg-neo-bg shadow-neo-raised hover:shadow-neo-raised-lift rounded-full text-gray-700 hover:text-yellow-700 transition-all font-medium"
          >
            Twitter
          </motion.a>
          <motion.a 
            href="https://t.me/Eagle_community_47" 
            target="_blank" 
            rel="noopener noreferrer" 
            whileHover={{ scale: 1.05, y: -2 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="px-5 py-2.5 bg-neo-bg shadow-neo-raised hover:shadow-neo-raised-lift rounded-full text-gray-700 hover:text-yellow-700 transition-all font-medium"
          >
            Telegram
          </motion.a>
        </motion.div>
      </div>
    </div>
  );
}
