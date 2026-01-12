import type { Address } from 'viem'

import type { ZoraCoin, ZoraProfile } from '@/lib/zora/types'

export type CreatorIdentitySource =
  | 'zoraCoinCreatorAddress'
  | 'farcasterCustody'
  | 'zoraProfilePublicWallet'
  | 'connectedWallet'
  | 'unknown'

export type CreatorIdentityWarningCode =
  | 'CUSTODY_MISMATCH'
  | 'CONNECTED_WALLET_MISMATCH'
  | 'CUSTODY_UNAVAILABLE'

export type CreatorIdentityResolution = {
  /** Canonical creator identity wallet (the identity that must not fragment). */
  canonicalIdentity: {
    address: Address | null
    source: CreatorIdentitySource
  }
  /** Currently connected wallet/account (execution context for the current session). */
  execution: {
    address: Address | null
  }
  /** Whether we have an existing creator coin identity we should enforce. */
  hasExistingCreatorCoinIdentity: boolean
  /** Block irreversible actions when true; caller should present UI guidance. */
  blockingReason: string | null
  /** Non-blocking warnings to show in UI. */
  warnings: CreatorIdentityWarningCode[]
}

function isAddressLike(value: unknown): value is Address {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeAddress(value: unknown): Address | null {
  return isAddressLike(value) ? (value as Address) : null
}

/**
 * Resolve canonical creator identity in a way that prevents fragmentation.
 *
 * Rules (your requested precedence):
 * - If a creator coin exists (Zora Coin metadata present), enforce its creator address as canonical identity.
 * - Otherwise, if we can infer a public wallet from a Zora profile (e.g. via Farcaster username → Zora profile),
 *   use that as canonical identity.
 * - Otherwise, fall back to the connected wallet (but treat this as fragile; caller should confirm before irreversible actions).
 */
export function resolveCreatorIdentity(params: {
  connectedWallet: Address | null
  zoraCoin?: ZoraCoin | null
  farcasterZoraProfile?: ZoraProfile | null
  farcasterCustodyAddress?: Address | null
}): CreatorIdentityResolution {
  const execution = normalizeAddress(params.connectedWallet)
  const zoraCoinCreator = normalizeAddress(params.zoraCoin?.creatorAddress)

  const farcasterPublicWallet = normalizeAddress(params.farcasterZoraProfile?.publicWallet?.walletAddress)
  const farcasterCustody = normalizeAddress(params.farcasterCustodyAddress)

  const warnings: CreatorIdentityWarningCode[] = []

  // 1) Existing creator coin identity (strongest signal)
  if (zoraCoinCreator) {
    const canonical = zoraCoinCreator

    let blockingReason: string | null = null
    if (execution && execution.toLowerCase() !== canonical.toLowerCase()) {
      warnings.push('CONNECTED_WALLET_MISMATCH')
      blockingReason = `This creator coin’s canonical identity is ${canonical}. You’re connected as ${execution}. Switch to the canonical identity wallet to continue.`
    } else if (!execution) {
      blockingReason = `Connect the canonical identity wallet (${canonical}) to continue.`
    }

    if (farcasterCustody && farcasterCustody.toLowerCase() !== canonical.toLowerCase()) {
      warnings.push('CUSTODY_MISMATCH')
    }

    return {
      canonicalIdentity: { address: canonical, source: 'zoraCoinCreatorAddress' },
      execution: { address: execution },
      hasExistingCreatorCoinIdentity: true,
      blockingReason,
      warnings,
    }
  }

  // 2) Farcaster custody (high-confidence identity when coin is absent)
  if (farcasterCustody) {
    const canonical = farcasterCustody

    let blockingReason: string | null = null
    if (execution && execution.toLowerCase() !== canonical.toLowerCase()) {
      warnings.push('CONNECTED_WALLET_MISMATCH')
      blockingReason = `Your Farcaster custody wallet is ${canonical}. You’re connected as ${execution}. Switch to the custody wallet (or use an identity-signed authorization) to continue.`
    } else if (!execution) {
      blockingReason = `Connect your Farcaster custody wallet (${canonical}) to continue.`
    }

    return {
      canonicalIdentity: { address: canonical, source: 'farcasterCustody' },
      execution: { address: execution },
      hasExistingCreatorCoinIdentity: false,
      blockingReason,
      warnings,
    }
  }

  // 3) No coin + no custody: block deploy/launch actions (avoid accidental identity fragmentation)
  warnings.push('CUSTODY_UNAVAILABLE')

  if (farcasterPublicWallet) {
    const canonical = farcasterPublicWallet
    if (execution && execution.toLowerCase() !== canonical.toLowerCase()) warnings.push('CONNECTED_WALLET_MISMATCH')
    return {
      canonicalIdentity: { address: canonical, source: 'zoraProfilePublicWallet' },
      execution: { address: execution },
      hasExistingCreatorCoinIdentity: false,
      blockingReason:
        'Farcaster custody is unavailable (or could not be verified). For safety, we cannot proceed with irreversible onchain actions right now.',
      warnings,
    }
  }

  if (execution) {
    return {
      canonicalIdentity: { address: execution, source: 'connectedWallet' },
      execution: { address: execution },
      hasExistingCreatorCoinIdentity: false,
      blockingReason:
        'Farcaster custody is unavailable (or could not be verified). For safety, we cannot proceed with irreversible onchain actions right now.',
      warnings,
    }
  }

  return {
    canonicalIdentity: { address: null, source: 'unknown' },
    execution: { address: null },
    hasExistingCreatorCoinIdentity: false,
    blockingReason: 'Connect a wallet to continue.',
    warnings,
  }
}

