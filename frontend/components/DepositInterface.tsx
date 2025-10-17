'use client';

import { useState } from 'react';
import type { FC } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { VAULT_ABI, ERC20_ABI, ADDRESSES } from '@/config/contracts';

const DepositInterface: FC = () => {
  const { address } = useAccount();
  const [wlfiAmount, setWlfiAmount] = useState('');
  const [usd1Amount, setUsd1Amount] = useState('');

  const { data: wlfiBalance } = useReadContract({
    address: ADDRESSES.WLFI,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  const { data: usd1Balance } = useReadContract({
    address: ADDRESSES.USD1,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  const { data: wlfiAllowance } = useReadContract({
    address: ADDRESSES.WLFI,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, ADDRESSES.VAULT] : undefined,
    query: { enabled: !!address }
  });

  const { data: usd1Allowance } = useReadContract({
    address: ADDRESSES.USD1,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, ADDRESSES.VAULT] : undefined,
    query: { enabled: !!address }
  });

  const { data: depositPreview } = useReadContract({
    address: ADDRESSES.VAULT,
    abi: VAULT_ABI,
    functionName: 'previewDepositDual',
    args: [
      wlfiAmount ? parseEther(wlfiAmount) : 0n,
      usd1Amount ? parseEther(usd1Amount) : 0n
    ],
    query: { enabled: !!(wlfiAmount || usd1Amount) }
  });

  const { writeContract: approveWlfi } = useWriteContract();
  const { writeContract: approveUsd1 } = useWriteContract();
  const { writeContract: depositDual } = useWriteContract();

  const needsWlfiApproval = wlfiAmount && wlfiAllowance !== undefined && 
    parseEther(wlfiAmount) > (wlfiAllowance as bigint);
  const needsUsd1Approval = usd1Amount && usd1Allowance !== undefined && 
    parseEther(usd1Amount) > (usd1Allowance as bigint);

  const handleDeposit = () => {
    if (!address || (!wlfiAmount && !usd1Amount)) return;
    
    depositDual({
      address: ADDRESSES.VAULT,
      abi: VAULT_ABI,
      functionName: 'depositDual',
      args: [
        wlfiAmount ? parseEther(wlfiAmount) : 0n,
        usd1Amount ? parseEther(usd1Amount) : 0n,
        address
      ]
    });
  };

  return (
    <div className="max-w-5xl">
      {/* Ultra Minimalistic Horizontal Form */}
      <div className="grid grid-cols-12 gap-2 items-end">
        {/* WLFI Input */}
        <div className="col-span-2">
          <label className="block text-xs text-dark-500 mb-1.5">WLFI</label>
          <div className="p-2.5 bg-[#0e1128] rounded border border-white/10 relative">
            <input
              type="number"
              value={wlfiAmount}
              onChange={(e) => setWlfiAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent border-none outline-none text-lg font-medium text-white placeholder-dark-600 pr-10"
            />
            <button 
              onClick={() => wlfiBalance && setWlfiAmount(formatEther(wlfiBalance))}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-[#2a2d4a] hover:bg-[#3a3d5a] rounded text-[10px] text-dark-300 transition-colors"
            >
              Max
            </button>
          </div>
          <div className="text-[10px] text-dark-500 mt-1">
            Balance: {wlfiBalance ? parseFloat(formatEther(wlfiBalance)).toFixed(2) : '0.00'}
          </div>
        </div>

        {/* USD1 Input */}
        <div className="col-span-2">
          <label className="block text-xs text-dark-500 mb-1.5">USD1</label>
          <div className="p-2.5 bg-[#0e1128] rounded border border-white/10 relative">
            <input
              type="number"
              value={usd1Amount}
              onChange={(e) => setUsd1Amount(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent border-none outline-none text-lg font-medium text-white placeholder-dark-600 pr-10"
            />
            <button 
              onClick={() => usd1Balance && setUsd1Amount(formatEther(usd1Balance))}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-[#2a2d4a] hover:bg-[#3a3d5a] rounded text-[10px] text-dark-300 transition-colors"
            >
              Max
            </button>
          </div>
          <div className="text-[10px] text-dark-500 mt-1">
            Balance: {usd1Balance ? parseFloat(formatEther(usd1Balance)).toFixed(2) : '0.00'}
          </div>
        </div>

        {/* Arrow */}
        <div className="col-span-1 flex justify-center items-center pb-4">
          <svg className="w-4 h-4 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>

        {/* EAGLE Output */}
        <div className="col-span-3">
          <label className="block text-xs text-dark-500 mb-1.5">Receive EAGLE</label>
          <div className="p-2.5 bg-[#0e1128] rounded border border-eagle-300/20">
            <div className="text-lg font-semibold golden-text">
              {depositPreview ? parseFloat(formatEther(depositPreview[0])).toFixed(4) : '0.0000'}
            </div>
          </div>
          <div className="text-[10px] text-dark-500 mt-1">
            ${depositPreview ? parseFloat(formatEther(depositPreview[1])).toFixed(2) : '0.00'}
          </div>
        </div>

        {/* Spacer */}
        <div className="col-span-2"></div>

        {/* Deposit Button */}
        <div className="col-span-2">
          <button
            onClick={handleDeposit}
            disabled={!address || (!wlfiAmount && !usd1Amount) || needsWlfiApproval || needsUsd1Approval}
            className="w-full py-2 px-4 bg-gradient-to-r from-eagle-400 to-eagle-300 hover:from-eagle-500 hover:to-eagle-400 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium rounded text-sm transition-all"
          >
            Deposit
          </button>
        </div>
      </div>

      {/* Minimal Approval Row */}
      {(needsWlfiApproval || needsUsd1Approval) && (
        <div className="flex gap-2 mt-2">
          {needsWlfiApproval && (
            <button
              onClick={() => approveWlfi({
                address: ADDRESSES.WLFI,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [ADDRESSES.VAULT, parseEther('999999999')]
              })}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs rounded border border-white/10 transition-all"
            >
              Approve WLFI
            </button>
          )}
          {needsUsd1Approval && (
            <button
              onClick={() => approveUsd1({
                address: ADDRESSES.USD1,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [ADDRESSES.VAULT, parseEther('999999999')]
              })}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs rounded border border-white/10 transition-all"
            >
              Approve USD1
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DepositInterface;
