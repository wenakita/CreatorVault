import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, usePublicClient } from 'wagmi'
import { isAddress, type Address } from 'viem'
import { base } from 'wagmi/chains'
import { useIsOwner } from './useLinkedSmartWallet'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

// Creator Coin ABI for ownership checks
const CREATOR_COIN_ABI = [
  {
    inputs: [],
    name: 'payoutRecipient',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'index', type: 'uint256' }],
    name: 'ownerAt',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalOwners',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

type OwnerRole = 'smartWallet' | 'privy' | 'eoa' | 'payoutRecipient' | 'unknown'

interface CreatorCoinOwners {
  /** All owner addresses from the contract */
  owners: Address[]
  /** The payout recipient address */
  payoutRecipient: Address | null
  /** Owner roles by index (0=smartWallet, 1=privy, 2=eoa) */
  ownerRoles: Map<Address, OwnerRole>
}

/**
 * Fetch all ownership info from a creator coin contract
 */
async function fetchCreatorCoinOwners(
  publicClient: any,
  coinAddress: Address,
): Promise<CreatorCoinOwners> {
  const owners: Address[] = []
  const ownerRoles = new Map<Address, OwnerRole>()
  let payoutRecipient: Address | null = null

  try {
    // Get payout recipient
    const recipient = await publicClient.readContract({
      address: coinAddress,
      abi: CREATOR_COIN_ABI,
      functionName: 'payoutRecipient',
    })
    if (recipient && recipient !== ZERO_ADDRESS) {
      payoutRecipient = recipient as Address
      ownerRoles.set(payoutRecipient, 'payoutRecipient')
    }
  } catch {
    // Not a creator coin or doesn't have payoutRecipient
  }

  try {
    // Get total owners
    const totalOwners = await publicClient.readContract({
      address: coinAddress,
      abi: CREATOR_COIN_ABI,
      functionName: 'totalOwners',
    })

    const count = Number(totalOwners)
    const roleNames: OwnerRole[] = ['smartWallet', 'privy', 'eoa']

    // Fetch each owner
    for (let i = 0; i < count; i++) {
      try {
        const owner = await publicClient.readContract({
          address: coinAddress,
          abi: CREATOR_COIN_ABI,
          functionName: 'ownerAt',
          args: [BigInt(i)],
        })
        if (owner && owner !== ZERO_ADDRESS) {
          owners.push(owner as Address)
          ownerRoles.set(owner as Address, roleNames[i] ?? 'unknown')
        }
      } catch {
        // Skip invalid index
      }
    }
  } catch {
    // Contract doesn't support totalOwners/ownerAt
  }

  return { owners, payoutRecipient, ownerRoles }
}

/**
 * Hook to check if the connected user is an owner/admin of a creator coin.
 *
 * This handles the EOA → Smart Wallet relationship:
 * - Checks if connected EOA is directly an owner
 * - Checks if connected EOA's linked Smart Wallet is an owner
 * - Checks if connected address is the payout recipient
 *
 * @param creatorCoinAddress - The creator coin contract address
 */
export function useCreatorCoinOwnership(creatorCoinAddress: Address | string | undefined) {
  const { address: connectedAddress } = useAccount()
  const publicClient = usePublicClient({ chainId: base.id })

  const coinAddr = typeof creatorCoinAddress === 'string' && isAddress(creatorCoinAddress)
    ? (creatorCoinAddress as Address)
    : undefined

  // Fetch ownership data from the contract
  const ownersQuery = useQuery({
    queryKey: ['creatorCoin', 'owners', coinAddr],
    queryFn: () => fetchCreatorCoinOwners(publicClient, coinAddr!),
    enabled: !!coinAddr && !!publicClient,
    staleTime: 1000 * 60 * 2, // Cache for 2 min
  })

  const { owners, payoutRecipient, ownerRoles } = ownersQuery.data ?? {
    owners: [],
    payoutRecipient: null,
    ownerRoles: new Map(),
  }

  // Combine owners and payoutRecipient for ownership check
  const allOwnerAddresses = useMemo(() => {
    const set = new Set<Address>(owners)
    if (payoutRecipient) set.add(payoutRecipient)
    return Array.from(set)
  }, [owners, payoutRecipient])

  // Use the ownership hook with EOA → Smart Wallet resolution
  const {
    isOwner,
    matchedAddress,
    eoa,
    smartWallet,
    source,
    isLoading: ownershipLoading,
  } = useIsOwner(connectedAddress, allOwnerAddresses)

  // Determine the role if we matched
  const matchedRole = useMemo(() => {
    if (!matchedAddress) return null
    return ownerRoles.get(matchedAddress as Address) ?? null
  }, [matchedAddress, ownerRoles])

  // Is this user the payout recipient specifically?
  const isPayoutRecipient = useMemo(() => {
    if (!payoutRecipient) return false
    if (eoa && eoa.toLowerCase() === payoutRecipient.toLowerCase()) return true
    if (smartWallet && smartWallet.toLowerCase() === payoutRecipient.toLowerCase()) return true
    return false
  }, [eoa, smartWallet, payoutRecipient])

  const isLoading = ownersQuery.isLoading || ownershipLoading
  const error = ownersQuery.error

  return {
    /** Whether the connected user is an owner of this creator coin */
    isOwner,
    /** Whether the connected user is the payout recipient */
    isPayoutRecipient,
    /** True if user is owner OR payout recipient (i.e., has admin rights) */
    isAdmin: isOwner || isPayoutRecipient,
    /** The address that matched (could be EOA or Smart Wallet) */
    matchedAddress,
    /** The role of the matched address: 'smartWallet' | 'privy' | 'eoa' | 'payoutRecipient' */
    matchedRole,
    /** The connected EOA */
    eoa,
    /** The linked Smart Wallet (if resolved) */
    smartWallet,
    /** How the Smart Wallet was discovered: 'zora' | 'onchain' | null */
    smartWalletSource: source,
    /** All owner addresses from the contract */
    owners,
    /** The payout recipient address */
    payoutRecipient,
    /** Loading state */
    isLoading,
    /** Any error */
    error,
  }
}

/**
 * Simplified hook that just returns isAdmin status
 */
export function useIsCreatorCoinAdmin(creatorCoinAddress: Address | string | undefined) {
  const { isAdmin, isLoading, matchedRole } = useCreatorCoinOwnership(creatorCoinAddress)
  return { isAdmin, isLoading, role: matchedRole }
}
