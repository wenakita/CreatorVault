'use client';

import { useState } from 'react';
import type { FC } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { VAULT_ABI, ADDRESSES } from '@/config/contracts';

const WithdrawalInterface: FC = () => {
  const { address } = useAccount();
  const [shareAmount, setShareAmount] = useState('');

  const { data: userShares } = useReadContract({
    address: ADDRESSES.VAULT,
    abi: VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

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

  const { writeContract: withdraw } = useWriteContract();

  const handleWithdraw = () => {
    if (!address || !shareAmount) return;
    
    withdraw({
      address: ADDRESSES.VAULT,
      abi: VAULT_ABI,
      functionName: 'withdrawDual',
      args: [parseEther(shareAmount), address]
    });
  };

  const estimatedWlfi = shareAmount && vaultBalances && Array.isArray(vaultBalances) && totalSupply && totalSupply > 0n
    ? formatEther(((vaultBalances[0] as bigint) * parseEther(shareAmount)) / totalSupply)
    : '0';

  const estimatedUsd1 = shareAmount && vaultBalances && Array.isArray(vaultBalances) && totalSupply && totalSupply > 0n
    ? formatEther(((vaultBalances[1] as bigint) * parseEther(shareAmount)) / totalSupply)
    : '0';

  return (
    <div className="max-w-5xl">
      {/* Ultra Minimalistic Horizontal Withdrawal */}
      <div className="grid grid-cols-12 gap-2 items-end">
        {/* From vault - EAGLE Input */}
        <div className="col-span-3">
          <label className="block text-xs text-dark-500 mb-1.5">From vault</label>
          <div className="p-2.5 bg-[#0e1128] rounded border border-white/10 relative">
            <input
              type="number"
              value={shareAmount}
              onChange={(e) => setShareAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent border-none outline-none text-lg font-medium text-white placeholder-dark-600 pr-10"
            />
            <button 
              onClick={() => userShares && setShareAmount(formatEther(userShares))}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-[#2a2d4a] hover:bg-[#3a3d5a] rounded text-[10px] text-dark-300 transition-colors"
            >
              Max
            </button>
          </div>
          <div className="text-[10px] text-dark-500 mt-1">
            EAGLE: {userShares ? parseFloat(formatEther(userShares)).toFixed(2) : '0.00'}
          </div>
        </div>

        {/* Arrow */}
        <div className="col-span-1 flex justify-center items-center pb-4">
          <svg className="w-4 h-4 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>

        {/* WLFI Output */}
        <div className="col-span-2">
          <label className="block text-xs text-dark-500 mb-1.5">WLFI</label>
          <div className="p-2.5 bg-[#0e1128] rounded border border-white/10">
            <div className="text-lg font-medium text-white">
              {parseFloat(estimatedWlfi).toFixed(4)}
            </div>
          </div>
          <div className="text-[10px] text-dark-500 mt-1">$0.00</div>
        </div>

        {/* USD1 Output */}
        <div className="col-span-2">
          <label className="block text-xs text-dark-500 mb-1.5">USD1</label>
          <div className="p-2.5 bg-[#0e1128] rounded border border-white/10">
            <div className="text-lg font-medium text-white">
              {parseFloat(estimatedUsd1).toFixed(4)}
            </div>
          </div>
          <div className="text-[10px] text-dark-500 mt-1">$0.00</div>
        </div>

        {/* Spacer */}
        <div className="col-span-2"></div>

        {/* Withdraw Button */}
        <div className="col-span-2">
          <button
            onClick={handleWithdraw}
            disabled={!address || !shareAmount || parseFloat(shareAmount) <= 0}
            className="w-full py-2 px-3 bg-gradient-to-r from-eagle-400 to-eagle-300 hover:from-eagle-500 hover:to-eagle-400 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium rounded text-sm transition-all"
          >
            Withdraw
          </button>
        </div>
      </div>
    </div>
  );
};

export default WithdrawalInterface;
