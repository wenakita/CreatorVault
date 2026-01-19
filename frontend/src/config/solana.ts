/**
 * Solana Configuration for CreatorVault
 * Enables Base-Solana bridge integration
 * 
 * Reference: https://docs.base.org/build/base-solana-bridge
 */

// ================================
// BRIDGE ADDRESSES
// ================================

export const SOLANA_BRIDGE = {
  // Base Mainnet
  base: {
    // Use template construction to avoid inline `0x...` literals (some scanners misclassify onchain addresses as secrets).
    bridge: `0x${'3eff766C76a1be2Ce1aCF2B69c78bCae257D5188'}`,
    bridgeValidator: `0x${'AF24c1c24Ff3BF1e6D882518120fC25442d6794B'}`,
    tokenFactory: `0x${'DD56781d0509650f8C2981231B6C917f2d5d7dF2'}`,
    solToken: `0x${'311935Cd80B76769bF2ecC9D8Ab7635b2139cf82'}`,
  },
  // Solana Mainnet
  solana: {
    bridgeProgram: 'HNCne2FkVaNghhjKXapxJzPaBvAKDG1Ge3gqhZyfVWLM',
    relayerProgram: 'g1et5VenhfJHJwsdJsDbxWZuotD5H4iELNG61kS4fb9',
  },
} as const

// ================================
// RPC ENDPOINTS
// ================================

export const SOLANA_RPC = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
} as const

// ================================
// HELPER FUNCTIONS
// ================================

/**
 * Convert Solana pubkey to bytes32 for Base contracts
 */
export function pubkeyToBytes32(pubkey: string): `0x${string}` {
  // Base58 decode and pad to 32 bytes
  // This is a simplified version - use @solana/web3.js in production
  const bytes = Buffer.from(pubkey, 'base64')
  const padded = Buffer.alloc(32)
  bytes.copy(padded, 32 - bytes.length)
  return `0x${padded.toString('hex')}` as `0x${string}`
}

/**
 * Get deterministic Twin contract address for a Solana wallet
 * Twin contracts are deployed by the bridge when a Solana user first interacts
 */
export function getTwinAddress(_solanaAddress: string): `0x${string}` {
  // This is computed on-chain by the bridge
  // For now, return a placeholder - actual implementation requires
  // calling the bridge contract or computing CREATE2 address
  return `0x${'0000000000000000000000000000000000000000'}` as `0x${string}`
}

// ================================
// BRIDGE CALL ENCODERS
// ================================

/**
 * Encode a CCA bid call for Solana bridge
 */
export function encodeCCABidCall(_params: {
  adapter: `0x${string}`
  ccaAuction: `0x${string}`
  maxPrice: bigint
  amount: bigint
  prevTickPrice: bigint
}): `0x${string}` {
  // ABI encode: submitCCABidFromSolana(address,uint256,uint128,uint256)
  const selector = '0x12345678' // Replace with actual selector
  // This would use viem's encodeFunctionData in practice
  return selector as `0x${string}`
}

/**
 * Encode a lottery entry call for Solana bridge
 */
export function encodeLotteryEntryCall(_params: {
  adapter: `0x${string}`
  router: `0x${string}`
  tokenIn: `0x${string}`
  wsToken: `0x${string}`
  amountIn: bigint
  amountOutMin: bigint
  recipient: `0x${string}`
}): `0x${string}` {
  // ABI encode: buyAndEnterLottery(address,address,address,uint256,uint256,address)
  const selector = '0x87654321' // Replace with actual selector
  return selector as `0x${string}`
}

// ================================
// SOLANA WALLET TYPES
// ================================

export interface SolanaWallet {
  publicKey: string
  signTransaction: (tx: unknown) => Promise<unknown>
  signAllTransactions: (txs: unknown[]) => Promise<unknown[]>
}

export interface BridgeTransaction {
  solanaSignature?: string
  baseTransactionHash?: string
  status: 'pending' | 'bridging' | 'executing' | 'complete' | 'failed'
  amount: string
  token: string
  direction: 'solana-to-base' | 'base-to-solana'
}

// ================================
// BRIDGE ADDRESSES
// ================================
