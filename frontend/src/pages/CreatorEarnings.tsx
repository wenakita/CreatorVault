import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAccount } from 'wagmi'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { formatEther, formatUnits, isAddress } from 'viem'
import type { Address } from 'viem'

import { useZoraProfileCoins } from '@/lib/zora/hooks'
import type { ZoraCoin, ZoraEarnings, ZoraProfile } from '@/lib/zora/types'
import {
  fetchProtocolRewardsBalances,
  fetchProtocolRewardsBalancesFromApi,
  fetchProtocolRewardsWithdrawnFromApi,
} from '@/lib/onchain/protocolRewards'
import { fetchCoinTradeRewardsBatchFromApi } from '@/lib/onchain/coinTradeRewardsBatch'

function shortAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatCurrencyLabel(currencyAddress: string, poolCurrency?: { address?: string; name?: string }): string {
  const zero = '0x0000000000000000000000000000000000000000'
  if (currencyAddress.toLowerCase() === zero) return 'ETH'
  if (
    poolCurrency?.address &&
    poolCurrency.address.toLowerCase() === currencyAddress.toLowerCase() &&
    poolCurrency.name
  ) {
    return String(poolCurrency.name)
  }
  return shortAddress(currencyAddress)
}

function getProfileAvatarUrl(profile: any): string | null {
  const medium =
    profile?.avatar?.previewImage?.medium ??
    profile?.avatar?.previewImage?.small ??
    profile?.avatar?.medium ??
    profile?.avatar?.small ??
    null
  return typeof medium === 'string' && medium.length > 0 ? medium : null
}

function formatUsd(value: number): string {
  return Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

function formatAmount(value: number): string {
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value)
}

function formatUnitsCompact(raw: bigint, decimals: number): string {
  const s = formatUnits(raw, decimals)
  const n = Number(s)
  if (Number.isFinite(n)) return formatAmount(n)
  return s
}

function sumEarningsUsd(earnings?: ZoraEarnings[]): number | null {
  if (!earnings || earnings.length === 0) return null
  const nums = earnings
    .map((e) => (e.amountUsd ? Number(e.amountUsd) : NaN))
    .filter((n) => Number.isFinite(n))
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0)
}

function sumEarningsByCurrency(earnings?: ZoraEarnings[]): Array<{ currencyAddress: string; amount: number }> {
  if (!earnings || earnings.length === 0) return []
  const map = new Map<string, number>()

  for (const e of earnings) {
    const cur = e.amount?.currencyAddress
    const amt = e.amount?.amountDecimal
    if (!cur || typeof amt !== 'number' || !Number.isFinite(amt)) continue
    map.set(cur, (map.get(cur) ?? 0) + amt)
  }

  return Array.from(map.entries()).map(([currencyAddress, amount]) => ({ currencyAddress, amount }))
}

function isLikelyMissingApiRoutes(err: unknown): boolean {
  const e = err as any
  const status = typeof e?.status === 'number' ? e.status : null
  if (status === 404) return true
  const msg = typeof e?.message === 'string' ? e.message : ''
  return msg.includes('HTTP 404') || msg.includes('Unexpected token') || msg.includes('Failed to fetch')
}

export function CreatorEarnings() {
  const { identifier } = useParams()
  const navigate = useNavigate()
  const { address } = useAccount()

  const [showAdvanced, setShowAdvanced] = useState(false)

  const defaultIdentifier = identifier ?? (address ? String(address) : '')
  const [input, setInput] = useState(defaultIdentifier)

  useEffect(() => {
    setInput(defaultIdentifier)
  }, [defaultIdentifier])

  const activeIdentifier = identifier ?? (address ? String(address) : undefined)

  const {
    data: profile,
    isLoading,
    error,
  } = useZoraProfileCoins(activeIdentifier, { count: 25 })

  const createdCoins: ZoraCoin[] = useMemo(() => {
    const edges = (profile as ZoraProfile | null | undefined)?.createdCoins?.edges ?? []
    return edges.map((e) => e.node).filter(Boolean) as ZoraCoin[]
  }, [profile])

  const createdCoinRows = useMemo(() => {
    return createdCoins.map((c) => {
      const addr = c.address ? String(c.address) : ''
      return { coin: c, address: addr, isValidAddress: isAddress(addr) }
    })
  }, [createdCoins])

  const payoutRecipients = useMemo(() => {
    const set = new Set<string>()
    for (const row of createdCoinRows) {
      const pr = row.coin.payoutRecipientAddress ? String(row.coin.payoutRecipientAddress) : ''
      if (pr && isAddress(pr)) set.add(pr)
    }
    return Array.from(set).sort() as Address[]
  }, [createdCoinRows])

  const {
    data: protocolRewardsBalances,
    isLoading: protocolRewardsLoading,
    error: protocolRewardsError,
  } = useQuery({
    queryKey: ['onchain', 'protocolRewards', 'balanceOf', payoutRecipients.join(',')],
    queryFn: async () => {
      // Prefer server-side RPC (secret-safe), fall back to public client-side RPC for local dev.
      try {
        return await fetchProtocolRewardsBalancesFromApi(payoutRecipients)
      } catch {
        return await fetchProtocolRewardsBalances(payoutRecipients)
      }
    },
    enabled: payoutRecipients.length > 0,
    staleTime: 1000 * 60 * 2,
  })

  const totalClaimableWei = useMemo(() => {
    if (!protocolRewardsBalances) return null
    return Object.values(protocolRewardsBalances).reduce((a, b) => a + b, 0n)
  }, [protocolRewardsBalances])

  const {
    data: protocolRewardsWithdrawn,
    isLoading: withdrawnLoading,
    error: withdrawnError,
  } = useQuery({
    queryKey: ['onchain', 'protocolRewards', 'withdrawn', payoutRecipients.join(',')],
    queryFn: async () => fetchProtocolRewardsWithdrawnFromApi(payoutRecipients),
    enabled: payoutRecipients.length > 0,
    staleTime: 1000 * 60 * 10,
  })

  const totalWithdrawnWei = useMemo(() => {
    if (!protocolRewardsWithdrawn) return null
    return Object.values(protocolRewardsWithdrawn).reduce((a, b) => a + b, 0n)
  }, [protocolRewardsWithdrawn])

  const totalLifetimeWei = useMemo(() => {
    if (totalClaimableWei === null || totalWithdrawnWei === null) return null
    return totalClaimableWei + totalWithdrawnWei
  }, [totalClaimableWei, totalWithdrawnWei])

  const totalClaimableEthDisplay = useMemo(() => {
    if (protocolRewardsLoading) return 'Loading…'
    if (protocolRewardsError) return '—'
    if (totalClaimableWei === null) return '—'

    const eth = Number(formatEther(totalClaimableWei))
    if (!Number.isFinite(eth)) return `${formatEther(totalClaimableWei)} ETH`
    return `${formatAmount(eth)} ETH`
  }, [protocolRewardsLoading, protocolRewardsError, totalClaimableWei])

  const totalLifetimeEthDisplay = useMemo(() => {
    if (withdrawnLoading) return 'Loading…'
    if (withdrawnError) return '—'
    if (totalLifetimeWei === null) return '—'

    const eth = Number(formatEther(totalLifetimeWei))
    if (!Number.isFinite(eth)) return `${formatEther(totalLifetimeWei)} ETH`
    return `${formatAmount(eth)} ETH`
  }, [withdrawnLoading, withdrawnError, totalLifetimeWei])

  // Progressive payout-currency totals (manual compute). This avoids long “global batch” waits on slow RPCs.
  const [payoutEarnedByCoin, setPayoutEarnedByCoin] = useState<Record<string, bigint>>({})
  const [payoutComputeRunning, setPayoutComputeRunning] = useState(false)
  const [payoutComputeDone, setPayoutComputeDone] = useState(0)
  const [payoutComputeTotal, setPayoutComputeTotal] = useState(0)
  const [payoutComputeError, setPayoutComputeError] = useState<string | null>(null)
  const computeRunId = useRef(0)

  useEffect(() => {
    // Reset computed totals when switching creators.
    setPayoutEarnedByCoin({})
    setPayoutComputeRunning(false)
    setPayoutComputeDone(0)
    setPayoutComputeTotal(0)
    setPayoutComputeError(null)
    computeRunId.current++
  }, [activeIdentifier])

  const computableCoins = useMemo(() => {
    return createdCoinRows
      .filter((r) => r.isValidAddress)
      .map((r) => {
        const coin = r.coin
        const coinAddr = r.address as Address
        const recipientRaw = coin.payoutRecipientAddress ? String(coin.payoutRecipientAddress) : ''
        const currencyRaw = coin.poolCurrencyToken?.address ? String(coin.poolCurrencyToken.address) : ''
        const createdAtRaw = coin.createdAt ? String(coin.createdAt) : ''
        const createdAtSeconds = createdAtRaw ? Math.floor(Date.parse(createdAtRaw) / 1000) : undefined
        return {
          coinAddr,
          payoutRecipient: isAddress(recipientRaw) ? (recipientRaw as Address) : null,
          currency: isAddress(currencyRaw) ? (currencyRaw as Address) : null,
          createdAtSeconds,
        }
      })
      .filter((x) => !!x.payoutRecipient && !!x.currency) as Array<{
      coinAddr: Address
      payoutRecipient: Address
      currency: Address
      createdAtSeconds?: number
    }>
  }, [createdCoinRows])

  const coinEarnedNeedVercel = useMemo(() => {
    // If local /api middleware isn't running, these will fail with fetch/404.
    return payoutComputeError ? isLikelyMissingApiRoutes(new Error(payoutComputeError)) : false
  }, [payoutComputeError])

  async function computeOnePayoutTotal(item: {
    coinAddr: Address
    payoutRecipient: Address
    currency: Address
    createdAtSeconds?: number
  }): Promise<void> {
    const result = await fetchCoinTradeRewardsBatchFromApi({
      recipient: item.payoutRecipient,
      pairs: [
        {
          coin: item.coinAddr,
          currency: item.currency,
          createdAtSeconds: item.createdAtSeconds,
        },
      ],
    })
    const amt = result[item.coinAddr.toLowerCase()] ?? 0n
    setPayoutEarnedByCoin((prev) => ({ ...prev, [item.coinAddr.toLowerCase()]: amt }))
  }

  async function computeVisiblePayoutTotals() {
    const run = ++computeRunId.current
    setPayoutComputeRunning(true)
    setPayoutComputeError(null)
    setPayoutComputeDone(0)
    setPayoutComputeTotal(computableCoins.length)

    try {
      let done = 0
      for (const item of computableCoins) {
        // Stop if a new run started (identifier changed, etc.)
        if (computeRunId.current !== run) return
        // Skip if already computed
        if (payoutEarnedByCoin[item.coinAddr.toLowerCase()] !== undefined) {
          done++
          setPayoutComputeDone(done)
          continue
        }
        await computeOnePayoutTotal(item)
        done++
        setPayoutComputeDone(done)
      }
    } catch (e: any) {
      setPayoutComputeError(e?.message || 'Failed to compute payout totals')
    } finally {
      if (computeRunId.current === run) setPayoutComputeRunning(false)
    }
  }

  const totals = useMemo(() => {
    const currencyTotals = new Map<string, { amount: number; label: string }>()
    let totalUsd = 0
    let hasUsd = false
    let hasReportedEarnings = false

    for (const coin of createdCoins) {
      if (Array.isArray(coin.creatorEarnings)) hasReportedEarnings = true
      const usd = sumEarningsUsd(coin.creatorEarnings)
      if (typeof usd === 'number' && Number.isFinite(usd)) {
        totalUsd += usd
        hasUsd = true
      }

      for (const row of sumEarningsByCurrency(coin.creatorEarnings)) {
        const label = formatCurrencyLabel(row.currencyAddress, coin.poolCurrencyToken)

        const prev = currencyTotals.get(row.currencyAddress)
        currencyTotals.set(row.currencyAddress, {
          amount: (prev?.amount ?? 0) + row.amount,
          label: prev?.label ?? label,
        })
      }
    }

    const currencies = Array.from(currencyTotals.entries()).map(([currencyAddress, v]) => ({
      currencyAddress,
      amount: v.amount,
      label: v.label,
    }))

    return { totalUsd: hasUsd ? totalUsd : null, currencies, hasReportedEarnings }
  }, [createdCoins])

  const allDetailsLoaded = useMemo(() => {
    return !isLoading && !error
  }, [error, isLoading])

  const totalUsdDisplay = useMemo(() => {
    if (totals.totalUsd !== null) return formatUsd(totals.totalUsd)
    return '—'
  }, [totals.totalUsd])

  function load() {
    const trimmed = input.trim()
    if (!trimmed) return
    navigate(`/creator/${encodeURIComponent(trimmed)}/earnings`)
  }

  return (
    <div className="relative">
      <section className="cinematic-section">
        <div className="max-w-4xl mx-auto px-6">
          <div className="mb-10 flex items-center justify-between gap-6">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="label">Back</span>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="space-y-3">
              <span className="label">Creator</span>
              <h1 className="headline text-4xl sm:text-6xl">Creator earnings</h1>
              <p className="text-zinc-600 text-sm font-light max-w-2xl">
                Lifetime creator earnings from Zora coin trades. Paid to the coin’s{' '}
                <span className="font-mono">payoutRecipient</span>.
              </p>
            </div>

            {/* Identifier input */}
            <div className="card p-6 space-y-3">
              <div className="label">Creator identifier</div>
              <div className="text-xs text-zinc-600">
                Enter a Zora handle (without @) or a wallet address.
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={address ? String(address) : 'handle-or-0x...'}
                  className="flex-1 bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-500/50 transition-colors font-mono"
                />
                <button
                  onClick={load}
                  className="btn-primary px-6"
                  disabled={!input.trim()}
                >
                  Load
                </button>
              </div>
            </div>

            {/* Results */}
            {!activeIdentifier ? (
              <div className="card p-8 text-sm text-zinc-600">
                Connect a wallet or enter a creator identifier above.
              </div>
            ) : isLoading ? (
              <div className="card p-8 flex items-center gap-3 text-sm text-zinc-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading creator coins…
              </div>
            ) : error ? (
              <div className="card p-8 text-sm text-zinc-600">
                Couldn’t load creator data. Check your Zora API keys and identifier.
              </div>
            ) : !profile ? (
              <div className="card p-8 text-sm text-zinc-600">
                No profile found for <span className="font-mono">{String(activeIdentifier)}</span>.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="card p-8 space-y-4">
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0 space-y-2">
                      <div className="label">Summary</div>
                      <div className="flex items-center gap-3">
                        {getProfileAvatarUrl(profile) ? (
                          <img
                            src={getProfileAvatarUrl(profile) as string}
                            alt={(profile as any)?.handle ? `@${String((profile as any).handle)}` : 'Creator'}
                            className="w-10 h-10 rounded-full object-cover border border-zinc-800"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary/20 to-brand-accent/20 border border-zinc-800 flex items-center justify-center text-xs font-medium text-brand-accent">
                            {(profile as any)?.handle
                              ? String((profile as any).handle).slice(0, 2).toUpperCase()
                              : String(activeIdentifier).startsWith('0x')
                                ? shortAddress(String(activeIdentifier)).slice(0, 2).toUpperCase()
                                : String(activeIdentifier).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="text-zinc-200 font-light truncate">
                          {(profile as any)?.handle
                            ? `@${String((profile as any).handle)}`
                            : String(activeIdentifier).startsWith('0x')
                              ? shortAddress(String(activeIdentifier))
                              : String(activeIdentifier)}
                        </div>
                      </div>

                      <div className="text-xs text-zinc-600">
                        Coins:{' '}
                        <span className="font-mono">
                          {String(createdCoinRows.filter((r) => r.isValidAddress).length)}
                          {(profile as any)?.createdCoins?.count ? `/${String((profile as any).createdCoins.count)}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 space-y-3">
                      <div>
                      <div className="text-xs text-zinc-600">Claimable now</div>
                      <div className="value mono text-2xl text-cyan-400">{totalClaimableEthDisplay}</div>
                      </div>

                      <div>
                        <div className="text-xs text-zinc-600">Lifetime (claimable + withdrawn)</div>
                        <div className="text-sm font-mono tabular-nums text-zinc-200">{totalLifetimeEthDisplay}</div>
                      </div>

                      <div>
                        <div className="text-xs text-zinc-600">
                          Reported earnings (USD){allDetailsLoaded ? '' : ' (loading…)'}
                        </div>
                        <div className="text-sm font-mono tabular-nums text-zinc-200">{totalUsdDisplay}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-900/50">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced((v) => !v)}
                      className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      {showAdvanced ? 'Hide advanced' : 'Show advanced'}
                    </button>

                    {showAdvanced ? (
                      <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                          <div className="text-xs text-zinc-600">Earned totals (payout currency) for visible coins</div>
                      <button
                        className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-50"
                        disabled={payoutComputeRunning || computableCoins.length === 0}
                        onClick={computeVisiblePayoutTotals}
                      >
                        {payoutComputeRunning ? 'Computing…' : 'Compute'}
                      </button>
                    </div>

                    {payoutComputeRunning ? (
                      <div className="text-xs text-zinc-700 font-mono">
                        {payoutComputeDone}/{payoutComputeTotal}
                      </div>
                    ) : null}

                    {payoutComputeError ? (
                      <div className="text-xs text-zinc-700">
                        {coinEarnedNeedVercel ? (
                          <>
                            If you see 404/Failed to fetch, run <span className="font-mono">vercel dev</span> (or keep using{' '}
                            <span className="font-mono">npm run dev</span> with the local API middleware).
                          </>
                        ) : (
                          <span className="font-mono">{payoutComputeError}</span>
                        )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="card p-0 overflow-hidden">
                  <div className="p-6 border-b border-zinc-900/50 flex items-center justify-between gap-6">
                    <div className="label">Created coins</div>
                  </div>
                  <div>
                    {createdCoinRows.length === 0 ? (
                      <div className="p-6 text-sm text-zinc-600">No created coins found.</div>
                    ) : (
                      createdCoinRows.map((row) => {
                        const coin = row.coin
                        const coinAddr = coin.address ? String(coin.address) : ''
                        const recipientRaw = coin.payoutRecipientAddress ? String(coin.payoutRecipientAddress) : ''
                        const currencyRaw = coin.poolCurrencyToken?.address ? String(coin.poolCurrencyToken.address) : ''
                        const currencyLabel = coin.poolCurrencyToken?.name
                          ? String(coin.poolCurrencyToken.name)
                          : currencyRaw && isAddress(currencyRaw)
                            ? shortAddress(currencyRaw)
                            : null
                        const decimalsRaw = coin.poolCurrencyToken?.decimals
                        const currencyDecimals =
                          typeof decimalsRaw === 'number' && Number.isFinite(decimalsRaw) ? decimalsRaw : 18
                        const earnedRaw = coinAddr ? (payoutEarnedByCoin[coinAddr.toLowerCase()] ?? null) : null
                        const details = row.isValidAddress ? coin : undefined
                        const usd = sumEarningsUsd(details?.creatorEarnings)
                        const byCurrency = sumEarningsByCurrency(details?.creatorEarnings)
                        const primaryCurrency = byCurrency[0]
                        const zoraCurrencyLabel =
                          primaryCurrency?.currencyAddress
                            ? formatCurrencyLabel(primaryCurrency.currencyAddress, coin.poolCurrencyToken)
                            : null

                        const earningsNotReported = !!details && !Array.isArray(details.creatorEarnings)
                        const earningsEmptyArray =
                          !!details && Array.isArray(details.creatorEarnings) && details.creatorEarnings.length === 0

                        const earningsText =
                          usd !== null
                            ? formatUsd(usd)
                            : primaryCurrency && zoraCurrencyLabel
                              ? `${formatAmount(primaryCurrency.amount)} ${zoraCurrencyLabel}`
                              : isLoading
                                ? 'Loading…'
                                : earningsNotReported
                                  ? 'Not available'
                                  : earningsEmptyArray
                                    ? formatUsd(0)
                                    : '—'

                        return (
                          <div
                            key={coinAddr || coin.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-zinc-900/50 px-6"
                          >
                            <div className="min-w-0">
                              <div className="text-zinc-200 font-light truncate">
                                {coin.name ? String(coin.name) : coin.symbol ? String(coin.symbol) : 'Coin'}
                                {coin.symbol ? (
                                  <span className="text-xs text-zinc-600 font-mono ml-2">{String(coin.symbol)}</span>
                                ) : null}
                              </div>
                              {coinAddr ? (
                                <div className="text-xs text-zinc-600 font-mono truncate">{coinAddr}</div>
                              ) : null}
                              {coin.payoutRecipientAddress ? (
                                <div className="text-xs text-zinc-600">
                                  Payout recipient:{' '}
                                  <span className="font-mono">
                                    {shortAddress(String(coin.payoutRecipientAddress))}
                                  </span>
                                </div>
                              ) : null}
                              {showAdvanced ? (
                              <div className="text-xs text-zinc-600">
                                Earned (payout currency):{' '}
                                <span className="font-mono text-zinc-300">
                                  {earnedRaw !== null && earnedRaw !== undefined && currencyLabel
                                    ? `${formatUnitsCompact(earnedRaw, currencyDecimals)} ${currencyLabel}`
                                    : '—'}
                                </span>
                                {coinAddr && isAddress(recipientRaw) && isAddress(currencyRaw) ? (
                                  <button
                                    className="ml-3 text-xs text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-50"
                                    disabled={payoutComputeRunning}
                                    onClick={async () => {
                                      try {
                                          const createdAtSeconds = coin.createdAt
                                            ? Math.floor(Date.parse(String(coin.createdAt)) / 1000)
                                            : undefined
                                        await computeOnePayoutTotal({
                                          coinAddr: coinAddr as Address,
                                          payoutRecipient: recipientRaw as Address,
                                          currency: currencyRaw as Address,
                                          createdAtSeconds,
                                        })
                                      } catch (err: any) {
                                        setPayoutComputeError(err?.message || 'Failed to compute this coin')
                                      }
                                    }}
                                  >
                                    {earnedRaw === null ? 'Compute' : 'Recompute'}
                                  </button>
                                ) : null}
                              </div>
                              ) : null}
                            </div>

                            <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
                              <div className="text-right">
                                <div className="text-xs text-zinc-600">Creator earnings</div>
                                <div className="text-sm font-mono text-zinc-200">{earningsText}</div>
                              </div>
                              <div className="flex items-center gap-3">
                                {coinAddr ? (
                                  <Link
                                    to={`/deploy?token=${encodeURIComponent(coinAddr)}`}
                                    className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                                  >
                                    Deploy vault <ArrowRight className="w-3 h-3 inline ml-1" />
                                  </Link>
                                ) : null}
                                {coinAddr ? (
                                  <Link
                                    to={`/coin/${encodeURIComponent(coinAddr)}/manage`}
                                    className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                                  >
                                    Manage coin
                                  </Link>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  )
}


