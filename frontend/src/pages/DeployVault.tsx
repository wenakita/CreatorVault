import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useReadContract } from 'wagmi'
import type { Address } from 'viem'
import { erc20Abi, formatUnits, isAddress } from 'viem'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { coinABI } from '@zoralabs/protocol-deployments'
import { ConnectButton } from '@/components/ConnectButton'
import { DeployVaultAA } from '@/components/DeployVaultAA'
import { useZoraCoin, useZoraProfile } from '@/lib/zora/hooks'
import { fetchCoinMarketRewardsByCoinFromApi } from '@/lib/onchain/coinMarketRewardsByCoin'

export function DeployVault() {
  const { address, isConnected } = useAccount()
  const [creatorToken, setCreatorToken] = useState('')
  const [deployAs, setDeployAs] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [searchParams] = useSearchParams()
  const prefillToken = useMemo(() => searchParams.get('token') ?? '', [searchParams])

  useEffect(() => {
    if (!prefillToken) return
    if (creatorToken.length > 0) return
    setCreatorToken(prefillToken)
  }, [prefillToken, creatorToken.length])

  // Detect "your" creator coin + smart wallet from your Zora profile and prefill inputs once.
  const myProfileQuery = useZoraProfile(address)
  const myProfile = myProfileQuery.data

  const detectedCreatorCoin = useMemo(() => {
    const v = myProfile?.creatorCoin?.address ? String(myProfile.creatorCoin.address) : ''
    return isAddress(v) ? (v as Address) : null
  }, [myProfile?.creatorCoin?.address])

  const detectedSmartWallet = useMemo(() => {
    const edges = myProfile?.linkedWallets?.edges ?? []
    for (const e of edges) {
      const n: any = (e as any)?.node
      const t = typeof n?.walletType === 'string' ? n.walletType : ''
      const a = typeof n?.walletAddress === 'string' ? n.walletAddress : ''
      if (String(t).toUpperCase() !== 'SMART_WALLET') continue
      if (isAddress(a)) return a as Address
    }
    return null
  }, [myProfile?.linkedWallets?.edges])

  const autofillRef = useRef<{ tokenFor?: string; deployAsFor?: string }>({})
  const addressLc = (address ?? '').toLowerCase()

  useEffect(() => {
    if (!isConnected || !addressLc) return
    if (prefillToken) return
    if (creatorToken.trim().length > 0) return
    if (!detectedCreatorCoin) return
    if (autofillRef.current.tokenFor === addressLc) return

    setCreatorToken(detectedCreatorCoin)
    autofillRef.current.tokenFor = addressLc
  }, [isConnected, addressLc, prefillToken, creatorToken, detectedCreatorCoin])

  useEffect(() => {
    if (!isConnected || !addressLc) return
    if (deployAs.trim().length > 0) return
    if (!detectedSmartWallet) return
    if (autofillRef.current.deployAsFor === addressLc) return

    setDeployAs(detectedSmartWallet)
    autofillRef.current.deployAsFor = addressLc
  }, [isConnected, addressLc, deployAs, detectedSmartWallet])

  const tokenIsValid = isAddress(creatorToken)
  const deployAsTrim = deployAs.trim()
  const deployAsAddress = useMemo(() => {
    if (!deployAsTrim) return null
    return isAddress(deployAsTrim) ? (deployAsTrim as Address) : null
  }, [deployAsTrim])
  const deployAsIsValid = deployAsTrim.length === 0 || !!deployAsAddress

  const {
    data: zoraCoin,
    isLoading: zoraLoading,
    isFetching: zoraFetching,
    dataUpdatedAt: zoraUpdatedAt,
    refetch: refetchZoraCoin,
  } = useZoraCoin(
    tokenIsValid ? (creatorToken as Address) : undefined,
  )
  const { data: zoraCreatorProfile } = useZoraProfile(zoraCoin?.creatorAddress)

  const { data: tokenSymbol, isLoading: symbolLoading } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'symbol',
    query: { enabled: tokenIsValid },
  })

  const { data: tokenName } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'name',
    query: { enabled: tokenIsValid },
  })

  // Auto-derive ShareOFT symbol and name (preserve original case)
  const baseSymbol = tokenSymbol ?? zoraCoin?.symbol

  const underlyingSymbol = useMemo(() => {
    if (!baseSymbol) return ''
    const s = String(baseSymbol)
    // Defensive: if a coin ever reports a "ws" prefixed symbol, normalize to the underlying.
    return s.toLowerCase().startsWith('ws') ? s.slice(2) : s
  }, [baseSymbol])

  const derivedVaultSymbol = useMemo(() => {
    if (!underlyingSymbol) return ''
    return `s${underlyingSymbol}`
  }, [underlyingSymbol])

  const derivedVaultName = useMemo(() => {
    if (!underlyingSymbol) return ''
    return `${underlyingSymbol} Vault Share`
  }, [underlyingSymbol])

  const derivedShareSymbol = useMemo(() => {
    if (!underlyingSymbol) return ''
    return `ws${underlyingSymbol}`
  }, [underlyingSymbol])

  const derivedShareName = useMemo(() => {
    if (!underlyingSymbol) return ''
    return `Wrapped ${underlyingSymbol} Vault Share`
  }, [underlyingSymbol])

  const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`

  const creatorAddress = zoraCoin?.creatorAddress ? String(zoraCoin.creatorAddress) : null
  const isOriginalCreator =
    !!address && !!creatorAddress && address.toLowerCase() === creatorAddress.toLowerCase()

  function formatUsdWhole(n: number): string {
    return Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  }

  function parseIsoToSeconds(iso?: string): number | undefined {
    if (!iso) return undefined
    const ms = Date.parse(iso)
    if (!Number.isFinite(ms)) return undefined
    return Math.floor(ms / 1000)
  }

  const createdAtSeconds = useMemo(() => parseIsoToSeconds(zoraCoin?.createdAt), [zoraCoin?.createdAt])

  const marketCapDisplay = useMemo(() => {
    const raw = zoraCoin?.marketCap
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? formatUsdWhole(n) : '—'
  }, [zoraCoin?.marketCap])

  const volume24hDisplay = useMemo(() => {
    const raw = zoraCoin?.volume24h
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? formatUsdWhole(n) : '—'
  }, [zoraCoin?.volume24h])

  const totalVolumeDisplay = useMemo(() => {
    const raw = zoraCoin?.totalVolume
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? formatUsdWhole(n) : '—'
  }, [zoraCoin?.totalVolume])

  // Onchain read of payoutRecipient (immediate after tx, no indexer delay).
  const { data: onchainPayoutRecipient } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: coinABI,
    functionName: 'payoutRecipient',
    query: { enabled: tokenIsValid },
  })

  const payoutRecipient = useMemo(() => {
    // Prefer onchain value (instant). Fall back to Zora indexed value.
    const onchain = typeof onchainPayoutRecipient === 'string' ? onchainPayoutRecipient : ''
    if (isAddress(onchain)) return onchain as Address
    const r = zoraCoin?.payoutRecipientAddress ? String(zoraCoin.payoutRecipientAddress) : ''
    return isAddress(r) ? (r as Address) : null
  }, [onchainPayoutRecipient, zoraCoin?.payoutRecipientAddress])

  const isPayoutRecipient =
    !!address && !!payoutRecipient && address.toLowerCase() === payoutRecipient.toLowerCase()
  const isAuthorizedDeployer = isOriginalCreator || isPayoutRecipient

  const poolCurrencyAddress = useMemo(() => {
    const c = zoraCoin?.poolCurrencyToken?.address ? String(zoraCoin.poolCurrencyToken.address) : ''
    return isAddress(c) ? (c as Address) : null
  }, [zoraCoin?.poolCurrencyToken?.address])

  const coinAddress = useMemo(() => {
    const c = zoraCoin?.address ? String(zoraCoin.address) : ''
    return isAddress(c) ? (c as Address) : null
  }, [zoraCoin?.address])

  const poolCurrencyDecimals = useMemo(() => {
    const d = zoraCoin?.poolCurrencyToken?.decimals
    return typeof d === 'number' && Number.isFinite(d) ? d : 18
  }, [zoraCoin?.poolCurrencyToken?.decimals])

  const creatorEarningsQuery = useQuery({
    queryKey: [
      'onchain',
      'coinMarketRewardsByCoin',
      payoutRecipient ?? 'missing',
      poolCurrencyAddress ?? 'missing',
      coinAddress ?? 'missing',
      createdAtSeconds ?? 0,
    ],
    queryFn: async () => {
      if (!payoutRecipient || !poolCurrencyAddress || !coinAddress) return {}
      return await fetchCoinMarketRewardsByCoinFromApi({
        recipient: payoutRecipient,
        currency: poolCurrencyAddress,
        coin: coinAddress,
        createdAtSeconds,
      })
    },
    enabled: false, // user-triggered (can be slow on first run)
    staleTime: 1000 * 60 * 10,
  })

  const creatorEarningsDisplay = useMemo(() => {
    const map = creatorEarningsQuery.data
    if (!map || !coinAddress) return '—'
    const raw = map[coinAddress.toLowerCase()]
    if (raw === undefined) return '—'

    // Convert currency amount to decimal.
    const amountCurrency = Number(formatUnits(raw, poolCurrencyDecimals))
    if (!Number.isFinite(amountCurrency)) return '—'

    // If pool currency is already USD (USDC), show 1:1.
    const poolName = zoraCoin?.poolCurrencyToken?.name ? String(zoraCoin.poolCurrencyToken.name).toUpperCase() : ''
    if (poolName.includes('USDC') || poolName.includes('USD')) return formatUsdWhole(amountCurrency)

    // Otherwise estimate USD using Zora-provided pricing:
    // poolTokenPriceInUsdc ~= coinPriceInUsdc / coinPriceInPoolToken
    const priceInUsdc = zoraCoin?.tokenPrice?.priceInUsdc ? Number(zoraCoin.tokenPrice.priceInUsdc) : NaN
    const priceInPoolToken = zoraCoin?.tokenPrice?.priceInPoolToken ? Number(zoraCoin.tokenPrice.priceInPoolToken) : NaN
    const poolTokenPriceInUsdc =
      Number.isFinite(priceInUsdc) && Number.isFinite(priceInPoolToken) && priceInPoolToken > 0
        ? priceInUsdc / priceInPoolToken
        : NaN

    const usd = Number.isFinite(poolTokenPriceInUsdc) ? amountCurrency * poolTokenPriceInUsdc : NaN
    return Number.isFinite(usd) ? formatUsdWhole(usd) : '—'
  }, [
    creatorEarningsQuery.data,
    coinAddress,
    poolCurrencyDecimals,
    zoraCoin?.poolCurrencyToken?.name,
    zoraCoin?.tokenPrice?.priceInUsdc,
    zoraCoin?.tokenPrice?.priceInPoolToken,
  ])

  // CreatorVaults are creator-initiated. If we can't confidently identify the creator, default to locked.
  const coinTypeUpper = String(zoraCoin?.coinType ?? '').toUpperCase()
  const isCreatorCoin = coinTypeUpper === 'CREATOR'
  const coinTypeLabel =
    coinTypeUpper === 'CREATOR' ? 'Creator Coin' : coinTypeUpper === 'CONTENT' ? 'Content Coin' : 'Coin'
  const coinTypePillClass =
    coinTypeUpper === 'CREATOR'
      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
      : coinTypeUpper === 'CONTENT'
        ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
        : 'bg-zinc-500/10 border border-zinc-500/20 text-zinc-300'
  const canDeploy =
    tokenIsValid &&
    !!zoraCoin &&
    isCreatorCoin &&
    isAuthorizedDeployer &&
    !!derivedShareSymbol &&
    !!derivedShareName &&
    deployAsIsValid

  return (
    <div className="relative">
      <section className="cinematic-section">
        <div className="max-w-3xl mx-auto px-6">
          <div className="space-y-8">
            {/* Header */}
            <div className="space-y-3">
              <span className="label">Deploy</span>
              <h1 className="headline text-4xl sm:text-6xl">Deploy Vault</h1>
              <p className="text-zinc-600 text-sm font-light">
                Deploy a vault for your Creator Coin on Base. Only the creator or current payout recipient can deploy.
              </p>
            </div>

            {/* Review */}
            {tokenIsValid && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="overflow-hidden"
              >
                {symbolLoading || zoraLoading ? (
                  <div className="text-sm text-zinc-600">Loading coin details…</div>
                ) : !zoraCoin ? (
                  <div className="text-sm text-red-400/80">
                    This token does not appear to be a Zora Coin. CreatorVaults can only be created for Zora{' '}
                    <span className="text-zinc-200">Creator Coins</span>.
                  </div>
                ) : baseSymbol ? (
                  <div className="card rounded-xl p-8 space-y-6">
                    {/* Token card */}
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex items-center gap-4 min-w-0">
                        {zoraCoin?.mediaContent?.previewImage?.medium ? (
                          <img
                            src={zoraCoin.mediaContent.previewImage.medium}
                            alt={zoraCoin.symbol ? String(zoraCoin.symbol) : 'Coin'}
                            className="w-14 h-14 rounded-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-sm font-medium text-cyan-400">
                            {String(baseSymbol).slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="text-white font-light text-xl">
                            {zoraCoin?.name
                              ? String(zoraCoin.name)
                              : tokenName
                                ? String(tokenName)
                                : String(baseSymbol)}
                            {baseSymbol ? (
                              <span className="text-zinc-500"> ({`$${String(baseSymbol)}`})</span>
                            ) : null}
                          </div>
                          <div className="text-xs text-zinc-600 font-mono mt-1">{String(creatorToken)}</div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${coinTypePillClass}`}>
                          {coinTypeLabel}
                        </span>
                        <Link
                          to={`/coin/${creatorToken}/manage`}
                          className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
                        >
                          Manage
                        </Link>
                      </div>
                    </div>

                    {/* Key rows */}
                    <div className="space-y-0">
                      {zoraCoin?.creatorAddress && (
                        <div className="data-row">
                          <div className="label">Creator</div>
                          <div className="text-xs text-zinc-300">
                            {zoraCreatorProfile?.handle
                              ? `@${zoraCreatorProfile.handle}`
                              : short(String(zoraCoin.creatorAddress))}
                          </div>
                        </div>
                      )}

                      {payoutRecipient && (
                        <div className="data-row">
                          <div className="label">Payout recipient</div>
                          <div className="text-xs text-zinc-300 font-mono">{short(payoutRecipient)}</div>
                        </div>
                      )}

                      {zoraCoin?.poolCurrencyToken?.name && (
                        <div className="data-row">
                          <div className="label">Trade currency</div>
                          <div className="text-xs text-zinc-300">{String(zoraCoin.poolCurrencyToken.name)}</div>
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-4 bg-black/30 border border-zinc-900/50 rounded-lg">
                        <div className="flex items-center justify-between gap-2">
                          <div className="label">Market cap</div>
                          {zoraCoin ? (
                            <button
                              type="button"
                              onClick={() => refetchZoraCoin()}
                              disabled={zoraLoading || zoraFetching}
                              className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-50"
                              title={zoraUpdatedAt ? `Last updated: ${new Date(zoraUpdatedAt).toLocaleTimeString()}` : 'Refresh'}
                            >
                              {zoraLoading || zoraFetching ? '…' : 'Refresh'}
                            </button>
                          ) : null}
                        </div>
                        <div className="text-sm font-mono text-emerald-400 mt-2">{marketCapDisplay}</div>
                      </div>
                      <div className="p-4 bg-black/30 border border-zinc-900/50 rounded-lg">
                        <div className="label">24h volume</div>
                        <div className="text-sm font-mono text-zinc-200 mt-2">{volume24hDisplay}</div>
                        <div className="text-[10px] text-zinc-700 mt-2">Total: {totalVolumeDisplay}</div>
                      </div>
                      <div className="p-4 bg-black/30 border border-zinc-900/50 rounded-lg">
                        <div className="flex items-center justify-between gap-2">
                          <div className="label">Creator earnings</div>
                          {payoutRecipient && poolCurrencyAddress && coinAddress ? (
                            <button
                              type="button"
                              onClick={() => creatorEarningsQuery.refetch()}
                              disabled={creatorEarningsQuery.isFetching}
                              className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-50"
                              title="Computed from onchain reward events (can take ~30-60s the first time)."
                            >
                              {creatorEarningsQuery.isFetching ? 'Computing…' : creatorEarningsQuery.data ? 'Refresh' : 'Compute'}
                            </button>
                          ) : null}
                        </div>
                        <div className="text-sm font-mono text-zinc-200 mt-2">
                          {creatorEarningsQuery.isFetching ? '…' : creatorEarningsDisplay}
                        </div>
                      </div>
                    </div>

                    {String(zoraCoin?.coinType ?? '').toUpperCase() === 'CONTENT' && (
                      <div className="text-xs text-amber-300/90 pt-4 border-t border-zinc-900/50">
                        This is a <span className="font-mono">Content Coin</span>. CreatorVaults can only be created for{' '}
                        <span className="font-mono">Creator Coins</span>.
                      </div>
                    )}

                    {isConnected && zoraCoin?.creatorAddress && !isAuthorizedDeployer && (
                      <div className="text-xs text-red-400/90">
                        You are connected as{' '}
                        <span className="font-mono">
                          {address?.slice(0, 6)}…{address?.slice(-4)}
                        </span>
                        . Only the coin creator or current payout recipient can deploy this vault.
                      </div>
                    )}

                    {/* Vault configuration */}
                    <div className="pt-4 border-t border-zinc-900/50 space-y-3">
                      <div className="label">Contracts deployed</div>
                      <div className="text-xs text-zinc-600">
                        Deployed together in one confirmation.
                      </div>

                      <div className="space-y-2">
                        <details className="group border border-zinc-900/50 rounded-lg bg-black/20">
                          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-4 py-3 flex items-center justify-between gap-4">
                            <div>
                              <div className="text-xs text-zinc-500">Vault token</div>
                              <div className="text-sm text-zinc-200">
                                {derivedVaultName || '—'}{' '}
                                <span className="font-mono text-zinc-500">({derivedVaultSymbol || '—'})</span>
                              </div>
                            </div>
                            <div className="text-[10px] text-zinc-600 group-open:hidden">Info</div>
                            <div className="text-[10px] text-zinc-600 hidden group-open:block">Hide</div>
                          </summary>
                          <div className="px-4 pb-3 text-xs text-zinc-600">
                            The vault’s share token. You receive it when you deposit creator coins.
                          </div>
                        </details>

                        <details className="group border border-zinc-900/50 rounded-lg bg-black/20">
                          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-4 py-3 flex items-center justify-between gap-4">
                            <div>
                              <div className="text-xs text-zinc-500">Share token</div>
                              <div className="text-sm text-zinc-200">
                                {derivedShareName || '—'}{' '}
                                <span className="font-mono text-zinc-500">({derivedShareSymbol || '—'})</span>
                              </div>
                            </div>
                            <div className="text-[10px] text-zinc-600 group-open:hidden">Info</div>
                            <div className="text-[10px] text-zinc-600 hidden group-open:block">Hide</div>
                          </summary>
                          <div className="px-4 pb-3 text-xs text-zinc-600">
                            A wrapped share token used by the vault system.
                          </div>
                        </details>

                        <details className="group border border-zinc-900/50 rounded-lg bg-black/20">
                          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-4 py-3 flex items-center justify-between gap-4">
                            <div>
                              <div className="text-xs text-zinc-500">Wrapper</div>
                              <div className="text-sm text-zinc-200">Vault Wrapper</div>
                            </div>
                            <div className="text-[10px] text-zinc-600 group-open:hidden">Info</div>
                            <div className="text-[10px] text-zinc-600 hidden group-open:block">Hide</div>
                          </summary>
                          <div className="px-4 pb-3 text-xs text-zinc-600">
                            Handles deposits/withdrawals and wraps vault shares into the share token.
                          </div>
                        </details>

                        <details className="group border border-zinc-900/50 rounded-lg bg-black/20">
                          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-4 py-3 flex items-center justify-between gap-4">
                            <div>
                              <div className="text-xs text-zinc-500">Gauge controller</div>
                              <div className="text-sm text-zinc-200">Gauge Controller</div>
                            </div>
                            <div className="text-[10px] text-zinc-600 group-open:hidden">Info</div>
                            <div className="text-[10px] text-zinc-600 hidden group-open:block">Hide</div>
                          </summary>
                          <div className="px-4 pb-3 text-xs text-zinc-600">
                            Coordinates incentives and fee routing for the vault.
                          </div>
                        </details>

                        <details className="group border border-zinc-900/50 rounded-lg bg-black/20">
                          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-4 py-3 flex items-center justify-between gap-4">
                            <div>
                              <div className="text-xs text-zinc-500">Launch strategy</div>
                              <div className="text-sm text-zinc-200">Launch Strategy</div>
                            </div>
                            <div className="text-[10px] text-zinc-600 group-open:hidden">Info</div>
                            <div className="text-[10px] text-zinc-600 hidden group-open:block">Hide</div>
                          </summary>
                          <div className="px-4 pb-3 text-xs text-zinc-600">
                            Manages the initial launch flow used by the vault.
                          </div>
                        </details>

                        <details className="group border border-zinc-900/50 rounded-lg bg-black/20">
                          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-4 py-3 flex items-center justify-between gap-4">
                            <div>
                              <div className="text-xs text-zinc-500">Oracle</div>
                              <div className="text-sm text-zinc-200">Oracle</div>
                            </div>
                            <div className="text-[10px] text-zinc-600 group-open:hidden">Info</div>
                            <div className="text-[10px] text-zinc-600 hidden group-open:block">Hide</div>
                          </summary>
                          <div className="px-4 pb-3 text-xs text-zinc-600">
                            Provides pricing data used by the vault’s launch/graduation path.
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-red-400/80">Could not read token. Is this a valid ERC-20?</div>
                )}
              </motion.div>
            )}

            {/* Settings */}
            <div className="card rounded-xl p-6 space-y-6">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-1">
                  <div className="label">Settings</div>
                  <div className="text-xs text-zinc-600">
                    Most creators won’t need to change anything here.
                  </div>
                </div>
                {isConnected ? (
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    {showAdvanced ? 'Hide advanced' : 'Advanced'}
                  </button>
                ) : null}
              </div>

              {!isConnected ? (
                <div className="space-y-3">
                  <div className="label">Wallet</div>
                  <ConnectButton />
                </div>
              ) : null}

              {/* Creator Coin */}
              <div className="space-y-2">
                <label className="label">Creator Coin</label>

                {!isConnected ? (
                  tokenIsValid ? (
                    <input
                      value={creatorToken}
                      disabled
                      className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                    />
                  ) : (
                    <>
                      <input
                        value=""
                        disabled
                        placeholder="Connect wallet to detect your creator coin"
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                      />
                      <div className="text-xs text-zinc-600">Connect your wallet to continue.</div>
                    </>
                  )
                ) : !showAdvanced ? (
                  tokenIsValid ? (
                    <>
                      <input
                        value={creatorToken}
                        disabled
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                      />
                      <div className="text-xs text-zinc-600">
                        {detectedCreatorCoin &&
                        creatorToken.toLowerCase() === detectedCreatorCoin.toLowerCase()
                          ? 'Prefilled for this wallet.'
                          : prefillToken
                            ? 'Set from a link.'
                            : 'Set manually.'}
                      </div>
                    </>
                  ) : detectedCreatorCoin ? (
                    <>
                      <input
                        value={detectedCreatorCoin}
                        disabled
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                      />
                      <div className="text-xs text-zinc-600">Prefilled for this wallet.</div>
                    </>
                  ) : myProfileQuery.isLoading || myProfileQuery.isFetching ? (
                    <>
                      <input
                        value=""
                        disabled
                        placeholder="Detecting your creator coin…"
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                      />
                      <div className="text-xs text-zinc-600">If you don’t have a Creator Coin yet, you won’t be able to deploy a vault.</div>
                    </>
                  ) : (
                    <>
                      <input
                        value=""
                        disabled
                        placeholder="No creator coin detected for this wallet"
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                      />
                      <div className="text-xs text-zinc-600">Open Advanced if you need to paste a coin address.</div>
                    </>
                  )
                ) : (
                  <>
                    <div className="text-xs text-zinc-600">
                      Paste a Creator Coin address if you want to deploy a different coin.
                    </div>
                    <input
                      value={creatorToken}
                      onChange={(e) => setCreatorToken(e.target.value)}
                      placeholder="0x..."
                      className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-500/50 transition-colors font-mono"
                    />
                    {isConnected && detectedCreatorCoin ? (
                      <button
                        type="button"
                        onClick={() => setCreatorToken(detectedCreatorCoin)}
                        className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
                      >
                        Use my coin
                      </button>
                    ) : null}
                  </>
                )}
              </div>

              {/* Vault owner wallet */}
              {isConnected ? (
                <div className="pt-3 border-t border-zinc-900/50 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="label">Vault owner wallet</div>
                    {!showAdvanced ? (
                      deployAsAddress ? (
                        detectedSmartWallet &&
                        deployAsAddress.toLowerCase() === detectedSmartWallet.toLowerCase() ? (
                          <div className="text-[10px] text-zinc-700">Smart wallet</div>
                        ) : (
                          <div className="text-[10px] text-zinc-700">Custom</div>
                        )
                      ) : address ? (
                        <div className="text-[10px] text-zinc-700">Connected wallet</div>
                      ) : null
                    ) : (
                      <div className="flex items-center gap-3">
                        {detectedSmartWallet ? (
                          <button
                            type="button"
                            onClick={() => setDeployAs(String(detectedSmartWallet))}
                            className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
                            title="Use your detected smart wallet address"
                          >
                            Use smart wallet
                          </button>
                        ) : null}
                        {payoutRecipient ? (
                          <button
                            type="button"
                            onClick={() => setDeployAs(String(payoutRecipient))}
                            className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
                            title="Use the coin’s current payout recipient address"
                          >
                            Use payout recipient
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {!showAdvanced ? (
                    <input
                      value={String(deployAsAddress ?? address ?? '')}
                      disabled
                      className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                    />
                  ) : (
                    <input
                      value={deployAs}
                      onChange={(e) => setDeployAs(e.target.value)}
                      placeholder="0x… (leave blank to use connected wallet)"
                      className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-500/50 transition-colors font-mono"
                    />
                  )}

                  {!deployAsIsValid ? (
                    <div className="text-xs text-red-400/80">Invalid wallet address.</div>
                  ) : (
                    <div className="text-xs text-zinc-600">
                      Vault contracts will be owned by this wallet.
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Deploy */}
            <div className="card rounded-xl p-8 space-y-4">
              <div className="label">Deploy</div>

              {!isConnected ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Connect wallet to deploy
                </button>
              ) : tokenIsValid && zoraCoin && String(zoraCoin.coinType ?? '').toUpperCase() !== 'CREATOR' ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Not eligible: vaults are Creator Coin–only
                </button>
              ) : canDeploy ? (
                <DeployVaultAA
                  creatorToken={creatorToken as `0x${string}`}
                  symbol={derivedShareSymbol}
                  name={derivedShareName}
                  // Keep revenue flowing to the coin’s payout recipient by default,
                  // even if you choose to deploy the vault *owned by* a different smart wallet.
                  creatorTreasury={((payoutRecipient ?? (address as Address)) as Address) as `0x${string}`}
                  executeAs={deployAsAddress ?? undefined}
                />
              ) : tokenIsValid && (symbolLoading || zoraLoading) ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Loading…
                </button>
              ) : tokenIsValid && zoraCoin && !isAuthorizedDeployer ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Authorized only: connect the coin’s creator or payout recipient wallet to deploy
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Enter token address to continue
                </button>
              )}

              <div className="text-xs text-zinc-600 space-y-1">
                <p>Deployment takes one wallet confirmation.</p>
                <p>Recommended: Coinbase Smart Wallet.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
