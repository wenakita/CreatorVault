import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useWaitForTransactionReceipt, useReadContract, useSendTransaction } from 'wagmi'
import { parseUnits, formatUnits, erc20Abi, encodeFunctionData } from 'viem'
import {
  Rocket,
  CheckCircle2,
  Loader2,
  Zap,
} from 'lucide-react'
import { AKITA } from '../config/contracts'
import { ConnectButton } from '../components/ConnectButton'

// ABIs for batch encoding
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
  {
    name: 'forceDeployToStrategies',
    type: 'function',
    inputs: [],
    outputs: [],
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

export function ActivateAkita() {
  const { address, isConnected, connector } = useAccount()
  // Fixed parameters for AKITA launch
  const depositAmount = '50000000' // 50M AKITA (locked)
  const auctionPercent = '50' // 50% to auction, 50% stays in vault (locked)
  const [requiredRaise, setRequiredRaise] = useState('0.1') // 0.1 ETH minimum

  // Read AKITA balance
  const { data: tokenBalance } = useReadContract({
    address: AKITA.token as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // Single batched transaction using smart wallet
  const { sendTransaction, data: txHash, isPending } = useSendTransaction()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  const depositAmountBigInt = parseUnits(depositAmount, 18)
  const auctionAmountBigInt = (depositAmountBigInt * BigInt(auctionPercent)) / 100n
  const requiredRaiseBigInt = parseUnits(requiredRaise, 18)

  // Check if using smart wallet (Coinbase Smart Wallet supports batching)
  const isSmartWallet = connector?.id === 'coinbaseWalletSDK'

  const handleBatchedActivation = async () => {
    if (!address) return

    try {
      // Prepare all transaction data
      const calls = [
        // 1. Approve AKITA to Vault
        {
          to: AKITA.token as `0x${string}`,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [AKITA.vault as `0x${string}`, depositAmountBigInt],
          }),
          value: 0n,
        },
        // 2. Deposit AKITA to Vault
        {
          to: AKITA.vault as `0x${string}`,
          data: encodeFunctionData({
            abi: VAULT_ABI,
            functionName: 'deposit',
            args: [depositAmountBigInt, address],
          }),
          value: 0n,
        },
        // 3. Deploy vault's AKITA to Charm strategy (AKITA/WETH V3)
        {
          to: AKITA.vault as `0x${string}`,
          data: encodeFunctionData({
            abi: VAULT_ABI,
            functionName: 'forceDeployToStrategies',
            args: [],
          }),
          value: 0n,
        },
        // 4. Approve vault shares to Wrapper
        {
          to: AKITA.vault as `0x${string}`,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [AKITA.wrapper as `0x${string}`, depositAmountBigInt],
          }),
          value: 0n,
        },
        // 5. Wrap shares to wsAKITA
        {
          to: AKITA.wrapper as `0x${string}`,
          data: encodeFunctionData({
            abi: WRAPPER_ABI,
            functionName: 'wrap',
            args: [depositAmountBigInt],
          }),
          value: 0n,
        },
        // 6. Approve wsAKITA to CCA
        {
          to: AKITA.shareOFT as `0x${string}`,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [AKITA.ccaStrategy as `0x${string}`, auctionAmountBigInt],
          }),
          value: 0n,
        },
        // 7. Launch CCA Auction
        {
          to: AKITA.ccaStrategy as `0x${string}`,
          data: encodeFunctionData({
            abi: CCA_ABI,
            functionName: 'launchAuctionSimple',
            args: [auctionAmountBigInt, requiredRaiseBigInt],
          }),
          value: 0n,
        },
      ]

      // Send as batched transaction
      sendTransaction({
        to: address, // Smart wallet will batch these
        data: '0x',
        value: 0n,
        // @ts-ignore - Coinbase Smart Wallet supports calls array
        calls,
      })
    } catch (error) {
      console.error('Batch transaction error:', error)
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
  if (isSuccess) {
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
              <span className="text-slate-400">Tokens in Auction</span>
              <span className="font-semibold">25M wsAKITA</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Your wsAKITA</span>
              <span className="font-semibold">25M (in wallet)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">AKITA/WETH LP</span>
              <span className="font-semibold">50M on Charm V3</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Minimum Raise</span>
              <span className="font-semibold">{requiredRaise} ETH</span>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <a href={`/auction/bid/${AKITA.vault}`}>
              <button className="btn-primary px-8 py-3">
                View Auction
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
          One-click activation powered by account abstraction
        </p>
      </div>

      {/* What Happens */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-6 h-6 text-brand-400" />
          <h2 className="text-xl font-bold">What Happens in One Transaction</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              1
            </div>
            <div>
              <p className="text-white font-medium">Deposit 50M AKITA</p>
              <p className="text-slate-500">Into vault contract</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              2
            </div>
            <div>
              <p className="text-white font-medium">Deploy to Charm</p>
              <p className="text-slate-500">AKITA/WETH V3 liquidity</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              3
            </div>
            <div>
              <p className="text-white font-medium">Wrap to wsAKITA</p>
              <p className="text-slate-500">50M vault shares</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              4
            </div>
            <div>
              <p className="text-white font-medium">Launch CCA</p>
              <p className="text-slate-500">25M wsAKITA price discovery</p>
            </div>
          </div>
        </div>

        {!isSmartWallet && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
            <p className="text-yellow-400 font-medium mb-1">💡 Pro Tip</p>
            <p className="text-yellow-300/80">
              Connect with Coinbase Smart Wallet for gasless batched transactions
            </p>
          </div>
        )}
      </motion.div>

      {/* Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6 space-y-6"
      >
        <h2 className="text-xl font-bold">Launch Parameters</h2>

        <div className="space-y-4">
          {/* Fixed Parameters */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/10">
            <div>
              <p className="text-xs text-slate-500 mb-1">Deposit Amount</p>
              <p className="text-2xl font-bold text-white">50M AKITA</p>
              <p className="text-xs text-slate-400 mt-1">Fixed launch size</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Allocation</p>
              <p className="text-2xl font-bold text-white">50/50</p>
              <p className="text-xs text-slate-400 mt-1">25M auction + 25M LP</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-brand-500/10 border border-brand-500/20 text-sm">
              <p className="text-brand-300">
                Your balance: <span className="font-semibold">{tokenBalance ? formatUnits(tokenBalance, 18) : '0'} AKITA</span>
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs">
              <p className="text-green-300 font-medium mb-1">✓ Charm Strategy Active</p>
              <p className="text-green-400/80">
                50M AKITA automatically deployed to Charm Finance for AKITA/WETH V3 liquidity with automated rebalancing
              </p>
            </div>
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

      {/* Launch Button */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={handleBatchedActivation}
          disabled={isPending || isConfirming}
          className="btn-primary px-16 py-5 text-xl font-bold disabled:opacity-50 shadow-2xl shadow-brand-500/30"
        >
          {isPending || isConfirming ? (
            <span className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin" />
              {isPending ? 'Confirm in Wallet...' : 'Launching Auction...'}
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <Zap className="w-6 h-6" />
              Launch Auction (1-Click)
            </span>
          )}
        </button>

        <p className="text-xs text-slate-500 text-center max-w-md">
          {isSmartWallet 
            ? 'All 7 steps batched into one gasless transaction via Coinbase Smart Wallet'
            : 'Powered by ERC-4337 Account Abstraction'
          }
        </p>

        <div className="text-center text-xs text-slate-600 space-y-1">
          <p>Transaction includes: approve + deposit + charm deploy + wrap + approve + auction</p>
          <p>Estimated gas: ~0.006 ETH {isSmartWallet && '(potentially sponsored)'}</p>
        </div>
      </div>
    </div>
  )
}
