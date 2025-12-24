import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits, parseUnits, erc20Abi } from 'viem'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  ExternalLink,
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

      {/* Fee Mechanism */}
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16"
          >
            <span className="label">Fee Architecture</span>
            <h2 className="headline text-5xl mt-6">How Earnings Work</h2>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Liquidity Pool */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="card p-8 space-y-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="label block mb-4">Trading Pair</span>
                  <div className="headline text-3xl mb-2">wsAKITA/ETH</div>
                  <p className="text-zinc-600 text-sm font-light">Uniswap V3 Liquidity Pool</p>
                </div>
                <div className="text-right">
                  <span className="label block mb-2">Fee Tier</span>
                  <div className="value mono text-2xl">1%</div>
                </div>
              </div>

              <div className="h-px bg-zinc-900" />

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 font-light">Trading Volume</span>
                  <div className="value mono text-sm">Real-time</div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 font-light">LP Rewards</span>
                  <div className="value mono text-sm text-cyan-400">Auto-compound</div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 font-light">Your Share</span>
                  <div className="value mono text-sm text-cyan-400">Proportional</div>
                </div>
              </div>
            </motion.div>

            {/* Fee Distribution */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="card p-8 space-y-6"
            >
              <div>
                <span className="label block mb-4">Buy & Sell Fees</span>
                <div className="headline text-3xl mb-2">6.9% Total</div>
                <p className="text-zinc-600 text-sm font-light">Applied on every trade</p>
              </div>

              <div className="h-px bg-zinc-900" />

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 font-light">To Jackpot</span>
                  <div className="value mono text-sm glow-purple">69%</div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 font-light">Burned</span>
                  <div className="value mono text-sm glow-amber">21.4%</div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 font-light">To Treasury</span>
                  <div className="value mono text-sm">9.6%</div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Flow Diagram */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8"
          >
            <div className="card p-10">
              <span className="label block mb-8">Fee Flow</span>
              
              <div className="space-y-0">
                <div className="data-row group">
                  <div className="flex items-center gap-6">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    </div>
                    <div>
                      <span className="label block mb-1">Trade Executed</span>
                      <p className="text-zinc-600 text-sm font-light">User buys or sells wsAKITA</p>
                    </div>
                  </div>
                  <div className="value mono text-xl">6.9%</div>
                </div>

                <div className="data-row group">
                  <div className="flex items-center gap-6">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-purple-400" />
                    </div>
                    <div>
                      <span className="label block mb-1">Jackpot Funded</span>
                      <p className="text-zinc-600 text-sm font-light">Largest portion goes to global prize pool</p>
                    </div>
                  </div>
                  <div className="value mono text-xl glow-purple">4.8%</div>
                </div>

                <div className="data-row group">
                  <div className="flex items-center gap-6">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                    </div>
                    <div>
                      <span className="label block mb-1">Tokens Burned</span>
                      <p className="text-zinc-600 text-sm font-light">Deflationary mechanism increases value</p>
                    </div>
                  </div>
                  <div className="value mono text-xl glow-amber">1.5%</div>
                </div>

                <div className="data-row border-none group">
                  <div className="flex items-center gap-6">
                    <div className="w-8 h-8 rounded-full bg-zinc-800/50 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-zinc-600" />
                    </div>
                    <div>
                      <span className="label block mb-1">Treasury</span>
                      <p className="text-zinc-600 text-sm font-light">Protocol development and sustainability</p>
                    </div>
                  </div>
                  <div className="value mono text-xl">0.6%</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Deposit/Withdraw */}
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-16"
          >
            <span className="label">Vault Operations</span>
            <h2 className="headline text-5xl mt-6">Manage Position</h2>
          </motion.div>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-3 space-y-12">
              {/* Mode Selector */}
              <div className="flex gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-4 transition-all duration-300 ${
                      activeTab === tab
                        ? 'card bg-zinc-950/50'
                        : 'bg-transparent border border-transparent text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-3">
                      {tab === 'Deposit' ? (
                        <ArrowDownToLine className="w-4 h-4" />
                      ) : (
                        <ArrowUpFromLine className="w-4 h-4" />
                      )}
                      <span className="label">{tab}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Flow Indicator */}
              <div className="card p-8">
                <span className="label block mb-6">Transaction Flow</span>
                <div className="flex items-center justify-between">
                  {activeTab === 'Deposit' ? (
                    <>
                      <div className="text-center">
                        <div className="value mono text-3xl mb-2">AKITA</div>
                        <span className="label">Input Token</span>
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                        <div className="h-px w-full bg-gradient-to-r from-zinc-800 via-cyan-500 to-zinc-800" />
                        <ArrowDownToLine className="w-5 h-5 text-cyan-400 mx-4" />
                        <div className="h-px w-full bg-gradient-to-r from-zinc-800 via-cyan-500 to-zinc-800" />
                      </div>
                      <div className="text-center">
                        <div className="value mono text-3xl mb-2 glow-cyan">wsAKITA</div>
                        <span className="label text-cyan-400">Vault Token</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-center">
                        <div className="value mono text-3xl mb-2 glow-cyan">wsAKITA</div>
                        <span className="label text-cyan-400">Vault Token</span>
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                        <div className="h-px w-full bg-gradient-to-r from-zinc-800 via-purple-500 to-zinc-800" />
                        <ArrowUpFromLine className="w-5 h-5 text-purple-400 mx-4" />
                        <div className="h-px w-full bg-gradient-to-r from-zinc-800 via-purple-500 to-zinc-800" />
                      </div>
                      <div className="text-center">
                        <div className="value mono text-3xl mb-2">AKITA</div>
                        <span className="label">Output Token</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-6 pt-6 border-t border-zinc-900">
                  <div className="flex justify-between items-center">
                    <span className="label">Exchange Rate</span>
                    <div className="value mono">~1:1</div>
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="label block mb-2">Amount</span>
                    <p className="text-zinc-600 text-xs font-light">Enter the amount to {activeTab.toLowerCase()}</p>
                  </div>
                  <button
                    onClick={() =>
                      setAmount(
                        activeTab === 'Deposit'
                          ? formatUnits(tokenBalance || 0n, 18)
                          : formatUnits(wsAkitaBalance || 0n, 18)
                      )
                    }
                    className="label text-zinc-600 hover:text-cyan-400 transition-colors"
                  >
                    Max: {activeTab === 'Deposit'
                      ? formatAmount(tokenBalance || 0n)
                      : formatAmount(wsAkitaBalance || 0n)}
                  </button>
                </div>
                
                <div className="card p-8">
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="input-field w-full text-5xl font-light text-center"
                  />
                  <div className="mt-4 text-center">
                    <span className="label">{activeTab === 'Deposit' ? 'AKITA' : 'wsAKITA'}</span>
                  </div>
                </div>

                {amount && (
                  <div className="flex justify-between items-center py-4 border-y border-zinc-900/50">
                    <span className="label">You Will Receive</span>
                    <div className="value mono text-xl glow-cyan">
                      {amount} {activeTab === 'Deposit' ? 'wsAKITA' : 'AKITA'}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              {!isConnected ? (
                <div className="space-y-4">
                  <span className="label block">Connect Required</span>
                  <ConnectButton />
                </div>
              ) : needsApproval ? (
                <button
                  onClick={handleApprove}
                  disabled={isApproving || !amount}
                  className="btn-accent w-full py-5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      <span className="label">Approving Token...</span>
                    </>
                  ) : (
                    <>
                      <span className="label">Approve AKITA</span>
                      <span className="text-xs text-zinc-600 block mt-1">Step 1 of 2</span>
                    </>
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
                  className="btn-accent w-full py-5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {((activeTab === 'Deposit' && isDepositing) ||
                    (activeTab === 'Withdraw' && isWithdrawing)) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      <span className="label">Processing...</span>
                    </>
                  ) : (
                    <>
                      <span className="label">{activeTab}</span>
                      <span className="text-xs text-zinc-600 block mt-1">Confirm transaction in wallet</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Position Panel */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <span className="label mb-6 block">Your Holdings</span>
                
                <div className="card p-8 space-y-8">
                  <div>
                    <span className="label block mb-4">Vault Token</span>
                    <div className="value mono text-4xl glow-cyan mb-2">
                      {formatAmount(wsAkitaBalance || 0n)}
                    </div>
                    <span className="label text-cyan-400">wsAKITA</span>
                  </div>
                  
                  <div className="h-px bg-zinc-900" />
                  
                  <div>
                    <span className="label block mb-4">Creator Token</span>
                    <div className="value mono text-2xl mb-2">
                      {formatAmount(tokenBalance || 0n)}
                    </div>
                    <span className="label">AKITA</span>
                  </div>
                </div>
              </div>

              {/* Info Card */}
              <div className="card p-8 space-y-4">
                <span className="label">Exchange Info</span>
                <div className="space-y-4 pt-4">
                  <div className="flex justify-between">
                    <span className="text-xs text-zinc-600 font-light">Rate</span>
                    <span className="text-xs text-zinc-400 mono">1:1</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-zinc-600 font-light">Gas Fee</span>
                    <span className="text-xs text-zinc-400 mono">Network</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-zinc-600 font-light">Processing</span>
                    <span className="text-xs text-zinc-400 mono">Instant</span>
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
