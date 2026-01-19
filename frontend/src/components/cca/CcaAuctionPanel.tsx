import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import type { Address } from 'viem'
import { formatUnits, isAddress, parseEther, parseEventLogs } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'

import { ConnectButton } from '@/components/ConnectButton'
import {
  MAX_UINT128,
  Q96,
  applyBps,
  currencyPerTokenBaseUnitsToQ96,
  mulDiv,
  q96ToCurrencyPerTokenBaseUnits,
} from '@/lib/cca/q96'

const addr = (hexWithout0x: string) => `0x${hexWithout0x}` as Address
const ZERO_ADDRESS = addr('0000000000000000000000000000000000000000')

// CCALaunchStrategy (minimal)
const CCA_LAUNCH_STRATEGY_ABI = [
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
  { name: 'currency', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { name: 'auctionToken', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
] as const

const ERC20_VIEW_ABI = [
  { name: 'decimals', type: 'function', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { name: 'symbol', type: 'function', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
] as const

// Uniswap CCA auction (bid + event only). Using the 4-arg overload (no tick hint).
const CCA_AUCTION_ABI = [
  {
    name: 'submitBid',
    type: 'function',
    inputs: [
      { name: 'maxPrice', type: 'uint256' },
      { name: 'amount', type: 'uint128' },
      { name: 'owner', type: 'address' },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [{ name: 'bidId', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'event',
    name: 'BidSubmitted',
    inputs: [
      { indexed: true, name: 'id', type: 'uint256' },
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: false, name: 'price', type: 'uint256' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    anonymous: false,
  },
] as const

function trimDecimals(value: string, maxDecimals: number): string {
  const [a, b] = value.split('.')
  if (!b) return value
  return `${a}.${b.slice(0, maxDecimals)}`
}

function formatEth(wei: bigint, maxDecimals: number = 6): string {
  return trimDecimals(formatUnits(wei, 18), maxDecimals)
}

export function CcaAuctionPanel({
  ccaStrategy,
  wsSymbol,
  vaultAddress,
}: {
  ccaStrategy: Address
  wsSymbol: string
  vaultAddress?: Address
}) {
  const { isConnected, address } = useAccount()
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')
  const [spendEth, setSpendEth] = useState('')
  const [maxPriceEthPerToken, setMaxPriceEthPerToken] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const { data: auctionStatus } = useReadContract({
    address: ccaStrategy,
    abi: CCA_LAUNCH_STRATEGY_ABI,
    functionName: 'getAuctionStatus',
    query: { 
      refetchInterval: 30_000, // Reduced from 12s to 30s (still feels real-time)
      // Only refetch when tab is visible
      refetchIntervalInBackground: false,
    },
  })

  const { data: currencyAddress } = useReadContract({
    address: ccaStrategy,
    abi: CCA_LAUNCH_STRATEGY_ABI,
    functionName: 'currency',
    query: { 
      // These are immutable contract values - cache indefinitely
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  })

  const { data: auctionTokenAddress } = useReadContract({
    address: ccaStrategy,
    abi: CCA_LAUNCH_STRATEGY_ABI,
    functionName: 'auctionToken',
    query: { 
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  })

  const { data: tokenDecimalsRaw } = useReadContract({
    address: (auctionTokenAddress && isAddress(auctionTokenAddress) ? auctionTokenAddress : ZERO_ADDRESS) as Address,
    abi: ERC20_VIEW_ABI,
    functionName: 'decimals',
    query: { 
      enabled: !!auctionTokenAddress && auctionTokenAddress !== ZERO_ADDRESS, 
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  })

  const { data: tokenSymbolRaw } = useReadContract({
    address: (auctionTokenAddress && isAddress(auctionTokenAddress) ? auctionTokenAddress : ZERO_ADDRESS) as Address,
    abi: ERC20_VIEW_ABI,
    functionName: 'symbol',
    query: { 
      enabled: !!auctionTokenAddress && auctionTokenAddress !== ZERO_ADDRESS, 
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  })

  const tokenDecimals = typeof tokenDecimalsRaw === 'number' ? tokenDecimalsRaw : Number(tokenDecimalsRaw ?? 18)
  const tokenSymbol = typeof tokenSymbolRaw === 'string' && tokenSymbolRaw.trim().length > 0 ? tokenSymbolRaw : wsSymbol

  const auctionAddress = (auctionStatus?.[0] ?? ZERO_ADDRESS) as Address
  const isActive = Boolean(auctionStatus?.[1] ?? false)
  const isGraduated = Boolean(auctionStatus?.[2] ?? false)
  const clearingPriceQ96 = (auctionStatus?.[3] ?? 0n) as bigint
  const currencyRaised = (auctionStatus?.[4] ?? 0n) as bigint

  const isEthAuction = (currencyAddress ?? ZERO_ADDRESS) === ZERO_ADDRESS
  const hasAuction = auctionAddress !== ZERO_ADDRESS

  const clearingPriceWeiPerToken = useMemo(() => {
    if (!clearingPriceQ96) return 0n
    return q96ToCurrencyPerTokenBaseUnits(clearingPriceQ96, tokenDecimals)
  }, [clearingPriceQ96, tokenDecimals])

  const [spendWei, spendParseError] = useMemo((): [bigint, string | null] => {
    if (!spendEth || spendEth.trim().length === 0) return [0n, null]
    try {
      return [parseEther(spendEth), null]
    } catch (e: any) {
      return [0n, e?.message ?? 'Invalid ETH amount']
    }
  }, [spendEth])

  const [maxPriceQ96, maxPriceParseError] = useMemo((): [bigint, string | null] => {
    if (!clearingPriceQ96) return [0n, null]

    const fallback = applyBps(clearingPriceQ96, 12_000) // 120%

    if (mode !== 'advanced' || !maxPriceEthPerToken.trim()) {
      return [fallback, null]
    }

    try {
      const weiPerToken = parseEther(maxPriceEthPerToken)
      const q = currencyPerTokenBaseUnitsToQ96(weiPerToken, tokenDecimals)
      return [q, null]
    } catch (e: any) {
      return [fallback, e?.message ?? 'Invalid max price']
    }
  }, [clearingPriceQ96, maxPriceEthPerToken, mode, tokenDecimals])

  const maxPriceOk = useMemo(() => {
    if (!clearingPriceQ96 || !maxPriceQ96) return false
    return maxPriceQ96 > clearingPriceQ96
  }, [clearingPriceQ96, maxPriceQ96])

  const estTokensBaseUnits = useMemo(() => {
    if (!spendWei || !clearingPriceQ96) return 0n
    return mulDiv(spendWei, Q96, clearingPriceQ96)
  }, [spendWei, clearingPriceQ96])

  const estTokensText = useMemo(() => {
    if (!estTokensBaseUnits) return null
    const raw = formatUnits(estTokensBaseUnits, tokenDecimals)
    return trimDecimals(raw, 2)
  }, [estTokensBaseUnits, tokenDecimals])

  const maxPriceText = useMemo(() => {
    if (!maxPriceQ96) return '—'
    const weiPerToken = q96ToCurrencyPerTokenBaseUnits(maxPriceQ96, tokenDecimals)
    return formatEth(weiPerToken, 6)
  }, [maxPriceQ96, tokenDecimals])

  const clearingPriceText = useMemo(() => {
    if (!clearingPriceWeiPerToken) return '—'
    return formatEth(clearingPriceWeiPerToken, 6)
  }, [clearingPriceWeiPerToken])

  const canBid =
    isConnected &&
    !!address &&
    hasAuction &&
    isActive &&
    isEthAuction &&
    spendWei > 0n &&
    spendWei <= MAX_UINT128 &&
    !!clearingPriceQ96 &&
    !!maxPriceQ96 &&
    maxPriceOk &&
    !spendParseError

  const { writeContract: submitBid, data: bidTxHash, error: bidError, isPending: isBidPending } = useWriteContract()
  const { data: bidReceipt, isLoading: isBidConfirming, isSuccess: bidSuccess } = useWaitForTransactionReceipt({
    hash: bidTxHash,
  })

  const bidId = useMemo(() => {
    if (!bidReceipt?.logs || !address) return null
    try {
      const logs = parseEventLogs({
        abi: CCA_AUCTION_ABI,
        logs: bidReceipt.logs,
        eventName: 'BidSubmitted',
        strict: false,
      })
      const mine = logs.find((l) => String(l.args.owner).toLowerCase() === address.toLowerCase())
      return mine?.args?.id?.toString?.() ?? null
    } catch {
      return null
    }
  }, [bidReceipt?.logs, address])

  const handleBid = () => {
    setLocalError(null)
    if (!isConnected || !address) return
    if (!hasAuction) return
    if (!isActive) return
    if (!isEthAuction) {
      setLocalError('This auction raises an ERC-20 currency. ETH bidding UI is not enabled yet.')
      return
    }
    if (spendParseError) {
      setLocalError(spendParseError)
      return
    }
    if (!spendWei || spendWei <= 0n) return
    if (spendWei > MAX_UINT128) {
      setLocalError('Bid amount too large (uint128 overflow).')
      return
    }
    if (!clearingPriceQ96 || !maxPriceQ96) return
    if (maxPriceQ96 <= clearingPriceQ96) {
      setLocalError('Max price must be above the current clearing price.')
      return
    }

    submitBid({
      address: auctionAddress,
      abi: CCA_AUCTION_ABI,
      functionName: 'submitBid',
      args: [maxPriceQ96, spendWei, address, '0x'],
      value: spendWei,
    })
  }

  // Animation state for real-time updates
  const [priceUpdating, setPriceUpdating] = useState(false)
  useEffect(() => {
    setPriceUpdating(true)
    const timer = setTimeout(() => setPriceUpdating(false), 800)
    return () => clearTimeout(timer)
  }, [clearingPriceQ96])

  return (
    <div className="card p-0 overflow-hidden">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-cyan-950/20 via-black/40 to-black/40 border-b border-white/5 p-6 sm:p-8">
        {/* Animated background particles for live auctions */}
        {isActive && (
          <div className="absolute inset-0 overflow-hidden opacity-20">
            <motion.div
              className="absolute w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"
              animate={{
                x: [0, 100, 0],
                y: [0, 50, 0],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          </div>
        )}

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="label">Continuous Clearing Auction</span>
              {/* Live status badge */}
              {isActive && (
                <motion.div 
                  className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-3 py-1"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div 
                    className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                    animate={{ 
                      boxShadow: [
                        '0 0 4px rgba(34, 211, 238, 0.6)',
                        '0 0 12px rgba(34, 211, 238, 0.8)',
                        '0 0 4px rgba(34, 211, 238, 0.6)',
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-[10px] uppercase tracking-wider text-cyan-400 font-medium">Live</span>
                </motion.div>
              )}
              {isGraduated && (
                <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-[10px] uppercase tracking-wider text-green-400 font-medium">Graduated</span>
                </div>
              )}
            </div>
            
            <h3 className="headline text-3xl sm:text-4xl mb-3">{tokenSymbol} Price Discovery</h3>
            
            <div className="flex items-center gap-2 text-zinc-600 text-sm font-light">
              <img
                src="/protocols/uniswap.png"
                alt="Uniswap"
                width={18}
                height={18}
                className="w-[18px] h-[18px] object-contain opacity-60"
                loading="lazy"
              />
              <span>
                Powered by{' '}
                <a
                  href="https://cca.uniswap.org"
                  target="_blank"
                  rel="noreferrer"
                  className="text-uniswap hover:text-uniswap/90 underline underline-offset-4 decoration-uniswap/30 hover:decoration-uniswap/40 transition-colors"
                >
                  Uniswap CCA
                </a>
              </span>
            </div>
            
            <p className="text-zinc-500 text-xs font-light mt-2 max-w-2xl">
              Continuous price discovery mechanism. Clearing price updates in real-time as bids arrive. 
              Bids are spread over time to reduce manipulation and ensure fair price discovery.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link 
              to="/auction-demo"
              className="btn-primary text-sm whitespace-nowrap hover:scale-105 transition-transform"
            >
              View Demo
            </Link>
            {isGraduated && (
              <Link 
                to={`/complete-auction/${ccaStrategy}`} 
                className="bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 px-6 py-3 text-sm transition-all duration-300 font-light tracking-wide whitespace-nowrap hover:scale-105"
              >
                Complete auction
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/5">
        {/* Status */}
        <motion.div 
          className="bg-black/60 p-6 group hover:bg-black/80 transition-colors"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <div className="label mb-3">Auction Status</div>
          <div className="value text-2xl">
            {!hasAuction ? (
              <span className="text-zinc-500">Not Launched</span>
            ) : isGraduated ? (
              <span className="text-green-400">Graduated ✓</span>
            ) : isActive ? (
              <span className="text-cyan-400 glow-cyan">Active</span>
            ) : (
              <span className="text-zinc-500">Inactive</span>
            )}
          </div>
        </motion.div>

        {/* Clearing Price */}
        <motion.div 
          className="bg-black/60 p-6 group hover:bg-black/80 transition-colors relative overflow-hidden"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          {/* Price update indicator */}
          <AnimatePresence>
            {priceUpdating && (
              <motion.div
                className="absolute inset-0 bg-cyan-500/5"
                initial={{ opacity: 0, x: '-100%' }}
                animate={{ opacity: [0, 1, 0], x: ['0%', '100%'] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
              />
            )}
          </AnimatePresence>
          
          <div className="label mb-3 flex items-center gap-2">
            Clearing Price
            {isActive && (
              <motion.span 
                className="text-[8px] text-cyan-400"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                LIVE
              </motion.span>
            )}
          </div>
          <div className="value mono text-2xl sm:text-3xl relative z-10">
            <motion.span
              key={clearingPriceText}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {clearingPriceText}
            </motion.span>
            <span className="text-zinc-400 text-base ml-2">ETH</span>
          </div>
          <div className="text-zinc-600 text-xs font-light mt-1">per {wsSymbol}</div>
        </motion.div>

        {/* Raised Amount */}
        <motion.div 
          className="bg-black/60 p-6 group hover:bg-black/80 transition-colors"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <div className="label mb-3">Total Raised</div>
          <div className="value mono text-2xl sm:text-3xl">
            <motion.span
              key={currencyRaised.toString()}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {formatEth(currencyRaised, 3)}
            </motion.span>
            <span className="text-zinc-400 text-base ml-2">ETH</span>
          </div>
          {currencyRaised > 0n && (
            <div className="text-zinc-600 text-xs font-light mt-1">
              ≈ ${(Number(formatEth(currencyRaised, 2)) * 3500).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
            </div>
          )}
        </motion.div>
      </div>

      {/* Bidding Interface */}
      <div className="p-6 sm:p-8">
        {!isConnected ? (
          <motion.div 
            className="bg-gradient-to-br from-cyan-950/10 to-black/40 border border-cyan-500/20 rounded-xl p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <h4 className="headline text-xl mb-2">Connect to Participate</h4>
                <p className="text-zinc-500 text-sm">
                  Connect your wallet to place bids and participate in price discovery.
                </p>
              </div>
              <ConnectButton />
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Pre-launch state */}
            {!hasAuction && (
              <motion.div 
                className="bg-black/40 border border-zinc-800 rounded-xl p-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="text-zinc-500 text-sm">
                  <div className="w-12 h-12 border-2 border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">⏳</span>
                  </div>
                  Auction not yet launched. Check back soon.
                </div>
              </motion.div>
            )}

            {/* ERC20 currency warning */}
            {hasAuction && !isEthAuction && (
              <motion.div 
                className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">⚠️</div>
                  <div>
                    <h4 className="text-amber-200 font-medium mb-1">ERC-20 Currency Auction</h4>
                    <p className="text-amber-200/80 text-sm">
                      This auction raises an ERC-20 currency. The embedded UI currently supports ETH auctions only.
                      Please use the full auction interface.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Active bidding interface */}
            {hasAuction && isActive && isEthAuction && (
              <motion.div 
                className="bg-gradient-to-br from-black/60 to-black/40 border border-white/10 rounded-xl overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                {/* Mode selector */}
                <div className="bg-black/40 border-b border-white/5 p-5 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="label mb-1.5">Place Your Bid</h4>
                    <p className="text-zinc-600 text-xs">
                      {mode === 'simple' 
                        ? 'Simple mode auto-sets max price to 120% of current clearing price'
                        : 'Advanced mode lets you set a custom max price'
                      }
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <motion.button
                      className={`px-4 py-2 text-xs font-medium tracking-wide transition-all ${
                        mode === 'simple'
                          ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                          : 'bg-transparent border border-zinc-800 text-zinc-500 hover:text-zinc-300'
                      }`}
                      onClick={() => setMode('simple')}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Simple
                    </motion.button>
                    <motion.button
                      className={`px-4 py-2 text-xs font-medium tracking-wide transition-all ${
                        mode === 'advanced'
                          ? 'bg-brand-primary/20 border border-brand-primary/40 text-brand-300'
                          : 'bg-transparent border border-zinc-800 text-zinc-500 hover:text-zinc-300'
                      }`}
                      onClick={() => setMode('advanced')}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Advanced
                    </motion.button>
                  </div>
                </div>

                {/* Bid form */}
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Amount input */}
                    <div className="space-y-2">
                      <label className="label flex items-center justify-between">
                        <span>Amount to Spend</span>
                        <span className="text-[9px] text-zinc-600">ETH</span>
                      </label>
                      <div className="relative">
                        <input
                          value={spendEth}
                          onChange={(e) => {
                            setSpendEth(e.target.value)
                            setLocalError(null)
                          }}
                          placeholder="0.05"
                          className="bg-black/60 border border-white/10 focus:border-cyan-500/50 text-white text-xl px-4 py-4 w-full transition-colors font-mono focus:outline-none"
                          inputMode="decimal"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">
                          ETH
                        </div>
                      </div>
                      <AnimatePresence mode="wait">
                        {spendParseError && (
                          <motion.div 
                            className="text-xs text-red-400 flex items-center gap-1.5"
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                          >
                            <span>⚠</span>
                            <span>{spendParseError}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Estimated tokens */}
                    <div className="space-y-2">
                      <label className="label flex items-center justify-between">
                        <span>You'll Receive (Est.)</span>
                        <span className="text-[9px] text-zinc-600">{wsSymbol}</span>
                      </label>
                      <div className="bg-black/80 border border-white/5 rounded-lg p-4 h-[72px] flex flex-col justify-center">
                        <AnimatePresence mode="wait">
                          {estTokensText ? (
                            <motion.div
                              key={estTokensText}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className="value mono text-2xl text-cyan-400"
                            >
                              ≈ {estTokensText}
                            </motion.div>
                          ) : (
                            <div className="value mono text-2xl text-zinc-700">—</div>
                          )}
                        </AnimatePresence>
                        <div className="text-zinc-600 text-[10px] font-light mt-1">
                          at {clearingPriceText} ETH per {wsSymbol}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Advanced mode: custom max price */}
                  <AnimatePresence>
                    {mode === 'advanced' && (
                      <motion.div 
                        className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-4 border-t border-white/5"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="space-y-2">
                          <label className="label flex items-center justify-between">
                            <span>Max Price (ETH per {wsSymbol})</span>
                            <span className="text-[9px] text-brand-400">CUSTOM</span>
                          </label>
                          <div className="relative">
                            <input
                              value={maxPriceEthPerToken}
                              onChange={(e) => {
                                setMaxPriceEthPerToken(e.target.value)
                                setLocalError(null)
                              }}
                              placeholder={clearingPriceText}
                              className="bg-black/60 border border-brand-primary/20 focus:border-brand-primary/50 text-white text-xl px-4 py-4 w-full transition-colors font-mono focus:outline-none"
                              inputMode="decimal"
                            />
                          </div>
                          <AnimatePresence mode="wait">
                            {maxPriceParseError && (
                              <motion.div 
                                className="text-xs text-amber-300 flex items-center gap-1.5"
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                              >
                                <span>⚠</span>
                                <span>{maxPriceParseError}</span>
                              </motion.div>
                            )}
                            {!maxPriceOk && !!clearingPriceQ96 && !!maxPriceQ96 && !maxPriceParseError && (
                              <motion.div 
                                className="text-xs text-red-400 flex items-center gap-1.5"
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                              >
                                <span>✗</span>
                                <span>Max price must exceed clearing price</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="space-y-2">
                          <label className="label">Effective Max Price</label>
                          <div className="bg-black/80 border border-white/5 rounded-lg p-4 h-[72px] flex flex-col justify-center">
                            <div className="value mono text-2xl text-brand-400">
                              {maxPriceText} ETH
                            </div>
                            <div className="text-zinc-600 text-[10px] font-light mt-1">
                              Q96 fixed-point (Uniswap CCA standard)
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit button */}
                  <motion.button
                    onClick={handleBid}
                    disabled={!canBid || isBidPending || isBidConfirming}
                    className={`w-full py-4 text-lg font-light tracking-wide transition-all ${
                      canBid && !isBidPending && !isBidConfirming
                        ? 'bg-cyan-500/20 border-2 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/30 hover:border-cyan-400/60'
                        : 'bg-zinc-900/50 border-2 border-zinc-800 text-zinc-600 cursor-not-allowed'
                    }`}
                    type="button"
                    whileHover={canBid ? { scale: 1.02 } : {}}
                    whileTap={canBid ? { scale: 0.98 } : {}}
                  >
                    {isBidPending || isBidConfirming ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          ⟳
                        </motion.span>
                        Submitting bid...
                      </span>
                    ) : (
                      'Submit Bid'
                    )}
                  </motion.button>

                  {/* Error display */}
                  <AnimatePresence mode="wait">
                    {(localError || bidError) && (
                      <motion.div 
                        className="bg-red-500/10 border border-red-500/30 rounded-lg p-4"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-red-400 text-lg">⚠</span>
                          <div className="text-red-200 text-sm flex-1">
                            {localError ?? bidError?.message}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Success feedback */}
                  <AnimatePresence mode="wait">
                    {bidTxHash && (
                      <motion.div 
                        className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-cyan-400 text-lg">{bidSuccess ? '✓' : '⟳'}</span>
                          <div className="flex-1">
                            <div className="text-cyan-200 text-sm mb-2">
                              {bidSuccess ? 'Bid submitted successfully!' : 'Transaction pending...'}
                            </div>
                            <div className="text-xs text-cyan-400/60 font-mono">
                              <a
                                href={`https://basescan.org/tx/${bidTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-cyan-400 transition-colors underline"
                              >
                                View on BaseScan ↗
                              </a>
                              {bidSuccess && bidId && (
                                <span className="ml-4">Bid ID: {bidId}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* Graduated state */}
            {hasAuction && isGraduated && (
              <motion.div 
                className="bg-gradient-to-br from-green-950/20 to-black/40 border border-green-500/30 rounded-xl p-6"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl">🎉</div>
                  <div className="flex-1">
                    <h4 className="text-green-300 font-medium text-lg mb-2">Auction Graduated!</h4>
                    <p className="text-green-200/80 text-sm mb-4">
                      This auction has successfully graduated. You can now sweep funds, configure fees, and complete the launch process.
                    </p>
                    <Link 
                      to={`/complete-auction/${ccaStrategy}`} 
                      className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30 px-6 py-2.5 text-sm transition-all font-light tracking-wide"
                    >
                      Complete Auction
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Technical Details Footer */}
      <div className="border-t border-white/5 bg-black/20 px-6 py-4">
        <details className="group">
          <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-zinc-600 hover:text-zinc-500 transition-colors flex items-center gap-2 select-none">
            <motion.span
              animate={{ rotate: 0 }}
              className="group-open:rotate-90 transition-transform inline-block"
            >
              ▸
            </motion.span>
            Technical Details
          </summary>
          <motion.div 
            className="mt-4 space-y-2 text-[11px] font-mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-between py-1.5 border-b border-white/5">
              <span className="text-zinc-600">Strategy Contract</span>
              <a 
                href={`https://basescan.org/address/${ccaStrategy}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {ccaStrategy.slice(0, 6)}...{ccaStrategy.slice(-4)}
              </a>
            </div>
            {vaultAddress && (
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-zinc-600">Vault Address</span>
                <a 
                  href={`https://basescan.org/address/${vaultAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {vaultAddress.slice(0, 6)}...{vaultAddress.slice(-4)}
                </a>
              </div>
            )}
            {hasAuction && auctionAddress !== ZERO_ADDRESS && (
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-zinc-600">Auction Contract</span>
                <a 
                  href={`https://basescan.org/address/${auctionAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {auctionAddress.slice(0, 6)}...{auctionAddress.slice(-4)}
                </a>
              </div>
            )}
            {auctionTokenAddress && auctionTokenAddress !== ZERO_ADDRESS && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-zinc-600">Token Address</span>
                <a 
                  href={`https://basescan.org/address/${auctionTokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {auctionTokenAddress.slice(0, 6)}...{auctionTokenAddress.slice(-4)}
                </a>
              </div>
            )}
          </motion.div>
        </details>
      </div>
    </div>
  )
}
