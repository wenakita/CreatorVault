export { EagleRegistryClient } from './client';
export type { RegistryConfig, PeerChainConfig } from './client';
export type { EagleRegistrySolana } from './types/eagle_registry_solana';

// Constants
export const SOLANA_MAINNET_EID = 30168;
export const WSOL_ADDRESS = 'So11111111111111111111111111111111111111112';

// LayerZero EIDs for EVM chains
export const EVM_CHAIN_EIDS = {
  ETHEREUM: 30101,
  ARBITRUM: 30110,
  BASE: 30184,
  BSC: 30102,
  SONIC: 30332,
  AVALANCHE: 30106,
  HYPEREVM: 30367,
} as const;

// Eagle Registry address on all EVM chains
export const EAGLE_REGISTRY_EVM = '0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e';

