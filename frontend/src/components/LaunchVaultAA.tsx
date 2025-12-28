/**
 * 🤖 ACCOUNT ABSTRACTION LAUNCH COMPONENT
 * 
 * This component enables ONE-SIGNATURE CCA launch using Account Abstraction.
 * Works with the deployed VaultActivationBatcher at 0x6d796554698f5Ddd74Ff20d745304096aEf93CB6
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, usePublicClient } from 'wagmi';
import { encodeFunctionData, erc20Abi, parseEther } from 'viem';
import { base } from 'wagmi/chains';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

// ✅ Deployed VaultActivationBatcher address
const VAULT_ACTIVATION_BATCHER = '0x6d796554698f5Ddd74Ff20d745304096aEf93CB6';

const VaultActivationBatcherABI = [
  {
    inputs: [
      { name: 'creatorToken', type: 'address' },
      { name: 'vault', type: 'address' },
      { name: 'wrapper', type: 'address' },
      { name: 'ccaStrategy', type: 'address' },
      { name: 'depositAmount', type: 'uint256' },
      { name: 'auctionPercent', type: 'uint8' },
      { name: 'requiredRaise', type: 'uint128' }
    ],
    name: 'batchActivate',
    outputs: [{ name: 'auction', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

interface LaunchVaultAAProps {
  creatorToken: `0x${string}`;
  vault: `0x${string}`;
  wrapper: `0x${string}`;
  ccaStrategy: `0x${string}`;
  depositAmount: string; // in human-readable format (e.g., "50000000")
  auctionPercent: number; // 0-100
  requiredRaise: string; // in ETH (e.g., "10")
}

export function LaunchVaultAA({
  creatorToken,
  vault,
  wrapper,
  ccaStrategy,
  depositAmount,
  auctionPercent,
  requiredRaise
}: LaunchVaultAAProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });
  
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function launchWithAA() {
    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Parse amounts
      const depositAmountBigInt = parseEther(depositAmount);
      const requiredRaiseBigInt = parseEther(requiredRaise);

      // Build batched transactions
      const transactions = [
        // 1. Approve tokens to batcher
        {
          to: creatorToken,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [VAULT_ACTIVATION_BATCHER, depositAmountBigInt]
          }),
          value: 0n
        },
        // 2. Launch CCA via batcher
        {
          to: VAULT_ACTIVATION_BATCHER,
          data: encodeFunctionData({
            abi: VaultActivationBatcherABI,
            functionName: 'batchActivate',
            args: [
              creatorToken,
              vault,
              wrapper,
              ccaStrategy,
              depositAmountBigInt,
              auctionPercent,
              requiredRaiseBigInt
            ]
          }),
          value: 0n
        }
      ];

      // Check if using smart wallet with batching capability
      // @ts-ignore - Smart wallet methods may not be typed
      if (window.ethereum?.isCoinbaseWallet || window.ethereum?.isBiconomy) {
        console.log('📱 Using smart wallet with native batching');
        
        // @ts-ignore
        const userOpHash = await window.ethereum.sendBatchTransaction?.(transactions);
        
        if (userOpHash) {
          console.log('✅ UserOp submitted:', userOpHash);
          setTxHash(userOpHash);
          
          // Poll for transaction
          // Note: Smart wallets return userOp hash, not tx hash
          // You may need to use a bundler API to get the actual tx hash
          
          return;
        }
      }

      // Fallback: Send transactions sequentially
      console.log('⚠️ Smart wallet batching not detected, using sequential transactions');
      
      // Send approve transaction
      const approveTxHash = await window.ethereum!.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: transactions[0].to,
          data: transactions[0].data
        }]
      }) as string;
      
      console.log('✅ Approve tx:', approveTxHash);
      
      // Wait for approval
      await publicClient?.waitForTransactionReceipt({ hash: approveTxHash as `0x${string}` });
      
      // Send launch transaction
      const launchTxHash = await window.ethereum!.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: transactions[1].to,
          data: transactions[1].data
        }]
      }) as string;
      
      console.log('✅ Launch tx:', launchTxHash);
      setTxHash(launchTxHash);
      
      // Wait for launch
      const receipt = await publicClient?.waitForTransactionReceipt({ 
        hash: launchTxHash as `0x${string}` 
      });
      
      if (receipt?.status === 'success') {
        console.log('🎉 CCA launched successfully!');
      }

    } catch (err: any) {
      console.error('Launch failed:', err);
      setError(err.message || 'Launch failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Launch Button */}
      <motion.button
        onClick={launchWithAA}
        disabled={loading || !address}
        whileHover={{ scale: loading ? 1 : 1.02 }}
        whileTap={{ scale: loading ? 1 : 0.98 }}
        className="w-full relative group overflow-hidden bg-gradient-to-r from-purple-600 to-cyan-500 
                   px-8 py-4 rounded font-light tracking-widest uppercase text-sm disabled:opacity-50 
                   disabled:cursor-not-allowed transition-all duration-300"
      >
        <div className="relative flex items-center justify-center gap-3">
          <Zap className="w-5 h-5" />
          {loading ? 'LAUNCHING...' : '⚡ LAUNCH CCA (1-CLICK)'}
        </div>
        
        {/* Shimmer effect */}
        {!loading && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{
              x: ['-100%', '100%']
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear'
            }}
          />
        )}
      </motion.button>

      {/* Status Messages */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm"
        >
          ❌ {error}
        </motion.div>
      )}

      {txHash && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-500/10 border border-green-500/20 rounded"
        >
          <p className="text-green-400 text-sm mb-2">✅ Transaction submitted!</p>
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 text-xs hover:underline font-mono"
          >
            {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </a>
        </motion.div>
      )}

      {/* Info */}
      <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded">
        <div className="flex items-center justify-between gap-4 mb-2">
          <p className="text-xs text-gray-400 uppercase tracking-wider">WHAT HAPPENS</p>
          <Link to="/faq/how-it-works" className="text-xs text-cyan-400 hover:underline">
            Learn more
          </Link>
        </div>
        <ul className="text-sm text-gray-300 space-y-2">
          <li className="flex gap-2">
            <span className="text-cyan-400">1.</span>
            <span>Sign once with your wallet</span>
          </li>
          <li className="flex gap-2">
            <span className="text-cyan-400">2.</span>
            <span>Smart contract approves + launches CCA</span>
          </li>
          <li className="flex gap-2">
            <span className="text-cyan-400">3.</span>
            <span>7-day auction begins automatically</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
