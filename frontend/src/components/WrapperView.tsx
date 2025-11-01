import { useState } from 'react';
import { motion } from 'framer-motion';
import type { BrowserProvider } from 'ethers';

interface Props {
  provider?: BrowserProvider;
  account?: string;
  onToast?: (props: { 
    title: string; 
    description: string; 
    variant?: 'default' | 'destructive'; 
    txHash?: string 
  }) => void;
  onNavigateDown?: () => void;
  onNavigateUp?: () => void;
}

export default function WrapperView({ provider, account, onToast, onNavigateDown, onNavigateUp }: Props) {
  const [activeTab, setActiveTab] = useState<'wrap' | 'unwrap'>('wrap');
  const [amount, setAmount] = useState('');

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Vault Wrapper Bridge
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Convert between Vault EAGLE shares and OFT EAGLE tokens for cross-chain bridging
          </p>
        </motion.div>

        {/* Main Wrapper Interface */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-2xl mx-auto"
        >
          {/* Card */}
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setActiveTab('wrap')}
                className={`flex-1 py-4 text-center font-semibold transition-all ${
                  activeTab === 'wrap'
                    ? 'bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-white border-b-2 border-purple-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Wrap to OFT
              </button>
              <button
                onClick={() => setActiveTab('unwrap')}
                className={`flex-1 py-4 text-center font-semibold transition-all ${
                  activeTab === 'unwrap'
                    ? 'bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-white border-b-2 border-purple-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Unwrap to Shares
              </button>
            </div>

            {/* Content */}
            <div className="p-8">
              {activeTab === 'wrap' ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Wrap Vault Shares → OFT Tokens</h3>
                    <p className="text-gray-400 text-sm mb-6">
                      Lock your vault EAGLE shares and receive OFT EAGLE tokens at 1:1 ratio.
                      OFT tokens can be bridged cross-chain via LayerZero.
                    </p>
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Amount to Wrap</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 transition-colors"
                      />
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold transition-colors">
                        MAX
                      </button>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Balance: -- vEAGLE</span>
                      <span>Fee: 1%</span>
                    </div>
                  </div>

                  {/* Wrap Button */}
                  <button
                    disabled={!account || !amount}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed font-semibold transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {!account ? 'Connect Wallet' : 'Wrap to OFT'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Unwrap OFT Tokens → Vault Shares</h3>
                    <p className="text-gray-400 text-sm mb-6">
                      Burn your OFT EAGLE tokens and receive vault EAGLE shares at 1:1 ratio.
                      You can then withdraw from the vault.
                    </p>
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Amount to Unwrap</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 transition-colors"
                      />
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold transition-colors">
                        MAX
                      </button>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Balance: -- OFT EAGLE</span>
                      <span>Fee: 2%</span>
                    </div>
                  </div>

                  {/* Unwrap Button */}
                  <button
                    disabled={!account || !amount}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed font-semibold transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {!account ? 'Connect Wallet' : 'Unwrap to Shares'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8"
          >
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <p className="text-gray-400 text-sm mb-2">Total Locked</p>
              <p className="text-2xl font-bold">--</p>
              <p className="text-xs text-gray-500 mt-1">Vault shares</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <p className="text-gray-400 text-sm mb-2">Total OFT Minted</p>
              <p className="text-2xl font-bold">--</p>
              <p className="text-xs text-gray-500 mt-1">OFT tokens</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <p className="text-gray-400 text-sm mb-2">1:1 Peg</p>
              <p className="text-2xl font-bold text-green-400">✓</p>
              <p className="text-xs text-gray-500 mt-1">Perfect ratio</p>
            </div>
          </motion.div>

          {/* Info Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8"
          >
            {/* How it Works */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How it Works
              </h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">→</span>
                  <span><strong className="text-white">Wrap:</strong> Lock vault shares, mint OFT tokens at 1:1 ratio</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">→</span>
                  <span><strong className="text-white">Bridge:</strong> Send OFT tokens to other chains via LayerZero</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">→</span>
                  <span><strong className="text-white">Unwrap:</strong> Burn OFT tokens, receive vault shares back</span>
                </li>
              </ul>
            </div>

            {/* Features */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Features
              </h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">✓</span>
                  <span>1:1 peg maintained at all times</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">✓</span>
                  <span>Cross-chain compatible via LayerZero</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">✓</span>
                  <span>Secure and non-custodial</span>
                </li>
              </ul>
            </div>
          </motion.div>
        </motion.div>

        {/* Navigation Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex justify-center gap-4 mt-12"
        >
          {onNavigateDown && (
            <button
              onClick={onNavigateDown}
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 font-semibold transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              Back to Vault
            </button>
          )}
          {onNavigateUp && (
            <button
              onClick={onNavigateUp}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-blue-400/50 font-semibold transition-all flex items-center gap-2"
            >
              Continue to LP Pool
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}

