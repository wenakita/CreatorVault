/**
 * CreatorVault Contract Configuration
 * 
 * @description Contract addresses and chain configuration for the CreatorVault platform
 */

// Chain IDs
export const CHAIN_IDS = {
  BASE: 8453,
  ETHEREUM: 1,
  ARBITRUM: 42161,
  BSC: 56,
  AVALANCHE: 43114,
  MONAD: 10143,
  SONIC: 146,
  HYPEREVM: 999,
} as const;

// LayerZero Endpoint IDs
export const LZ_EIDS = {
  BASE: 30184,
  ETHEREUM: 30101,
  ARBITRUM: 30110,
  BSC: 30102,
  AVALANCHE: 30106,
  MONAD: 30390,
  SONIC: 30332,
  HYPEREVM: 30275,
} as const;

// Hub Chain (where vault lives)
export const HUB_CHAIN = CHAIN_IDS.BASE;

// Common LayerZero Endpoint (same on all chains)
export const LZ_ENDPOINT = '0x1a44076050125825900e736c501f859c50fE728c';

/**
 * First Creator Coin: akita
 * 
 * @see https://app.uniswap.org/explore/tokens/base/0x5b674196812451b7cec024fe9d22d2c0b172fa75
 */
export const AKITA_CONFIG = {
  // Creator Coin Token
  token: {
    address: '0x5b674196812451b7cec024fe9d22d2c0b172fa75' as `0x${string}`,
    name: 'akita',
    symbol: 'akita',
    decimals: 18,
    chainId: CHAIN_IDS.BASE,
  },
  
  // Vault (CreatorOVault)
  vault: {
    address: '' as `0x${string}`, // TBD after deployment
    name: 'akita Omnichain Vault',
    symbol: 'akitaOV',
  },
  
  // ShareOFT (CreatorShareOFT)
  shareOFT: {
    address: '' as `0x${string}`, // TBD after deployment
    name: 'akita Share Token',
    symbol: 'stkmaakita',
  },
  
  // Wrapper (CreatorOVaultWrapper)
  wrapper: {
    address: '' as `0x${string}`, // TBD after deployment
  },
  
  // Liquidity Pool
  pool: {
    pair: 'akita/ZORA',
    dex: 'Uniswap V4',
    feeTier: 30000, // 3%
    address: '' as `0x${string}`, // TBD
  },
  
  // Creator
  creator: {
    address: '' as `0x${string}`, // Creator's address
    twitter: '@stkmaakita',
  },
};

/**
 * Platform Contracts
 */
export const PLATFORM_CONTRACTS = {
  [CHAIN_IDS.BASE]: {
    registry: '' as `0x${string}`, // TBD
    factory: '' as `0x${string}`,  // TBD
    create2Deployer: '' as `0x${string}`, // TBD
    lotteryManager: '' as `0x${string}`, // TBD
    gaugeController: '' as `0x${string}`, // TBD
  },
};

/**
 * Chain Configuration
 */
export const CHAIN_CONFIG = {
  [CHAIN_IDS.BASE]: {
    name: 'Base',
    shortName: 'base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    lzEid: LZ_EIDS.BASE,
    isHub: true,
  },
  [CHAIN_IDS.ETHEREUM]: {
    name: 'Ethereum',
    shortName: 'eth',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    lzEid: LZ_EIDS.ETHEREUM,
    isHub: false,
  },
  [CHAIN_IDS.ARBITRUM]: {
    name: 'Arbitrum',
    shortName: 'arb',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    lzEid: LZ_EIDS.ARBITRUM,
    isHub: false,
  },
  [CHAIN_IDS.MONAD]: {
    name: 'Monad',
    shortName: 'monad',
    nativeCurrency: { name: 'Monad', symbol: 'MONAD', decimals: 18 },
    rpcUrl: 'https://rpc.monad.xyz',
    explorerUrl: 'https://monadexplorer.com',
    lzEid: LZ_EIDS.MONAD,
    isHub: false,
  },
  [CHAIN_IDS.SONIC]: {
    name: 'Sonic',
    shortName: 'sonic',
    nativeCurrency: { name: 'Sonic', symbol: 'S', decimals: 18 },
    rpcUrl: 'https://rpc.soniclabs.com',
    explorerUrl: 'https://sonicscan.org',
    lzEid: LZ_EIDS.SONIC,
    isHub: false,
  },
} as const;

/**
 * Get chain configuration by ID
 */
export function getChainConfig(chainId: number) {
  return CHAIN_CONFIG[chainId as keyof typeof CHAIN_CONFIG];
}

/**
 * Get LZ EID for chain ID
 */
export function getLzEid(chainId: number): number {
  const config = getChainConfig(chainId);
  return config?.lzEid || 0;
}

/**
 * Get chain ID for LZ EID
 */
export function getChainIdForEid(eid: number): number {
  for (const [chainId, config] of Object.entries(CHAIN_CONFIG)) {
    if (config.lzEid === eid) {
      return Number(chainId);
    }
  }
  return 0;
}

/**
 * Helper to format address for LayerZero (bytes32)
 */
export function addressToBytes32(address: `0x${string}`): `0x${string}` {
  return `0x000000000000000000000000${address.slice(2)}` as `0x${string}`;
}

/**
 * Helper to parse bytes32 to address
 */
export function bytes32ToAddress(bytes32: `0x${string}`): `0x${string}` {
  return `0x${bytes32.slice(26)}` as `0x${string}`;
}


