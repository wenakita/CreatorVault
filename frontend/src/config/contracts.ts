/**
 * CreatorVault Deployed Contract Addresses
 * Updated: December 2024
 */

import { AKITA_DEFAULTS, BASE_DEFAULTS, ERC4626_DEFAULTS } from './contracts.defaults'

// Prefer env overrides for deployment flexibility. Use fallbacks for known Base mainnet addresses.
function envAddress(name: string, fallback?: `0x${string}` | undefined): `0x${string}` | undefined {
  const v = (import.meta as any)?.env?.[name] as string | undefined
  if (!v) return fallback
  const trimmed = v.trim()
  if (!trimmed) return fallback
  return trimmed as `0x${string}`
}

export const CONTRACTS = {
  // Shared Infrastructure
  registry: envAddress('VITE_REGISTRY', BASE_DEFAULTS.registry)!,
  factory: envAddress('VITE_FACTORY', BASE_DEFAULTS.factory)!,
  lotteryManager: envAddress('VITE_LOTTERY_MANAGER', BASE_DEFAULTS.lotteryManager)!,
  vrfConsumer: envAddress('VITE_VRF_CONSUMER', BASE_DEFAULTS.vrfConsumer)!,
  payoutRouterFactory: envAddress('VITE_PAYOUT_ROUTER_FACTORY', BASE_DEFAULTS.payoutRouterFactory)!,
  // Universal CREATE2 factory (EIP-2470-style; deployed on many chains)
  create2Factory: envAddress('VITE_CREATE2_FACTORY', BASE_DEFAULTS.create2Factory)!,
  // Phase 2 (AA): CREATE2 deployer for permissionless, one-signature deployments
  create2Deployer: envAddress('VITE_CREATE2_DEPLOYER', BASE_DEFAULTS.create2Deployer)!,

  // Universal AA optimization:
  // Store large creation bytecode once, then deploy via CREATE2 using (codeId + constructor args).
  // Deployed via the universal CREATE2 factory (0x4e59…) with chain-agnostic salts.
  //
  // NOTE: These addresses may not be deployed on every chain yet. The frontend should treat them as optional
  // and fall back to calldata-based deployments when missing.
  universalBytecodeStore: envAddress('VITE_UNIVERSAL_BYTECODE_STORE', BASE_DEFAULTS.universalBytecodeStore)!,
  universalCreate2DeployerFromStore: envAddress('VITE_UNIVERSAL_CREATE2_DEPLOYER', BASE_DEFAULTS.universalCreate2DeployerFromStore)!,

  // Phase 1/2 (AA): Vault activation batcher (approve + deposit + wrap + launch auction)
  vaultActivationBatcher: envAddress('VITE_VAULT_ACTIVATION_BATCHER', BASE_DEFAULTS.vaultActivationBatcher),
  // Phase 2 (AA): One-call deploy+launch primitive (optional; used for deterministic AA deployments)
  creatorVaultBatcher: envAddress('VITE_CREATOR_VAULT_BATCHER', BASE_DEFAULTS.creatorVaultBatcher),

  // Protocol treasury / multisig (receives protocol fee slice from GaugeController)
  protocolTreasury: envAddress('VITE_PROTOCOL_TREASURY', BASE_DEFAULTS.protocolTreasury)!,

  // Legacy activator (older 2-click flow). Kept for backwards compatibility.
  vaultActivator: BASE_DEFAULTS.vaultActivator,

  // External - Uniswap V4
  poolManager: envAddress('VITE_V4_POOL_MANAGER', BASE_DEFAULTS.poolManager)!,
  taxHook: envAddress('VITE_V4_TAX_HOOK', BASE_DEFAULTS.taxHook)!,
  // V4 periphery (optional; required for on-chain V4 LP strategies like CreatorLPManager)
  v4PositionManager: envAddress('VITE_V4_POSITION_MANAGER'),
  chainlinkEthUsd: envAddress('VITE_CHAINLINK_ETH_USD', BASE_DEFAULTS.chainlinkEthUsd)!,
  weth: envAddress('VITE_WETH', BASE_DEFAULTS.weth)!, // Base WETH
  // Permit2 (used by Uniswap periphery; canonical address is chain-agnostic)
  permit2: envAddress('VITE_PERMIT2', BASE_DEFAULTS.permit2)!,
  
  // External - Ajna Protocol (Base)
  // Source: https://faqs.ajna.finance/info/deployment-addresses-and-bridges
  ajnaErc20Factory: envAddress('VITE_AJNA_ERC20_FACTORY', BASE_DEFAULTS.ajnaErc20Factory)!,
  ajnaErc721Factory: envAddress('VITE_AJNA_ERC721_FACTORY', BASE_DEFAULTS.ajnaErc721Factory)!,
  ajnaPoolInfoUtils: envAddress('VITE_AJNA_POOL_INFO_UTILS', BASE_DEFAULTS.ajnaPoolInfoUtils)!,
  ajnaPositionManager: envAddress('VITE_AJNA_POSITION_MANAGER', BASE_DEFAULTS.ajnaPositionManager)!,

  // External - Charm Finance (Base deployment addresses not yet available)
  charmAlphaVault: envAddress('VITE_CHARM_ALPHA_VAULT'),

  // External - Uniswap
  uniswapV3Factory: envAddress('VITE_UNISWAP_V3_FACTORY', BASE_DEFAULTS.uniswapV3Factory)!,
  // ZORA reference pools (Uniswap V3) for deploy-time pricing
  zoraUsdcV3Pool: envAddress('VITE_ZORA_USDC_V3_POOL', BASE_DEFAULTS.zoraUsdcV3Pool)!,
  zoraWethV3Pool: envAddress('VITE_ZORA_WETH_V3_POOL', BASE_DEFAULTS.zoraWethV3Pool)!,

  // External - Standard Tokens
  zora: envAddress('VITE_ZORA', BASE_DEFAULTS.zora)!,
  usdc: envAddress('VITE_USDC', BASE_DEFAULTS.usdc)!,

  // Helpers
  strategyDeploymentBatcher: envAddress('VITE_STRATEGY_DEPLOYMENT_BATCHER'), // Deploy with: forge create StrategyDeploymentBatcher
} as const

// Example: AKITA Vault (first creator)
export const AKITA = {
  token: envAddress('VITE_AKITA_TOKEN', AKITA_DEFAULTS.token)!,
  vault: envAddress('VITE_AKITA_VAULT', AKITA_DEFAULTS.vault)!,
  wrapper: envAddress('VITE_AKITA_WRAPPER', AKITA_DEFAULTS.wrapper)!,
  shareOFT: envAddress('VITE_AKITA_SHARE_OFT', AKITA_DEFAULTS.shareOFT)!,
  gaugeController: envAddress('VITE_AKITA_GAUGE_CONTROLLER', AKITA_DEFAULTS.gaugeController)!,
  ccaStrategy: envAddress('VITE_AKITA_CCA_STRATEGY', AKITA_DEFAULTS.ccaStrategy)!,
  oracle: envAddress('VITE_AKITA_ORACLE', AKITA_DEFAULTS.oracle)!,
  // Strategies for vault allocation
  strategies: {
    akitaWethLP: envAddress('VITE_AKITA_WETH_LP'), // Deploy AKITA/WETH 1% LP strategy
    akitaUsdcLP: envAddress('VITE_AKITA_USDC_LP'), // Deploy AKITA/USDC 1% LP strategy
    ajna: envAddress('VITE_AKITA_AJNA_STRATEGY'), // Ajna strategy
  },
} as const

// Protocol token (ERC4626)
export const ERC4626 = {
  token: envAddress('VITE_ERC4626_TOKEN', ERC4626_DEFAULTS.token)!,
  vault: envAddress('VITE_ERC4626_VAULT', ERC4626_DEFAULTS.vault)!,
  wrapper: envAddress('VITE_ERC4626_WRAPPER', ERC4626_DEFAULTS.wrapper)!,
  shareOFT: envAddress('VITE_ERC4626_SHARE_OFT', ERC4626_DEFAULTS.shareOFT)!,
  gaugeController: envAddress('VITE_ERC4626_GAUGE_CONTROLLER', ERC4626_DEFAULTS.gaugeController)!,
  ccaStrategy: envAddress('VITE_ERC4626_CCA_STRATEGY', ERC4626_DEFAULTS.ccaStrategy)!,
  oracle: envAddress('VITE_ERC4626_ORACLE', ERC4626_DEFAULTS.oracle)!,
} as const

export type { ContractAddress } from './contracts.defaults'
