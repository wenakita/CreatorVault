import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { formatUnits, parseEther, encodeFunctionData } from 'viem'
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  PartyPopper,
  Zap,
  Trophy,
  ArrowRight,
  ExternalLink,
  Wallet,
  Clock,
  Target,
  Flame,
} from 'lucide-react'
import { CONTRACTS, AKITA } from '../config/contracts'
import { ConnectButton } from '../components/ConnectButton'

// CCA Strategy ABI
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
  {
    name: 'sweepCurrency',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getTaxHookCalldata',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'target', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getCompleteAuctionCalldata',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'calldatas', type: 'bytes[]' },
    ],
    stateMutability: 'view',
  },
  { name: 'auctionToken', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { name: 'feeRecipient', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { name: 'taxRateBps', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const

// Tax Hook ABI (for direct calls)
const TAX_HOOK_ABI = [
  {
    name: 'setTaxConfig',
    type: 'function',
    inputs: [
      { name: 'token_', type: 'address' },
      { name: 'counterAsset_', type: 'address' },
      { name: 'recipient_', type: 'address' },
      { name: 'taxRate_', type: 'uint256' },
      { name: 'counterIsEth', type: 'bool' },
      { name: 'enabled_', type: 'bool' },
      { name: 'lock_', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

type Step = 'check' | 'sweep' | 'configure' | 'complete'

export function CompleteAuction() {
  const { strategy } = useParams()
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const [currentStep, setCurrentStep] = useState<Step>('check')
  const [error, setError] = useState<string | null>(null)

  // Default to AKITA CCA strategy if not provided
  const strategyAddress = (strategy || AKITA.ccaStrategy) as `0x${string}`

  // Read auction status
  const { data: auctionStatus, refetch: refetchStatus } = useReadContract({
    address: strategyAddress,
    abi: CCA_STRATEGY_ABI,
    functionName: 'getAuctionStatus',
  })

  // Read token address
  const { data: tokenAddress } = useReadContract({
    address: strategyAddress,
    abi: CCA_STRATEGY_ABI,
    functionName: 'auctionToken',
  })

  // Read fee recipient (GaugeController)
  const { data: feeRecipient } = useReadContract({
    address: strategyAddress,
    abi: CCA_STRATEGY_ABI,
    functionName: 'feeRecipient',
  })

  // Read tax rate
  const { data: taxRate } = useReadContract({
    address: strategyAddress,
    abi: CCA_STRATEGY_ABI,
    functionName: 'taxRateBps',
  })

  // Step 1: Sweep Currency (completes auction, configures oracle)
  const {
    writeContract: sweepCurrency,
    data: sweepTxHash,
    isPending: isSweeping,
    error: sweepError,
  } = useWriteContract()
  const { isLoading: isSweepConfirming, isSuccess: isSweepSuccess } = useWaitForTransactionReceipt({
    hash: sweepTxHash,
  })

  // Step 2: Configure Tax Hook (6.9% fee)
  const {
    writeContract: configureTaxHook,
    data: configTxHash,
    isPending: isConfiguring,
    error: configError,
  } = useWriteContract()
  const { isLoading: isConfigConfirming, isSuccess: isConfigSuccess } = useWaitForTransactionReceipt({
    hash: configTxHash,
  })

  // Update step based on transaction status
  useEffect(() => {
    if (isSweepSuccess && !isConfigSuccess) {
      setCurrentStep('configure')
    } else if (isConfigSuccess) {
      setCurrentStep('complete')
    }
  }, [isSweepSuccess, isConfigSuccess])

  const handleSweepCurrency = () => {
    setError(null)
    sweepCurrency({
      address: strategyAddress,
      abi: CCA_STRATEGY_ABI,
      functionName: 'sweepCurrency',
    })
  }

  const handleConfigureTaxHook = () => {
    if (!tokenAddress || !feeRecipient) {
      setError('Missing token or fee recipient address')
      return
    }
    setError(null)

    configureTaxHook({
      address: CONTRACTS.taxHook as `0x${string}`,
      abi: TAX_HOOK_ABI,
      functionName: 'setTaxConfig',
      args: [
        tokenAddress,           // wsToken address
        '0x0000000000000000000000000000000000000000' as `0x${string}`, // ETH
        feeRecipient,           // GaugeController
        taxRate || 690n,        // 6.9%
        true,                   // counterIsEth
        true,                   // enabled
        false,                  // not locked
      ],
    })
  }

  const formatEth = (value: bigint | undefined) => {
    if (!value) return '0'
    return Number(formatUnits(value, 18)).toFixed(4)
  }

  // Parse auction data
  const auctionAddress = auctionStatus?.[0]
  const isActive = auctionStatus?.[1]
  const isGraduated = auctionStatus?.[2]
  const clearingPrice = auctionStatus?.[3]
  const currencyRaised = auctionStatus?.[4]

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 max-w-md text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto">
            <Wallet className="w-8 h-8 text-brand-500" />
          </div>
          <h2 className="font-display text-2xl font-bold">Connect Your Wallet</h2>
          <p className="text-surface-400">
            Connect your wallet to complete your auction
          </p>
          <ConnectButton />
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-500 text-sm font-medium">
          <PartyPopper className="w-4 h-4" />
          Click 2: Complete Auction
        </div>
        <h1 className="font-display text-3xl font-bold">Finalize Your Vault</h1>
        <p className="text-surface-400">
          Your CCA has graduated! Complete the setup to enable trading.
        </p>
      </motion.div>

      {/* Auction Status Card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-brand-500" />
          Auction Status
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-surface-900/50">
            <p className="text-xs text-surface-500 uppercase tracking-wider mb-1">Status</p>
            {isGraduated ? (
              <p className="font-semibold text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Graduated
              </p>
            ) : isActive ? (
              <p className="font-semibold text-yellow-400 flex items-center gap-2">
                <Clock className="w-4 h-4" /> In Progress
              </p>
            ) : (
              <p className="font-semibold text-surface-400">Not Started</p>
            )}
          </div>
          <div className="p-4 rounded-xl bg-surface-900/50">
            <p className="text-xs text-surface-500 uppercase tracking-wider mb-1">ETH Raised</p>
            <p className="font-semibold text-lg">{formatEth(currencyRaised)} ETH</p>
          </div>
        </div>

        {!isGraduated && isActive && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
            <p className="font-medium">⏳ Auction Still Active</p>
            <p className="mt-1 text-amber-300/70">
              Wait for the auction to graduate (reach required raise) before completing.
            </p>
          </div>
        )}
      </motion.div>

      {/* Steps */}
      {isGraduated && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 space-y-6"
        >
          {/* Step 1: Sweep Currency */}
          <div className={`p-4 rounded-xl border ${
            currentStep === 'check' || currentStep === 'sweep'
              ? 'bg-brand-500/5 border-brand-500/30'
              : isSweepSuccess
              ? 'bg-green-500/5 border-green-500/30'
              : 'bg-surface-900/30 border-surface-800'
          }`}>
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isSweepSuccess
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-brand-500/20 text-brand-400'
              }`}>
                {isSweeping || isSweepConfirming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isSweepSuccess ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="font-bold">1</span>
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">Complete Auction</h4>
                <p className="text-surface-400 text-sm mt-1">
                  Sweep raised ETH to vault and configure the price oracle.
                </p>
                {!isSweepSuccess && currentStep !== 'configure' && currentStep !== 'complete' && (
                  <button
                    onClick={handleSweepCurrency}
                    disabled={isSweeping || isSweepConfirming}
                    className="btn-primary mt-4 flex items-center gap-2"
                  >
                    {isSweeping || isSweepConfirming ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isSweeping ? 'Confirming...' : 'Processing...'}
                      </>
                    ) : (
                      <>
                        Sweep Currency
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
                {sweepTxHash && (
                  <a
                    href={`https://basescan.org/tx/${sweepTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 mt-2"
                  >
                    View transaction <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Configure Tax Hook */}
          <div className={`p-4 rounded-xl border ${
            currentStep === 'configure'
              ? 'bg-brand-500/5 border-brand-500/30'
              : isConfigSuccess
              ? 'bg-green-500/5 border-green-500/30'
              : 'bg-surface-900/30 border-surface-800'
          }`}>
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isConfigSuccess
                  ? 'bg-green-500/20 text-green-400'
                  : currentStep === 'configure'
                  ? 'bg-brand-500/20 text-brand-400'
                  : 'bg-surface-800 text-surface-500'
              }`}>
                {isConfiguring || isConfigConfirming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isConfigSuccess ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="font-bold">2</span>
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">Enable 6.9% Trade Fee</h4>
                <p className="text-surface-400 text-sm mt-1">
                  Configure the V4 hook to collect fees for jackpot & burns.
                </p>
                
                {/* Fee breakdown */}
                <div className="flex gap-4 mt-3 text-xs">
                  <span className="flex items-center gap-1 text-yellow-400">
                    <Trophy className="w-3 h-3" /> 90% Jackpot
                  </span>
                  <span className="flex items-center gap-1 text-red-400">
                    <Flame className="w-3 h-3" /> 5% Burn
                  </span>
                  <span className="flex items-center gap-1 text-brand-400">
                    <Zap className="w-3 h-3" /> 5% Protocol
                  </span>
                </div>

                {currentStep === 'configure' && !isConfigSuccess && (
                  <button
                    onClick={handleConfigureTaxHook}
                    disabled={isConfiguring || isConfigConfirming}
                    className="btn-primary mt-4 flex items-center gap-2"
                  >
                    {isConfiguring || isConfigConfirming ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isConfiguring ? 'Confirming...' : 'Configuring...'}
                      </>
                    ) : (
                      <>
                        Configure Tax Hook
                        <Zap className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
                {configTxHash && (
                  <a
                    href={`https://basescan.org/tx/${configTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 mt-2"
                  >
                    View transaction <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Errors */}
          {(sweepError || configError || error) && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-sm mt-1">
                {error || sweepError?.message || configError?.message}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Success State */}
      <AnimatePresence>
        {currentStep === 'complete' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-8 text-center space-y-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto"
            >
              <PartyPopper className="w-10 h-10 text-green-400" />
            </motion.div>
            <h2 className="font-display text-2xl font-bold">
              🎉 Vault Activated!
            </h2>
            <p className="text-surface-400">
              Your vault is now live on Uniswap V4 with 6.9% trade fees enabled.
              Every buy is a lottery entry!
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate(`/vault/${AKITA.vault}`)}
                className="btn-primary flex items-center justify-center gap-2"
              >
                View Vault
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href={`https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=${tokenAddress}&chain=base`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex items-center justify-center gap-2"
              >
                Trade on Uniswap
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

