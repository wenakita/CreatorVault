import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import type { Address } from 'viem'
import { formatUnits, isAddress, parseEther, parseEventLogs } from 'viem'

import { ConnectButton } from '@/components/ConnectButton'
import {
  MAX_UINT128,
  Q96,
  applyBps,
  currencyPerTokenBaseUnitsToQ96,
  mulDiv,
  q96ToCurrencyPerTokenBaseUnits,
} from '@/lib/cca/q96'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

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
    query: { refetchInterval: 12_000 },
  })

  const { data: currencyAddress } = useReadContract({
    address: ccaStrategy,
    abi: CCA_LAUNCH_STRATEGY_ABI,
    functionName: 'currency',
    query: { refetchInterval: 60_000 },
  })

  const { data: auctionTokenAddress } = useReadContract({
    address: ccaStrategy,
    abi: CCA_LAUNCH_STRATEGY_ABI,
    functionName: 'auctionToken',
    query: { refetchInterval: 60_000 },
  })

  const { data: tokenDecimalsRaw } = useReadContract({
    address: (auctionTokenAddress && isAddress(auctionTokenAddress) ? auctionTokenAddress : ZERO_ADDRESS) as Address,
    abi: ERC20_VIEW_ABI,
    functionName: 'decimals',
    query: { enabled: !!auctionTokenAddress && auctionTokenAddress !== ZERO_ADDRESS, refetchInterval: 60_000 },
  })

  const { data: tokenSymbolRaw } = useReadContract({
    address: (auctionTokenAddress && isAddress(auctionTokenAddress) ? auctionTokenAddress : ZERO_ADDRESS) as Address,
    abi: ERC20_VIEW_ABI,
    functionName: 'symbol',
    query: { enabled: !!auctionTokenAddress && auctionTokenAddress !== ZERO_ADDRESS, refetchInterval: 60_000 },
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

  return (
    <div className="card p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <span className="label block mb-2">Continuous Clearing Auction</span>
          <h3 className="headline text-2xl sm:text-3xl">{tokenSymbol} Price Discovery</h3>
          <p className="text-zinc-600 text-sm font-light mt-2 flex items-center gap-2">
            <span>
              Powered by{' '}
              <a
                href="https://cca.uniswap.org"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 decoration-cyan-400/30 hover:decoration-cyan-300/40 transition-colors"
              >
                Uniswap Continuous Clearing Auction
              </a>
              . Clearing price updates as bids arrive; bids are spread over time.
            </span>
            <img
              src="/protocols/uniswap.png"
              alt="Uniswap"
              width={16}
              height={16}
              className="w-4 h-4 object-contain"
              loading="lazy"
            />
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/auction/bid/${ccaStrategy}`} className="btn-secondary text-sm">
            Open full auction
          </Link>
          {isGraduated && (
            <Link to={`/complete-auction/${ccaStrategy}`} className="btn-primary text-sm">
              Complete auction
            </Link>
          )}
        </div>
      </div>

      {/* Status + metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-black/40 border border-white/5 rounded-xl p-4">
          <div className="label mb-2">Status</div>
          <div className="value">
            {!hasAuction ? (
              <span className="text-zinc-500">Not launched</span>
            ) : isGraduated ? (
              <span className="text-green-400">Graduated</span>
            ) : isActive ? (
              <span className="text-cyan-400">Live</span>
            ) : (
              <span className="text-zinc-500">Inactive</span>
            )}
          </div>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-xl p-4">
          <div className="label mb-2">Clearing price</div>
          <div className="value mono text-lg sm:text-xl">
            {clearingPriceText} ETH
            <span className="text-zinc-600 text-xs font-light ml-2">per {wsSymbol}</span>
          </div>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-xl p-4">
          <div className="label mb-2">Raised</div>
          <div className="value mono text-lg sm:text-xl">{formatEth(currencyRaised, 4)} ETH</div>
        </div>
      </div>

      {/* Connection / bidding */}
      {!isConnected ? (
        <div className="bg-black/40 border border-white/5 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="label mb-1">Connect to bid</div>
            <div className="text-zinc-600 text-sm">Connect your wallet to participate in this auction.</div>
          </div>
          <ConnectButton />
        </div>
      ) : (
        <div className="space-y-4">
          {!hasAuction && (
            <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-zinc-600 text-sm">
              No active auction contract yet.
            </div>
          )}

          {hasAuction && !isEthAuction && (
            <div className="bg-black/40 border border-amber-500/20 rounded-xl p-4 text-amber-200 text-sm">
              This auction raises an ERC-20 currency. The embedded UI currently supports ETH auctions only.
            </div>
          )}

          {hasAuction && isActive && isEthAuction && (
            <div className="bg-black/40 border border-white/5 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="label mb-1">Place a bid</div>
                  <div className="text-zinc-600 text-sm">
                    Simple mode sets your max price to <span className="mono">{maxPriceText} ETH</span> ({mode === 'simple' ? '120%' : 'custom'}).
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className={mode === 'simple' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
                    onClick={() => setMode('simple')}
                    type="button"
                  >
                    Simple
                  </button>
                  <button
                    className={mode === 'advanced' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
                    onClick={() => setMode('advanced')}
                    type="button"
                  >
                    Advanced
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="label">Spend (ETH)</div>
                  <input
                    value={spendEth}
                    onChange={(e) => setSpendEth(e.target.value)}
                    placeholder="0.05"
                    className="input-field w-full"
                    inputMode="decimal"
                  />
                  {spendParseError && <div className="text-xs text-red-300">{spendParseError}</div>}
                </div>

                <div className="space-y-2">
                  <div className="label">Estimated {wsSymbol}</div>
                  <div className="bg-black/60 border border-white/5 rounded-md px-4 py-3">
                    <div className="value mono text-lg">{estTokensText ? `~${estTokensText}` : '—'}</div>
                    <div className="text-zinc-600 text-xs font-light">
                      Uses current clearing price ({clearingPriceText} ETH / {wsSymbol})
                    </div>
                  </div>
                </div>
              </div>

              {mode === 'advanced' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="label">Max price (ETH per {wsSymbol})</div>
                    <input
                      value={maxPriceEthPerToken}
                      onChange={(e) => setMaxPriceEthPerToken(e.target.value)}
                      placeholder={clearingPriceText}
                      className="input-field w-full"
                      inputMode="decimal"
                    />
                    {maxPriceParseError && <div className="text-xs text-amber-200">{maxPriceParseError}</div>}
                    {!maxPriceOk && !!clearingPriceQ96 && !!maxPriceQ96 && (
                      <div className="text-xs text-red-300">Max price must be above the clearing price.</div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="label">Max price (effective)</div>
                    <div className="bg-black/60 border border-white/5 rounded-md px-4 py-3">
                      <div className="value mono text-lg">{maxPriceText} ETH</div>
                      <div className="text-zinc-600 text-xs font-light">
                        Stored onchain as Q96 fixed-point (per Uniswap CCA).
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleBid}
                disabled={!canBid || isBidPending || isBidConfirming}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                {isBidPending || isBidConfirming ? 'Submitting…' : 'Submit bid'}
              </button>

              {(localError || bidError) && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-200 text-sm">
                  {localError ?? bidError?.message}
                </div>
              )}

              {bidTxHash && (
                <div className="text-xs text-zinc-500">
                  Tx:{' '}
                  <a
                    href={`https://basescan.org/tx/${bidTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline"
                  >
                    view on BaseScan
                  </a>
                  {bidSuccess && bidId ? <span className="ml-3">Bid ID: <span className="mono">{bidId}</span></span> : null}
                </div>
              )}
            </div>
          )}

          {hasAuction && isGraduated && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-green-200 text-sm">
              Auction has graduated. You can now sweep funds, configure fees, and complete launch.
              <span className="ml-2">
                <Link to={`/complete-auction/${ccaStrategy}`} className="text-green-200 underline">
                  Complete auction →
                </Link>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Footer details */}
      <div className="text-[11px] text-zinc-600 font-mono">
        Strategy: {ccaStrategy}
        {vaultAddress ? <span className="ml-3">Vault: {vaultAddress}</span> : null}
        {hasAuction ? <span className="ml-3">Auction: {auctionAddress}</span> : null}
      </div>
    </div>
  )
}
