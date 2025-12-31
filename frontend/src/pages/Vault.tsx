import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits, parseUnits, erc20Abi, type Address } from 'viem'
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
import { CcaAuctionPanel } from '@/components/cca/CcaAuctionPanel'

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
    name: 'getAuctionStatus',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'auction', type: 'address' },
      { name: 'isActive', type: 'bool' },
      { name: 'isGraduated', type: 'bool' },
      { name: 'clearingPrice', type: 'uint256' },
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
    functionName: 'getAuctionStatus',
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

  const isAuctionActive = auctionStatus?.[1] || false

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
    <div className="relative pb-24 md:pb-0">
      {/* Particle atmosphere */}
      <div className="particles">
        <div className="absolute top-1/3 right-1/4 w-px h-px bg-amber-500 rounded-full" style={{ animation: 'particle-float 10s ease-in-out infinite' }} />
      </div>

      {/* Header */}
      <section className="cinematic-section">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 sm:gap-8"
          >
            <div className="flex items-center gap-4 sm:gap-6">
              <TokenImage
                tokenAddress={tokenAddress as `0x${string}`}
                // Show the creator coin icon, and use the vault bezel to communicate "vault form".
                symbol="AKITA"
                size="2xl"
                fallbackColor="from-orange-500 to-red-600"
                isWrapped={true}
              />
              <div>
                <span className="label mb-2 block">Creator Vault</span>
                <h1 className="headline text-4xl sm:text-6xl">AKITA</h1>
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
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-center gap-4">
                <Clock className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="status-active mb-2">
                    <span className="label text-cyan-400">CCA Auction Active</span>
                  </div>
                  <p className="text-zinc-500 text-sm font-light">Get wsAKITA before anyone else</p>
                </div>
              </div>
              <Link to={`/auction/bid/${ccaStrategy}`} className="btn-accent w-full sm:w-auto text-center">
                Join Auction <ArrowDownToLine className="w-4 h-4 inline ml-2" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      <section className="cinematic-section bg-zinc-950/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-900">
            <div className="bg-black p-5 sm:p-8 space-y-3 sm:space-y-4">
              <span className="label">Total Supply</span>
              <div className="value mono text-2xl sm:text-3xl">
                {totalWsAkita ? formatAmount(totalWsAkita) : '...'}
              </div>
            </div>
            <div className="bg-black p-5 sm:p-8 space-y-3 sm:space-y-4">
              <span className="label">APY</span>
              <div className="value mono text-2xl sm:text-3xl glow-cyan">42.0%</div>
            </div>
            <div className="bg-black p-5 sm:p-8 space-y-3 sm:space-y-4">
              <span className="label">Global Jackpot</span>
              <div className="value mono text-2xl sm:text-3xl glow-purple">0.1 ETH</div>
            </div>
            <div className="bg-black p-5 sm:p-8 space-y-3 sm:space-y-4">
              <span className="label">Trade Fee</span>
              <div className="value mono text-2xl sm:text-3xl">6.9%</div>
            </div>
          </div>

          <div className="mt-10">
            <CcaAuctionPanel
              ccaStrategy={ccaStrategy as Address}
              wsSymbol="wsAKITA"
              vaultAddress={AKITA.vault as Address}
            />
          </div>
        </div>
      </section>

      {/* Deposit/Withdraw */}
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-10 sm:mb-16"
          >
            <span className="label">Vault Operations</span>
            <h2 className="headline text-3xl sm:text-5xl mt-4 sm:mt-6">Manage Position</h2>
          </motion.div>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-3 space-y-10 sm:space-y-12">
              {/* Mode Selector */}
              <div className="flex gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 sm:py-4 transition-all duration-300 ${
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

              {/* Amount Input */}
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
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
                    className="label text-zinc-600 hover:text-cyan-400 transition-colors text-left sm:text-right"
                  >
                    Max: {activeTab === 'Deposit'
                      ? formatAmount(tokenBalance || 0n)
                      : formatAmount(wsAkitaBalance || 0n)}
                  </button>
                </div>
                
                <div className="card p-5 sm:p-8">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="input-field w-full text-4xl sm:text-5xl font-light text-center"
                  />
                  <div className="mt-4 text-center">
                    <span className="label">{activeTab === 'Deposit' ? 'AKITA' : 'wsAKITA'}</span>
                  </div>
                </div>

                {amount && (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-4 border-y border-zinc-900/50">
                    <span className="label">You Will Receive</span>
                    <div className="value mono text-lg sm:text-xl glow-cyan sm:text-right whitespace-nowrap">
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
                  className="btn-accent w-full py-4 sm:py-5 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="btn-accent w-full py-4 sm:py-5 disabled:opacity-50 disabled:cursor-not-allowed"
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
                
                <div className="card p-5 sm:p-8 space-y-8">
                  <div>
                    <span className="label block mb-4">Vault Token</span>
                    <div className="value mono text-3xl sm:text-4xl glow-cyan mb-2">
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
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
