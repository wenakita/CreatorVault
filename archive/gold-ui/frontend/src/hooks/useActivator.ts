import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { parseUnits } from 'viem'
import { CONTRACTS } from '../config/contracts'

const ACTIVATOR_ABI = [
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

export interface ActivateParams {
  vault: `0x${string}`
  wrapper: `0x${string}`
  ccaStrategy: `0x${string}`
  depositAmount: string
  auctionPercent: number
  requiredRaiseEth: string
  tokenDecimals?: number
}

export interface ActivateSimpleParams {
  vault: `0x${string}`
  wrapper: `0x${string}`
  depositAmount: string
  tokenDecimals?: number
}

export function useActivator() {
  const { address: userAddress } = useAccount()

  const {
    writeContract: activate,
    data: activateTxHash,
    isPending: isActivating,
    reset: resetActivate,
    error: activateError,
  } = useWriteContract()

  const {
    isLoading: isActivateConfirming,
    isSuccess: isActivateSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash: activateTxHash })

  const handleActivate = ({
    vault,
    wrapper,
    ccaStrategy,
    depositAmount,
    auctionPercent,
    requiredRaiseEth,
    tokenDecimals = 18,
  }: ActivateParams) => {
    if (!userAddress) return

    activate({
      address: CONTRACTS.vaultActivator,
      abi: ACTIVATOR_ABI,
      functionName: 'activate',
      args: [
        vault,
        wrapper,
        ccaStrategy,
        parseUnits(depositAmount, tokenDecimals),
        BigInt(auctionPercent),
        parseUnits(requiredRaiseEth, 18),
      ],
    })
  }

  const handleActivateSimple = ({
    vault,
    wrapper,
    depositAmount,
    tokenDecimals = 18,
  }: ActivateSimpleParams) => {
    if (!userAddress) return

    activate({
      address: CONTRACTS.vaultActivator,
      abi: ACTIVATOR_ABI,
      functionName: 'activateSimple',
      args: [vault, wrapper, parseUnits(depositAmount, tokenDecimals)],
    })
  }

  return {
    handleActivate,
    handleActivateSimple,
    activateTxHash,
    isActivating,
    isActivateConfirming,
    isActivateSuccess,
    activateError,
    confirmError,
    resetActivate,
    isConnected: !!userAddress,
  }
}
