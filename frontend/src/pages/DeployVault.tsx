import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useConnect, useDisconnect, usePublicClient, useReadContract } from 'wagmi'
import { base } from 'wagmi/chains'
import type { Address } from 'viem'
import { erc20Abi, formatUnits, isAddress } from 'viem'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { coinABI } from '@zoralabs/protocol-deployments'
import { BarChart3, Layers, Lock, Rocket, ShieldCheck } from 'lucide-react'
import { ConnectButton } from '@/components/ConnectButton'
import { DeployVaultAA } from '@/components/DeployVaultAA'
import { DerivedTokenIcon } from '@/components/DerivedTokenIcon'
import { RequestCreatorAccess } from '@/components/RequestCreatorAccess'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useCreatorAllowlist } from '@/hooks'
import { useMiniAppContext } from '@/hooks'
import { useZoraCoin, useZoraProfile } from '@/lib/zora/hooks'
import { fetchCoinMarketRewardsByCoinFromApi } from '@/lib/onchain/coinMarketRewardsByCoin'

const MIN_FIRST_DEPOSIT = 50_000_000n * 10n ** 18n
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type AdminAuthResponse = { address: string; isAdmin: boolean } | null

async function fetchAdminAuth(): Promise<AdminAuthResponse> {
  const res = await fetch('/api/auth/admin', { method: 'GET', headers: { Accept: 'application/json' } })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AdminAuthResponse> | null
  if (!res.ok || !json) return null
  if (!json.success) return null
  return (json.data ?? null) as AdminAuthResponse
}

const COINBASE_SMART_WALLET_OWNER_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const

function ExplainerRow({
  icon,
  label,
  title,
  contractName,
  note,
  metaLine,
}: {
  icon: ReactNode
  label: string
  title: ReactNode
  contractName: string
  note: string
  metaLine?: ReactNode
}) {
  return (
    <div className="px-4 py-4 grid grid-cols-[56px_minmax(0,1fr)_auto] gap-x-4 items-start hover:bg-white/[0.02] transition-colors">
      <div className="w-14 shrink-0 pt-0.5 flex justify-center">{icon}</div>

      <div className="min-w-0">
        <div className="text-[15px] leading-5 text-zinc-100 font-medium truncate min-w-0">{title}</div>

        <div className="text-[11px] text-zinc-500 mt-1 leading-5">
          <span className="inline-flex align-middle items-center rounded-md border border-white/5 bg-black/20 px-2 py-0.5 font-mono text-[10px] leading-4 text-zinc-300">
            {contractName}
          </span>
          {metaLine ? (
            <>
              <span className="text-zinc-800">{' · '}</span>
              <span className="align-middle">{metaLine}</span>
            </>
          ) : null}
        </div>

        <div className="text-[11px] text-zinc-600 leading-relaxed mt-2">{note}</div>
      </div>

      <div className="shrink-0 pt-[3px] text-[10px] leading-4 uppercase tracking-[0.34em] text-zinc-500/90 font-medium whitespace-nowrap text-right">
        {label}
      </div>
    </div>
  )
}

export function DeployVault() {
  const { address, isConnected, connector } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [creatorToken, setCreatorToken] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [deploymentVersion, setDeploymentVersion] = useState<'v1' | 'v2' | 'v3'>('v3')
  const [lastDeployedVault, setLastDeployedVault] = useState<Address | null>(null)
  const [confirmedSmartWallet, setConfirmedSmartWallet] = useState(false)

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
  const miniApp = useMiniAppContext()
  const farcasterProfileQuery = useZoraProfile(miniApp.username ?? undefined)

  const { isSignedIn, busy: authBusy, error: authError, signIn } = useSiweAuth()
  const adminAuthQuery = useQuery({
    queryKey: ['adminAuth'],
    enabled: isConnected && showAdvanced && isSignedIn,
    queryFn: fetchAdminAuth,
    staleTime: 30_000,
    retry: 0,
  })
  const isAdmin = Boolean(adminAuthQuery.data?.isAdmin)

  useEffect(() => {
    // v1 is legacy/admin-only; never allow non-admins to select it.
    if (!isAdmin && deploymentVersion === 'v1') setDeploymentVersion('v3')
  }, [isAdmin, deploymentVersion])

  const detectedCreatorCoin = useMemo(() => {
    const v = myProfile?.creatorCoin?.address ? String(myProfile.creatorCoin.address) : ''
    return isAddress(v) ? (v as Address) : null
  }, [myProfile?.creatorCoin?.address])

  const detectedCreatorCoinFromFarcaster = useMemo(() => {
    const v = farcasterProfileQuery.data?.creatorCoin?.address ? String(farcasterProfileQuery.data.creatorCoin.address) : ''
    return isAddress(v) ? (v as Address) : null
  }, [farcasterProfileQuery.data?.creatorCoin?.address])

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

  // Defensive: some indexers/wallet graphs can incorrectly label an EOA as a "SMART_WALLET".
  // Coinbase Smart Wallet is a contract account onchain, so require bytecode to treat it as a smart wallet.
  const publicClient = usePublicClient({ chainId: base.id })
  const smartWalletBytecodeQuery = useQuery({
    queryKey: ['bytecode', 'smartWallet', detectedSmartWallet],
    enabled: !!publicClient && !!detectedSmartWallet,
    queryFn: async () => {
      return await publicClient!.getBytecode({ address: detectedSmartWallet as Address })
    },
    staleTime: 60_000,
    retry: 0,
  })

  const detectedSmartWalletContract = useMemo(() => {
    const code = smartWalletBytecodeQuery.data
    if (!detectedSmartWallet) return null
    if (!code || code === '0x') return null
    return detectedSmartWallet
  }, [detectedSmartWallet, smartWalletBytecodeQuery.data])

  const autofillRef = useRef<{ tokenFor?: string }>({})
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

  // Mini App fallback: if we have Farcaster context but no connected wallet-based prefill,
  // try prefilling from the Farcaster username → Zora profile lookup.
  useEffect(() => {
    if (prefillToken) return
    if (creatorToken.trim().length > 0) return
    if (!miniApp.username) return
    if (!detectedCreatorCoinFromFarcaster) return
    const key = `miniapp:${miniApp.username.toLowerCase()}`
    if (autofillRef.current.tokenFor === key) return
    setCreatorToken(detectedCreatorCoinFromFarcaster)
    autofillRef.current.tokenFor = key
  }, [prefillToken, creatorToken, miniApp.username, detectedCreatorCoinFromFarcaster])

  const tokenIsValid = isAddress(creatorToken)

  const connectedWalletAddress = useMemo(() => {
    const a = address ? String(address) : ''
    return isAddress(a) ? (a as Address) : null
  }, [address])

  const { data: connectedTokenBalance } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [(connectedWalletAddress ?? ZERO_ADDRESS) as `0x${string}`],
    query: { enabled: tokenIsValid && !!connectedWalletAddress },
  })

  // NOTE: selectedOwnerWallet (smart wallet vs connected wallet) is computed further down once we know
  // payoutRecipient/creatorAddress.

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

  const underlyingSymbolUpper = useMemo(() => {
    if (!underlyingSymbol) return ''
    return underlyingSymbol.toUpperCase()
  }, [underlyingSymbol])

  const derivedVaultSymbol = useMemo(() => {
    if (!underlyingSymbolUpper) return ''
    return `s${underlyingSymbolUpper}`
  }, [underlyingSymbolUpper])

  const derivedVaultName = useMemo(() => {
    if (!underlyingSymbolUpper) return ''
    return `${underlyingSymbolUpper} Vault Share`
  }, [underlyingSymbolUpper])

  const derivedShareSymbol = useMemo(() => {
    if (!underlyingSymbolUpper) return ''
    return `ws${underlyingSymbolUpper}`
  }, [underlyingSymbolUpper])

  const derivedShareName = useMemo(() => {
    if (!underlyingSymbolUpper) return ''
    return `Wrapped ${underlyingSymbolUpper} Vault Share`
  }, [underlyingSymbolUpper])

  const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`
  function formatToken18(raw?: bigint): string {
    if (raw === undefined) return '—'
    const s = formatUnits(raw, 18)
    const n = Number(s)
    if (Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
    return s
  }

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

  // Prefer onchain truth over indexer graphs:
  // If the coin's payoutRecipient is a deployed contract, treat it as the canonical smart wallet.
  // This matches how many creators deploy their Zora coin (Smart Wallet payout recipient).
  const payoutRecipientBytecodeQuery = useQuery({
    queryKey: ['bytecode', 'payoutRecipient', creatorToken, payoutRecipient],
    enabled: !!publicClient && !!payoutRecipient,
    queryFn: async () => {
      return await publicClient!.getBytecode({ address: payoutRecipient as Address })
    },
    staleTime: 60_000,
    retry: 0,
  })

  const payoutRecipientContract = useMemo(() => {
    if (!payoutRecipient) return null
    const code = payoutRecipientBytecodeQuery.data
    if (!code || code === '0x') return null
    return payoutRecipient
  }, [payoutRecipient, payoutRecipientBytecodeQuery.data])

  const { data: payoutRecipientTokenBalance } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [((payoutRecipient ?? ZERO_ADDRESS) as Address) as `0x${string}`],
    query: { enabled: tokenIsValid && !!payoutRecipient },
  })

  void payoutRecipientTokenBalance // reserved for future UX

  const isPayoutRecipient =
    !!address && !!payoutRecipient && address.toLowerCase() === payoutRecipient.toLowerCase()

  // Zora creators often deploy coins from a smart wallet (Privy-managed), then add EOAs later.
  // Treat the Smart Wallet address as canonical and allow the connected EOA to act if it is an onchain owner.
  const coinSmartWallet = useMemo(() => {
    // Highest-confidence: the coin's payout recipient is already a deployed contract.
    // (This is the common Coinbase Smart Wallet setup.)
    if (payoutRecipientContract) return payoutRecipientContract

    // Fallback: use Zora profile-linked wallet graphs if present (requires onchain bytecode).
    if (!detectedSmartWalletContract) return null
    const smartLc = detectedSmartWalletContract.toLowerCase()
    if (payoutRecipient && payoutRecipient.toLowerCase() === smartLc) return detectedSmartWalletContract
    if (creatorAddress && creatorAddress.toLowerCase() === smartLc) return detectedSmartWalletContract
    return null
  }, [payoutRecipientContract, detectedSmartWalletContract, payoutRecipient, creatorAddress])

  // For gas-free 1-click, the connected account must *be* the smart wallet account.
  // Otherwise wagmi will attempt to sendCalls via a connector that doesn't control that account.
  const isConnectedAsSmartWallet = useMemo(() => {
    if (!coinSmartWallet || !address) return false
    return address.toLowerCase() === coinSmartWallet.toLowerCase()
  }, [address, coinSmartWallet])

  const coinbaseSmartWalletConnector = useMemo(() => {
    return connectors.find((c) => String(c.id) === 'coinbaseSmartWallet')
  }, [connectors])

  const smartWalletConnectionHint = useMemo(() => {
    if (!coinSmartWallet) return null
    if (!isConnected) return null
    if (isConnectedAsSmartWallet) return null
    const connectorName = String((connector as any)?.name ?? (connector as any)?.id ?? 'Unknown connector')
    return { connectorName }
  }, [coinSmartWallet, connector, isConnected, isConnectedAsSmartWallet])

  // If the coin was created from a smart wallet (Privy/Coinbase Smart Wallet), prefer using that
  // as the execution account for deployment + the 50M initial deposit.
  //
  // - `coinSmartWallet`: smart wallet address that matches the coin's creator or payoutRecipient.
  // - Fallback to the connected wallet when we cannot confidently identify a smart wallet.
  const selectedOwnerWallet = useMemo(() => {
    return (coinSmartWallet ?? connectedWalletAddress) as Address | null
  }, [coinSmartWallet, connectedWalletAddress])

  const { data: selectedOwnerTokenBalance } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [((selectedOwnerWallet ?? ZERO_ADDRESS) as Address) as `0x${string}`],
    query: { enabled: tokenIsValid && !!selectedOwnerWallet },
  })

  const selectedOwnerHasMinDeposit =
    typeof selectedOwnerTokenBalance === 'bigint' && selectedOwnerTokenBalance >= MIN_FIRST_DEPOSIT

  const smartWalletOwnerQuery = useReadContract({
    address: coinSmartWallet ? (coinSmartWallet as `0x${string}`) : undefined,
    abi: COINBASE_SMART_WALLET_OWNER_ABI,
    functionName: 'isOwnerAddress',
    args: [(connectedWalletAddress ?? ZERO_ADDRESS) as `0x${string}`],
    query: {
      enabled: !!coinSmartWallet && !!connectedWalletAddress && !isOriginalCreator && !isPayoutRecipient,
      retry: false,
    },
  })

  const isAuthorizedViaSmartWallet =
    !!coinSmartWallet && smartWalletOwnerQuery.data === true

  const isAuthorizedDeployer = isOriginalCreator || isPayoutRecipient || isAuthorizedViaSmartWallet

  const creatorAllowlistQuery = useCreatorAllowlist(tokenIsValid ? { coin: creatorToken } : undefined)
  const allowlistMode = creatorAllowlistQuery.data?.mode
  const allowlistEnforced = allowlistMode === 'enforced'
  const isAllowlistedCreator = creatorAllowlistQuery.data?.allowed === true
  const passesCreatorAllowlist = allowlistMode === 'disabled' ? true : isAllowlistedCreator

  const selectedOwnerAddress = selectedOwnerWallet

  void selectedOwnerAddress // reserved for future “deploy as smart wallet” UX
  void selectedOwnerTokenBalance // reserved for future funding UX


  // NOTE: We previously supported an optional “fund owner wallet” helper flow, but it’s not wired into
  // the current UX. Keeping the deploy path deterministic + minimal for now.

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

  // Creator Vaults are creator-initiated. If we can't confidently identify the creator, default to locked.
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
    creatorAllowlistQuery.isSuccess &&
    passesCreatorAllowlist &&
    !!derivedShareSymbol &&
    !!derivedShareName &&
    confirmedSmartWallet && // User must confirm they've sent 50M to their smart wallet
    // If the coin is owned by a Smart Wallet, we must be connected *as that account*
    // to use EIP-5792 batching + paymaster sponsorship.
    (!!coinSmartWallet ? isConnectedAsSmartWallet : true) &&
    !!selectedOwnerAddress &&
    selectedOwnerHasMinDeposit // Must have 50M tokens in the selected owner wallet

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
                Deploy a vault for your Creator Coin on Base. Only the creator or current payout recipient can deploy. Deploy is invite-only during
                early launch.
              </p>
            </div>

            {/* Feature Callout: 1-Click Gas-Free Deployment */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-gradient-to-br from-uniswap/5 to-purple-500/5 border border-uniswap/10 p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-uniswap/10 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-uniswap" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-sm font-medium mb-1">1-Click, Gas-Free Deployment</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed mb-3">
                    Powered by <span className="text-white">EIP-4337</span> account abstraction and <span className="text-white">Coinbase CDP</span>{' '}
                    paymaster. Sign once to deploy your entire vault stack—no gas fees, no multiple confirmations.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-400 bg-black/40 border border-white/5 rounded-full px-2.5 py-1">
                      <ShieldCheck className="w-3 h-3 text-uniswap" />
                      Gas sponsored by Coinbase
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-400 bg-black/40 border border-white/5 rounded-full px-2.5 py-1">
                      <BarChart3 className="w-3 h-3 text-uniswap" />
                      Atomic batch execution
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-400 bg-black/40 border border-white/5 rounded-full px-2.5 py-1">
                      <Lock className="w-3 h-3 text-uniswap" />
                      EIP-5792 smart wallet batching
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

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
                    This token does not appear to be a Zora Coin. Creator Vaults can only be created for Zora{' '}
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
                          <div className="label">Paired token</div>
                          <div className="text-xs text-zinc-300">
                            {String(zoraCoin.poolCurrencyToken.name).toUpperCase()}
                          </div>
                        </div>
                      )}

                      <div className="data-row">
                        <div className="label">Chain</div>
                        <div className="text-xs text-zinc-300 inline-flex items-center gap-2">
                          <img
                            src="/protocols/base.png"
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            className="w-3.5 h-3.5 opacity-90"
                          />
                          Base
                        </div>
                      </div>
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
                        This is a <span className="font-mono">Content Coin</span>. Creator Vaults can only be created for{' '}
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

                      <div className="rounded-2xl border border-white/5 bg-[#080808]/60 backdrop-blur-2xl overflow-hidden divide-y divide-white/5">
                        <div className="px-4 py-2 text-[10px] uppercase tracking-wide text-zinc-500 bg-white/[0.02]">
                          Core stack
                        </div>

                        <ExplainerRow
                          icon={
                            <div className="w-14 h-14 rounded-full bg-black/30 border border-white/5 shadow-[inset_0_0_24px_rgba(0,0,0,0.9)] flex items-center justify-center text-zinc-500">
                              <Lock className="w-5 h-5" />
                            </div>
                          }
                          label="Vault token"
                          title={`${derivedVaultName || '—'} (${derivedVaultSymbol || '—'})`}
                          contractName="CreatorOVault"
                          note="Core vault that holds creator coin deposits and mints shares."
                          metaLine={
                            <>
                              <span className="font-mono text-zinc-400">ERC-4626</span>
                              {' · '}
                              <span className="inline-flex items-center gap-1.5 text-zinc-400">
                                <img
                                  src="/protocols/layerzero.svg"
                                  alt=""
                                  aria-hidden="true"
                                  loading="lazy"
                                  className="w-3.5 h-3.5 opacity-90"
                                />
                                LayerZero
                              </span>
                              {' · '}
                              <span className="inline-flex items-center gap-1.5 text-zinc-400">
                                <img
                                  src="/protocols/yearn.svg"
                                  alt=""
                                  aria-hidden="true"
                                  loading="lazy"
                                  className="w-3.5 h-3.5 opacity-90"
                                />
                                Yearn v3
                              </span>
                            </>
                          }
                        />

                        <ExplainerRow
                          icon={
                            tokenIsValid ? (
                              <DerivedTokenIcon
                                tokenAddress={creatorToken as `0x${string}`}
                                symbol={underlyingSymbolUpper || 'TOKEN'}
                                variant="share"
                                size="lg"
                              />
                            ) : null
                          }
                          label="Share token"
                          title={`${derivedShareName || '—'} (${derivedShareSymbol || '—'})`}
                          contractName="CreatorShareOFT"
                          note="Wrapped vault shares token (wsToken) used for routing fees."
                          metaLine={
                            <>
                              <span className="inline-flex items-center gap-1.5 text-zinc-400">
                                <img
                                  src="/protocols/layerzero.svg"
                                  alt=""
                                  aria-hidden="true"
                                  loading="lazy"
                                  className="w-3.5 h-3.5 opacity-90"
                                />
                                LayerZero OFT
                              </span>
                            </>
                          }
                        />

                        <ExplainerRow
                          icon={
                            <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                              <Layers className="w-4 h-4" />
                            </div>
                          }
                          label="Wrapper"
                          title="Vault Wrapper"
                          contractName="CreatorOVaultWrapper"
                          note="Wraps/unlocks vault shares into the wsToken."
                        />

                        <ExplainerRow
                          icon={
                            <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                              <BarChart3 className="w-4 h-4" />
                            </div>
                          }
                          label="Gauge controller"
                          title="Fees & incentives"
                          contractName="CreatorGaugeController"
                          note="Routes fees (burn / lottery / voters) and manages gauges."
                        />

                        <ExplainerRow
                          icon={
                            <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                              <Rocket className="w-4 h-4" />
                            </div>
                          }
                          label="Launch strategy"
                          title={
                            <a
                              href="https://cca.uniswap.org"
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block max-w-full hover:text-white transition-colors underline underline-offset-4 decoration-white/15 hover:decoration-white/30"
                              title="Open cca.uniswap.org"
                            >
                              Uniswap Continuous Clearing Auction
                            </a>
                          }
                          contractName="CCALaunchStrategy"
                          note="Runs Uniswap’s Continuous Clearing Auction (CCA) for fair price discovery."
                          metaLine={
                            <>
                              <span className="inline-flex items-center gap-1.5 text-zinc-400">
                                <img
                                  src="/protocols/uniswap.png"
                                  alt=""
                                  aria-hidden="true"
                                  loading="lazy"
                                  className="w-3.5 h-3.5 opacity-90"
                                />
                                Uniswap
                              </span>
                            </>
                          }
                        />

                        <ExplainerRow
                          icon={
                            <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                              <ShieldCheck className="w-4 h-4" />
                            </div>
                          }
                          label="Oracle"
                          title="Price oracle"
                          contractName="CreatorOracle"
                          note="Price oracle used by the auction and strategies."
                          metaLine={
                            <>
                              <span className="inline-flex items-center gap-1.5 text-zinc-400">
                                <img
                                  src="/protocols/chainlink.svg"
                                  alt=""
                                  aria-hidden="true"
                                  loading="lazy"
                                  className="w-3.5 h-3.5 opacity-90"
                                />
                                Chainlink
                              </span>
                            </>
                          }
                        />

                        <div className="px-4 py-2 text-[10px] uppercase tracking-wide text-zinc-500 bg-white/[0.02]">
                          Yield strategies (post-auction)
                        </div>
                        <div className="px-4 py-3 text-[12px] text-zinc-500">
                          Yield strategies are deployed after launch (post-auction) to keep the initial deployment deterministic and compatible with
                          wallet simulation.
                        </div>
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

              {/* Deployment */}
              {isConnected && showAdvanced ? (
                <div className="pt-3 border-t border-zinc-900/50 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="label">Deployment</div>
                    <div className="text-[10px] text-zinc-700">
                      {deploymentVersion === 'v3' ? 'Default (v3)' : deploymentVersion === 'v2' ? 'Alt (v2)' : 'Legacy (v1)'}
                    </div>
                  </div>

                  {isAdmin ? (
                    <div className="inline-flex rounded-lg border border-zinc-900/60 bg-black/30 p-1 gap-1">
                      <button
                        type="button"
                        onClick={() => setDeploymentVersion('v3')}
                        className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${
                          deploymentVersion === 'v3'
                            ? 'bg-white/[0.06] text-zinc-100'
                            : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]'
                        }`}
                        title="Default deterministic addresses (v3). Fresh namespace to avoid collisions with earlier deploy attempts."
                      >
                        v3
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeploymentVersion('v2')}
                        className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${
                          deploymentVersion === 'v2'
                            ? 'bg-white/[0.06] text-zinc-100'
                            : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]'
                        }`}
                        title="Alternative deterministic addresses (v2)."
                      >
                        v2
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeploymentVersion('v1')}
                        className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${
                          deploymentVersion === 'v1'
                            ? 'bg-white/[0.06] text-zinc-100'
                            : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]'
                        }`}
                        title="Legacy deterministic addresses (v1). Admin-only."
                      >
                        v1 (admin)
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-600">Using v3 (default). Legacy v1 is admin-only.</div>
                  )}

                  <div className="text-xs text-zinc-600">
                    v3 uses a fresh deterministic address namespace to avoid collisions with earlier deployments. v2 is kept as an alternative.
                    v1 is a legacy fallback and is admin-only.
                  </div>

                  {!isSignedIn ? (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => void signIn()}
                        disabled={authBusy}
                        className="text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-60"
                        title="Admin sign-in unlocks legacy v1 controls if your wallet is allowlisted."
                      >
                        {authBusy ? 'Signing in…' : 'Admin sign-in (optional)'}
                      </button>
                      {authError ? <div className="text-[11px] text-red-400/90 mt-1">{authError}</div> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Smart Wallet Requirement */}
              {isConnected ? (
                <div className="pt-3 border-t border-zinc-900/50 space-y-4">
                  <div>
                    <div className="label mb-2">Your Smart Wallet (Coinbase Wallet)</div>

                    {smartWalletConnectionHint ? (
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                        <div className="text-amber-300/90 text-sm font-medium">Connect as Smart Wallet to deploy</div>
                        <div className="text-amber-300/70 text-xs leading-relaxed">
                          You’re currently connected via <span className="text-white font-mono">{smartWalletConnectionHint.connectorName}</span>.
                          Gas-free 1-click requires connecting as the Smart Wallet account{' '}
                          <span className="text-white font-mono">{short(coinSmartWallet as string)}</span>.
                        </div>
                        {coinbaseSmartWalletConnector ? (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                disconnect()
                              } catch {
                                // ignore
                              }
                              connect({ connector: coinbaseSmartWalletConnector })
                            }}
                            className="btn-accent w-full"
                          >
                            Connect Coinbase Smart Wallet
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Smart wallet address (read-only) */}
                    <input
                      value={String(selectedOwnerWallet ?? address ?? '')}
                      disabled
                      className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-400 placeholder:text-zinc-700 outline-none font-mono opacity-90 cursor-not-allowed"
                    />

                    <div className="text-xs text-zinc-600 space-y-3">
                      <div>
                        This is your <span className="text-white">Coinbase Smart Wallet</span>. It will sign the deployment and fund the first 50M token deposit.
                      </div>

                      {tokenIsValid ? (
                        <>
                          {/* Balance display */}
                          <div className="flex items-center justify-between text-sm p-3 bg-black/40 border border-zinc-800 rounded-lg">
                            <span className="text-zinc-500">Current balance:</span>
                            <span className={selectedOwnerHasMinDeposit ? 'text-emerald-400 font-medium' : 'text-amber-300/90 font-medium'}>
                              {formatToken18(typeof selectedOwnerTokenBalance === 'bigint' ? selectedOwnerTokenBalance : undefined)}{' '}
                              {underlyingSymbolUpper || 'TOKENS'}
                            </span>
                          </div>

                          {/* Warning if insufficient balance */}
                          {!selectedOwnerHasMinDeposit ? (
                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                              <div className="text-amber-300/90 text-sm font-medium">⚠️ Insufficient Balance</div>
                              <div className="text-amber-300/70 text-xs">
                                You need <span className="text-white font-medium">50,000,000 {underlyingSymbolUpper || 'TOKENS'}</span> in this smart wallet to deploy.
                              </div>
                              <div className="text-amber-300/70 text-xs">
                                Please send tokens to: <span className="text-white font-mono">{String(selectedOwnerWallet ?? address ?? '')}</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Confirmation checkbox */}
                              <label className="flex items-start gap-3 p-4 bg-uniswap/5 border border-uniswap/10 rounded-lg cursor-pointer hover:bg-uniswap/8 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={confirmedSmartWallet}
                                  onChange={(e) => setConfirmedSmartWallet(e.target.checked)}
                                  className="mt-0.5 w-4 h-4 rounded border-uniswap/30 bg-black/40 checked:bg-uniswap checked:border-uniswap transition-colors"
                                />
                                <div className="flex-1 min-w-0 text-xs">
                                  <div className="text-white font-medium mb-1">I confirm this is my smart wallet</div>
                                  <div className="text-zinc-500">
                                    I have verified that{' '}
                                    <span className="text-white font-mono">
                                      {String(selectedOwnerWallet ?? address ?? '').slice(0, 10)}...{String(selectedOwnerWallet ?? address ?? '').slice(-8)}
                                    </span>{' '}
                                    is my Coinbase Smart Wallet and contains at least 50M {underlyingSymbolUpper || 'TOKENS'}.
                                  </div>
                                </div>
                              </label>
                            </>
                          )}

                          <div className="text-[11px] text-zinc-700 pt-2">
                            After launch, ownership is transferred to the protocol multisig to lock fee routing.
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

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
                  {coinSmartWallet ? (
                    smartWalletOwnerQuery.isLoading ? (
                      'Verifying owner authorization…'
                    ) : (
                      'Authorized only: connect the coin’s creator/payout wallet (or an owner wallet for the coin owner address).'
                    )
                  ) : (
                    'Authorized only: connect the coin’s creator or payout recipient wallet to deploy'
                  )}
                </button>
              ) : tokenIsValid && zoraCoin && creatorAllowlistQuery.isLoading ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Checking creator access…
                </button>
              ) : tokenIsValid && zoraCoin && creatorAllowlistQuery.isError ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Couldn’t verify creator access. Refresh and try again.
                </button>
              ) : tokenIsValid && zoraCoin && allowlistEnforced && !isAllowlistedCreator ? (
                <RequestCreatorAccess coin={creatorToken} />
              ) : canDeploy && typeof selectedOwnerTokenBalance === 'bigint' && !selectedOwnerHasMinDeposit ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Owner wallet needs 50,000,000 {underlyingSymbolUpper || 'TOKENS'} to deploy & launch
                </button>
              ) : canDeploy ? (
                <DeployVaultAA
                  creatorToken={creatorToken as `0x${string}`}
                  symbol={derivedShareSymbol}
                  name={derivedShareName}
                  deploymentVersion={deploymentVersion}
                  // Keep revenue flowing to the coin's payout recipient by default
                  creatorTreasury={((payoutRecipient ?? (address as Address)) as Address) as `0x${string}`}
                  // If the coin is owned by a smart wallet, execute deployment as that account.
                  executeAs={coinSmartWallet ?? undefined}
                  onSuccess={(a) => setLastDeployedVault(a.vault)}
                />
              ) : (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Enter token address to continue
                </button>
              )}

              <div className="text-xs text-zinc-600 space-y-1">
                <p>Designed for one wallet confirmation (some wallets may require multiple confirmations).</p>
                <p>Requires a 50M token deposit to start the fair launch.</p>
                <p>Advanced: v3 is the default. v1 is admin-only.</p>
              </div>
            </div>

            {/* Status */}
            <div className="card rounded-xl p-8 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="label">Status</div>
                <Link
                  to="/status"
                  className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors whitespace-nowrap"
                >
                  Open
                </Link>
              </div>

              <div className="flex items-start justify-between gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-zinc-200 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-300" />
                    Verification checks
                  </div>
                  <div className="text-xs text-zinc-600 max-w-prose">
                    Verify your vault wiring on Base and generate a shareable report. If a fix is available, it requires an owner transaction.
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/status"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-black/30 border border-zinc-900/60 px-5 py-3 text-sm text-zinc-200 hover:text-white hover:border-white/10 transition-colors"
                >
                  Open status checks
                </Link>

                {lastDeployedVault ? (
                  <Link
                    to={`/status?vault=${encodeURIComponent(lastDeployedVault)}`}
                    className="w-full sm:w-auto btn-accent rounded-lg px-5 py-3 text-sm text-center"
                  >
                    Verify this vault
                  </Link>
                ) : null}
              </div>

              {lastDeployedVault ? (
                <div className="text-[10px] text-zinc-700">
                  Vault: <span className="font-mono break-all text-zinc-500">{lastDeployedVault}</span>
                </div>
              ) : (
                <div className="text-[10px] text-zinc-700">Tip: after deploying, use the vault address shown in the Deploy details panel.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      </section>
    </div>
  )
}
