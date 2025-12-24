import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseUnits, formatUnits, erc20Abi } from 'viem'
import {
  Rocket,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
  Coins,
  TrendingUp,
} from 'lucide-react'
import { CONTRACTS, AKITA } from '../config/contracts'
import { ConnectButton } from '../components/ConnectButton'

const VAULT_ACTIVATOR_ABI = [
  {
    name: 'activate',
    type: 'function',
    inputs: [
      { name: 'vault', type: 'address' },
      { name: 'wrapper', type: 'address' },
      { name: 'ccaStrategy', type: 'address' },
      { name: 'depositAmount', type: 'uint256' },
      { name: 'auctionPercent', type: 'uint8' },
      { name: 'requiredRaise', type: 'uint128' },
    ],
    outputs: [{ name: 'auction', type: 'address' }],
    stateMutability: 'nonpayable',
  },
] as const

export function ActivateAkita() {
  const { address, isConnected } = useAccount()
  const [depositAmount, setDepositAmount] = useState('100000000') // 100M AKITA
  const [auctionPercent, setAuctionPercent] = useState('50') // 50% to auction
  const [requiredRaise, setRequiredRaise] = useState('0.1') // 0.1 ETH minimum
  const [step, setStep] = useState<'config' | 'approve' | 'activate' | 'success'>('config')

  // Read AKITA balance
  const { data: tokenBalance } = useReadContract({
    address: AKITA.token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  })

  // Read AKITA decimals
  const { data: tokenDecimals } = useReadContract({
    address: AKITA.token,
    abi: erc20Abi,
    functionName: 'decimals',
  })

  // Approve transaction
  const { writeContract: approve, data: approveTxHash, isPending: isApproving } = useWriteContract()
  const { isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  })

  // Activate transaction
  const { writeContract: activate, data: activateTxHash, isPending: isActivating } = useWriteContract()
  const { isLoading: isActivateConfirming, isSuccess: isActivateSuccess } = useWaitForTransactionReceipt({
    hash: activateTxHash,
  })

  const handleApprove = () => {
    if (!tokenDecimals) return
    
    approve({
      address: AKITA.token,
      abi: erc20Abi,
      functionName: 'approve',
      args: [CONTRACTS.vaultActivator, parseUnits(depositAmount, tokenDecimals)],
    })
    setStep('approve')
  }

  const handleActivate = () => {
    if (!tokenDecimals) return

    activate({
      address: CONTRACTS.vaultActivator,
      abi: VAULT_ACTIVATOR_ABI,
      functionName: 'activate',
      args: [
        AKITA.vault,
        AKITA.wrapper,
        AKITA.ccaStrategy,
        parseUnits(depositAmount, tokenDecimals),
        Number(auctionPercent), // uint8
        parseUnits(requiredRaise, 18),
      ],
    })
    setStep('activate')
  }

  if (isActivateSuccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 max-w-md text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="font-display text-2xl font-bold">CCA Launched! 🎉</h2>
          <p className="text-surface-400">
            AKITA vault is now live with a 7-day CCA auction.
          </p>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Deposited:</span>
              <span className="text-white font-semibold">{depositAmount} AKITA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Auction:</span>
              <span className="text-white font-semibold">{auctionPercent}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Min Raise:</span>
              <span className="text-white font-semibold">{requiredRaise} ETH</span>
            </div>
          </div>
          <a href="/dashboard" className="btn-primary w-full">
            View Dashboard
          </a>
        </motion.div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 max-w-md text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto">
            <Rocket className="w-8 h-8 text-brand-500" />
          </div>
          <h2 className="font-display text-2xl font-bold">Activate AKITA Vault</h2>
          <p className="text-surface-400">
            Connect your wallet to launch the 7-day CCA auction
          </p>
          <ConnectButton />
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-500 text-sm font-medium">
          <Rocket className="w-4 h-4" />
          Launch CCA
        </div>
        <h1 className="font-display text-3xl font-bold">Activate AKITA Vault</h1>
        <p className="text-surface-400">
          Start 7-day Continuous Combinatorial Auction
        </p>
      </motion.div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6 space-y-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-brand-500" />
          </div>
          <div>
            <h3 className="font-semibold text-white mb-1">What is CCA?</h3>
            <p className="text-surface-400 text-sm leading-relaxed">
              A fair launch mechanism where participants bid on your tokens over 7 days. 
              No snipers, equal opportunity for everyone. Prevents instant dumps and builds community.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6 space-y-6"
      >
        <h2 className="text-xl font-bold">Launch Parameters</h2>

        {/* Deposit Amount */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-surface-300">
            Initial Deposit (AKITA)
          </label>
          <div className="relative">
            <input
              type="text"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="input-field pr-20"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-surface-500">
              AKITA
            </div>
          </div>
          {tokenBalance !== undefined && tokenDecimals !== undefined && (
            <p className="text-xs text-surface-500">
              Your balance: {Number(formatUnits(tokenBalance, tokenDecimals)).toLocaleString()} AKITA
            </p>
          )}
        </div>

        {/* Auction Percent */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-surface-300">
            Auction Allocation (%)
          </label>
          <input
            type="number"
            value={auctionPercent}
            onChange={(e) => setAuctionPercent(e.target.value)}
            min="0"
            max="100"
            className="input-field"
          />
          <p className="text-xs text-surface-500">
            {auctionPercent}% goes to CCA, {100 - Number(auctionPercent)}% to your vault
          </p>
        </div>

        {/* Required Raise */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-surface-300">
            Minimum Raise (ETH)
          </label>
          <div className="relative">
            <input
              type="text"
              value={requiredRaise}
              onChange={(e) => setRequiredRaise(e.target.value)}
              className="input-field pr-16"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-surface-500">
              ETH
            </div>
          </div>
          <p className="text-xs text-surface-500">
            Auction must raise at least this amount
          </p>
        </div>

        {/* Summary */}
        <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 space-y-2">
          <div className="flex items-center gap-2 text-brand-400 font-semibold mb-2">
            <TrendingUp className="w-4 h-4" />
            Launch Summary
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-surface-500 text-xs">Duration</p>
              <p className="text-white font-semibold">7 days</p>
            </div>
            <div>
              <p className="text-surface-500 text-xs">Initial Liquidity</p>
              <p className="text-white font-semibold">{depositAmount} AKITA</p>
            </div>
            <div>
              <p className="text-surface-500 text-xs">To Auction</p>
              <p className="text-white font-semibold">{auctionPercent}%</p>
            </div>
            <div>
              <p className="text-surface-500 text-xs">Min Raise</p>
              <p className="text-white font-semibold">{requiredRaise} ETH</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {step === 'config' && (
            <button
              onClick={handleApprove}
              disabled={isApproving}
              className="btn-primary w-full"
            >
              {isApproving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4" />
                  1. Approve Tokens
                </>
              )}
            </button>
          )}

          {(step === 'approve' || isApproveSuccess) && !isActivateSuccess && (
            <button
              onClick={handleActivate}
              disabled={!isApproveSuccess || isActivating || isActivateConfirming}
              className="btn-primary w-full"
            >
              {isActivating || isActivateConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  2. Launch CCA
                </>
              )}
            </button>
          )}

          {isApproveSuccess && !isActivateSuccess && (
            <div className="flex items-center gap-2 text-green-500 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Tokens approved! Now click "Launch CCA"
            </div>
          )}
        </div>
      </motion.div>

      {/* Warning */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-4 border-orange-500/20"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-surface-400">
            <p className="font-semibold text-orange-400 mb-1">Important</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>CCA will run for 7 days</li>
              <li>You'll need to complete the auction after it ends</li>
              <li>Your tokens will be locked during the auction</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

