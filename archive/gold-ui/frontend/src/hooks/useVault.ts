import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { parseUnits, formatUnits, erc20Abi } from 'viem'

const VAULT_ABI = [
  { name: 'deposit', type: 'function', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { name: 'withdraw', type: 'function', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { name: 'redeem', type: 'function', inputs: [{ name: 'shares', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { name: 'totalAssets', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'totalSupply', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'convertToAssets', type: 'function', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'convertToShares', type: 'function', inputs: [{ name: 'assets', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'asset', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { name: 'name', type: 'function', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { name: 'symbol', type: 'function', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
] as const

export function useVault(vaultAddress: `0x${string}`) {
  const { address: userAddress } = useAccount()

  // Read vault info
  const { data: asset } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'asset',
  })

  const { data: name } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'name',
  })

  const { data: symbol } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'symbol',
  })

  const { data: totalAssets, refetch: refetchTotalAssets } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'totalAssets',
  })

  const { data: totalSupply, refetch: refetchTotalSupply } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'totalSupply',
  })

  // User-specific reads
  const { data: userShares, refetch: refetchUserShares } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: { enabled: !!userAddress },
  })

  const { data: userAssets } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'convertToAssets',
    args: [userShares || 0n],
    query: { enabled: !!userShares },
  })

  // Token allowance check
  const { data: tokenAllowance, refetch: refetchAllowance } = useReadContract({
    address: asset as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [userAddress!, vaultAddress],
    query: { enabled: !!userAddress && !!asset },
  })

  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: asset as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: { enabled: !!userAddress && !!asset },
  })

  // Write functions
  const { writeContract: approve, data: approveTxHash, isPending: isApproving, reset: resetApprove } = useWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash })

  const { writeContract: deposit, data: depositTxHash, isPending: isDepositing, reset: resetDeposit } = useWriteContract()
  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositTxHash })

  const { writeContract: withdraw, data: withdrawTxHash, isPending: isWithdrawing, reset: resetWithdraw } = useWriteContract()
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawTxHash })

  const handleApprove = (amount: string, decimals = 18) => {
    if (!asset) return
    approve({
      address: asset as `0x${string}`,
      abi: erc20Abi,
      functionName: 'approve',
      args: [vaultAddress, parseUnits(amount, decimals)],
    })
  }

  const handleDeposit = (amount: string, decimals = 18) => {
    if (!userAddress) return
    deposit({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'deposit',
      args: [parseUnits(amount, decimals), userAddress],
    })
  }

  const handleWithdraw = (amount: string, decimals = 18) => {
    if (!userAddress) return
    withdraw({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'withdraw',
      args: [parseUnits(amount, decimals), userAddress, userAddress],
    })
  }

  const refetchAll = () => {
    refetchTotalAssets()
    refetchTotalSupply()
    refetchUserShares()
    refetchAllowance()
    refetchTokenBalance()
  }

  const formatAmount = (value: bigint | undefined, decimals = 18) => {
    if (!value) return '0'
    return Number(formatUnits(value, decimals)).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    })
  }

  const needsApproval = (amount: string, decimals = 18) => {
    if (!tokenAllowance) return true
    try {
      return parseUnits(amount || '0', decimals) > tokenAllowance
    } catch {
      return true
    }
  }

  return {
    // Vault info
    asset,
    name,
    symbol,
    totalAssets,
    totalSupply,

    // User info
    userShares,
    userAssets,
    tokenBalance,
    tokenAllowance,

    // Actions
    handleApprove,
    handleDeposit,
    handleWithdraw,
    refetchAll,

    // Loading states
    isApproving,
    isApproveConfirming,
    isApproveSuccess,
    isDepositing,
    isDepositConfirming,
    isDepositSuccess,
    isWithdrawing,
    isWithdrawConfirming,
    isWithdrawSuccess,

    // Transaction hashes
    approveTxHash,
    depositTxHash,
    withdrawTxHash,

    // Helpers
    formatAmount,
    needsApproval,
    resetApprove,
    resetDeposit,
    resetWithdraw,
  }
}
