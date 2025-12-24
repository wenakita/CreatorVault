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

// ABIs
const WRAPPER_ABI = [
  { name: 'deposit', type: 'function', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { name: 'withdraw', type: 'function', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
] as const

const SHARE_OFT_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'totalSupply', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const

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
    <div className="relative">
      {/* Particle atmosphere */}
      <div className="particles">
        <div className="absolute top-1/3 right-1/4 w-px h-px bg-amber-500 rounded-full" style={{ animation: 'particle-float 10s ease-in-out infinite' }} />
      </div>

      {/* Header */}
      <section className="cinematic-section">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8"
          >
            <div className="flex items-center gap-6">
              <TokenImage
                tokenAddress={tokenAddress as `0x${string}`}
                symbol="wsAKITA"
                size="lg"
                fallbackColor="from-orange-500 to-red-600"
                isWrapped={true}
              />
              <div>
                <span className="label mb-2 block">Creator Vault</span>
                <h1 className="headline text-6xl">AKITA</h1>
                <p className="text-zinc-600 text-sm mono mt-2">AKITA → wsAKITA</p>
              </div>
            </div>
            <a
              href={`https://basescan.org/address/${wrapperAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <span className="label">View Contract</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Auction Banner */}
      {isAuctionActive && (
        <section className="border-y border-cyan-500/20 bg-cyan-500/5">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <Clock className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="status-active mb-2">
                    <span className="label text-cyan-400">CCA Auction Active</span>
                  </div>
                  <p className="text-zinc-500 text-sm font-light">Get wsAKITA before anyone else</p>
                </div>
              </div>
              <Link to={`/auction/${wrapperAddress}`} className="btn-accent">
                Join Auction <ArrowDownToLine className="w-4 h-4 inline ml-2" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      <section className="cinematic-section bg-zinc-950/20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-900">
            <div className="bg-black p-8 space-y-4">
              <span className="label">Total Supply</span>
              <div className="value mono text-3xl">
                {totalWsAkita ? formatAmount(totalWsAkita) : '...'}
              </div>
            </div>
            <div className="bg-black p-8 space-y-4">
              <span className="label">APY</span>
              <div className="value mono text-3xl glow-cyan">42.0%</div>
            </div>
            <div className="bg-black p-8 space-y-4">
              <span className="label">Global Jackpot</span>
              <div className="value mono text-3xl glow-purple">0.1 ETH</div>
            </div>
            <div className="bg-black p-8 space-y-4">
              <span className="label">Trade Fee</span>
              <div className="value mono text-3xl">6.9%</div>
            </div>
          </div>
        </div>
      </section>

      {/* Deposit/Withdraw */}
      <section className="cinematic-section">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-8">
              {/* Tabs */}
              <div className="flex gap-4 border-b border-zinc-900">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 transition-colors ${
                      activeTab === tab
                        ? 'text-white border-b-2 border-white'
                        : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    <span className="label">{tab}</span>
                  </button>
                ))}
              </div>

              {/* Flow */}
              <div className="flex items-center justify-center gap-4 py-6 border-y border-zinc-900/50">
                {activeTab === 'Deposit' ? (
                  <>
                    <span className="value mono">AKITA</span>
                    <ArrowDownToLine className="w-4 h-4 text-zinc-600" />
                    <span className="value mono text-cyan-400">wsAKITA</span>
                  </>
                ) : (
                  <>
                    <span className="value mono text-cyan-400">wsAKITA</span>
                    <ArrowUpFromLine className="w-4 h-4 text-zinc-600" />
                    <span className="value mono">AKITA</span>
                  </>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="label">Amount</span>
                  <button
                    onClick={() =>
                      setAmount(
                        activeTab === 'Deposit'
                          ? formatUnits(tokenBalance || 0n, 18)
                          : formatUnits(wsAkitaBalance || 0n, 18)
                      )
                    }
                    className="label text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    Balance: {activeTab === 'Deposit'
                      ? formatAmount(tokenBalance || 0n)
                      : formatAmount(wsAkitaBalance || 0n)}
                  </button>
                </div>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="input-field w-full text-4xl font-light"
                />
              </div>

              {/* Action */}
              {!isConnected ? (
                <ConnectButton />
              ) : needsApproval ? (
                <button
                  onClick={handleApprove}
                  disabled={isApproving || !amount}
                  className="btn-accent w-full disabled:opacity-50"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
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
                  className="btn-accent w-full disabled:opacity-50"
                >
                  {((activeTab === 'Deposit' && isDepositing) ||
                    (activeTab === 'Withdraw' && isWithdrawing)) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      {activeTab === 'Deposit' ? 'Depositing...' : 'Withdrawing...'}
                    </>
                  ) : (
                    activeTab
                  )}
                </button>
              )}
            </div>

            {/* Position */}
            <div className="space-y-8">
              <div>
                <span className="label mb-6 block">Your Position</span>
                
                <div className="space-y-6">
                  <div className="data-row">
                    <span className="label">wsAKITA Balance</span>
                    <div className="value mono text-xl">
                      {formatAmount(wsAkitaBalance || 0n)}
                    </div>
                  </div>
                  
                  <div className="data-row border-none">
                    <span className="label">AKITA Balance</span>
                    <div className="value mono">
                      {formatAmount(tokenBalance || 0n)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
