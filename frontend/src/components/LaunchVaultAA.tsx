/**
 * 🤖 ACCOUNT ABSTRACTION LAUNCH COMPONENT
 * 
 * This component enables ONE-SIGNATURE CCA launch using Account Abstraction.
 * Uses `CONTRACTS.vaultActivationBatcher` (set via `VITE_VAULT_ACTIVATION_BATCHER` in Vercel).
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { useSendCalls } from 'wagmi/experimental';
import { useOnchainKit } from '@coinbase/onchainkit';
import { encodeFunctionData, erc20Abi, isAddress, parseEther, type Address, type Hex } from 'viem';
import { base } from 'wagmi/chains';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { logger } from '@/lib/logger';
import { CONTRACTS } from '@/config/contracts';
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp';
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337';
import { useZoraProfile } from '@/lib/zora/hooks';

const addr = (hexWithout0x: string) => `0x${hexWithout0x}` as Address;
const ZERO_ADDRESS = addr('0000000000000000000000000000000000000000');

const VAULT_ACTIVATION_BATCHER = (CONTRACTS.vaultActivationBatcher ??
  ZERO_ADDRESS) as Address;

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
  creatorToken: Address;
  vault: Address;
  wrapper: Address;
  ccaStrategy: Address;
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
  const { data: walletClient } = useWalletClient({ chainId: base.id });
  const { sendCallsAsync } = useSendCalls();
  const { config: onchainKitConfig } = useOnchainKit();

  const profileQuery = useZoraProfile(address);
  const profile = profileQuery.data;
  const connectedSmartWallet = useMemo(() => {
    const edges = profile?.linkedWallets?.edges ?? [];
    for (const e of edges) {
      const node: any = (e as any)?.node;
      const walletType = typeof node?.walletType === 'string' ? node.walletType : '';
      const walletAddress = typeof node?.walletAddress === 'string' ? node.walletAddress : '';
      if (String(walletType).toUpperCase() !== 'SMART_WALLET') continue;
      if (isAddress(walletAddress)) return walletAddress as Address;
    }
    return null;
  }, [profile?.linkedWallets?.edges]);
  
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function launchWithAA() {
    if (!address) {
      setError('Please connect your wallet');
      return;
    }
    if (VAULT_ACTIVATION_BATCHER === ZERO_ADDRESS) {
      setError('Vault activation batcher is not configured. Set VITE_VAULT_ACTIVATION_BATCHER.');
      return;
    }

    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Parse amounts
      const depositAmountBigInt = parseEther(depositAmount);
      const requiredRaiseBigInt = parseEther(requiredRaise);

      // Optional paymaster sponsorship (Coinbase CDP via OnchainKitProvider).
      const cdpApiKey = import.meta.env.VITE_CDP_API_KEY as string | undefined;
      const paymasterUrl = resolveCdpPaymasterUrl(onchainKitConfig?.paymaster ?? null, cdpApiKey);
      const capabilities =
        paymasterUrl && typeof paymasterUrl === 'string'
          ? ({ paymasterService: { url: paymasterUrl } } as const)
          : undefined;

      // Build batched transactions
      const transactions: { to: Address; data: Hex; value: bigint }[] = [
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

      // Prefer true ERC-4337 flow when a smart wallet is linked + paymaster is available.
      if (paymasterUrl && publicClient && walletClient && address && connectedSmartWallet) {
        const [connectedCode, smartWalletCode] = await Promise.all([
          publicClient.getBytecode({ address: address as Address }),
          publicClient.getBytecode({ address: connectedSmartWallet }),
        ]);
        const connectedIsContract = !!connectedCode && connectedCode !== '0x';
        const smartWalletIsContract = !!smartWalletCode && smartWalletCode !== '0x';
        if (!connectedIsContract && smartWalletIsContract) {
          const res = await sendCoinbaseSmartWalletUserOperation({
            publicClient,
            walletClient,
            bundlerUrl: paymasterUrl,
            smartWallet: connectedSmartWallet,
            ownerAddress: address as Address,
            calls: transactions.map((tx) => ({ to: tx.to, value: tx.value, data: tx.data })),
            version: '1',
          });
          setTxHash(res.transactionHash);
          return;
        }
      }

      // Preferred: wallet_sendCalls atomic batch (Smart Wallets + paymaster support).
      try {
        const res = await sendCallsAsync({
          calls: transactions,
          account: address as Address,
          chainId: base.id,
          forceAtomic: true,
          capabilities: capabilities as any,
        });
        // NOTE: This is a call bundle id / userOp-ish identifier, not always a tx hash.
        setTxHash(res.id);
        return;
      } catch (e) {
        // fall back
        logger.warn('wallet_sendCalls failed, falling back to sequential txs', e);
      }

      // Fallback: Send transactions sequentially (EOA-style).
      if (!walletClient) throw new Error('Wallet not ready');
      if (publicClient && address && connectedSmartWallet) {
        const [connectedCode, smartWalletCode] = await Promise.all([
          publicClient.getBytecode({ address: address as Address }),
          publicClient.getBytecode({ address: connectedSmartWallet }),
        ]);
        const connectedIsContract = !!connectedCode && connectedCode !== '0x';
        const smartWalletIsContract = !!smartWalletCode && smartWalletCode !== '0x';
        if (!connectedIsContract && smartWalletIsContract) {
          throw new Error(
            `A Zora smart wallet (${connectedSmartWallet}) is linked to this account. Please switch to your Zora smart wallet connector before continuing.`,
          );
        }
      }
      logger.info('Falling back to sequential transactions');

      const approveTxHash = await walletClient.sendTransaction({
        account: address as any,
        chain: base as any,
        to: transactions[0].to as any,
        data: transactions[0].data as any,
        value: 0n,
      });
      await publicClient?.waitForTransactionReceipt({ hash: approveTxHash as `0x${string}` });

      const launchTxHash = await walletClient.sendTransaction({
        account: address as any,
        chain: base as any,
        to: transactions[1].to as any,
        data: transactions[1].data as any,
        value: 0n,
      });
      setTxHash(launchTxHash);
      await publicClient?.waitForTransactionReceipt({ hash: launchTxHash as `0x${string}` });

    } catch (err: any) {
      logger.error('Launch failed', err);
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
        className="w-full relative group overflow-hidden bg-blue-gradient 
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
      <div className="p-4 bg-brand-primary/5 border border-brand-primary/10 rounded">
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
