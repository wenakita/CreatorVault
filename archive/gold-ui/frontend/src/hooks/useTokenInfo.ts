import { useReadContract } from 'wagmi'

const ERC20_METADATA_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function useTokenInfo(tokenAddress?: string | null) {
  const address =
    typeof tokenAddress === 'string' && isAddressLike(tokenAddress)
      ? (tokenAddress.toLowerCase() as `0x${string}`)
      : undefined

  const nameQuery = useReadContract({
    address,
    abi: ERC20_METADATA_ABI,
    functionName: 'name',
    query: {
      enabled: Boolean(address),
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 0,
    },
  })

  const symbolQuery = useReadContract({
    address,
    abi: ERC20_METADATA_ABI,
    functionName: 'symbol',
    query: {
      enabled: Boolean(address),
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 0,
    },
  })

  return {
    name: typeof nameQuery.data === 'string' ? nameQuery.data : null,
    symbol: typeof symbolQuery.data === 'string' ? symbolQuery.data : null,
    isLoading: nameQuery.isLoading || symbolQuery.isLoading,
  }
}
