/**
 * CreatorVault Deployed Contract Addresses
 * Updated: December 2024
 */

export const CONTRACTS = {
  // Shared Infrastructure
  registry: '0x777e28d7617ADb6E2fE7b7C49864A173e36881EF' as const,
  factory: '0x6205c91941A207A622fD00481b92cA04308a2819' as const,
  lotteryManager: '0xe2C39D39FF92c0cF7A0e9eD16FcE1d6F14bB38fD' as const,
  vrfConsumer: '0xE7Bdc1dA09E6fD92B1a1cb82F427ed8d53B4f3Cb' as const,
  payoutRouterFactory: '0x9C53cEaA15AdDB436c89A1F929fF12ED2BD26ea9' as const,
  // Universal CREATE2 factory (EIP-2470-style; deployed on many chains)
  create2Factory: '0x4e59b44847b379578588920cA78FbF26c0B4956C' as const,
  // Phase 2 (AA): CREATE2 deployer for permissionless, one-signature deployments
  create2Deployer: '0xaBf645362104F34D9C3FE48440bE7c99aaDE58E7' as const,

  // Phase 1/2 (AA): Vault activation batcher (approve + deposit + wrap + launch auction)
  vaultActivationBatcher: '0x6d796554698f5Ddd74Ff20d745304096aEf93CB6' as const,

  // Protocol treasury / multisig (receives protocol fee slice from GaugeController)
  protocolTreasury: '0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3' as const,

  // Legacy activator (older 2-click flow). Kept for backwards compatibility.
  vaultActivator: '0x1bf02C90B226C028720D25dE535b345e5FfB9743' as const,
  lpDeployer: '0x0000000000000000000000000000000000000000' as const, // TODO: Deploy SimpleLPDeployer

  // External - Uniswap V4
  poolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b' as const,
  taxHook: '0xca975B9dAF772C71161f3648437c3616E5Be0088' as const,
  chainlinkEthUsd: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70' as const,
  weth: '0x4200000000000000000000000000000000000006' as const, // Base WETH
  
  // External - Ajna Protocol (Base)
  // Source: https://faqs.ajna.finance/info/deployment-addresses-and-bridges
  ajnaErc20Factory: '0x214f62B5836D83f3D6c4f71F174209097B1A779C' as const,
  ajnaErc721Factory: '0xeefEC5d1Cc4bde97279d01D88eFf9e0fEe981769' as const,
  ajnaPoolInfoUtils: '0x97fa9b0909C238D170C1ab3B5c728A3a45BBEcBa' as const,
  ajnaPositionManager: '0x59710a4149A27585f1841b5783ac704a08274e64' as const,

  // External - Charm Finance (TODO: Add Base deployment addresses)
  charmAlphaVault: undefined as `0x${string}` | undefined,

  // External - Uniswap
  uniswapV3Factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD' as const,

  // External - Standard Tokens
  zora: '0x4200000000000000000000000000000000000777' as const,
  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const,

  // Helpers
  strategyDeploymentBatcher: undefined as `0x${string}` | undefined, // Deploy with: forge create StrategyDeploymentBatcher
} as const

// Example: AKITA Vault (first creator)
export const AKITA = {
  token: '0x5b674196812451b7cec024fe9d22d2c0b172fa75' as const,
  vault: '0xA015954E2606d08967Aee3787456bB3A86a46A42' as const,
  wrapper: '0x58Cd1E9248F89138208A601e95A531d3c0fa0c4f' as const,
  shareOFT: '0x4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57' as const,
  gaugeController: '0xB471B53cD0A30289Bc3a2dc3c6dd913288F8baA1' as const,
  ccaStrategy: '0x00c7897e0554b34A477D9D144AcC613Cdc97046F' as const,
  oracle: '0x8C044aeF10d05bcC53912869db89f6e1f37bC6fC' as const,
  // Strategies for vault allocation
  strategies: {
    akitaWethLP: '0x0000000000000000000000000000000000000000' as const, // TODO: Deploy AKITA/WETH 1% LP strategy
    akitaUsdcLP: '0x0000000000000000000000000000000000000000' as const, // TODO: Deploy AKITA/USDC 1% LP strategy
    ajna: '0x0000000000000000000000000000000000000000' as const, // TODO: Deploy Ajna strategy
  },
} as const

export type ContractAddress = `0x${string}`
