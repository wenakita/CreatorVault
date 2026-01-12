/**
 * Shared, environment-agnostic default addresses.
 *
 * IMPORTANT:
 * - This file must be safe to import from BOTH:
 *   - Vite/browser code (`frontend/src/...`)
 *   - Node/Vercel functions (`frontend/api/...`)
 * - Do NOT reference `import.meta.env` or `process.env` here.
 */

export type ContractAddress = `0x${string}`

export const BASE_DEFAULTS = {
  // Shared infrastructure
  registry: '0x777e28d7617ADb6E2fE7b7C49864A173e36881EF' as ContractAddress,
  factory: '0x6205c91941A207A622fD00481b92cA04308a2819' as ContractAddress,
  lotteryManager: '0xe2C39D39FF92c0cF7A0e9eD16FcE1d6F14bB38fD' as ContractAddress,
  vrfConsumer: '0xE7Bdc1dA09E6fD92B1a1cb82F427ed8d53B4f3Cb' as ContractAddress,
  payoutRouterFactory: '0x9C53cEaA15AdDB436c89A1F929fF12ED2BD26ea9' as ContractAddress,

  // CREATE2 infra
  create2Factory: '0x4e59b44847b379578588920cA78FbF26c0B4956C' as ContractAddress,
  create2Deployer: '0xaBf645362104F34D9C3FE48440bE7c99aaDE58E7' as ContractAddress,
  universalBytecodeStore: '0xbec0c922835136949032223860C021484b0Cbdfa' as ContractAddress,
  universalCreate2DeployerFromStore: '0x6E01e598e450F07551200e7b2db333BEcC66b35e' as ContractAddress,

  // AA helpers
  vaultActivationBatcher: '0x6d796554698f5Ddd74Ff20d745304096aEf93CB6' as ContractAddress,

  // Treasury
  protocolTreasury: '0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3' as ContractAddress,
  vaultActivator: '0x1bf02C90B226C028720D25dE535b345e5FfB9743' as ContractAddress,

  // Uniswap V4 core + hook
  poolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b' as ContractAddress,
  taxHook: '0xca975B9dAF772C71161f3648437c3616E5Be0088' as ContractAddress,

  // Chainlink + tokens
  chainlinkEthUsd: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70' as ContractAddress,
  weth: '0x4200000000000000000000000000000000000006' as ContractAddress,
  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as ContractAddress,
  zora: '0x4200000000000000000000000000000000000777' as ContractAddress,

  // Permit2 (canonical, chain-agnostic)
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as ContractAddress,

  // Ajna (Base)
  ajnaErc20Factory: '0x214f62B5836D83f3D6c4f71F174209097B1A779C' as ContractAddress,
  ajnaErc721Factory: '0xeefEC5d1Cc4bde97279d01D88eFf9e0fEe981769' as ContractAddress,
  ajnaPoolInfoUtils: '0x97fa9b0909C238D170C1ab3B5c728A3a45BBEcBa' as ContractAddress,
  ajnaPositionManager: '0x59710a4149A27585f1841b5783ac704a08274e64' as ContractAddress,

  // Uniswap V3 factory (Base)
  uniswapV3Factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD' as ContractAddress,
} as const

export const AKITA_DEFAULTS = {
  token: '0x5b674196812451b7cec024fe9d22d2c0b172fa75' as ContractAddress,
  vault: '0xA015954E2606d08967Aee3787456bB3A86a46A42' as ContractAddress,
  wrapper: '0x58Cd1E9248F89138208A601e95A531d3c0fa0c4f' as ContractAddress,
  shareOFT: '0x4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57' as ContractAddress,
  gaugeController: '0xB471B53cD0A30289Bc3a2dc3c6dd913288F8baA1' as ContractAddress,
  ccaStrategy: '0x00c7897e0554b34A477D9D144AcC613Cdc97046F' as ContractAddress,
  oracle: '0x8C044aeF10d05bcC53912869db89f6e1f37bC6fC' as ContractAddress,
} as const

