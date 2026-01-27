import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { isAddress, encodeAbiParameters, type Address, type Hex } from 'viem'
import { base } from 'wagmi/chains'
import { useZoraProfile } from '@/lib/zora/hooks'

// Coinbase Smart Wallet ABI for owner lookup
const COINBASE_SMART_WALLET_OWNERS_ABI = [
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
] as const

/**
 * Convert an EOA address to the bytes format used by Coinbase Smart Wallet.
 * Smart Wallet stores owners as 32-byte left-padded address bytes.
 */
function asOwnerBytes(owner: Address): Hex {
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

/**
 * Check if an EOA is an owner of a Coinbase Smart Wallet onchain.
 */
async function checkIsSmartWalletOwner(
  publicClient: any,
  smartWallet: Address,
  eoaAddress: Address,
  maxScan = 10,
): Promise<boolean> {
  try {
    // First check if it's a contract
    const code = await publicClient.getBytecode({ address: smartWallet })
    if (!code || code === '0x') return false

    // Get owner count
    const countRaw = await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'ownerCount',
    })
    const count = Number(countRaw)
    if (!Number.isFinite(count) || count <= 0) return false

    // Check each owner slot
    const expected = asOwnerBytes(eoaAddress).toLowerCase()
    const limit = Math.min(count, maxScan)
    for (let i = 0; i < limit; i++) {
      const ownerBytes = await publicClient.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      })
      if (String(ownerBytes).toLowerCase() === expected) {
        return true
      }
    }
    return false
  } catch {
    // Not a Smart Wallet or call failed
    return false
  }
}

/**
 * Hook to resolve an EOA's linked Coinbase Smart Wallet.
 *
 * Resolution order:
 * 1. Zora profile (if user has linked their Smart Wallet on Zora)
 * 2. Onchain lookup (checks if EOA is owner of any candidate Smart Wallets)
 *
 * @param eoaAddress - The connected EOA address
 * @param candidateSmartWallets - Optional list of addresses to check onchain (e.g., creator coin owners)
 */
export function useLinkedSmartWallet(
  eoaAddress: Address | string | undefined,
  candidateSmartWallets?: Array<Address | string>,
) {
  const addressStr = typeof eoaAddress === 'string' && isAddress(eoaAddress) ? eoaAddress : undefined
  const publicClient = usePublicClient({ chainId: base.id })

  // === Method 1: Zora Profile Lookup ===
  const profileQuery = useZoraProfile(addressStr)
  const profile = profileQuery.data

  // Extract Smart Wallet from linked wallets in Zora profile
  const zoraSmartWallet = useMemo(() => {
    const edges = profile?.linkedWallets?.edges ?? []
    for (const e of edges) {
      const node: any = (e as any)?.node
      const walletType = typeof node?.walletType === 'string' ? node.walletType : ''
      const walletAddress = typeof node?.walletAddress === 'string' ? node.walletAddress : ''
      if (String(walletType).toUpperCase() !== 'SMART_WALLET') continue
      if (isAddress(walletAddress)) return walletAddress as Address
    }
    return null
  }, [profile?.linkedWallets?.edges])

  // Verify Zora-provided Smart Wallet is actually a contract
  const zoraBytecodeQuery = useQuery({
    queryKey: ['smartWallet', 'bytecode', zoraSmartWallet],
    queryFn: async () => {
      if (!zoraSmartWallet || !publicClient) return null
      const code = await publicClient.getBytecode({ address: zoraSmartWallet })
      return code && code !== '0x' ? zoraSmartWallet : null
    },
    enabled: !!zoraSmartWallet && !!publicClient,
    staleTime: 1000 * 60 * 10,
  })

  const verifiedZoraSmartWallet = zoraBytecodeQuery.data ?? null

  // === Method 2: Onchain Fallback ===
  // If Zora didn't find a Smart Wallet, check if EOA owns any of the candidate addresses
  const validCandidates = useMemo(() => {
    if (!candidateSmartWallets) return []
    return candidateSmartWallets
      .map((a) => (typeof a === 'string' && isAddress(a) ? (a as Address) : null))
      .filter((a): a is Address => a !== null)
      // Don't check the EOA itself
      .filter((a) => a.toLowerCase() !== addressStr?.toLowerCase())
  }, [candidateSmartWallets, addressStr])

  const onchainLookupQuery = useQuery({
    queryKey: ['smartWallet', 'onchainLookup', addressStr, validCandidates.join(',')],
    queryFn: async () => {
      if (!addressStr || !publicClient || validCandidates.length === 0) return null

      // Check each candidate to see if EOA is an owner
      for (const candidate of validCandidates) {
        const isOwner = await checkIsSmartWalletOwner(publicClient, candidate, addressStr as Address)
        if (isOwner) {
          return candidate
        }
      }
      return null
    },
    // Only run if Zora lookup didn't find anything
    enabled: !!addressStr && !!publicClient && validCandidates.length > 0 && !verifiedZoraSmartWallet,
    staleTime: 1000 * 60 * 5,
  })

  // Use Zora result first, then onchain fallback
  const smartWallet = verifiedZoraSmartWallet ?? onchainLookupQuery.data ?? null
  const source = verifiedZoraSmartWallet ? 'zora' : onchainLookupQuery.data ? 'onchain' : null

  const isLoading =
    profileQuery.isLoading ||
    zoraBytecodeQuery.isLoading ||
    (onchainLookupQuery.isLoading && !verifiedZoraSmartWallet)
  const error = profileQuery.error || zoraBytecodeQuery.error || onchainLookupQuery.error

  return {
    /** The connected EOA address */
    eoa: addressStr ?? null,
    /** The verified Smart Wallet address (or null if none found) */
    smartWallet,
    /** How the Smart Wallet was discovered: 'zora' | 'onchain' | null */
    source,
    /** Raw candidate from Zora profile (before bytecode verification) */
    zoraCandidate: zoraSmartWallet,
    /** Whether the queries are still loading */
    isLoading,
    /** Any error from the queries */
    error,
    /** The full Zora profile (for additional data) */
    profile,
  }
}

/**
 * Check if an address (EOA or Smart Wallet) is in a list of owner addresses.
 *
 * This accounts for the EOA → Smart Wallet relationship:
 * - If the EOA is directly in the owners list, returns true
 * - If the EOA's linked Smart Wallet is in the owners list, returns true
 * - Uses onchain lookup as fallback if Zora profile doesn't have linked wallet
 */
export function useIsOwner(
  connectedAddress: Address | string | undefined,
  owners: Array<Address | string> | undefined,
) {
  // Pass owners as candidates for onchain fallback lookup
  const { eoa, smartWallet, isLoading, source } = useLinkedSmartWallet(connectedAddress, owners)

  const isOwner = useMemo(() => {
    if (!owners || owners.length === 0) return false

    const ownerSet = new Set(owners.map((o) => String(o).toLowerCase()))

    // Check if EOA is directly an owner
    if (eoa && ownerSet.has(eoa.toLowerCase())) return true

    // Check if linked Smart Wallet is an owner
    if (smartWallet && ownerSet.has(smartWallet.toLowerCase())) return true

    return false
  }, [eoa, smartWallet, owners])

  // Which address matched (for display/debugging)
  const matchedAddress = useMemo(() => {
    if (!owners || owners.length === 0) return null
    const ownerSet = new Set(owners.map((o) => String(o).toLowerCase()))
    if (eoa && ownerSet.has(eoa.toLowerCase())) return eoa
    if (smartWallet && ownerSet.has(smartWallet.toLowerCase())) return smartWallet
    return null
  }, [eoa, smartWallet, owners])

  return {
    isOwner,
    isLoading,
    /** The address that matched (EOA or Smart Wallet) */
    matchedAddress,
    /** The connected EOA */
    eoa,
    /** The linked Smart Wallet (if any) */
    smartWallet,
    /** How the Smart Wallet was discovered: 'zora' | 'onchain' | null */
    source,
  }
}

/**
 * Get the "effective" address for transactions.
 *
 * If the user has a linked Smart Wallet, prefer that for transactions
 * (enables gas sponsorship, batch calls, etc.)
 *
 * @param connectedAddress - The connected EOA address
 * @param candidateSmartWallets - Optional list of addresses to check onchain
 */
export function useEffectiveAddress(
  connectedAddress: Address | string | undefined,
  candidateSmartWallets?: Array<Address | string>,
) {
  const { eoa, smartWallet, isLoading, source } = useLinkedSmartWallet(connectedAddress, candidateSmartWallets)

  return {
    /** The address to use for transactions (Smart Wallet if available, else EOA) */
    effectiveAddress: smartWallet ?? eoa,
    /** Whether to use the Smart Wallet path */
    useSmartWallet: !!smartWallet,
    /** The raw EOA */
    eoa,
    /** The linked Smart Wallet */
    smartWallet,
    /** How the Smart Wallet was discovered */
    source,
    isLoading,
  }
}
