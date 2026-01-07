// Utility to resolve CreatorCoin contract addresses to actual creator addresses
// Based on: https://basescan.org/token/0x5b674196812451b7cec024fe9d22d2c0b172fa75

import { createPublicClient, http, type Address } from 'viem'
import { base } from 'viem/chains'

const CREATOR_COIN_DEBUG = import.meta.env.DEV && import.meta.env.VITE_DEBUG_LOGS === 'true'

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
})

// CreatorCoin ABI - we only need the functions we're calling
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

/**
 * Get the payout recipient (creator's main address) from a CreatorCoin contract
 */
export async function getPayoutRecipient(coinAddress: Address): Promise<Address | null> {
  try {
    const recipient = await publicClient.readContract({
      address: coinAddress,
      abi: CREATOR_COIN_ABI,
      functionName: 'payoutRecipient',
    })
    
    if (CREATOR_COIN_DEBUG) console.log('[CreatorCoin] Payout recipient:', recipient)
    return recipient as Address
  } catch (error) {
    console.error('[CreatorCoin] Failed to get payout recipient:', error)
    return null
  }
}

/**
 * Get the owner at a specific index
 * Index 0: Coinbase Smart Account
 * Index 1: Privy
 * Index 2: Main EOA (Externally Owned Account)
 */
export async function getOwnerAt(coinAddress: Address, index: number): Promise<Address | null> {
  try {
    const owner = await publicClient.readContract({
      address: coinAddress,
      abi: CREATOR_COIN_ABI,
      functionName: 'ownerAt',
      args: [BigInt(index)],
    })
    
    if (CREATOR_COIN_DEBUG) console.log(`[CreatorCoin] Owner at index ${index}:`, owner)
    return owner as Address
  } catch (error) {
    console.error(`[CreatorCoin] Failed to get owner at index ${index}:`, error)
    return null
  }
}

/**
 * Get all owners of a CreatorCoin
 */
export async function getAllOwners(coinAddress: Address): Promise<Address[]> {
  try {
    const totalOwners = await publicClient.readContract({
      address: coinAddress,
      abi: CREATOR_COIN_ABI,
      functionName: 'totalOwners',
    })
    
    const owners: Address[] = []
    for (let i = 0; i < Number(totalOwners); i++) {
      const owner = await getOwnerAt(coinAddress, i)
      if (owner) {
        owners.push(owner)
      }
    }
    
    if (CREATOR_COIN_DEBUG) console.log('[CreatorCoin] All owners:', owners)
    return owners
  } catch (error) {
    console.error('[CreatorCoin] Failed to get all owners:', error)
    return []
  }
}

/**
 * Resolve a CreatorCoin address to the creator's main wallet
 * Priority:
 * 1. Payout recipient (most reliable)
 * 2. Owner at index 2 (main EOA)
 * 3. Fallback to the contract address itself
 */
export async function resolveCreatorAddress(addressOrCoin: Address): Promise<Address> {
  if (CREATOR_COIN_DEBUG) console.log('[CreatorCoin] Resolving address:', addressOrCoin)
  
  try {
    // First try to get payout recipient
    const payoutRecipient = await getPayoutRecipient(addressOrCoin)
    if (payoutRecipient && payoutRecipient !== '0x0000000000000000000000000000000000000000') {
      if (CREATOR_COIN_DEBUG) console.log('[CreatorCoin] Using payout recipient:', payoutRecipient)
      return payoutRecipient
    }
    
    // Fallback to owner at index 2 (main EOA)
    const mainEOA = await getOwnerAt(addressOrCoin, 2)
    if (mainEOA && mainEOA !== '0x0000000000000000000000000000000000000000') {
      if (CREATOR_COIN_DEBUG) console.log('[CreatorCoin] Using owner at index 2:', mainEOA)
      return mainEOA
    }
    
    // If all else fails, return the original address
    if (CREATOR_COIN_DEBUG) console.log('[CreatorCoin] Using original address (not a CreatorCoin or no payout recipient)')
    return addressOrCoin
  } catch (error) {
    console.error('[CreatorCoin] Error resolving address, using original:', error)
    return addressOrCoin
  }
}

/**
 * Check if an address is a CreatorCoin contract
 */
export async function isCreatorCoin(address: Address): Promise<boolean> {
  try {
    // Try to call payoutRecipient - if it works, it's a CreatorCoin
    await publicClient.readContract({
      address,
      abi: CREATOR_COIN_ABI,
      functionName: 'payoutRecipient',
    })
    return true
  } catch {
    return false
  }
}

