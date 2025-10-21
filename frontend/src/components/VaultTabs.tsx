import { useState } from 'react';
import { CONTRACTS } from '../config/contracts';

export default function VaultTabs() {
  const [activeTab, setActiveTab] = useState<'about' | 'strategies' | 'info'>('about');

  return (
    <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-2xl border border-white/10 overflow-hidden">
      {/* Tab Headers */}
      <div className="flex border-b border-white/10">
        {[
          { id: 'about' as const, label: 'About', icon: '📖' },
          { id: 'strategies' as const, label: 'Strategies', icon: '📊' },
          { id: 'info' as const, label: 'Info', icon: 'ℹ️' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === tab.id
                ? 'bg-white/10 text-white border-b-2 border-yellow-500'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-8">
        {activeTab === 'about' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Description</h3>
              <p className="text-gray-400 leading-relaxed">
                Deposit your <a href="https://worldlibertyfinancial.com/" target="_blank" rel="noopener noreferrer" className="text-yellow-500 hover:text-yellow-400">WLFI</a> and <a href="https://worldlibertyfinancial.com/usd1" target="_blank" rel="noopener noreferrer" className="text-yellow-500 hover:text-yellow-400">USD1</a> into Eagle's auto-compounding vault and start earning maximum APY immediately. 
                The vault handles staking, claiming, and swapping your tokens for you. Your deposited assets are managed through 
                Charm Finance's AlphaVault strategy, earning Uniswap V3 trading fees on the WLFI/USD1 pool.
              </p>
              <p className="text-gray-400 leading-relaxed mt-4">
                For more details about vault mechanics and yield generation, check out{' '}
                <a href="https://docs.47eagle.com" target="_blank" rel="noopener noreferrer" className="text-yellow-500 hover:text-yellow-400">Eagle's docs</a>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">APY</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Weekly APY</span>
                    <span className="text-white font-mono">32.27%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Monthly APY</span>
                    <span className="text-white font-mono">22.22%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Inception APY</span>
                    <span className="text-white font-mono">117.91%</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-gray-300">Net APY</span>
                    <span className="text-yellow-500 font-mono">22.22%</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">Vault Fees</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Deposit/Withdrawal fee</span>
                    <span className="text-white font-mono">0%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Management fee</span>
                    <span className="text-white font-mono">0%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Performance fee</span>
                    <span className="text-white font-mono">10%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Cumulative Earnings</h4>
              <div className="h-48 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center">
                <svg className="w-full h-full p-4" viewBox="0 0 400 160">
                  <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#eab308" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0 120 Q 50 100 100 80 T 200 60 T 300 40 T 400 20"
                    fill="none"
                    stroke="url(#lineGradient)"
                    strokeWidth="3"
                  />
                  <text x="380" y="35" fill="#9ca3af" fontSize="12">30%</text>
                  <text x="380" y="95" fill="#9ca3af" fontSize="12">17%</text>
                  <text x="380" y="135" fill="#9ca3af" fontSize="12">0%</text>
                </svg>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'strategies' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Active Strategies</h3>
              
              {/* Charm Strategy */}
              <div className="bg-white/5 rounded-lg border border-white/10 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img 
                      src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafkreid3difftzksqy3xlummzzobhk674ece35d7drmgo3ftt7wrix6dwu" 
                      alt="Charm"
                      className="w-10 h-10 rounded-lg"
                    />
                    <div>
                      <h4 className="font-semibold text-white">Charm AlphaVault</h4>
                      <p className="text-sm text-gray-400">USD1/WLFI 1% Fee Tier</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full">
                    Active
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Allocation</p>
                    <p className="text-lg font-semibold text-white">100%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Assets Deployed</p>
                    <p className="text-lg font-semibold text-white">$93.08</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Expected APY</p>
                    <p className="text-lg font-semibold text-yellow-500">22.22%</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <p className="text-sm text-gray-400 mb-2">Strategy Description</p>
                  <p className="text-sm text-gray-300">
                    Provides concentrated liquidity to Uniswap V3 WLFI/USD1 pool through Charm Finance's automated 
                    market making strategy. Earns trading fees from swaps while maintaining optimal price ranges.
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <a 
                    href={`https://etherscan.io/address/${CONTRACTS.STRATEGY}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-yellow-500 hover:text-yellow-400 flex items-center gap-1"
                  >
                    <span>View Strategy Contract</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <span className="text-gray-600">•</span>
                  <a 
                    href={`https://etherscan.io/address/${CONTRACTS.CHARM_VAULT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-yellow-500 hover:text-yellow-400 flex items-center gap-1"
                  >
                    <span>View Charm Vault</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm">
                  <p className="text-yellow-400 font-medium mb-1">Strategy Update</p>
                  <p className="text-yellow-200/80">
                    New fixed strategy deployed on Oct 21, 2025. Bug fix ensures correct share calculations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Contract Information</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-3 border-b border-white/10">
                  <span className="text-gray-400">Vault Contract</span>
                  <a 
                    href={`https://etherscan.io/address/${CONTRACTS.VAULT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-500 hover:text-yellow-400 font-mono text-sm flex items-center gap-1"
                  >
                    {CONTRACTS.VAULT.slice(0, 8)}...{CONTRACTS.VAULT.slice(-6)}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-white/10">
                  <span className="text-gray-400">Strategy Contract</span>
                  <a 
                    href={`https://etherscan.io/address/${CONTRACTS.STRATEGY}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-500 hover:text-yellow-400 font-mono text-sm flex items-center gap-1"
                  >
                    {CONTRACTS.STRATEGY.slice(0, 8)}...{CONTRACTS.STRATEGY.slice(-6)}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>

                <div className="flex justify-between items-center py-3 border-b border-white/10">
                  <span className="text-gray-400">WLFI Token</span>
                  <a 
                    href={`https://etherscan.io/address/${CONTRACTS.WLFI}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-500 hover:text-yellow-400 font-mono text-sm flex items-center gap-1"
                  >
                    {CONTRACTS.WLFI.slice(0, 8)}...{CONTRACTS.WLFI.slice(-6)}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>

                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-400">USD1 Token</span>
                  <a 
                    href={`https://etherscan.io/address/${CONTRACTS.USD1}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-500 hover:text-yellow-400 font-mono text-sm flex items-center gap-1"
                  >
                    {CONTRACTS.USD1.slice(0, 8)}...{CONTRACTS.USD1.slice(-6)}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Protocols</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-lg border border-white/10 p-4 text-center">
                  <img 
                    src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafkreichw4b4wxvinfu4dmkloxajj4mm7672k6q3nyqzvdnvogvlbbycfq" 
                    alt="Uniswap"
                    className="w-8 h-8 mx-auto mb-2"
                  />
                  <p className="text-sm font-medium text-white">Uniswap V3</p>
                  <p className="text-xs text-gray-500">DEX</p>
                </div>
                <div className="bg-white/5 rounded-lg border border-white/10 p-4 text-center">
                  <img 
                    src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafkreid3difftzksqy3xlummzzobhk674ece35d7drmgo3ftt7wrix6dwu" 
                    alt="Charm"
                    className="w-8 h-8 mx-auto mb-2"
                  />
                  <p className="text-sm font-medium text-white">Charm Finance</p>
                  <p className="text-xs text-gray-500">Vault Manager</p>
                </div>
                <div className="bg-white/5 rounded-lg border border-white/10 p-4 text-center">
                  <img 
                    src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafkreihml3nahd2duwdjg2ltoeixax2xdj2ldp5unnrjwntyicar74nwra" 
                    alt="LayerZero"
                    className="w-8 h-8 mx-auto mb-2"
                  />
                  <p className="text-sm font-medium text-white">LayerZero V2</p>
                  <p className="text-xs text-gray-500">Cross-chain</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

