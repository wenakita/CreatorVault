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
  const [includeOracle, setIncludeOracle] = useState(true)
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

  const derivedShareSymbol = useMemo(() => {
    if (!baseSymbol) return ''
    return `ws${String(baseSymbol)}`
  }, [baseSymbol])

  const derivedShareName = useMemo(() => {
    if (!baseSymbol) return ''
    return `Wrapped ${String(baseSymbol)} Share`
  }, [baseSymbol])

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
  const { data: onchainPayoutRecipient, refetch: refetchPayoutRecipient } = useReadContract({
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
  const isCreatorCoin = String(zoraCoin?.coinType ?? '').toUpperCase() === 'CREATOR'
  const canDeploy =
    tokenIsValid &&
    !!zoraCoin &&
    isCreatorCoin &&
    isAuthorizedDeployer &&
    !!derivedShareSymbol &&
    !!derivedShareName &&
    deployAsIsValid

  return (
    <div className="max-w-xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="label text-cyan-500/80">Phase 2</div>
        <h1 className="text-2xl font-light tracking-[0.08em] uppercase text-zinc-100">
          Deploy Vault
        </h1>
        <div className="text-xs text-zinc-600">
          Vaults can only be created for <span className="text-zinc-400">Creator Coins</span> (not Content Coins) and must be deployed by the creator or current payout recipient.
        </div>
        {!isConnected ? (
          <div className="pt-3 flex justify-center">
            <ConnectButton />
          </div>
        ) : null}
      </div>

      {/* Single Input */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label className="label text-zinc-500">Creator Coin</label>
          {isConnected ? (
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors"
            >
              {showAdvanced ? 'Hide advanced' : 'Advanced'}
            </button>
          ) : null}
        </div>

        {/* Default (simple) mode: show detected coin as read-only */}
        {isConnected && !showAdvanced ? (
          detectedCreatorCoin ? (
            <>
              <input
                value={detectedCreatorCoin}
                disabled
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-4 text-base text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
              />
              <div className="text-xs text-zinc-600">Detected from your profile.</div>
            </>
          ) : myProfileQuery.isLoading || myProfileQuery.isFetching ? (
            <>
              <input
                value=""
                disabled
                placeholder="Detecting your creator coin…"
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-4 text-base text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
              />
              <div className="text-xs text-zinc-600">Connect a wallet with a Creator Coin.</div>
            </>
          ) : (
            <>
              <input
                value=""
                disabled
                placeholder="No creator coin detected for this wallet"
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-4 text-base text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
              />
              <div className="text-xs text-zinc-600">Open Advanced if you need to paste a coin address.</div>
            </>
          )
        ) : (
          // Advanced mode (or not connected): allow manual paste / overrides.
          <>
            <div className="text-xs text-zinc-600">
              Paste a Creator Coin address if you want to deploy a different coin.
            </div>
            <input
              value={creatorToken}
              onChange={(e) => setCreatorToken(e.target.value)}
              placeholder="0x..."
              className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-4 text-base text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-500/50 transition-colors font-mono"
            />
            {isConnected && detectedCreatorCoin ? (
              <button
                type="button"
                onClick={() => setCreatorToken(detectedCreatorCoin)}
                className="text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors"
              >
                Use my coin
              </button>
            ) : null}
          </>
        )}
      </div>

      {/* Token Preview */}
      {tokenIsValid && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="overflow-hidden"
        >
          {symbolLoading || zoraLoading ? (
            <div className="text-sm text-zinc-600">Loading token info...</div>
          ) : !zoraCoin ? (
            <div className="text-sm text-red-400/80">
              This token does not appear to be a Zora Coin. CreatorVaults can only be created for Zora <span className="text-zinc-200">Creator Coins</span>.
            </div>
          ) : baseSymbol ? (
            <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-lg space-y-4">
              {/* Token Info */}
              <div className="flex items-center gap-3">
                {zoraCoin?.mediaContent?.previewImage?.medium ? (
                  <img
                    src={zoraCoin.mediaContent.previewImage.medium}
                    alt={zoraCoin.symbol ? String(zoraCoin.symbol) : 'Coin'}
                    className="w-10 h-10 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-sm font-medium text-cyan-400">
                    {String(baseSymbol).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-zinc-200 font-medium">{String(baseSymbol)}</div>
                  <div className="text-xs text-zinc-500">
                    {zoraCoin?.name
                      ? String(zoraCoin.name)
                      : tokenName
                        ? String(tokenName)
                        : 'Creator Token'}
                  </div>
                </div>
              </div>

              {zoraCoin?.creatorAddress && (
                <div className="text-xs text-zinc-500">
                  Creator:{' '}
                  <span className="text-zinc-300">
                    {zoraCreatorProfile?.handle
                      ? `@${zoraCreatorProfile.handle}`
                      : `${zoraCoin.creatorAddress.slice(0, 6)}…${zoraCoin.creatorAddress.slice(-4)}`}
                  </span>
                </div>
              )}

              {zoraCoin?.coinType && (
                <div className="text-xs text-zinc-500">
                  Coin type:{' '}
                  <span
                    className={
                      String(zoraCoin.coinType).toUpperCase() === 'CREATOR'
                        ? 'text-emerald-400'
                        : String(zoraCoin.coinType).toUpperCase() === 'CONTENT'
                          ? 'text-amber-400'
                          : 'text-zinc-300'
                    }
                  >
                    {String(zoraCoin.coinType).toUpperCase() === 'CREATOR'
                      ? 'Creator Coin'
                      : String(zoraCoin.coinType).toUpperCase() === 'CONTENT'
                        ? 'Content Coin'
                        : String(zoraCoin.coinType)}
                  </span>
                </div>
              )}

              {payoutRecipient && (
                <div className="text-xs text-zinc-500 flex items-center gap-2">
                  <span>Payout recipient:</span>
                  <span className="text-zinc-300 font-mono">{short(payoutRecipient)}</span>
                  <button
                    type="button"
                    onClick={() => refetchPayoutRecipient()}
                    className="text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors"
                    title="Re-read from chain"
                  >
                    ↻
                  </button>
                </div>
              )}

              {/* Optional: deploy as a different wallet (e.g. a smart wallet address) */}
              {isConnected ? (
                <div className="pt-3 border-t border-zinc-800/60 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Vault owner wallet (optional)</div>
                    {showAdvanced ? (
                      <div className="flex items-center gap-3">
                        {detectedSmartWallet ? (
                          <button
                            type="button"
                            onClick={() => setDeployAs(String(detectedSmartWallet))}
                            className="text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors"
                            title="Use your detected smart wallet address"
                          >
                            Use smart wallet
                          </button>
                        ) : null}
                        {payoutRecipient ? (
                          <button
                            type="button"
                            onClick={() => setDeployAs(String(payoutRecipient))}
                            className="text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors"
                            title="Use the coin’s current payout recipient address"
                          >
                            Use payout recipient
                          </button>
                        ) : null}
                      </div>
                    ) : detectedSmartWallet ? (
                      <div className="text-[10px] text-zinc-700">Using smart wallet</div>
                    ) : null}
                  </div>
                  {!showAdvanced && detectedSmartWallet ? (
                    <input
                      value={String(detectedSmartWallet)}
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
                      If you set this, vault contracts will be owned by that wallet (you must control it).
                    </div>
                  )}
                </div>
              ) : null}

              {zoraCoin?.poolCurrencyToken?.name && (
                <div className="text-xs text-zinc-500">
                  Trade currency:{' '}
                  <span className="text-zinc-300">
                    {String(zoraCoin.poolCurrencyToken.name)}
                  </span>
                </div>
              )}

              {/* Zora-style stats (USD) */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-zinc-800/60">
                <div className="p-3 bg-black/30 border border-zinc-800/70 rounded-lg">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Market Cap</div>
                    {zoraCoin ? (
                      <button
                        type="button"
                        onClick={() => refetchZoraCoin()}
                        disabled={zoraLoading || zoraFetching}
                        className="text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors disabled:opacity-50"
                        title={zoraUpdatedAt ? `Last updated: ${new Date(zoraUpdatedAt).toLocaleTimeString()}` : 'Refresh'}
                      >
                        {zoraLoading || zoraFetching ? '…' : 'Refresh'}
                      </button>
                    ) : null}
                  </div>
                  <div className="text-sm font-mono text-emerald-400 mt-1">{marketCapDisplay}</div>
                </div>
                <div className="p-3 bg-black/30 border border-zinc-800/70 rounded-lg">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">24H Volume</div>
                  <div className="text-sm font-mono text-zinc-200 mt-1">{volume24hDisplay}</div>
                  <div className="text-[10px] text-zinc-700 mt-1">Total: {totalVolumeDisplay}</div>
                </div>
                <div className="p-3 bg-black/30 border border-zinc-800/70 rounded-lg">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Creator Earnings</div>
                    {payoutRecipient && poolCurrencyAddress && coinAddress ? (
                      <button
                        type="button"
                        onClick={() => creatorEarningsQuery.refetch()}
                        disabled={creatorEarningsQuery.isFetching}
                        className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-50"
                        title="Computed from onchain reward events (can take ~30-60s the first time)."
                      >
                        {creatorEarningsQuery.isFetching ? 'Computing…' : creatorEarningsQuery.data ? 'Refresh' : 'Compute'}
                      </button>
                    ) : null}
                  </div>
                  <div className="text-sm font-mono text-zinc-200 mt-1">
                    {creatorEarningsQuery.isFetching ? '…' : creatorEarningsDisplay}
                  </div>
                </div>
              </div>

              {String(zoraCoin?.coinType ?? '').toUpperCase() === 'CONTENT' && (
                <div className="text-xs text-amber-300/90 pt-2 border-t border-zinc-800/60">
                  This is a <span className="font-mono">Content Coin</span>. CreatorVaults can only be created for <span className="font-mono">Creator Coins</span>.
                </div>
              )}

              {isConnected && zoraCoin?.creatorAddress && !isAuthorizedDeployer && (
                <div className="text-xs text-red-400/90">
                  You are connected as <span className="font-mono">{address?.slice(0, 6)}…{address?.slice(-4)}</span>.
                  Only the coin creator or current payout recipient can deploy this vault.
                </div>
              )}

              {/* What will be deployed */}
              <div className="pt-2 border-t border-zinc-800/60">
                <div className="text-xs text-zinc-500 mb-2">Will deploy:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-zinc-400">Vault</div>
                  <div className="text-zinc-300 font-mono">s{String(baseSymbol)}</div>
                  <div className="text-zinc-400">ShareOFT</div>
                  <div className="text-zinc-300 font-mono">{derivedShareSymbol}</div>
                  <div className="text-zinc-400">Wrapper</div>
                  <div className="text-zinc-500">+ Gauge + CCA</div>
                </div>
              </div>

              {/* Oracle Toggle - Compact */}
              <label className="flex items-center justify-between pt-2 border-t border-zinc-800/60 cursor-pointer">
                <div className="text-xs text-zinc-400">
                  Include Oracle <span className="text-zinc-600">(for V4 pool)</span>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={includeOracle}
                    onChange={(e) => setIncludeOracle(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-800 rounded-full peer-checked:bg-cyan-600/60 transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-zinc-400 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all" />
                </div>
              </label>
            </div>
          ) : (
            <div className="text-sm text-red-400/80">
              Could not read token. Is this a valid ERC-20?
            </div>
          )}
        </motion.div>
      )}

      {tokenIsValid && (
        <div className="text-center">
          <Link
            to={`/coin/${creatorToken}/manage`}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Manage coin settings
          </Link>
        </div>
      )}

      {/* Deploy Button / Component */}
      {!isConnected ? (
        <button
          disabled
          className="w-full py-4 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
        >
          Connect wallet to deploy
        </button>
      ) : tokenIsValid && zoraCoin && String(zoraCoin.coinType ?? '').toUpperCase() !== 'CREATOR' ? (
        <button
          disabled
          className="w-full py-4 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
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
          includeOracle={includeOracle}
        />
      ) : tokenIsValid && (symbolLoading || zoraLoading) ? (
        <button
          disabled
          className="w-full py-4 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
        >
          Loading…
        </button>
      ) : tokenIsValid && zoraCoin && !isAuthorizedDeployer ? (
        <button
          disabled
          className="w-full py-4 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
        >
          Authorized only: connect the coin’s creator or payout recipient wallet to deploy
        </button>
      ) : (
        <button
          disabled
          className="w-full py-4 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
        >
          Enter token address to continue
        </button>
      )}

      {/* Info Footer */}
      <div className="text-center text-xs text-zinc-600 space-y-1">
        <p>One signature deploys 5-6 contracts via CREATE2</p>
        <p>Recommended: Coinbase Smart Wallet. If you set a vault owner wallet, you can deploy from it using an owner EOA.</p>
      </div>
    </div>
  )
}
