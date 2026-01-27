import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { isAddress, type Address } from 'viem'
import { base } from 'wagmi/chains'
import { useZoraProfile } from '@/lib/zora/hooks'

/**
 * Hook to resolve an EOA's linked Coinbase Smart Wallet via Zora profile.
 *
 * When a user connects with their EOA, this hook:
 * 1. Fetches their Zora profile
 * 2. Extracts any linked Smart Wallet addresses
 * 3. Verifies the Smart Wallet is a contract onchain (not a mislabeled EOA)
 *
 * Use case: Users deploy creator coins on Zora with their EOA, but the
 * Smart Wallet (owned by the EOA) is listed as the coin owner.
 */
export function useLinkedSmartWallet(eoaAddress: Address | string | undefined) {
  const addressStr = typeof eoaAddress === 'string' && isAddress(eoaAddress) ? eoaAddress : undefined
  const publicClient = usePublicClient({ chainId: base.id })

  // Fetch Zora profile for the connected address
  const profileQuery = useZoraProfile(addressStr)
  const profile = profileQuery.data

  // Extract Smart Wallet from linked wallets
  const candidateSmartWallet = useMemo(() => {
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

  // Verify the Smart Wallet is actually a contract (not a mislabeled EOA)
  const bytecodeQuery = useQuery({
    queryKey: ['smartWallet', 'bytecode', candidateSmartWallet],
    queryFn: async () => {
      if (!candidateSmartWallet || !publicClient) return null
      const code = await publicClient.getBytecode({ address: candidateSmartWallet })
      return code && code !== '0x' ? candidateSmartWallet : null
    },
    enabled: !!candidateSmartWallet && !!publicClient,
    staleTime: 1000 * 60 * 10, // Cache for 10 min (bytecode doesn't change)
  })

  const smartWallet = bytecodeQuery.data ?? null
  const isLoading = profileQuery.isLoading || bytecodeQuery.isLoading
  const error = profileQuery.error || bytecodeQuery.error

  return {
    /** The connected EOA address */
    eoa: addressStr ?? null,
    /** The verified Smart Wallet address (or null if none found) */
    smartWallet,
    /** Raw candidate from Zora profile (before bytecode verification) */
    candidateSmartWallet,
    /** Whether the profile/bytecode queries are still loading */
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
 */
export function useIsOwner(
  connectedAddress: Address | string | undefined,
  owners: Array<Address | string> | undefined,
) {
  const { eoa, smartWallet, isLoading } = useLinkedSmartWallet(connectedAddress)

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
  }
}

/**
 * Get the "effective" address for transactions.
 *
 * If the user has a linked Smart Wallet, prefer that for transactions
 * (enables gas sponsorship, batch calls, etc.)
 */
export function useEffectiveAddress(connectedAddress: Address | string | undefined) {
  const { eoa, smartWallet, isLoading } = useLinkedSmartWallet(connectedAddress)

  return {
    /** The address to use for transactions (Smart Wallet if available, else EOA) */
    effectiveAddress: smartWallet ?? eoa,
    /** Whether to use the Smart Wallet path */
    useSmartWallet: !!smartWallet,
    /** The raw EOA */
    eoa,
    /** The linked Smart Wallet */
    smartWallet,
    isLoading,
  }
}
