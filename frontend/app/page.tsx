'use client';

import { useState } from 'react';
import type { FC } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ADDRESSES } from '@/config/contracts';
import DepositInterface from '@/components/DepositInterface';
import WithdrawalInterface from '@/components/WithdrawalInterface';
import VaultAnalytics from '@/components/VaultAnalytics';
import UserPosition from '@/components/UserPosition';
import BridgeInterface from '@/components/BridgeInterface';
import VaultHeader from '@/components/VaultHeader';

const Home: FC = () => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'bridge'>('deposit');
  const [activeSubTab, setActiveSubTab] = useState<'about' | 'strategies' | 'info'>('strategies');

  return (
    <div className="min-h-screen bg-[#0a0c1e]">
      {/* Top Navigation */}
      <header className="border-b border-white/10 bg-[#0a0c1e]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <img 
                  src="/eagle-logo.svg" 
                  alt="Eagle" 
                  className="h-8 w-auto filter brightness-0 invert"
                />
                <div>
                  <h1 className="text-lg font-semibold text-white">v3 Vaults</h1>
                </div>
              </div>
              <nav className="flex gap-6">
                <a href="#" className="text-sm text-dark-300 hover:text-white transition-colors">Docs</a>
                <a href="#" className="text-sm text-dark-300 hover:text-white transition-colors">Support</a>
                <a href="#" className="text-sm text-dark-300 hover:text-white transition-colors">Blog</a>
              </nav>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button className="flex items-center gap-2 text-white mb-6 hover:text-eagle-300 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Vault Header Card */}
        <VaultHeader />

        {/* Bridge Info */}
        <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
          <p className="text-sm text-dark-200">
            <strong className="text-white">Deployed on Arbitrum:</strong> Uses Chainlink and Uniswap V3 TWAP oracles for accurate pricing
          </p>
        </div>

        {/* Main Tabs */}
        <div className="mt-8 flex gap-4 border-b border-white/10">
          <button
            onClick={() => setActiveTab('deposit')}
            className={`pb-3 px-2 text-sm font-medium transition-colors relative ${
              activeTab === 'deposit'
                ? 'text-white'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Deposit
            {activeTab === 'deposit' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#d4af37]"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`pb-3 px-2 text-sm font-medium transition-colors relative ${
              activeTab === 'withdraw'
                ? 'text-white'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Withdraw
            {activeTab === 'withdraw' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#d4af37]"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('bridge')}
            className={`pb-3 px-2 text-sm font-medium transition-colors relative ${
              activeTab === 'bridge'
                ? 'text-white'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Bridge
            {activeTab === 'bridge' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#d4af37]"></div>
            )}
          </button>
        </div>

        {/* Deposit/Withdraw/Bridge Content */}
        <div className="mt-8">
          {activeTab === 'deposit' && (
            <div className="animate-fadeIn">
              <DepositInterface />
              <UserPosition />
            </div>
          )}
          {activeTab === 'withdraw' && (
            <div className="animate-fadeIn">
              <WithdrawalInterface />
              <UserPosition />
            </div>
          )}
          {activeTab === 'bridge' && (
            <div className="animate-fadeIn">
              <BridgeInterface />
              <UserPosition />
            </div>
          )}
        </div>

        {/* Sub Navigation */}
        <div className="mt-12 flex gap-6 border-b border-white/10">
          <button
            onClick={() => setActiveSubTab('about')}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeSubTab === 'about'
                ? 'text-white border-b-2 border-eagle-300'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            About
          </button>
          <button
            onClick={() => setActiveSubTab('strategies')}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeSubTab === 'strategies'
                ? 'text-white border-b-2 border-eagle-300'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Strategies
          </button>
          <button
            onClick={() => setActiveSubTab('info')}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeSubTab === 'info'
                ? 'text-white border-b-2 border-eagle-300'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Info
          </button>
        </div>

        {/* Sub Content */}
        <div className="mt-8">
          {activeSubTab === 'about' && (
            <div className="glass-card p-8">
              <h3 className="text-xl font-semibold text-white mb-4">About Eagle Vault V3</h3>
              <p className="text-base text-dark-200 leading-relaxed mb-4">
                Oracle-powered dual-token vault with Chainlink and Uniswap V3 TWAP integration for accurate USD valuation.
                Earn yield through automated strategy deployment.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div>
                  <h4 className="text-sm font-semibold text-eagle-300 mb-2">Features</h4>
                  <ul className="space-y-2 text-sm text-dark-300">
                    <li>• Chainlink Price Feeds</li>
                    <li>• Uniswap V3 TWAP Oracle</li>
                    <li>• ERC-4626 Standard</li>
                    <li>• Multi-Strategy Support</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-eagle-300 mb-2">Security</h4>
                  <ul className="space-y-2 text-sm text-dark-300">
                    <li>• OpenZeppelin Libraries</li>
                    <li>• Reentrancy Guards</li>
                    <li>• Oracle Price Validation</li>
                    <li>• Multi-Source Verification</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {activeSubTab === 'strategies' && (
            <div className="animate-fadeIn">
              <VaultAnalytics />
            </div>
          )}
          
          {activeSubTab === 'info' && (
            <div className="glass-card p-8">
              <h3 className="text-xl font-semibold text-white mb-6">Contract Information</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-white/10">
                  <span className="text-sm text-dark-400">Network</span>
                  <span className="text-sm text-white font-mono">Arbitrum One</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-white/10">
                  <span className="text-sm text-dark-400">Vault Contract</span>
                  <span className="text-sm text-white font-mono">{ADDRESSES.VAULT.slice(0, 10)}...{ADDRESSES.VAULT.slice(-8)}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-white/10">
                  <span className="text-sm text-dark-400">WLFI Token</span>
                  <span className="text-sm text-white font-mono">{ADDRESSES.WLFI.slice(0, 10)}...{ADDRESSES.WLFI.slice(-8)}</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-sm text-dark-400">USD1 Token</span>
                  <span className="text-sm text-white font-mono">{ADDRESSES.USD1.slice(0, 10)}...{ADDRESSES.USD1.slice(-8)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 border-t border-white/10 bg-[#0a0c1e] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <p className="text-sm text-dark-400">© 2025 Eagle Vault V3. Built with Chainlink and Uniswap V3 oracles.</p>
            <div className="flex gap-6">
              <a href="https://github.com/wenakita/v1" className="text-sm text-dark-400 hover:text-eagle-300 transition-colors">GitHub</a>
              <a href="https://arbiscan.io" className="text-sm text-dark-400 hover:text-eagle-300 transition-colors">Arbiscan</a>
              <a href="https://docs.chain.link" className="text-sm text-dark-400 hover:text-eagle-300 transition-colors">Chainlink Docs</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
