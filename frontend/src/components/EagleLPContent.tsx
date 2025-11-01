import { motion } from 'framer-motion';
import { BrowserProvider } from 'ethers';
import { ArrowDown } from 'lucide-react';
import { ICONS } from '../config/icons';
import { NeoButton, NeoStatCard, NeoCard, NeoTaskBadge } from './neumorphic';

interface Props {
  onNavigateDown?: () => void;
  provider: BrowserProvider | null;
}

export default function EagleLPContent({ onNavigateDown }: Props) {
  return (
    <div className="h-full overflow-y-auto bg-neo-bg dark:bg-black transition-colors">
      <div className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Back Button */}
        <NeoButton
          onClick={onNavigateDown}
          label="Back to Home"
          icon={<ArrowDown className="w-4 h-4" />}
          className="mb-8"
        />

        {/* Header */}
        <motion.div 
          className="mb-12"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <img 
                src={ICONS.EAGLE}
                alt="Eagle"
                className="w-16 h-16"
              />
              <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">+</span>
              <img 
                src={ICONS.ETHEREUM}
                alt="ETH"
                className="w-16 h-16 rounded-full"
              />
            </div>
          </div>
          
          <h1 className="text-6xl font-bold text-gray-900 dark:text-gray-100 mb-4">EAGLE/ETH Liquidity Pool</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Provide liquidity, earn trading fees, and support the Eagle ecosystem
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <NeoStatCard
            label="Total Liquidity"
            value="$0"
            subtitle="Coming Soon"
          />
          <NeoStatCard
            label="24h Volume"
            value="$0"
            subtitle="---"
          />
          <NeoStatCard
            label="APR"
            value="---%"
            subtitle="Trading fees"
            highlighted
          />
          <NeoStatCard
            label="Your Liquidity"
            value="$0.00"
            subtitle="Connect wallet"
          />
        </motion.div>

        {/* Coming Soon Card */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <NeoCard className="p-12 text-center relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-400/10 rounded-full blur-3xl"></div>
            </div>

            <div className="max-w-2xl mx-auto relative z-10">
              <motion.div 
                className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full shadow-neo-raised flex items-center justify-center"
                animate={{ 
                  scale: [1, 1.05, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </motion.div>
              
              <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                EAGLE/ETH Pool Coming Soon
              </h2>
              
              <p className="text-xl text-gray-700 dark:text-gray-300 mb-8 leading-relaxed">
                We're launching the EAGLE/ETH liquidity pool on Uniswap V3. Provide liquidity, earn trading fees, 
                and help build the Eagle ecosystem.
              </p>
              
              <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto mb-10">
                <motion.div
                  whileHover={{ scale: 1.05, y: -2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <NeoTaskBadge
                    primaryLabel="Pool Type"
                    secondaryLabel="Uniswap V3"
                    secondaryColor="blue"
                    className="justify-center"
                  />
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05, y: -2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <NeoTaskBadge
                    primaryLabel="Fee Tier"
                    secondaryLabel="1%"
                    secondaryColor="orange"
                    className="justify-center"
                  />
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05, y: -2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <NeoTaskBadge
                    primaryLabel="Network"
                    secondaryLabel="Ethereum"
                    secondaryColor="green"
                    className="justify-center"
                  />
                </motion.div>
              </div>

              <motion.div 
                className="mt-8"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <a 
                  href="https://t.me/Eagle_community_47" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <NeoButton
                    label="Join Telegram for Updates"
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    }
                    className="!px-8 !py-4 !bg-gradient-to-r !from-blue-500 !to-blue-600 !text-white !shadow-lg hover:!shadow-xl"
                  />
                </a>
              </motion.div>
            </div>
          </NeoCard>
        </motion.div>
      </div>
    </div>
  );
}

