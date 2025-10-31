import { EndpointId } from '@layerzerolabs/lz-definitions'

export interface DeploymentConfig {
  vault: {
    contracts: {
      vault: string
      wrapper: string  // Changed from shareAdapter
      composer: string
    }
    deploymentEid: EndpointId
    vaultAddress?: string
    assetOFTAddress?: string
    wrapperAddress?: string  // Changed from shareOFTAdapterAddress
  }
  shareOFT: {
    contract: string
    metadata: {
      name: string
      symbol: string
    }
    deploymentEids: EndpointId[]  // Now includes hub!
  }
  assetOFT: {
    contract: string
    metadata: {
      name: string
      symbol: string
    }
    deploymentEids: EndpointId[]
  }
}

// Hub network where EagleOVault lives
const _hubEid = EndpointId.ETHEREUM_V2_MAINNET

// Spoke networks where ShareOFT lives
const _spokeEids = [
  EndpointId.BSC_V2_MAINNET,
  EndpointId.ARBITRUM_V2_MAINNET,
  EndpointId.BASE_V2_MAINNET,
  EndpointId.AVALANCHE_V2_MAINNET,
]

// ============================================
// DEPLOYMENT CONFIGURATION
// ============================================

export const DEPLOYMENT_CONFIG: DeploymentConfig = {
  // Vault configuration (Hub chain only - Ethereum)
  vault: {
    contracts: {
      vault: 'EagleOVault',           // Our clean ERC4626 vault
      wrapper: 'EagleVaultWrapper',   // Converts vault shares ↔ EAGLE OFT (1:1)
      composer: 'EagleOVaultComposer', // LayerZero composer (optional)
    },
    deploymentEid: _hubEid,
    vaultAddress: undefined,          // Deploy fresh EagleOVault
    assetOFTAddress: undefined,       // Deploy fresh WLFI Asset OFT
    wrapperAddress: undefined,        // Deploy fresh EagleVaultWrapper
  },

  // Share OFT configuration (ALL chains - including hub!)
  // Architecture: Same EagleShareOFT on ALL chains with same address (CREATE2)
  shareOFT: {
    contract: 'EagleShareOFT',
    metadata: {
      name: 'Eagle Vault Shares',
      symbol: 'EAGLE',
    },
    deploymentEids: [_hubEid, ..._spokeEids],  // ALL chains including hub! ✅
  },

  // Asset OFT configuration (All chains - hub + spokes)
  assetOFT: {
    contract: 'WLFIAssetOFT', // We'll deploy both WLFI and USD1
    metadata: {
      name: 'WLFI Asset',
      symbol: 'WLFI',
    },
    deploymentEids: [_hubEid, ..._spokeEids],
  },
} as const

// Additional configuration for USD1 Asset OFT
export const USD1_ASSET_CONFIG = {
  contract: 'USD1AssetOFT',
  metadata: {
    name: 'USD1 Asset',
    symbol: 'USD1',
  },
  deploymentEids: [_hubEid, ..._spokeEids],
} as const

// ============================================
// CREATE2 CONFIGURATION FOR SAME ADDRESS EVERYWHERE
// ============================================

export const CREATE2_CONFIG = {
  // Use the same salt for EagleShareOFT on ALL chains
  // This ensures the same contract address everywhere!
  eagleShareOFTSalt: '0x0000000000000000000000000000000000000000000000000000000047EA91E0',
  
  // CREATE2 factory (Arachnid's public factory - available on all chains)
  factory: '0x4e59b44847b379578588920cA78FbF26c0B4956C',
  
  // Expected address (will be calculated from salt)
  expectedEagleAddress: undefined,  // To be calculated using CREATE2 formula
}

// ============================================
// ARCHITECTURE NOTES
// ============================================

/*
 * EAGLEVAULTWRAPPER ARCHITECTURE:
 * 
 * Unlike standard LayerZero OFTAdapter pattern, we use EagleVaultWrapper
 * to achieve the same EAGLE token on ALL chains (including hub).
 * 
 * ALL CHAINS (Ethereum, Arbitrum, Base, etc.):
 *   - EagleShareOFT (0xSAME_ADDRESS via CREATE2)
 *   - Name: "Eagle Vault Shares"
 *   - Symbol: "EAGLE"
 *   - Standard LayerZero OFT
 * 
 * ETHEREUM ONLY (Hub):
 *   - EagleOVault: ERC4626 vault (WLFI/USD1 deposits)
 *   - EagleVaultWrapper: Converts vault shares ↔ EAGLE (1:1)
 *     └─ wrap():   Lock vault shares → Mint EAGLE
 *     └─ unwrap(): Burn EAGLE → Release vault shares
 * 
 * BENEFITS:
 *   ✅ Same token address everywhere
 *   ✅ Same metadata everywhere ("EAGLE")
 *   ✅ Consistent branding
 *   ✅ Better UX
 * 
 * SECURITY:
 *   ⚠️  EagleVaultWrapper is ONLY minter on Ethereum
 *   ⚠️  No minters on spoke chains (LayerZero only)
 *   ⚠️  Wrapper must be audited thoroughly
 * 
 * See: /ARCHITECTURE_DECISION.md for full details
 */

// ============================================ // VANITY ADDRESS CONFIGURATION (OPTIONAL)
// ============================================

export const VANITY_CONFIG = {
  // Target vanity pattern: 0x47...EA91E (optional)
  targetPrefix: '47',
  targetSuffix: 'EA91E',
  
  // CREATE2 factory for deterministic addresses
  create2Factory: CREATE2_CONFIG.factory,
  
  // Expected vanity addresses (will be generated)
  expectedAddresses: {
    vault: undefined,      // To be calculated
    wrapper: undefined,    // Changed from shareAdapter
    composer: undefined,
  },
}

// ============================================
// NETWORK CONFIGURATION
// ============================================

export const NETWORK_CONFIG = {
  hub: {
    name: 'Ethereum',
    eid: _hubEid,
    isHub: true,
    deployments: ['EagleOVault', 'EagleVaultWrapper', 'EagleShareOFT', 'WLFIAssetOFT', 'USD1AssetOFT'],
  },
  spokes: _spokeEids.map(eid => ({
    eid,
    name: getNetworkName(eid),
    isHub: false,
    deployments: ['EagleShareOFT', 'WLFIAssetOFT', 'USD1AssetOFT'],  // Same EAGLE OFT!
  })),
}

function getNetworkName(eid: EndpointId): string {
  switch (eid) {
    case EndpointId.BSC_V2_MAINNET: return 'BSC'
    case EndpointId.ARBITRUM_V2_MAINNET: return 'Arbitrum'
    case EndpointId.BASE_V2_MAINNET: return 'Base'
    case EndpointId.AVALANCHE_V2_MAINNET: return 'Avalanche'
    case EndpointId.ETHEREUM_V2_MAINNET: return 'Ethereum'
    default: return 'Unknown'
  }
}

// ============================================
// POST-DEPLOYMENT CONFIGURATION
// ============================================

export const POST_DEPLOYMENT_STEPS = {
  ethereum: [
    '1. Deploy EagleOVault',
    '2. Deploy EagleShareOFT (with CREATE2 salt)',
    '3. Deploy EagleVaultWrapper',
    '4. Set wrapper as minter: oft.setMinter(wrapper, true)',
    '5. Deploy asset OFTs (WLFI, USD1)',
    '6. Wire LayerZero peers',
  ],
  spokes: [
    '1. Deploy EagleShareOFT (SAME CREATE2 salt!)',
    '2. DO NOT set any minters',
    '3. Deploy asset OFTs (WLFI, USD1)',
    '4. Wire LayerZero peers',
  ],
  verification: [
    '1. Verify all contracts on Etherscan/block explorers',
    '2. Check EagleShareOFT has same address on all chains',
    '3. Verify wrapper is only minter on Ethereum',
    '4. Verify no minters on spoke chains',
    '5. Test wrap/unwrap on Ethereum',
    '6. Test cross-chain bridge',
    '7. Verify supply invariant: SUM(EAGLE supply) = wrapper.totalLocked',
  ],
}
