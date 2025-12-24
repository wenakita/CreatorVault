import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits, parseUnits, erc20Abi } from 'viem'
import {
  TrendingUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  ExternalLink,
  Users,
  Coins,
  Trophy,
  Zap,
} from 'lucide-react'
import { AKITA } from '../config/contracts'
import { ConnectButton } from '../components/ConnectButton'
import { TokenImage } from '../components/TokenImage'

// Wrapper ABI - users deposit AKITA, get wsAKITA directly
const WRAPPER_ABI = [
  { name: 'deposit', type: 'function', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { name: 'withdraw', type: 'function', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
] as const

// wsAKITA (ShareOFT) - what users hold
const SHARE_OFT_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'totalSupply', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const

const tabs = ['Deposit', 'Withdraw'] as const
type TabType = typeof tabs[number]

export function Vault() {
  const { address: userAddress, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<TabType>('Deposit')
  const [amount, setAmount] = useState('')

  // Use AKITA config - wrapper handles everything
  const tokenAddress = AKITA.token
  const wrapperAddress = AKITA.wrapper
  const shareOFTAddress = AKITA.shareOFT

  // Read user's AKITA balance (for deposits)
  const { data: tokenBalance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: { enabled: !!userAddress },
  })

  // Read user's wsAKITA balance (for withdrawals)
  const { data: wsAkitaBalance } = useReadContract({
    address: shareOFTAddress as `0x${string}`,
    abi: SHARE_OFT_ABI,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: { enabled: !!userAddress },
  })

  // Read total wsAKITA supply
  const { data: totalWsAkita } = useReadContract({
    address: shareOFTAddress as `0x${string}`,
    abi: SHARE_OFT_ABI,
    functionName: 'totalSupply',
  })

  // Check AKITA allowance for wrapper
  const { data: tokenAllowance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [userAddress!, wrapperAddress as `0x${string}`],
    query: { enabled: !!userAddress },
  })

  // Write functions
  const { writeContract: approve, data: approveTxHash, isPending: isApproving } = useWriteContract()
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({ hash: approveTxHash })

  const { writeContract: deposit, data: depositTxHash, isPending: isDepositing } = useWriteContract()
  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositTxHash })

  const { writeContract: withdraw, data: withdrawTxHash, isPending: isWithdrawing } = useWriteContract()
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawTxHash })

  const needsApproval = tokenAllowance !== undefined && 
    parseUnits(amount || '0', 18) > tokenAllowance

  const handleApprove = () => {
    approve({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'approve',
      args: [wrapperAddress as `0x${string}`, parseUnits(amount || '0', 18)],
    })
  }

  // Deposit AKITA → get wsAKITA (wrapper handles sAKITA internally)
  const handleDeposit = () => {
    if (!userAddress) return
    deposit({
      address: wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: 'deposit',
      args: [parseUnits(amount || '0', 18)],
    })
  }

  // Withdraw wsAKITA → get AKITA (wrapper handles sAKITA internally)
  const handleWithdraw = () => {
    if (!userAddress) return
    withdraw({
      address: wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: 'withdraw',
      args: [parseUnits(amount || '0', 18)],
    })
  }

  const formatAmount = (value: bigint | undefined, decimals = 18) => {
    if (!value) return '0'
    return Number(formatUnits(value, decimals)).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          {/* wsToken - token deposited in Base vault */}
          <TokenImage
            tokenAddress={tokenAddress as `0x${string}`}
            symbol="wsAKITA"
            size="lg"
            fallbackColor="from-orange-500 to-red-600"
            isWrapped={true}
          />
          <div>
            <h1 className="font-display text-2xl font-bold">AKITA Vault</h1>
            <p className="text-surface-400">AKITA → wsAKITA • Base</p>
          </div>
        </div>
        <a
          href={`https://basescan.org/address/${wrapperAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          View on Basescan
        </a>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        <div className="stat-card">
          <div className="flex items-center gap-2 text-surface-400">
            <Coins className="w-4 h-4" />
            <span className="stat-label">Total wsAKITA</span>
          </div>
          <p className="stat-value">{formatAmount(totalWsAkita)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-surface-400">
            <TrendingUp className="w-4 h-4" />
            <span className="stat-label">APY</span>
          </div>
          <p className="stat-value text-brand-500">42.0%</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-surface-400">
            <Trophy className="w-4 h-4" />
            <span className="stat-label">Global Jackpot</span>
          </div>
          <p className="stat-value text-brand-500">0.1 ETH</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-surface-400">
            <Zap className="w-4 h-4" />
            <span className="stat-label">Trade Fee</span>
          </div>
          <p className="stat-value">6.9%</p>
        </div>
      </motion.div>

      <div className="grid sm:grid-cols-5 gap-6">
        {/* Deposit/Withdraw Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="sm:col-span-3 glass-card p-6 space-y-6"
        >
          {/* Tabs */}
          <div className="flex gap-2 p-1 rounded-lg bg-surface-900/50">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-brand-500 text-white'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                {tab === 'Deposit' ? (
                  <span className="flex items-center justify-center gap-2">
                    <ArrowDownToLine className="w-4 h-4" /> Deposit AKITA
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <ArrowUpFromLine className="w-4 h-4" /> Withdraw
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Flow indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-surface-400 bg-surface-900/30 rounded-lg py-2">
            {activeTab === 'Deposit' ? (
              <>
                <span className="text-white font-medium">AKITA</span>
                <span>→</span>
                <span className="text-brand-500 font-medium">wsAKITA</span>
                <span className="text-surface-500 ml-2">(~1:1)</span>
              </>
            ) : (
              <>
                <span className="text-brand-500 font-medium">wsAKITA</span>
                <span>→</span>
                <span className="text-white font-medium">AKITA</span>
              </>
            )}
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-surface-400">Amount</span>
              <span className="text-surface-400">
                Balance:{' '}
                <button
                  onClick={() =>
                    setAmount(
                      activeTab === 'Deposit'
                        ? formatUnits(tokenBalance || 0n, 18)
                        : formatUnits(wsAkitaBalance || 0n, 18)
                    )
                  }
                  className="text-brand-500 hover:text-brand-400"
                >
                  {activeTab === 'Deposit'
                    ? formatAmount(tokenBalance)
                    : formatAmount(wsAkitaBalance)}{' '}
                  {activeTab === 'Deposit' ? 'AKITA' : 'wsAKITA'}
                </button>
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="input-field pr-20 text-xl font-semibold"
              />
              <button
                onClick={() =>
                  setAmount(
                    activeTab === 'Deposit'
                      ? formatUnits(tokenBalance || 0n, 18)
                      : formatUnits(wsAkitaBalance || 0n, 18)
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-brand-500/10 text-brand-500 text-sm font-medium hover:bg-brand-500/20 transition-colors"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Action Button */}
          {!isConnected ? (
            <ConnectButton />
          ) : activeTab === 'Deposit' ? (
            needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={isApproving || isApproveConfirming}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isApproving || isApproveConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  'Approve AKITA'
                )}
              </button>
            ) : (
              <button
                onClick={handleDeposit}
                disabled={isDepositing || isDepositConfirming || !amount}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isDepositing || isDepositConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Depositing...
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="w-4 h-4" />
                    Deposit AKITA → wsAKITA
                  </>
                )}
              </button>
            )
          ) : (
            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || isWithdrawConfirming || !amount}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isWithdrawing || isWithdrawConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Withdrawing...
                </>
              ) : (
                <>
                  <ArrowUpFromLine className="w-4 h-4" />
                  Withdraw wsAKITA → AKITA
                </>
              )}
            </button>
          )}

          {/* Success messages */}
          {(isDepositSuccess || isWithdrawSuccess) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-500 text-sm text-center"
            >
              ✓ Transaction successful!
            </motion.div>
          )}
        </motion.div>

        {/* Your Position */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="sm:col-span-2 glass-card p-6 space-y-4"
        >
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-500" />
            Your Position
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-surface-400">AKITA Balance</span>
              <span className="font-mono">{formatAmount(tokenBalance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">wsAKITA Balance</span>
              <span className="font-mono text-brand-500">{formatAmount(wsAkitaBalance)}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-surface-800">
            <div className="flex justify-between mb-2">
              <span className="text-surface-400 text-sm">Pool Share</span>
              <span className="text-sm">
                {wsAkitaBalance && totalWsAkita && totalWsAkita > 0n
                  ? ((Number(wsAkitaBalance) / Number(totalWsAkita)) * 100).toFixed(4)
                  : '0'}
                %
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
              <motion.div
                className="h-full bg-brand-500"
                initial={{ width: 0 }}
                animate={{
                  width: `${
                    wsAkitaBalance && totalWsAkita && totalWsAkita > 0n
                      ? Math.min((Number(wsAkitaBalance) / Number(totalWsAkita)) * 100, 100)
                      : 0
                  }%`,
                }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Buy-To-Win Lottery Info with Distribution Chart */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="glass-card p-6 space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-500" />
            CCA Auction Strategy
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500 text-xs font-medium">
            7-day fair launch
          </span>
        </div>

        {/* Timeline Visualization */}
        <div className="relative p-6 rounded-2xl bg-gradient-to-br from-brand-500/10 via-purple-500/5 to-transparent border border-brand-500/20">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Day 1</span>
              <span>Day 7</span>
            </div>
            
            {/* Progress Bar */}
            <div className="relative h-3 rounded-full bg-slate-900/50 overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-500 to-purple-500 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: '35%' }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white/80">Auction in Progress</span>
              </div>
            </div>

            {/* Current Status */}
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-slate-500 text-xs">Current Bids</p>
                <p className="text-white font-bold">12 participants</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 text-xs">Total Raised</p>
                <p className="text-brand-400 font-bold">0.124 ETH</p>
              </div>
            </div>
          </div>
        </div>

        {/* How Bidding Works */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">How Bidding Works</p>
          
          {/* Example Bids */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-bold text-green-400">
                  1
                </div>
                <div>
                  <p className="text-xs text-green-300 font-medium">Highest Bid</p>
                  <p className="text-[10px] text-green-400/60">Will win tokens</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">0.05 ETH</p>
                <p className="text-xs text-slate-400">per 1000 AKITA</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-400">
                  2
                </div>
                <div>
                  <p className="text-xs text-brand-300 font-medium">Mid Bid</p>
                  <p className="text-[10px] text-brand-400/60">Competitive</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">0.03 ETH</p>
                <p className="text-xs text-slate-400">per 1000 AKITA</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-700/10 border border-slate-700/20">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-700/20 flex items-center justify-center text-xs font-bold text-slate-400">
                  3
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Low Bid</p>
                  <p className="text-[10px] text-slate-500">Might not win</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">0.01 ETH</p>
                <p className="text-xs text-slate-400">per 1000 AKITA</p>
              </div>
            </div>
          </div>

          {/* Explainer */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-xs text-slate-400 leading-relaxed">
              💡 Bids are ranked by price. When the auction ends, highest bidders get tokens at the <span className="text-white font-medium">clearing price</span> (lowest winning bid). Everyone pays the same fair price.
            </p>
          </div>
        </div>

        {/* Token Allocation */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">Token Allocation</p>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
                <Trophy className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-white mb-1">50%</p>
              <p className="text-xs text-purple-300">To Auction</p>
              <p className="text-[10px] text-slate-500 mt-1">For bidders</p>
            </div>

            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center mx-auto mb-2">
                <Users className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-2xl font-bold text-white mb-1">50%</p>
              <p className="text-xs text-green-300">To Vault</p>
              <p className="text-[10px] text-slate-500 mt-1">For deposits</p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="pt-4 border-t border-white/5 space-y-2">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Why CCA?</p>
          <div className="grid sm:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2 text-green-400">
              <span>✓</span>
              <span>No bot snipers</span>
            </div>
            <div className="flex items-center gap-2 text-green-400">
              <span>✓</span>
              <span>Fair pricing</span>
            </div>
            <div className="flex items-center gap-2 text-green-400">
              <span>✓</span>
              <span>Community first</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
