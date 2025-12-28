import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseUnits, formatUnits, erc20Abi } from 'viem'
import {
  Rocket,
  CheckCircle2,
  Circle,
  Loader2,
  ArrowRight,
  AlertCircle,
  Wallet,
  Zap,
  PartyPopper,
} from 'lucide-react'
import { CONTRACTS } from '../config/contracts'
import { ConnectButton } from '../components/ConnectButton'

// Step states
type StepStatus = 'pending' | 'active' | 'loading' | 'complete' | 'error'

interface Step {
  id: number
  title: string
  description: string
  status: StepStatus
}

// VaultActivator ABI (simplified)
const VAULT_ACTIVATOR_ABI = [
  {
    name: 'activate',
    type: 'function',
    inputs: [
      { name: 'vault', type: 'address' },
      { name: 'wrapper', type: 'address' },
      { name: 'ccaStrategy', type: 'address' },
      { name: 'depositAmount', type: 'uint256' },
      { name: 'auctionPercent', type: 'uint256' },
      { name: 'requiredRaise', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'activateSimple',
    type: 'function',
    inputs: [
      { name: 'vault', type: 'address' },
      { name: 'wrapper', type: 'address' },
      { name: 'depositAmount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

export function Launch() {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const [tokenAddress, setTokenAddress] = useState('')
  const [depositAmount, setDepositAmount] = useState('100000000')
  const [auctionPercent, setAuctionPercent] = useState('50')
  const [requiredRaise, setRequiredRaise] = useState('0.1')
  const [currentStep, setCurrentStep] = useState(0)

  // For now, use AKITA addresses as example - in production, these would come from deployment
  const [vaultAddress] = useState('')
  const [wrapperAddress] = useState('')
  const [ccaAddress] = useState('')

  // Read token info
  const { data: tokenSymbol } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'symbol',
    query: { enabled: tokenAddress.length === 42 },
  })

  const { data: tokenDecimals } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: tokenAddress.length === 42 },
  })

  const { data: tokenBalance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: tokenAddress.length === 42 && !!address },
  })

  // Approve transaction
  const { writeContract: approve, data: approveTxHash, isPending: isApproving } = useWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  })

  // Activate transaction
  const { writeContract: activate, data: activateTxHash, isPending: isActivating } = useWriteContract()
  const { isLoading: isActivateConfirming, isSuccess: isActivateSuccess } = useWaitForTransactionReceipt({
    hash: activateTxHash,
  })

  const steps: Step[] = [
    {
      id: 1,
      title: 'Enter Token',
      description: 'Paste your Creator Coin address',
      status: tokenAddress.length === 42 ? 'complete' : currentStep === 0 ? 'active' : 'pending',
    },
    {
      id: 2,
      title: 'Configure',
      description: 'Set deposit amount & auction params',
      status: currentStep === 1 ? 'active' : currentStep > 1 ? 'complete' : 'pending',
    },
    {
      id: 3,
      title: 'Approve',
      description: 'Allow vault to use your tokens',
      status: isApproving || isApproveConfirming ? 'loading' : isApproveSuccess ? 'complete' : currentStep === 2 ? 'active' : 'pending',
    },
    {
      id: 4,
      title: 'Launch',
      description: 'Deploy vault & start auction',
      status: isActivating || isActivateConfirming ? 'loading' : isActivateSuccess ? 'complete' : currentStep === 3 ? 'active' : 'pending',
    },
  ]

  const handleApprove = () => {
    if (!tokenAddress || !tokenDecimals) return
    
    approve({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'approve',
      args: [CONTRACTS.vaultActivator, parseUnits(depositAmount, tokenDecimals)],
    })
  }

  const handleActivate = () => {
    if (!vaultAddress || !wrapperAddress || !ccaAddress || !tokenDecimals) return

    activate({
      address: CONTRACTS.vaultActivator,
      abi: VAULT_ACTIVATOR_ABI,
      functionName: 'activate',
      args: [
        vaultAddress as `0x${string}`,
        wrapperAddress as `0x${string}`,
        ccaAddress as `0x${string}`,
        parseUnits(depositAmount, tokenDecimals),
        BigInt(auctionPercent),
        parseUnits(requiredRaise, 18),
      ],
    })
  }

  const getStepIcon = (step: Step) => {
    switch (step.status) {
      case 'complete':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'loading':
        return <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
      case 'active':
        return <Circle className="w-5 h-5 text-brand-500 fill-brand-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <Circle className="w-5 h-5 text-surface-600" />
    }
  }

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
            Connect your wallet to launch your Creator Vault
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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 text-brand-500 text-sm font-medium">
          <Rocket className="w-4 h-4" />
          Click 1 of 2
        </div>
        <h1 className="font-display text-3xl font-bold">Launch Your Vault</h1>
        <p className="text-surface-400">
          Deploy contracts & start fair launch auction (CCA)
        </p>
        
        {/* 2-Click Flow Explainer */}
        <div className="flex items-center justify-center gap-4 pt-2 text-xs text-surface-500">
          <div className="flex items-center gap-1.5 text-brand-400">
            <div className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[10px] font-bold">1</div>
            Deploy + Launch CCA
          </div>
          <ArrowRight className="w-3 h-3" />
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-surface-700 text-surface-400 flex items-center justify-center text-[10px] font-bold">2</div>
            Complete Auction
          </div>
        </div>
      </motion.div>

      {/* Progress Steps */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-4"
      >
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                {getStepIcon(step)}
                <span
                  className={`text-xs mt-1 ${
                    step.status === 'active' || step.status === 'complete'
                      ? 'text-white'
                      : 'text-surface-500'
                  }`}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 sm:w-24 h-0.5 mx-2 ${
                    step.status === 'complete' ? 'bg-brand-500' : 'bg-surface-800'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Main Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-6 space-y-6"
      >
        {/* Step 1: Token Address */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-surface-300">
            Creator Coin Address
          </label>
          <input
            type="text"
            value={tokenAddress}
            onChange={(e) => {
              setTokenAddress(e.target.value)
              if (e.target.value.length === 42) setCurrentStep(1)
            }}
            placeholder="0x..."
            className="input-field font-mono"
          />
          {tokenSymbol && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 text-sm"
            >
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-surface-300">
                Found: <span className="font-semibold text-white">{tokenSymbol}</span>
              </span>
              {tokenBalance !== undefined && tokenDecimals !== undefined && (
                <span className="text-surface-500">
                  • Balance: {Number(formatUnits(tokenBalance, tokenDecimals)).toLocaleString()}
                </span>
              )}
            </motion.div>
          )}
        </div>

        {/* Step 2: Configuration */}
        <AnimatePresence>
          {currentStep >= 1 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pt-4 border-t border-surface-800"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-surface-300">
                    Deposit Amount
                  </label>
                  <input
                    type="text"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="input-field"
                  />
                  <p className="text-xs text-surface-500">Tokens to stake in vault</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-surface-300">
                    Auction Percent
                  </label>
                  <input
                    type="text"
                    value={auctionPercent}
                    onChange={(e) => setAuctionPercent(e.target.value)}
                    className="input-field"
                  />
                  <p className="text-xs text-surface-500">% of wsTokens for fair launch</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-surface-300">
                  Required Raise (ETH)
                </label>
                <input
                  type="text"
                  value={requiredRaise}
                  onChange={(e) => setRequiredRaise(e.target.value)}
                  className="input-field"
                />
                <p className="text-xs text-surface-500">
                  Minimum ETH to raise for auction graduation
                </p>
              </div>

              <button
                onClick={() => setCurrentStep(2)}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 3: Approve */}
        <AnimatePresence>
          {currentStep >= 2 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pt-4 border-t border-surface-800"
            >
              <div className="glass-card p-4 bg-brand-500/5 border-brand-500/20">
                <h3 className="font-semibold mb-2">Summary</h3>
                <div className="space-y-1 text-sm text-surface-400">
                  <p>
                    Token: <span className="text-white">{tokenSymbol || 'Unknown'}</span>
                  </p>
                  <p>
                    Deposit: <span className="text-white">{Number(depositAmount).toLocaleString()} tokens</span>
                  </p>
                  <p>
                    Auction: <span className="text-white">{auctionPercent}% of wrapped shares</span>
                  </p>
                  <p>
                    Min Raise: <span className="text-white">{requiredRaise} ETH</span>
                  </p>
                </div>
              </div>

              {!isApproveSuccess ? (
                <button
                  onClick={handleApprove}
                  disabled={isApproving || isApproveConfirming}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isApproving || isApproveConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isApproving ? 'Confirming...' : 'Approving...'}
                    </>
                  ) : (
                    <>
                      Approve {tokenSymbol}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => setCurrentStep(3)}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Approved! Continue
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 4: Launch */}
        <AnimatePresence>
          {currentStep >= 3 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pt-4 border-t border-surface-800"
            >
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
                <p className="font-medium">⚠️ Demo Mode</p>
                <p className="mt-1 text-amber-300/70">
                  Full deployment requires vault contracts. Use existing AKITA vault to test activation.
                </p>
              </div>

              <button
                onClick={handleActivate}
                disabled={isActivating || isActivateConfirming || !vaultAddress}
                className="btn-primary w-full flex items-center justify-center gap-2 text-lg py-4"
              >
                {isActivating || isActivateConfirming ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isActivating ? 'Confirming...' : 'Launching...'}
                  </>
                ) : isActivateSuccess ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Launched!
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5" />
                    Launch Vault
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Success State */}
      <AnimatePresence>
        {isActivateSuccess && (
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
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </motion.div>
            <h2 className="font-display text-2xl font-bold">
              Deployment Complete
            </h2>
            <p className="text-surface-400">
              Your vault is deployed and the CCA auction is live! 
              Once the auction graduates (reaches the required raise), 
              proceed to Click 2 to complete setup.
            </p>
            
            {/* Next Steps */}
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-left">
              <p className="font-semibold text-yellow-400 flex items-center gap-2">
                <PartyPopper className="w-4 h-4" />
                What's Next?
              </p>
              <ul className="mt-2 space-y-1 text-sm text-surface-300">
                <li>1. Wait for the CCA auction to graduate</li>
                <li>2. Once graduated, click "Complete Auction" to finalize</li>
                <li>3. This enables 6.9% trade fees & Buy-To-Win lottery</li>
              </ul>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('/complete-auction')}
                className="btn-primary flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Go to Click 2
              </button>
              <a
                href={`https://basescan.org/tx/${activateTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex items-center justify-center gap-2"
              >
                View Transaction
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
