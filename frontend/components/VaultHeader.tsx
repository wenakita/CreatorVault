'use client';

import type { FC } from 'react';
import { useReadContract } from 'wagmi';
import { formatEther } from 'viem';
import { VAULT_ABI, ADDRESSES } from '@/config/contracts';

const VaultHeader: FC = () => {
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

  const tvl = totalAssets ? formatEther(totalAssets) : '0';
  const supply = totalSupply ? formatEther(totalSupply) : '0';
  const estimatedAPR = '12.50';

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Golden Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#8a6f00] via-[#d4af37] to-[#b8941f]"></div>
      
      {/* Content */}
      <div className="relative p-8">
        {/* Logo Circle */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 p-2">
            <img 
              src="/eagle-logo.svg" 
              alt="Eagle" 
              className="w-full h-full object-contain filter brightness-0 invert"
            />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white text-center mb-1 tracking-tight">
          EAGLE
        </h1>
        <p className="text-center text-white/70 text-xs font-mono mb-6">
          {ADDRESSES.VAULT.slice(0, 8)}...{ADDRESSES.VAULT.slice(-6)}
        </p>

        {/* Network Tabs */}
        <div className="flex gap-2 justify-center mb-8">
          <button className="px-5 py-1.5 bg-white/25 backdrop-blur-sm rounded-full text-white text-xs font-semibold border border-white/30 shadow-sm">
            Arbitrum
          </button>
          <button className="px-5 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-white/80 text-xs font-medium border border-white/20 hover:bg-white/20 transition-all">
            Bridge EAGLE
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Total Deposited */}
          <div className="text-center">
            <p className="text-white/60 text-xs mb-2">Total Deposited</p>
            <p className="text-2xl font-bold text-white mb-0.5">
              {parseFloat(tvl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <p className="text-white/50 text-[10px]">
              WLFI + USD1 Value
            </p>
          </div>

          {/* Estimated APR */}
          <div className="text-center">
            <p className="text-white/60 text-xs mb-2">
              Estimated APR
            </p>
            <p className="text-2xl font-bold text-white mb-0.5">
              {estimatedAPR}%
            </p>
            <p className="text-white/50 text-[10px]">
              From Charm LP
            </p>
          </div>

          {/* Total Shares */}
          <div className="text-center">
            <p className="text-white/60 text-xs mb-2">
              Total EAGLE Shares
            </p>
            <p className="text-2xl font-bold text-white mb-0.5">
              {parseFloat(supply).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <p className="text-white/50 text-[10px]">
              Outstanding
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaultHeader;
