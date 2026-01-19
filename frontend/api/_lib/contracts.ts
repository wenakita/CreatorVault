/**
 * Node-safe contract address config for Vercel serverless functions.
 *
 * IMPORTANT:
 * - Do NOT import from `frontend/src/config/contracts.ts` inside /api routes.
 *   That file references `import.meta.env` (Vite-only) and will crash Node functions.
 * - Keep defaults aligned with `frontend/src/config/contracts.ts`.
 */

declare const process: { env: Record<string, string | undefined> }

// NOTE: Vercel Node functions run as ESM; include `.js` extension for cross-folder imports.
import { BASE_DEFAULTS, type ContractAddress } from '../../src/config/contracts.defaults.js'

export type ApiContracts = {
  registry: ContractAddress
  factory: ContractAddress
  lotteryManager: ContractAddress
  payoutRouterFactory: ContractAddress
  create2Factory: ContractAddress
  create2Deployer: ContractAddress
  universalBytecodeStore?: ContractAddress
  universalCreate2DeployerFromStore?: ContractAddress
  vaultActivationBatcher: ContractAddress
  creatorVaultBatcher?: ContractAddress
  protocolTreasury: ContractAddress
  vaultGaugeVoting?: ContractAddress
  voterRewardsDistributor?: ContractAddress
  bribesFactory?: ContractAddress
  ve4626?: ContractAddress
  veBoostManager?: ContractAddress
  poolManager: ContractAddress
  taxHook: ContractAddress
  positionManager?: ContractAddress
  swapRouter?: ContractAddress
  quoter?: ContractAddress
  chainlinkEthUsd: ContractAddress
  weth: ContractAddress
  ajnaErc20Factory: ContractAddress
  ajnaErc721Factory: ContractAddress
  ajnaPoolInfoUtils: ContractAddress
  ajnaPositionManager: ContractAddress
  charmAlphaVault?: ContractAddress
  uniswapV3Factory: ContractAddress
  zora: ContractAddress
  usdc: ContractAddress
  permit2: ContractAddress
  strategyDeploymentBatcher?: ContractAddress
}

function pickAddress(envKey: string, fallback?: string): ContractAddress | undefined {
  const raw = (process.env[envKey] ?? '').trim()
  const v = raw.length > 0 ? raw : (fallback ?? '').trim()
  if (!v) return undefined
  return v as ContractAddress
}

function pickAddressProdSafe(envKey: string, fallback?: string): ContractAddress | undefined {
  const isVercel = Boolean((process.env.VERCEL ?? '').trim())
  const allowOverrides = (process.env.ALLOW_API_CONTRACT_OVERRIDES ?? '').trim() === '1'
  // In production serverless, prefer repo defaults to avoid mismatched env overrides
  // between frontend + backend that can cause paymaster validation failures.
  if (isVercel && !allowOverrides) return (fallback ?? undefined) as ContractAddress | undefined
  return pickAddress(envKey, fallback)
}

/**
 * Contract addresses for Base mainnet.
 *
 * Env overrides are optional and are primarily useful for local testing.
 */
export function getApiContracts(): ApiContracts {
  return {
    registry: pickAddress('CREATOR_REGISTRY', BASE_DEFAULTS.registry)!,
    factory: pickAddress('CREATOR_FACTORY', BASE_DEFAULTS.factory)!,
    lotteryManager: pickAddress('LOTTERY_MANAGER', BASE_DEFAULTS.lotteryManager)!,
    payoutRouterFactory: pickAddress('PAYOUT_ROUTER_FACTORY', BASE_DEFAULTS.payoutRouterFactory)!,
    create2Factory: pickAddress('CREATE2_FACTORY', BASE_DEFAULTS.create2Factory)!,
    create2Deployer: pickAddress('CREATE2_DEPLOYER', BASE_DEFAULTS.create2Deployer)!,
    universalBytecodeStore: pickAddress('UNIVERSAL_BYTECODE_STORE', BASE_DEFAULTS.universalBytecodeStore),
    universalCreate2DeployerFromStore: pickAddress(
      'UNIVERSAL_CREATE2_FROM_STORE',
      BASE_DEFAULTS.universalCreate2DeployerFromStore,
    ),
    vaultActivationBatcher: pickAddressProdSafe('VAULT_ACTIVATION_BATCHER', BASE_DEFAULTS.vaultActivationBatcher)!,
    creatorVaultBatcher: pickAddressProdSafe('CREATOR_VAULT_BATCHER', BASE_DEFAULTS.creatorVaultBatcher),
    protocolTreasury: pickAddress('PROTOCOL_TREASURY', BASE_DEFAULTS.protocolTreasury)!,
    vaultGaugeVoting: pickAddressProdSafe('VAULT_GAUGE_VOTING'),
    voterRewardsDistributor: pickAddressProdSafe('VOTER_REWARDS_DISTRIBUTOR'),
    bribesFactory: pickAddressProdSafe('BRIBES_FACTORY'),
    ve4626: pickAddressProdSafe('VE4626'),
    veBoostManager: pickAddressProdSafe('VE_BOOST_MANAGER'),
    poolManager: pickAddress('POOL_MANAGER', BASE_DEFAULTS.poolManager)!,
    taxHook: pickAddress('TAX_HOOK', BASE_DEFAULTS.taxHook)!,
    positionManager: pickAddress('POSITION_MANAGER'),
    swapRouter: pickAddress('SWAP_ROUTER'),
    quoter: pickAddress('QUOTER'),
    chainlinkEthUsd: pickAddress('CHAINLINK_ETH_USD', BASE_DEFAULTS.chainlinkEthUsd)!,
    weth: pickAddress('WETH', BASE_DEFAULTS.weth)!,
    ajnaErc20Factory: pickAddress('AJNA_ERC20_FACTORY', BASE_DEFAULTS.ajnaErc20Factory)!,
    ajnaErc721Factory: pickAddress('AJNA_ERC721_FACTORY', BASE_DEFAULTS.ajnaErc721Factory)!,
    ajnaPoolInfoUtils: pickAddress('AJNA_POOL_INFO_UTILS', BASE_DEFAULTS.ajnaPoolInfoUtils)!,
    ajnaPositionManager: pickAddress('AJNA_POSITION_MANAGER', BASE_DEFAULTS.ajnaPositionManager)!,
    charmAlphaVault: pickAddress('CHARM_ALPHA_VAULT'),
    uniswapV3Factory: pickAddress('UNISWAP_V3_FACTORY', BASE_DEFAULTS.uniswapV3Factory)!,
    zora: pickAddress('ZORA_TOKEN', BASE_DEFAULTS.zora)!,
    usdc: pickAddress('USDC_TOKEN', BASE_DEFAULTS.usdc)!,
    permit2: pickAddress('PERMIT2', BASE_DEFAULTS.permit2)!,
    strategyDeploymentBatcher: pickAddress('STRATEGY_DEPLOYMENT_BATCHER'),
  }
}
