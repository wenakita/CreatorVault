import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useAccount, usePublicClient, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { formatUnits, getAddress, isAddress, parseUnits, erc20Abi, type Address } from 'viem'
import { base } from 'viem/chains'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  ExternalLink,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import { AKITA } from '../config/contracts'
import { ConnectButton } from '../components/ConnectButton'
import { Link, useParams } from 'react-router-dom'
import { CcaAuctionPanel } from '@/components/cca/CcaAuctionPanel'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import { useZoraCoin } from '@/lib/zora/hooks'
import { resolveCreatorVaultByAnyAddress } from '@/lib/onchain/creatorVaultResolve'
import { OrbBorder } from '@/components/brand/OrbBorder'
import { TokenOrb } from '@/components/brand/TokenOrb'
import { SHARE_SYMBOL_PREFIX, toShareSymbol } from '@/lib/tokenSymbols'

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
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

function TokenAvatar({
  image,
  symbol,
  badge,
}: {
  image: string
  symbol: string
  badge?: string
}) {
  return (
    <div className="relative w-11 h-11 shrink-0">
      <div className="absolute inset-0 rounded-full overflow-hidden bg-black border border-white/10 shadow-[inset_0_0_24px_rgba(0,0,0,0.9)]">
        {image ? (
          <img src={image} alt={symbol} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.06] via-black to-black">
            <span className="font-serif text-white/80 select-none">{symbol.trim()?.[0]?.toUpperCase() || '?'}</span>
          </div>
        )}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_32px_rgba(0,0,0,0.85)]" />
        <div className="absolute inset-0 pointer-events-none opacity-35 mix-blend-overlay bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.75)_0%,transparent_60%)]" />
      </div>

      {badge ? (
        <div
          className="absolute -bottom-1 -right-1 rounded-full backdrop-blur-md border border-brand-primary/20 bg-black/70 text-brand-accent font-mono leading-none text-[10px] px-2 py-0.5"
          aria-label={badge === SHARE_SYMBOL_PREFIX ? `Share token (${SHARE_SYMBOL_PREFIX}TOKEN)` : badge}
          title={badge === SHARE_SYMBOL_PREFIX ? `Share token (${SHARE_SYMBOL_PREFIX}TOKEN)` : badge}
        >
          {badge}
        </div>
      ) : null}
    </div>
  )
}

export function Vault() {
  const params = useParams()
  const addressParamRaw = typeof params.address === 'string' ? params.address.trim() : ''
  const addressParam = addressParamRaw && isAddress(addressParamRaw) ? (getAddress(addressParamRaw) as Address) : null

  const akitaFallback = useMemo(() => {
    if (!addressParam) return false
    const lc = addressParam.toLowerCase()
    return (
      lc === String(AKITA.vault).toLowerCase() ||
      lc === String(AKITA.wrapper).toLowerCase() ||
      lc === String(AKITA.shareOFT).toLowerCase() ||
      lc === String(AKITA.token).toLowerCase() ||
      lc === String(AKITA.ccaStrategy).toLowerCase()
    )
  }, [addressParam])

  const publicClient = usePublicClient({ chainId: base.id })
  const { data: resolved, isLoading: resolveLoading, error: resolveError } = useQuery({
    queryKey: ['creatorVaultResolve', base.id, addressParam ?? ''],
    queryFn: async () => {
      if (!publicClient || !addressParam) return null
      return await resolveCreatorVaultByAnyAddress(publicClient, addressParam)
    },
    enabled: Boolean(publicClient && addressParam),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  })

  const { address: userAddress, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<TabType>('Deposit')
  const [amount, setAmount] = useState('')

  const tokenAddress = (resolved?.token ?? (akitaFallback ? (AKITA.token as Address) : null)) as Address | null
  const wrapperAddress = (resolved?.info.wrapper ?? (akitaFallback ? (AKITA.wrapper as Address) : null)) as Address | null
  const shareOFTAddress = (resolved?.info.shareOFT ?? (akitaFallback ? (AKITA.shareOFT as Address) : null)) as Address | null
  const vaultAddress = (resolved?.info.vault ?? (akitaFallback ? (AKITA.vault as Address) : null)) as Address | null
  const ccaStrategy = (resolved?.ccaStrategy ?? (akitaFallback ? (AKITA.ccaStrategy as Address) : null)) as Address | null

  const underlyingSymbol = useMemo(() => {
    const s = (resolved?.info.symbol ?? '').trim()
    if (s) return s
    return akitaFallback ? 'AKITA' : 'TOKEN'
  }, [akitaFallback, resolved?.info.symbol])

  const shareSymbol = useMemo(() => toShareSymbol(underlyingSymbol), [underlyingSymbol])

  const tokenDecimalsEnabled = Boolean(tokenAddress)
  const shareDecimalsEnabled = Boolean(shareOFTAddress)

  const { data: tokenDecimals } = useReadContract({
    address: (tokenAddress ?? ZERO_ADDRESS) as `0x${string}`,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: tokenDecimalsEnabled },
  })

  const { data: shareDecimals } = useReadContract({
    address: (shareOFTAddress ?? ZERO_ADDRESS) as `0x${string}`,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: shareDecimalsEnabled },
  })

  const creatorDecimals = typeof tokenDecimals === 'number' ? tokenDecimals : 18
  const shareTokenDecimals = typeof shareDecimals === 'number' ? shareDecimals : 18

  const { data: tokenBalance } = useReadContract({
    address: (tokenAddress ?? ZERO_ADDRESS) as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: { enabled: !!userAddress && Boolean(tokenAddress) },
  })

  const { data: shareBalance } = useReadContract({
    address: (shareOFTAddress ?? ZERO_ADDRESS) as `0x${string}`,
    abi: SHARE_OFT_ABI,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: { enabled: !!userAddress && Boolean(shareOFTAddress) },
  })

  const { data: totalShareSupply } = useReadContract({
    address: (shareOFTAddress ?? ZERO_ADDRESS) as `0x${string}`,
    abi: SHARE_OFT_ABI,
    functionName: 'totalSupply',
    query: { enabled: Boolean(shareOFTAddress) },
  })

  const { data: auctionStatus } = useReadContract({
    address: (ccaStrategy ?? ZERO_ADDRESS) as `0x${string}`,
    abi: CCA_STRATEGY_ABI,
    functionName: 'getAuctionStatus',
    query: { enabled: Boolean(ccaStrategy) },
  })

  const { data: tokenAllowance } = useReadContract({
    address: (tokenAddress ?? ZERO_ADDRESS) as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [userAddress!, (wrapperAddress ?? ZERO_ADDRESS) as `0x${string}`],
    query: { enabled: !!userAddress && activeTab === 'Deposit' && Boolean(wrapperAddress) && Boolean(tokenAddress) },
  })

  const { writeContract: writeApprove, data: approveHash } = useWriteContract()
  const { writeContract: writeDeposit, data: depositHash } = useWriteContract()
  const { writeContract: writeWithdraw, data: withdrawHash } = useWriteContract()

  const { isLoading: isApproving } = useWaitForTransactionReceipt({ hash: approveHash })
  const { isLoading: isDepositing } = useWaitForTransactionReceipt({ hash: depositHash })
  const { isLoading: isWithdrawing } = useWaitForTransactionReceipt({ hash: withdrawHash })

  const isAuctionActive = auctionStatus?.[1] || false
  const isGraduated = auctionStatus?.[2] || false
  const isUnlocked = isAuctionActive || isGraduated
  const canManageVault = isGraduated
  const phaseLabel = isAuctionActive ? 'Auction Phase' : isGraduated ? 'Vault Active' : 'Not Launched'

  // Prefer Zora indexed preview image (fast), then onchain tokenURI metadata.
  const { data: zoraCoin } = useZoraCoin(tokenAddress ?? undefined)
  const zoraPreview =
    zoraCoin?.mediaContent?.previewImage?.medium ||
    zoraCoin?.mediaContent?.previewImage?.small ||
    undefined
  const { imageUrl } = useTokenMetadata(tokenAddress ?? undefined)
  const heroImage = zoraPreview || imageUrl || '/logo.svg'

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
      args: [wrapperAddress as `0x${string}`, parseUnits(amount, creatorDecimals)],
    })
  }

  const handleDeposit = () => {
    if (!amount || !tokenAddress || !wrapperAddress) return
    writeDeposit({
      address: wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: 'deposit',
      args: [parseUnits(amount, creatorDecimals)],
    })
  }

  const handleWithdraw = () => {
    if (!amount || !wrapperAddress) return
    writeWithdraw({
      address: wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: 'withdraw',
      args: [parseUnits(amount, shareTokenDecimals)],
    })
  }

  const needsApproval =
    activeTab === 'Deposit' &&
    Boolean(tokenAddress && wrapperAddress) &&
    (!tokenAllowance || tokenAllowance < parseUnits(amount || '0', creatorDecimals))

  const canResolve = Boolean(publicClient && addressParam)
  const showResolveError = canResolve && !akitaFallback && Boolean(resolveError)
  const showNotFound = canResolve && !akitaFallback && !resolveLoading && !resolved && !showResolveError

  if (!addressParam) {
    return (
      <div className="relative pb-24 md:pb-0">
        <section className="cinematic-section">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="rounded-3xl border border-white/5 bg-[#080808]/50 backdrop-blur-2xl px-6 py-10 sm:p-10">
              <span className="label">Vault</span>
              <h1 className="headline text-3xl sm:text-5xl mt-4">Invalid vault address</h1>
              <p className="text-zinc-600 text-sm font-light mt-4">Check the URL and try again.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/dashboard" className="btn-accent inline-flex items-center justify-center rounded-full px-5 py-3 text-xs">
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  if (showResolveError || showNotFound) {
    return (
      <div className="relative pb-24 md:pb-0">
        <section className="cinematic-section">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="rounded-3xl border border-white/5 bg-[#080808]/50 backdrop-blur-2xl px-6 py-10 sm:p-10">
              <span className="label">Vault</span>
              <h1 className="headline text-3xl sm:text-5xl mt-4">
                {showResolveError ? 'Could not load vault' : 'Vault not registered'}
              </h1>
              <p className="text-zinc-600 text-sm font-light mt-4">
                {showResolveError
                  ? 'We could not resolve this vault from the onchain registry right now.'
                  : 'This address is not recognized by the onchain registry.'}
              </p>
              <div className="mt-3 text-[11px] font-mono text-zinc-600 break-all">{addressParam}</div>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/dashboard" className="btn-accent inline-flex items-center justify-center rounded-full px-5 py-3 text-xs">
                  Back to Dashboard
                </Link>
                <a
                  href={`https://basescan.org/address/${addressParam}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-xs"
                >
                  View on Basescan <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

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
            className="relative overflow-hidden rounded-3xl border border-white/5 bg-[#080808]/50 backdrop-blur-2xl px-6 py-10 sm:p-10"
          >
            {/* Atmosphere */}
            <motion.div
              aria-hidden
              animate={{ scale: [1, 1.12, 1], opacity: isUnlocked ? [0.18, 0.28, 0.18] : [0.08, 0.12, 0.08], x: [0, 40, 0] }}
              transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-32 -right-24 w-[640px] h-[640px] bg-brand-primary/10 rounded-full blur-[140px] pointer-events-none"
            />
            <motion.div
              aria-hidden
              animate={{ scale: [1, 1.08, 1], opacity: [0.06, 0.1, 0.06], y: [0, -30, 0] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute -top-32 -left-24 w-[520px] h-[520px] bg-zinc-500/10 rounded-full blur-[140px] pointer-events-none"
            />

            <div className="relative z-10 grid lg:grid-cols-[260px_minmax(0,1fr)] gap-8 sm:gap-10 items-center">
              {/* Vessel */}
              <div className="mx-auto lg:mx-0">
                <div className="relative w-56 h-56 sm:w-64 sm:h-64">
                  <OrbBorder intensity={isUnlocked ? 'high' : 'medium'}>
                    <div className="w-full h-full p-[6px] bg-obsidian rounded-full">
                      <div className="w-full h-full rounded-full overflow-hidden relative shadow-[inset_0_0_20px_black]">
                        <TokenOrb image={heroImage} isUnlocked={isUnlocked} symbol={underlyingSymbol} />
                      </div>
                    </div>
                  </OrbBorder>

                  {/* Corner mark */}
                  <div className="absolute -bottom-1 -right-1 rounded-full backdrop-blur-md border border-brand-primary/20 bg-black/70 text-brand-accent font-mono leading-none text-[11px] px-2 py-0.5">
                    {SHARE_SYMBOL_PREFIX}
                  </div>
                </div>
              </div>

              {/* HUD */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ opacity: isUnlocked ? [1, 0.55, 1] : 1 }}
                    transition={{ duration: 2.2, repeat: isUnlocked ? Infinity : 0, ease: 'easeInOut' }}
                    className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(212,175,55,0.35)] ${
                      isUnlocked ? 'bg-emerald-400' : 'bg-zinc-700'
                    }`}
                  />
                  <span className="text-[10px] tracking-[0.34em] uppercase font-medium text-zinc-500">
                    {phaseLabel}
                  </span>
                </div>

                <div className="mt-3 flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <span className="label mt-2 block">Creator Vault</span>
                    <h1 className="headline text-4xl sm:text-6xl mt-3">
                      {underlyingSymbol}{' '}
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent italic">
                        Vault
                      </span>
                    </h1>
                    <p className="text-zinc-600 text-sm font-light mono mt-3">
                      {underlyingSymbol} → {shareSymbol}
                    </p>
                  </div>

                  <div className="shrink-0 hidden sm:flex flex-col items-end gap-3">
                    <div className="bg-black/20 px-3 py-1.5 rounded-full border border-white/5 flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand-primary" />
                      <span className="text-[10px] font-mono text-zinc-400">ERC-4626 • Base</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  {wrapperAddress ? (
                    <a
                      href={`https://basescan.org/address/${wrapperAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-xs"
                    >
                      View wrapper <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : null}
                  {vaultAddress ? (
                    <Link
                      to={`/status?vault=${encodeURIComponent(vaultAddress)}`}
                      className="btn-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-xs"
                      title="Verification checks"
                    >
                      Status checks <ShieldCheck className="w-3 h-3 text-emerald-300" />
                    </Link>
                  ) : null}
                  {canManageVault ? (
                    <a
                      href="#manage"
                      className="inline-flex items-center justify-center gap-2 rounded-full btn-accent px-5 py-3 text-xs text-center"
                    >
                      Manage position
                    </a>
                  ) : (
                    <a
                      href="#auction"
                      className="inline-flex items-center justify-center gap-2 rounded-full btn-accent px-5 py-3 text-xs text-center"
                    >
                      Auction panel
                    </a>
                  )}
                </div>
              </div>
            </div>
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
                  <p className="text-zinc-500 text-sm font-light">Get {shareSymbol} before anyone else</p>
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
          {canManageVault ? (
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] overflow-hidden">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/5">
                <div className="bg-[#080808]/70 backdrop-blur-xl p-5 sm:p-8 space-y-3 sm:space-y-4">
                  <span className="label">Total Supply</span>
                  <div className="value mono text-2xl sm:text-3xl">
                    {totalShareSupply ? formatAmount(totalShareSupply, shareTokenDecimals) : '—'}
                  </div>
                </div>
                <div className="bg-[#080808]/70 backdrop-blur-xl p-5 sm:p-8 space-y-3 sm:space-y-4">
                  <span className="label">APY</span>
                  <div className="value mono text-2xl sm:text-3xl glow-cyan">—</div>
                </div>
                <div className="bg-[#080808]/70 backdrop-blur-xl p-5 sm:p-8 space-y-3 sm:space-y-4">
                  <span className="label">Global Jackpot</span>
                  <div className="value mono text-2xl sm:text-3xl glow-brand">—</div>
                </div>
                <div className="bg-[#080808]/70 backdrop-blur-xl p-5 sm:p-8 space-y-3 sm:space-y-4">
                  <span className="label">Trade Fee</span>
                  <div className="value mono text-2xl sm:text-3xl">—</div>
                </div>
              </div>
            </div>
          ) : null}

          <div id="auction" className="mt-10">
            {ccaStrategy && vaultAddress ? (
              <CcaAuctionPanel
                ccaStrategy={ccaStrategy}
                wsSymbol={shareSymbol}
                vaultAddress={vaultAddress}
              />
            ) : (
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 text-sm text-zinc-600">
                Auction panel is not available for this vault yet.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Deposit/Withdraw */}
      {canManageVault ? (
      <section id="manage" className="cinematic-section">
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
              <div className="w-full inline-flex items-center gap-0.5 rounded-full border border-white/5 bg-black/30 p-0.5 backdrop-blur-sm">
                {tabs.map((tab) => {
                  const active = activeTab === tab
                  const Icon = tab === 'Deposit' ? ArrowDownToLine : ArrowUpFromLine
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      aria-pressed={active}
                      className={`flex-1 h-10 rounded-full flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.18em] transition-colors ${
                        active ? 'bg-zinc-900 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-medium">{tab}</span>
                    </button>
                  )
                })}
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
                          ? formatUnits(tokenBalance || 0n, creatorDecimals)
                          : formatUnits(shareBalance || 0n, shareTokenDecimals)
                      )
                    }
                    className="label text-zinc-600 hover:text-cyan-400 transition-colors text-left sm:text-right"
                  >
                    Max: {activeTab === 'Deposit'
                      ? formatAmount(tokenBalance || 0n, creatorDecimals)
                      : formatAmount(shareBalance || 0n, shareTokenDecimals)}
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
                    <span className="label">{activeTab === 'Deposit' ? underlyingSymbol : shareSymbol}</span>
                  </div>
                </div>

                {amount && (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-4 border-y border-zinc-900/50">
                    <span className="label">You Will Receive</span>
                    <div className="value mono text-lg sm:text-xl glow-cyan sm:text-right whitespace-nowrap">
                      {amount} {activeTab === 'Deposit' ? shareSymbol : underlyingSymbol}
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
                      <span className="label">Approve {underlyingSymbol}</span>
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
                
                <div className="card p-5 sm:p-8">
                  <div className="space-y-6">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center">
                      <TokenAvatar image={heroImage} symbol={underlyingSymbol} badge={SHARE_SYMBOL_PREFIX} />
                      <div className="min-w-0">
                        <div className="text-[10px] tracking-[0.34em] uppercase text-zinc-600">Vault token</div>
                        <div className="text-sm text-zinc-200 mt-1 font-light truncate">{shareSymbol}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xl sm:text-2xl text-zinc-200 tabular-nums glow-cyan">
                          {formatAmount(shareBalance || 0n, shareTokenDecimals)}
                        </div>
                        <div className="text-[10px] text-zinc-700 mt-1">Balance</div>
                      </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center">
                      <TokenAvatar image={heroImage} symbol={underlyingSymbol} />
                      <div className="min-w-0">
                        <div className="text-[10px] tracking-[0.34em] uppercase text-zinc-600">Creator token</div>
                        <div className="text-sm text-zinc-200 mt-1 font-light truncate">{underlyingSymbol}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg sm:text-xl text-zinc-200 tabular-nums">
                          {formatAmount(tokenBalance || 0n, creatorDecimals)}
                        </div>
                        <div className="text-[10px] text-zinc-700 mt-1">Balance</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      ) : null}
    </div>
  )
}
