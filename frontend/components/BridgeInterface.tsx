'use client';

import { useState } from 'react';
import type { FC } from 'react';
import { useAccount } from 'wagmi';

const BridgeInterface: FC = () => {
  const { address } = useAccount();
  const [amount, setAmount] = useState('');
  const [fromChain, setFromChain] = useState('arbitrum');
  const [toChain, setToChain] = useState('ethereum');

  const chains = [
    { id: 'arbitrum', name: 'Arbitrum', icon: 'A' },
    { id: 'ethereum', name: 'Ethereum', icon: 'E' },
    { id: 'base', name: 'Base', icon: 'B' },
    { id: 'bnb', name: 'BNB Chain', icon: 'B' },
    { id: 'sonic', name: 'Sonic', icon: 'S' },
  ];

  const getChainDisplay = (chainId: string) => {
    return chains.find(c => c.id === chainId);
  };

  return (
    <div className="max-w-4xl">
      {/* Minimalistic Bridge Form */}
      <div className="grid grid-cols-12 gap-2 items-end">
        {/* From Chain */}
        <div className="col-span-3">
          <label className="block text-xs text-dark-500 mb-1.5">From</label>
          <select
            value={fromChain}
            onChange={(e) => setFromChain(e.target.value)}
            className="w-full p-2.5 bg-[#0e1128] rounded border border-white/10 text-sm text-white outline-none focus:border-eagle-300/50 transition-colors"
          >
            {chains.map(chain => (
              <option key={chain.id} value={chain.id}>{chain.name}</option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div className="col-span-3">
          <label className="block text-xs text-dark-500 mb-1.5">Amount EAGLE</label>
          <div className="p-2.5 bg-[#0e1128] rounded border border-white/10 relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent border-none outline-none text-lg font-medium text-white placeholder-dark-600 pr-10"
            />
            <button 
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-[#2a2d4a] hover:bg-[#3a3d5a] rounded text-[10px] text-dark-300 transition-colors"
            >
              Max
            </button>
          </div>
          <div className="text-[10px] text-dark-500 mt-1">
            Balance: 0.00 EAGLE
          </div>
        </div>

        {/* Arrow with Swap */}
        <div className="col-span-1 flex justify-center items-center pb-4">
          <button 
            onClick={() => {
              const temp = fromChain;
              setFromChain(toChain);
              setToChain(temp);
            }}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
        </div>

        {/* To Chain */}
        <div className="col-span-3">
          <label className="block text-xs text-dark-500 mb-1.5">To</label>
          <select
            value={toChain}
            onChange={(e) => setToChain(e.target.value)}
            className="w-full p-2.5 bg-[#0e1128] rounded border border-white/10 text-sm text-white outline-none focus:border-eagle-300/50 transition-colors"
          >
            {chains.filter(c => c.id !== fromChain).map(chain => (
              <option key={chain.id} value={chain.id}>{chain.name}</option>
            ))}
          </select>
        </div>

        {/* Bridge Button */}
        <div className="col-span-2">
          <button
            disabled={!address || !amount}
            className="w-full py-2 px-3 bg-gradient-to-r from-[#d4af37] to-[#b8941f] hover:from-[#e2c55f] hover:to-[#d4af37] disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium rounded text-sm transition-all"
          >
            Bridge
          </button>
        </div>
      </div>

      {/* Bridge Info */}
      <div className="mt-3 p-3 bg-white/5 rounded border border-white/10">
        <p className="text-xs text-dark-300">
          Bridge fee: ~$0.50 USD (LayerZero V2 cross-chain message)
        </p>
      </div>
    </div>
  );
};

export default BridgeInterface;

