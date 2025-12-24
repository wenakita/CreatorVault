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
  Coins,
  Trophy,
  Zap,
  Clock,
} from 'lucide-react'
import { AKITA } from '../config/contracts'
import { ConnectButton } from '../components/ConnectButton'
import { TokenImage } from '../components/TokenImage'
import { Link } from 'react-router-dom'

// Wrapper ABI
const WRAPPER_ABI = [
  { name: 'deposit', type: 'function', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { name: 'withdraw', type: 'function', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
] as const

// ShareOFT ABI
const SHARE_OFT_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'totalSupply', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const

// CCA Strategy ABI
const CCA_STRATEGY_ABI = [
  {
    name: 'auctionStatus',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'isActive', type: 'bool' },
      { name: 'isGraduated', type: 'bool' },
      { name: 'bidCount', type: 'uint256' },
      { name: 'tokensSold', type: 'uint256' },
      { name: 'currencyRaised', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const

const tabs = ['Deposit', 'Withdraw'] as const
type TabType = typeof tabs[number]

export function Vault() {
  const { address: userAddress, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<TabType>('Deposit')
  const [amount, setAmount] = useState('')

  const tokenAddress = AKITA.token
  const wrapperAddress = AKITA.wrapper
  const shareOFTAddress = AKITA.shareOFT
  const ccaStrategy = AKITA.ccaStrategy

  // Read balances
  const { data: tokenBalance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: { enabled: !!userAddress },
  })

  const { data: wsAkitaBalance } = useReadContract({
    address: shareOFTAddress as `0x${string}`,
    abi: SHARE_OFT_ABI,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: { enabled: !!userAddress },
  })

  const { data: totalWsAkita } = useReadContract({
    address: shareOFTAddress as `0x${string}`,
    abi: SHARE_OFT_ABI,
    functionName: 'totalSupply',
  })

  const { data: auctionStatus } = useReadContract({
    address: ccaStrategy as `0x${string}`,
    abi: CCA_STRATEGY_ABI,
    functionName: 'auctionStatus',
  })

  const { data: tokenAllowance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [userAddress!, wrapperAddress as `0x${string}`],
    query: { enabled: !!userAddress && activeTab === 'Deposit' },
  })

  // Write contracts
  const { writeContract: writeApprove, data: approveHash } = useWriteContract()
  const { writeContract: writeDeposit, data: depositHash } = useWriteContract()
  const { writeContract: writeWithdraw, data: withdrawHash } = useWriteContract()

  const { isLoading: isApproving } = useWaitForTransactionReceipt({ hash: approveHash })
  const { isLoading: isDepositing } = useWaitForTransactionReceipt({ hash: depositHash })
  const { isLoading: isWithdrawing } = useWaitForTransactionReceipt({ hash: withdrawHash })

  const isAuctionActive = auctionStatus?.[0] || false

  const formatAmount = (value: bigint, decimals: number = 18) => {
    if (!value) return '0'
    return Number(formatUnits(value, decimals)).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    })
  }

  const handleApprove = () => {
    if (!amount || !tokenAddress || !wrapperAddress) return
    writeApprove({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'approve',
      args: [wrapperAddress as `0x${string}`, parseUnits(amount, 18)],
    })
  }

  const handleDeposit = () => {
    if (!amount || !wrapperAddress) return
    writeDeposit({
      address: wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: 'deposit',
      args: [parseUnits(amount, 18)],
    })
  }

  const handleWithdraw = () => {
    if (!amount || !wrapperAddress) return
    writeWithdraw({
      address: wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: 'withdraw',
      args: [parseUnits(amount, 18)],
    })
  }

  const needsApproval = activeTab === 'Deposit' && (!tokenAllowance || tokenAllowance < parseUnits(amount || '0', 18))

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <TokenImage
            tokenAddress={tokenAddress as `0x${string}`}
            symbol="wsAKITA"
            size="lg"
            fallbackColor="from-orange-500 to-red-600"
            isWrapped={true}
          />
          <div>
            <h1 className="text-3xl font-bold">AKITA Vault</h1>
            <p className="text-zinc-500 text-sm">AKITA → wsAKITA</p>
          </div>
        </div>
        <a
          href={`https://basescan.org/address/${wrapperAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <ExternalLink className="w-4 h-4" />
          Basescan
        </a>
      </motion.div>

      {/* Auction Status */}
      {isAuctionActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="font-semibold text-blue-400">CCA Auction Active</h3>
                <p className="text-sm text-zinc-400">Get wsAKITA before anyone else</p>
              </div>
            </div>
            <Link to={`/auction/${wrapperAddress}`} className="btn-primary">
              Join Auction
            </Link>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-zinc-500" />
            <span className="text-xs text-zinc-500">Total Supply</span>
          </div>
          <div className="text-xl font-semibold">
            {totalWsAkita ? formatAmount(totalWsAkita) : '...'}
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-zinc-500">APY</span>
          </div>
          <div className="text-xl font-semibold text-blue-500">42.0%</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-zinc-500" />
            <span className="text-xs text-zinc-500">Jackpot</span>
          </div>
          <div className="text-xl font-semibold">0.1 ETH</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-zinc-500" />
            <span className="text-xs text-zinc-500">Trade Fee</span>
          </div>
          <div className="text-xl font-semibold">6.9%</div>
        </div>
      </motion.div>

      {/* Main Section */}
      <div className="grid sm:grid-cols-3 gap-6">
        {/* Deposit/Withdraw */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="sm:col-span-2 card p-6 space-y-6"
        >
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-zinc-950 rounded-lg border border-zinc-900">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-blue-500 text-white'
                    : 'text-zinc-400 hover:text-white'
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

          {/* Flow */}
          <div className="flex items-center justify-center gap-2 text-sm bg-zinc-950 rounded-lg py-3 border border-zinc-900">
            {activeTab === 'Deposit' ? (
              <>
                <span className="font-medium">AKITA</span>
                <span className="text-zinc-600">→</span>
                <span className="font-medium text-blue-500">wsAKITA</span>
              </>
            ) : (
              <>
                <span className="font-medium text-blue-500">wsAKITA</span>
                <span className="text-zinc-600">→</span>
                <span className="font-medium">AKITA</span>
              </>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Amount</span>
              <button
                onClick={() =>
                  setAmount(
                    activeTab === 'Deposit'
                      ? formatUnits(tokenBalance || 0n, 18)
                      : formatUnits(wsAkitaBalance || 0n, 18)
                  )
                }
                className="text-blue-500 hover:text-blue-400"
              >
                Balance: {' '}
                {activeTab === 'Deposit'
                  ? formatAmount(tokenBalance || 0n)
                  : formatAmount(wsAkitaBalance || 0n)}
              </button>
            </div>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="input-field w-full text-2xl"
            />
          </div>

          {/* Action Button */}
          {!isConnected ? (
            <ConnectButton />
          ) : needsApproval ? (
            <button
              onClick={handleApprove}
              disabled={isApproving || !amount}
              className="btn-primary w-full disabled:opacity-50"
            >
              {isApproving ? (
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
              onClick={activeTab === 'Deposit' ? handleDeposit : handleWithdraw}
              disabled={
                (activeTab === 'Deposit' && isDepositing) ||
                (activeTab === 'Withdraw' && isWithdrawing) ||
                !amount
              }
              className="btn-primary w-full disabled:opacity-50"
            >
              {((activeTab === 'Deposit' && isDepositing) ||
                (activeTab === 'Withdraw' && isWithdrawing)) ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {activeTab === 'Deposit' ? 'Depositing...' : 'Withdrawing...'}
                </>
              ) : (
                activeTab
              )}
            </button>
          )}
        </motion.div>

        {/* Your Position */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6 space-y-6"
        >
          <h3 className="font-semibold">Your Position</h3>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm text-zinc-500 mb-1">wsAKITA Balance</div>
              <div className="text-2xl font-bold">
                {formatAmount(wsAkitaBalance || 0n)}
              </div>
            </div>
            
            <div className="border-t border-zinc-900 pt-4">
              <div className="text-sm text-zinc-500 mb-1">AKITA Balance</div>
              <div className="text-lg font-semibold">
                {formatAmount(tokenBalance || 0n)}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
