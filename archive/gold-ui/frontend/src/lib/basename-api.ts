// Basenames integration using OnchainKit
// Docs: https://docs.base.org/base-account/basenames/basenames-onchainkit-tutorial

import { createPublicClient, http } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { normalize } from 'viem/ens'

export interface BasenameInfo {
  name: string | null // e.g., "akita.base.eth"
  avatar?: string | null
  displayName?: string | null
  description?: string | null
  twitter?: string | null
  github?: string | null
  discord?: string | null
  email?: string | null
  url?: string | null
}

/**
 * Get Basename for an address
 */
export async function getBasename(
  address: string,
  chainId: number = base.id
): Promise<string | null> {
  try {
    const chain = chainId === baseSepolia.id ? baseSepolia : base

    const client = createPublicClient({
      chain,
      transport: http(),
    })

    // Get the primary name for this address
    const name = await client.getEnsName({
      address: address as `0x${string}`,
    })

    return name
  } catch (error) {
    console.error('Failed to fetch Basename:', error)
    return null
  }
}

/**
 * Get Basename with full profile info
 */
export async function getBasenameProfile(
  address: string,
  chainId: number = base.id
): Promise<BasenameInfo> {
  try {
    const name = await getBasename(address, chainId)
    
    if (!name) {
      return { name: null }
    }

    const chain = chainId === baseSepolia.id ? baseSepolia : base
    const client = createPublicClient({
      chain,
      transport: http(),
    })

    // Fetch ENS text records in parallel
    const [avatar, displayName, description, twitter, github, discord, email, url] = 
      await Promise.all([
        client.getEnsAvatar({ name: normalize(name) }).catch(() => null),
        client.getEnsText({ name: normalize(name), key: 'name' }).catch(() => null),
        client.getEnsText({ name: normalize(name), key: 'description' }).catch(() => null),
        client.getEnsText({ name: normalize(name), key: 'com.twitter' }).catch(() => null),
        client.getEnsText({ name: normalize(name), key: 'com.github' }).catch(() => null),
        client.getEnsText({ name: normalize(name), key: 'com.discord' }).catch(() => null),
        client.getEnsText({ name: normalize(name), key: 'email' }).catch(() => null),
        client.getEnsText({ name: normalize(name), key: 'url' }).catch(() => null),
      ])

    return {
      name,
      avatar,
      displayName,
      description,
      twitter,
      github,
      discord,
      email,
      url,
    }
  } catch (error) {
    console.error('Failed to fetch Basename profile:', error)
    return { name: null }
  }
}

/**
 * Format Basename for display (remove .base.eth suffix for cleaner look)
 */
export function formatBasename(name: string | null): string {
  if (!name) return ''
  return name.replace('.base.eth', '')
}

/**
 * Check if address has a Basename
 */
export async function hasBasename(address: string): Promise<boolean> {
  const name = await getBasename(address)
  return name !== null
}
