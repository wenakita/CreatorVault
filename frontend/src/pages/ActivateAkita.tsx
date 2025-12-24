import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseUnits, formatUnits, erc20Abi } from 'viem'
import {
  Rocket,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { AKITA } from '../config/contracts'
import { ConnectButton } from '../components/ConnectButton'

// ABIs for the 3-step process
const VAULT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const

const WRAPPER_ABI = [
  {
    name: 'wrap',
    type: 'function',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [{ name: 'wsTokens', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const

const CCA_ABI = [
  {
    name: 'launchAuctionSimple',
    type: 'function',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'requiredRaise', type: 'uint128' },
    ],
    outputs: [{ name: 'auction', type: 'address' }],
    stateMutability: 'nonpayable',
  },
] as const

type Step = {
  id: string
  label: string
  description: string
  status: 'pending' | 'current' | 'completed' | 'error'
}

export function ActivateAkita() {
  const { address, isConnected } = useAccount()
  const [depositAmount, setDepositAmount] = useState('100000000') // 100M AKITA
  const [auctionPercent, setAuctionPercent] = useState('50') // 50% to auction
  const [requiredRaise, setRequiredRaise] = useState('0.1') // 0.1 ETH minimum
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // Read AKITA balance
  const { data: tokenBalance } = useReadContract({
    address: AKITA.token as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // Read vault shares balance (to continue from step 2 if interrupted)
  const { data: vaultSharesBalance } = useReadContract({
    address: AKITA.vault as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // Read wsAKITA balance
  const { data: wsAkitaBalance } = useReadContract({
    address: AKITA.shareOFT as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // Transaction hooks
  const { writeContract, data: txHash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, isError, error } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  const depositAmountBigInt = parseUnits(depositAmount, 18)
  const requiredRaiseBigInt = parseUnits(requiredRaise, 18)

  const steps: Step[] = [
    {
      id: 'approve-vault',
      label: 'Approve AKITA',
      description: 'Allow vault to receive your AKITA tokens',
      status: currentStepIndex > 0 ? 'completed' : currentStepIndex === 0 ? 'current' : 'pending',
    },
    {
      id: 'deposit-vault',
      label: 'Deposit to Vault',
      description: 'Deposit AKITA into vault',
      status: currentStepIndex > 1 ? 'completed' : currentStepIndex === 1 ? 'current' : 'pending',
    },
    {
      id: 'approve-wrapper',
      label: 'Approve Vault Shares',
      description: 'Allow wrapper to convert your shares',
      status: currentStepIndex > 2 ? 'completed' : currentStepIndex === 2 ? 'current' : 'pending',
    },
    {
      id: 'wrap-shares',
      label: 'Wrap to wsAKITA',
      description: 'Convert vault shares to wsAKITA tokens',
      status: currentStepIndex > 3 ? 'completed' : currentStepIndex === 3 ? 'current' : 'pending',
    },
    {
      id: 'approve-cca',
      label: 'Approve wsAKITA',
      description: 'Allow CCA to access tokens for auction',
      status: currentStepIndex > 4 ? 'completed' : currentStepIndex === 4 ? 'current' : 'pending',
    },
    {
      id: 'launch-auction',
      label: 'Launch Auction',
      description: 'Start the 7-day CCA auction',
      status: currentStepIndex > 5 ? 'completed' : currentStepIndex === 5 ? 'current' : 'pending',
    },
  ]

  // Auto-advance when transaction succeeds
  useEffect(() => {
    if (isSuccess && currentStepIndex < 6) {
      // Small delay for better UX
      setTimeout(() => {
        setCurrentStepIndex(prev => prev + 1)
        reset()
      }, 1000)
    }
  }, [isSuccess, currentStepIndex, reset])

  const executeCurrentStep = () => {
    switch (currentStepIndex) {
      case 0: // Approve AKITA to Vault
        writeContract({
          address: AKITA.token as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [AKITA.vault as `0x${string}`, depositAmountBigInt],
        })
        break

      case 1: // Deposit AKITA to Vault
        writeContract({
          address: AKITA.vault as `0x${string}`,
          abi: VAULT_ABI,
          functionName: 'deposit',
          args: [depositAmountBigInt, address!],
        })
        break

      case 2: // Approve vault shares to Wrapper
        const sharesToApprove = vaultSharesBalance || depositAmountBigInt
        writeContract({
          address: AKITA.vault as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [AKITA.wrapper as `0x${string}`, sharesToApprove],
        })
        break

      case 3: // Wrap shares to wsAKITA
        const sharesToWrap = vaultSharesBalance || depositAmountBigInt
        writeContract({
          address: AKITA.wrapper as `0x${string}`,
          abi: WRAPPER_ABI,
          functionName: 'wrap',
          args: [sharesToWrap],
        })
        break

      case 4: // Approve wsAKITA to CCA
        const wsTokensToApprove = wsAkitaBalance || depositAmountBigInt
        const auctionAmount = (wsTokensToApprove * BigInt(auctionPercent)) / 100n
        writeContract({
          address: AKITA.shareOFT as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [AKITA.ccaStrategy as `0x${string}`, auctionAmount],
        })
        break

      case 5: // Launch CCA Auction
        const wsTokensToAuction = wsAkitaBalance || depositAmountBigInt
        const finalAuctionAmount = (wsTokensToAuction * BigInt(auctionPercent)) / 100n
        writeContract({
          address: AKITA.ccaStrategy as `0x${string}`,
          abi: CCA_ABI,
          functionName: 'launchAuctionSimple',
          args: [finalAuctionAmount, BigInt(requiredRaiseBigInt)],
        })
        break
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <Rocket className="w-16 h-16 text-brand-500 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold mb-2">Launch AKITA Auction</h2>
            <p className="text-slate-400 mb-6">
              Connect your wallet to activate the AKITA vault and start the CCA auction
            </p>
            <ConnectButton />
          </div>
        </motion.div>
      </div>
    )
  }

  // Success state
  if (currentStepIndex >= 6) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6 max-w-2xl"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto"
          >
            <CheckCircle2 className="w-12 h-12 text-green-400" />
          </motion.div>

          <div>
            <h2 className="text-3xl font-bold mb-3">Auction Launched Successfully!</h2>
            <p className="text-slate-400 text-lg mb-6">
              The 7-day AKITA CCA auction is now live and accepting bids
            </p>
          </div>

          <div className="glass-card p-6 text-left space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Auction Duration</span>
              <span className="font-semibold">7 Days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Tokens Available</span>
              <span className="font-semibold">{(Number(depositAmount) * Number(auctionPercent) / 100).toLocaleString()} wsAKITA</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Minimum Raise</span>
              <span className="font-semibold">{requiredRaise} ETH</span>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <a href={`/auction/bid/${AKITA.vault}`}>
              <button className="btn-primary px-8 py-3">
                View Auction →
              </button>
            </a>
            <a href="/dashboard">
              <button className="btn-secondary px-8 py-3">
                Back to Dashboard
              </button>
            </a>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="text-center">
        <Rocket className="w-12 h-12 text-brand-500 mx-auto mb-4" />
        <h1 className="text-4xl font-bold mb-2">Launch AKITA Auction</h1>
        <p className="text-slate-400">
          Multi-step activation process to start the CCA auction
        </p>
      </div>

      {/* Progress Steps */}
      <div className="glass-card p-6">
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
                step.status === 'current'
                  ? 'bg-brand-500/10 border border-brand-500/30'
                  : step.status === 'completed'
                  ? 'bg-green-500/10 border border-green-500/30'
                  : 'bg-white/[0.02] border border-white/5'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.status === 'completed'
                    ? 'bg-green-500 text-white'
                    : step.status === 'current'
                    ? 'bg-brand-500 text-white'
                    : 'bg-white/10 text-slate-500'
                }`}
              >
                {step.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-bold">{index + 1}</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-1">{step.label}</h3>
                <p className="text-sm text-slate-400">{step.description}</p>
              </div>
              {step.status === 'current' && (isPending || isConfirming) && (
                <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Configuration (only show on first step) */}
      {currentStepIndex === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 space-y-6"
        >
          <h2 className="text-xl font-bold">Launch Parameters</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Deposit Amount (AKITA)
              </label>
              <input
                type="text"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="input-field w-full"
                placeholder="100000000"
              />
              <p className="text-xs text-slate-500 mt-1">
                Your balance: {tokenBalance ? formatUnits(tokenBalance, 18) : '0'} AKITA
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Auction Allocation (%)
              </label>
              <input
                type="text"
                value={auctionPercent}
                onChange={(e) => setAuctionPercent(e.target.value)}
                className="input-field w-full"
                placeholder="50"
              />
              <p className="text-xs text-slate-500 mt-1">
                Auction: {(Number(depositAmount) * Number(auctionPercent) / 100).toLocaleString()} wsAKITA, 
                You keep: {(Number(depositAmount) * (100 - Number(auctionPercent)) / 100).toLocaleString()} wsAKITA
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Minimum Raise (ETH)
              </label>
              <input
                type="text"
                value={requiredRaise}
                onChange={(e) => setRequiredRaise(e.target.value)}
                className="input-field w-full"
                placeholder="0.1"
              />
              <p className="text-xs text-slate-500 mt-1">
                Auction must raise at least this much ETH to succeed
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Action Button */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={executeCurrentStep}
          disabled={isPending || isConfirming}
          className="btn-primary px-12 py-4 text-lg disabled:opacity-50"
        >
          {isPending || isConfirming ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {isPending ? 'Confirm in Wallet...' : 'Processing...'}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {steps[currentStepIndex].label}
              <ArrowRight className="w-5 h-5" />
            </span>
          )}
        </button>

        {isError && (
          <div className="text-red-400 text-sm text-center">
            Transaction failed. Please try again.
            {error && <div className="text-xs mt-1">{error.message}</div>}
          </div>
        )}

        <p className="text-xs text-slate-500 text-center max-w-md">
          Step {currentStepIndex + 1} of 6 • Each step requires wallet confirmation
        </p>
      </div>
    </div>
  )
}
