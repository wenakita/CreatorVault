'use client';

import { useState } from 'react';
import type { FC } from 'react';
import { useReadContract } from 'wagmi';
import { formatEther } from 'viem';
import { VAULT_ABI, ADDRESSES } from '@/config/contracts';

const VaultAnalytics: FC = () => {
  const [expandedStrategy, setExpandedStrategy] = useState<number | null>(0);

  const { data: totalAssets } = useReadContract({
    address: ADDRESSES.VAULT,
    abi: VAULT_ABI,
    functionName: 'totalAssets'
  });

  const { data: totalSupply } = useReadContract({
    address: ADDRESSES.VAULT,
    abi: VAULT_ABI,
    functionName: 'totalSupply'
  });

  const { data: vaultBalances } = useReadContract({
    address: ADDRESSES.VAULT,
    abi: VAULT_ABI,
    functionName: 'getVaultBalances'
  });

  const tvl = totalAssets ? formatEther(totalAssets) : '0';

  // Strategies - replace with real data when available
  const strategies = [
    {
      name: 'Charm Managed: WLFI/USD1 Uniswap V3 LP',
      allocation: '100.00%',
      allocationValue: '$' + parseFloat(tvl).toLocaleString(),
      apy: '12.50%',
      managementFee: '0%',
      performanceFee: '0%',
      lastReport: 'a day ago',
      vaultAddress: ADDRESSES.VAULT.slice(0, 10) + '...',
      contractAddress: ADDRESSES.VAULT.slice(0, 8) + '...'
    }
  ];

  return (
    <div className="glass-card p-0 overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/10 bg-[#0e1128]">
        <div className="col-span-5 text-xs text-dark-400 uppercase tracking-wider">Vault</div>
        <div className="col-span-2 text-xs text-dark-400 uppercase tracking-wider text-right">Allocation %</div>
        <div className="col-span-2 text-xs text-dark-400 uppercase tracking-wider text-right">Allocation $</div>
        <div className="col-span-2 text-xs text-dark-400 uppercase tracking-wider text-right">Est. APY</div>
        <div className="col-span-1"></div>
      </div>

      {/* Strategy Rows */}
      <div>
        {strategies.map((strategy, index) => (
          <div key={index}>
            {/* Main Row */}
            <div 
              className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-[#1a1d3a] transition-colors cursor-pointer items-center"
              onClick={() => setExpandedStrategy(expandedStrategy === index ? null : index)}
            >
              {/* Vault Name */}
              <div className="col-span-5 flex items-center gap-3">
                <button className="text-dark-400 hover:text-white transition-colors">
                  <svg 
                    className={`w-4 h-4 transition-transform ${expandedStrategy === index ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="w-8 h-8 rounded-full bg-eagle-300/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-eagle-300">E</span>
                </div>
                <span className="text-sm font-medium text-white">{strategy.name}</span>
              </div>

              {/* Allocation % */}
              <div className="col-span-2 text-right">
                <span className="text-base font-semibold text-white">{strategy.allocation}</span>
              </div>

              {/* Allocation $ */}
              <div className="col-span-2 text-right">
                <span className="text-base font-medium text-white">{strategy.allocationValue}</span>
              </div>

              {/* APY */}
              <div className="col-span-2 text-right">
                <span className="text-base font-medium text-green-400">{strategy.apy}</span>
              </div>

              {/* Empty column for alignment */}
              <div className="col-span-1"></div>
            </div>

            {/* Expanded Details */}
            {expandedStrategy === index && (
              <div className="px-6 py-4 bg-[#0e1128] border-t border-white/5">
                <div className="ml-12 space-y-3">
                  {/* Action Buttons */}
                  <div className="flex gap-2 mb-4">
                    <a
                      href={`https://arbiscan.io/address/${ADDRESSES.VAULT}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium rounded-full transition-colors border border-blue-500/30 flex items-center gap-1"
                    >
                      Vault
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <a
                      href={`https://arbiscan.io/address/${ADDRESSES.VAULT}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium rounded-full transition-colors border border-blue-500/30 flex items-center gap-1"
                    >
                      {strategy.contractAddress}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>

                  {/* Details */}
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-dark-400">Management Fee:</span>
                    <span className="text-sm text-white">{strategy.managementFee}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-dark-400">Performance Fee:</span>
                    <span className="text-sm text-white">{strategy.performanceFee}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-dark-400">Last Report:</span>
                    <span className="text-sm text-white">{strategy.lastReport}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Allocation Pie Chart */}
      <div className="p-6 border-t border-white/10">
        <div className="flex items-center justify-center">
          <div className="relative w-40 h-40">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="35"
                fill="none"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="10"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="35"
                fill="none"
                stroke="#d4af37"
                strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 35}`}
                strokeDashoffset="0"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-xs text-dark-400 mb-1">allocation %</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaultAnalytics;
