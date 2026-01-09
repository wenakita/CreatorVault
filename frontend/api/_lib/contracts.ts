/**
 * Node-safe contract address config for Vercel serverless functions.
 *
 * IMPORTANT:
 * - Do NOT import from `frontend/src/config/contracts.ts` inside /api routes.
 *   That file references `import.meta.env` (Vite-only) and will crash Node functions.
 * - Keep defaults aligned with `frontend/src/config/contracts.ts`.
 */

declare const process: { env: Record<string, string | undefined> }

export type ContractAddress = `0x${string}`

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
  vaultActivator: ContractAddress
  poolManager: ContractAddress
  taxHook: ContractAddress
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

/**
 * Contract addresses for Base mainnet.
 *
 * Env overrides are optional and are primarily useful for local testing.
 */
export function getApiContracts(): ApiContracts {
  return {
    registry: pickAddress('CREATOR_REGISTRY', '0x777e28d7617ADb6E2fE7b7C49864A173e36881EF')!,
    factory: pickAddress('CREATOR_FACTORY', '0x6205c91941A207A622fD00481b92cA04308a2819')!,
    lotteryManager: pickAddress('LOTTERY_MANAGER', '0xe2C39D39FF92c0cF7A0e9eD16FcE1d6F14bB38fD')!,
    payoutRouterFactory: pickAddress('PAYOUT_ROUTER_FACTORY', '0x9C53cEaA15AdDB436c89A1F929fF12ED2BD26ea9')!,
    create2Factory: pickAddress('CREATE2_FACTORY', '0x4e59b44847b379578588920cA78FbF26c0B4956C')!,
    create2Deployer: pickAddress('CREATE2_DEPLOYER', '0xaBf645362104F34D9C3FE48440bE7c99aaDE58E7')!,
    universalBytecodeStore: pickAddress('UNIVERSAL_BYTECODE_STORE', '0xbec0c922835136949032223860C021484b0Cbdfa'),
    universalCreate2DeployerFromStore: pickAddress(
      'UNIVERSAL_CREATE2_FROM_STORE',
      '0x6E01e598e450F07551200e7b2db333BEcC66b35e',
    ),
    vaultActivationBatcher: pickAddress('VAULT_ACTIVATION_BATCHER', '0x6d796554698f5Ddd74Ff20d745304096aEf93CB6')!,
    creatorVaultBatcher: pickAddress('CREATOR_VAULT_BATCHER'),
    protocolTreasury: pickAddress('PROTOCOL_TREASURY', '0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3')!,
    vaultActivator: pickAddress('VAULT_ACTIVATOR', '0x1bf02C90B226C028720D25dE535b345e5FfB9743')!,
    poolManager: pickAddress('POOL_MANAGER', '0x498581fF718922c3f8e6A244956aF099B2652b2b')!,
    taxHook: pickAddress('TAX_HOOK', '0xca975B9dAF772C71161f3648437c3616E5Be0088')!,
    chainlinkEthUsd: pickAddress('CHAINLINK_ETH_USD', '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70')!,
    weth: pickAddress('WETH', '0x4200000000000000000000000000000000000006')!,
    ajnaErc20Factory: pickAddress('AJNA_ERC20_FACTORY', '0x214f62B5836D83f3D6c4f71F174209097B1A779C')!,
    ajnaErc721Factory: pickAddress('AJNA_ERC721_FACTORY', '0xeefEC5d1Cc4bde97279d01D88eFf9e0fEe981769')!,
    ajnaPoolInfoUtils: pickAddress('AJNA_POOL_INFO_UTILS', '0x97fa9b0909C238D170C1ab3B5c728A3a45BBEcBa')!,
    ajnaPositionManager: pickAddress('AJNA_POSITION_MANAGER', '0x59710a4149A27585f1841b5783ac704a08274e64')!,
    charmAlphaVault: pickAddress('CHARM_ALPHA_VAULT'),
    uniswapV3Factory: pickAddress('UNISWAP_V3_FACTORY', '0x33128a8fC17869897dcE68Ed026d694621f6FDfD')!,
    zora: pickAddress('ZORA_TOKEN', '0x4200000000000000000000000000000000000777')!,
    usdc: pickAddress('USDC_TOKEN', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')!,
    permit2: pickAddress('PERMIT2', '0x000000000022D473030F116dDEE9F6B43aC78BA3')!,
    strategyDeploymentBatcher: pickAddress('STRATEGY_DEPLOYMENT_BATCHER'),
  }
}
