import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits, parseUnits, erc20Abi } from 'viem'
import {
  TrendingUp,
  Gift,
  Flame,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  ExternalLink,
  Users,
  Coins,
  Zap,
  Trophy,
} from 'lucide-react'
import { AKITA, CONTRACTS } from '../config/contracts'
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
  const { address: vaultAddress } = useParams()
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
          <TokenImage
            tokenAddress={tokenAddress as `0x${string}`}
            symbol="AKITA"
            size="lg"
            className="w-16 h-16"
            fallbackColor="from-orange-500 to-red-600"
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
          <p className="stat-value text-green-400">42.0%</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-surface-400">
            <Trophy className="w-4 h-4" />
            <span className="stat-label">Global Jackpot</span>
          </div>
          <p className="stat-value text-yellow-400">0.1 ETH</p>
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
                <span className="text-brand-400 font-medium">wsAKITA</span>
                <span className="text-surface-500 ml-2">(~1:1)</span>
              </>
            ) : (
              <>
                <span className="text-brand-400 font-medium">wsAKITA</span>
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
              className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm text-center"
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
              <span className="font-mono text-brand-400">{formatAmount(wsAkitaBalance)}</span>
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
                className="h-full bg-gradient-to-r from-brand-500 to-brand-400"
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

      {/* Buy-To-Win Lottery Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="glass-card p-6"
      >
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Buy-To-Win Lottery
          <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-medium">
            Chainlink VRF
          </span>
        </h3>
        
        <p className="text-surface-400 text-sm mb-4">
          Every <span className="text-white font-medium">BUY</span> of wsAKITA on Uniswap V4 is an entry to win! 
          The 6.9% trade fee (on buys AND sells) funds the prize pool shared across all Creator Vaults.
          Winners selected randomly via Chainlink VRF v2.5.
        </p>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span className="font-medium">90% Jackpot</span>
            </div>
            <p className="text-surface-400 text-sm">
              Random VRF draw. Buy wsAKITA = lottery entry!
            </p>
          </div>
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-5 h-5 text-red-500" />
              <span className="font-medium">5% Burn</span>
            </div>
            <p className="text-surface-400 text-sm">
              Permanently removed. Deflationary across all vaults.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-5 h-5 text-brand-500" />
              <span className="font-medium">5% Protocol</span>
            </div>
            <p className="text-surface-400 text-sm">
              Sustains CreatorVault development.
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-surface-900/50 text-center">
          <p className="text-surface-500 text-xs uppercase tracking-wider mb-1">How to enter</p>
          <p className="text-surface-300 text-sm">
            Simply <span className="text-brand-400 font-medium">BUY wsAKITA</span> on Uniswap after CCA graduation. Every purchase is an entry!
          </p>
        </div>
      </motion.div>
    </div>
  )
}
