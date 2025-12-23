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
  Clock,
  Users,
  Coins,
  RefreshCw,
} from 'lucide-react'
import { AKITA } from '../config/contracts'
import { ConnectButton } from '../components/ConnectButton'

// Simplified vault ABI
const VAULT_ABI = [
  { name: 'deposit', type: 'function', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { name: 'withdraw', type: 'function', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { name: 'totalAssets', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'totalSupply', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'convertToAssets', type: 'function', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const

const tabs = ['Deposit', 'Withdraw'] as const
type TabType = typeof tabs[number]

export function Vault() {
  const { address: vaultAddress } = useParams()
  const { address: userAddress, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<TabType>('Deposit')
  const [amount, setAmount] = useState('')

  // For demo, use AKITA addresses
  const vault = vaultAddress || AKITA.vault
  const tokenAddress = AKITA.token

  // Read vault data
  const { data: totalAssets } = useReadContract({
    address: vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: 'totalAssets',
  })

  const { data: userShares } = useReadContract({
    address: vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: { enabled: !!userAddress },
  })

  const { data: userAssets } = useReadContract({
    address: vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: 'convertToAssets',
    args: [userShares || 0n],
    query: { enabled: !!userShares },
  })

  const { data: tokenBalance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: { enabled: !!userAddress },
  })

  const { data: tokenAllowance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [userAddress!, vault as `0x${string}`],
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
      args: [vault as `0x${string}`, parseUnits(amount || '0', 18)],
    })
  }

  const handleDeposit = () => {
    if (!userAddress) return
    deposit({
      address: vault as `0x${string}`,
      abi: VAULT_ABI,
      functionName: 'deposit',
      args: [parseUnits(amount || '0', 18), userAddress],
    })
  }

  const handleWithdraw = () => {
    if (!userAddress) return
    withdraw({
      address: vault as `0x${string}`,
      abi: VAULT_ABI,
      functionName: 'withdraw',
      args: [parseUnits(amount || '0', 18), userAddress, userAddress],
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
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center font-display font-bold text-2xl text-white">
            A
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">AKITA Vault</h1>
            <p className="text-surface-400">sAKITA • Base</p>
          </div>
        </div>
        <a
          href={`https://basescan.org/address/${vault}`}
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
            <span className="stat-label">TVL</span>
          </div>
          <p className="stat-value">{formatAmount(totalAssets)}</p>
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
            <Gift className="w-4 h-4" />
            <span className="stat-label">Jackpot</span>
          </div>
          <p className="stat-value text-yellow-400">0.1 ETH</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-surface-400">
            <Clock className="w-4 h-4" />
            <span className="stat-label">Next Draw</span>
          </div>
          <p className="stat-value">6d 12h</p>
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
                    <ArrowDownToLine className="w-4 h-4" /> Deposit
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <ArrowUpFromLine className="w-4 h-4" /> Withdraw
                  </span>
                )}
              </button>
            ))}
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
                        : formatUnits(userAssets || 0n, 18)
                    )
                  }
                  className="text-brand-500 hover:text-brand-400"
                >
                  {activeTab === 'Deposit'
                    ? formatAmount(tokenBalance)
                    : formatAmount(userAssets)}{' '}
                  {activeTab === 'Deposit' ? 'AKITA' : 'sAKITA'}
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
                      : formatUnits(userAssets || 0n, 18)
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
                    Deposit
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
                  Withdraw
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
              <span className="text-surface-400">sAKITA Balance</span>
              <span className="font-mono">{formatAmount(userShares)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">AKITA Value</span>
              <span className="font-mono">{formatAmount(userAssets)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Lottery Tickets</span>
              <span className="font-mono">~{formatAmount(userShares)}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-surface-800">
            <div className="flex justify-between mb-2">
              <span className="text-surface-400 text-sm">Win Probability</span>
              <span className="text-sm">
                {userShares && totalAssets && totalAssets > 0n
                  ? ((Number(userShares) / Number(totalAssets)) * 100).toFixed(2)
                  : '0'}
                %
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-brand-500 to-yellow-500"
                initial={{ width: 0 }}
                animate={{
                  width: `${
                    userShares && totalAssets && totalAssets > 0n
                      ? Math.min((Number(userShares) / Number(totalAssets)) * 100, 100)
                      : 0
                  }%`,
                }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tax Distribution */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="glass-card p-6"
      >
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-brand-500" />
          6.9% Sell Tax Distribution
        </h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-5 h-5 text-yellow-500" />
              <span className="font-medium">90% Jackpot</span>
            </div>
            <p className="text-surface-400 text-sm">
              Weekly lottery for sAKITA holders. More shares = more chances.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-5 h-5 text-red-500" />
              <span className="font-medium">5% Burn</span>
            </div>
            <p className="text-surface-400 text-sm">
              Permanently removed from supply. Deflationary pressure.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-5 h-5 text-brand-500" />
              <span className="font-medium">5% Protocol</span>
            </div>
            <p className="text-surface-400 text-sm">
              Sustains platform development and operations.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

