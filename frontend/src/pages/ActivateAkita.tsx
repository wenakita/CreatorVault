import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useReadContract } from 'wagmi'
import { formatUnits, erc20Abi, type Address } from 'viem'
import {
  Rocket,
  Zap,
} from 'lucide-react'
import { AKITA } from '../config/contracts'
import { ConnectButton } from '../components/ConnectButton'
import { toShareSymbol } from '@/lib/tokenSymbols'
import { LaunchVaultAA } from '@/components/LaunchVaultAA'

export function ActivateAkita() {
  const { address, isConnected, connector } = useAccount()
  // Fixed parameters for AKITA launch
  const depositAmount = '50000000' // 50M AKITA (locked)
  const auctionPercent = 50 // 50% to auction, 50% stays in vault (locked)
  const [requiredRaise, setRequiredRaise] = useState('0.1') // 0.1 ETH minimum
  const SHARE_SYMBOL = toShareSymbol('AKITA')

  // Read AKITA balance
  const { data: tokenBalance } = useReadContract({
    address: AKITA.token as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // NOTE: AA batching support is wallet-dependent; we still support sequential fallback.
  const isSmartWallet = connector?.id === 'coinbaseWalletSDK' || connector?.id === 'coinbaseSmartWallet'

  if (!isConnected) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <Rocket className="w-16 h-16 text-brand-500 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold mb-2">Launch AKITA Auction</h2>
            <p className="text-slate-400 mb-6">
              Connect your wallet to activate the AKITA vault and start the CCA auction
            </p>
            <ConnectButton />
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="text-center">
        <Rocket className="w-12 h-12 text-brand-500 mx-auto mb-4" />
        <h1 className="text-4xl font-bold mb-2">Launch AKITA Auction</h1>
        <p className="text-slate-400">
          One-click activation powered by account abstraction
        </p>
      </div>

      {/* What Happens */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-6 h-6 text-brand-400" />
          <h2 className="text-xl font-bold">What Happens in One Transaction</h2>
        </div>
        
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              1
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">Approve 50M AKITA</p>
              <p className="text-slate-500">To the activation batcher</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              2
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">Deposit into vault</p>
              <p className="text-slate-500">Mints ▢AKITA vault shares</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              3
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">Wrap to {SHARE_SYMBOL}</p>
              <p className="text-slate-500">Converts ▢AKITA → {SHARE_SYMBOL}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              4
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">Launch CCA + {SHARE_SYMBOL}/ETH V4 Pool</p>
              <p className="text-slate-500">25M {SHARE_SYMBOL} auction · 0.3% fee tier with 6.9% hook</p>
            </div>
          </div>
        </div>

        {/* (Removed) Smart wallet promo: most creators will not have access to the original coin-deploy wallet. */}
      </motion.div>

      {/* Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6 space-y-6"
      >
        <h2 className="text-xl font-bold">Launch Parameters</h2>

        <div className="space-y-4">
          {/* Fixed Parameters */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/10">
            <div>
              <p className="text-xs text-slate-500 mb-1">Deposit Amount</p>
              <p className="text-2xl font-bold text-white">50M AKITA</p>
              <p className="text-xs text-slate-400 mt-1">Fixed launch size</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Allocation</p>
              <p className="text-2xl font-bold text-white">50/50</p>
              <p className="text-xs text-slate-400 mt-1">25M auction + 25M stays with creator</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-brand-500/10 border border-brand-500/20 text-sm">
              <p className="text-brand-300">
                Your balance: <span className="font-semibold">{tokenBalance ? formatUnits(tokenBalance, 18) : '0'} AKITA</span>
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs space-y-2">
                <p className="text-green-300 font-medium">✓ Underlying AKITA Strategies (Vault):</p>
                <p className="text-green-400/80">
                  69% AKITA/USDC Charm LP · 21.39% Ajna Lending · 9.61% Idle Reserve
                </p>
                <p className="text-green-400/80 italic">
                  Mirrors fee distribution for consistent branding
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs space-y-2">
                <p className="text-purple-300 font-medium">✓ {SHARE_SYMBOL} Trading Pool (Created Post-Auction):</p>
                <p className="text-purple-400/80">
                  {SHARE_SYMBOL}/ETH on Uniswap V4 · 0.3% fee tier · 6.9% hook tax for jackpot & burns
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs">
                <p className="text-yellow-300 font-medium mb-1">⚠️ Prerequisites</p>
                <p className="text-yellow-400/80">
                  Recommended: deploy strategies + set weights (69% Charm LP / 21.39% Ajna) and set minimumTotalIdle (4.805M = 9.61%) before launching.
                </p>
                <p className="text-yellow-400/80 mt-2">
                  Use <a className="underline hover:text-yellow-300" href="/admin/deploy-strategies">/admin/deploy-strategies</a>.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Minimum Raise (ETH)
            </label>
            <input
              type="text"
              value={requiredRaise}
              onChange={(e) => setRequiredRaise(e.target.value)}
              className="input-field w-full"
              placeholder="0.1"
            />
            <p className="text-xs text-slate-500 mt-1">
              Auction must raise at least this much ETH to succeed
            </p>
          </div>
        </div>
      </motion.div>

      {/* Launch Button */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-full max-w-xl">
          <LaunchVaultAA
            creatorToken={AKITA.token as Address}
            vault={AKITA.vault as Address}
            wrapper={AKITA.wrapper as Address}
            ccaStrategy={AKITA.ccaStrategy as Address}
            depositAmount={depositAmount}
            auctionPercent={auctionPercent}
            requiredRaise={requiredRaise}
          />
        </div>

        <p className="text-xs text-slate-500 text-center max-w-md">
          {isSmartWallet 
            ? 'Approve + activate are batched into one signature (when supported).'
            : 'Your wallet may prompt you to sign 2 transactions (approve, then activate).'
          }
        </p>

        <div className="text-center text-xs text-slate-600 space-y-1">
          <p>Transaction includes: approve + activate (deposit → wrap → auction)</p>
          <p>Estimated gas: ~0.006 ETH {isSmartWallet && '(potentially sponsored)'}</p>
        </div>
      </div>
    </div>
  )
}
