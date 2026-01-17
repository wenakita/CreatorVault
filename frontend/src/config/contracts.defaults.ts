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
  registry: '0x02c8031c39E10832A831b954Df7a2c1bf9Df052D' as ContractAddress,
  factory: '0xcCa08f9b94dD478266D0D1D2e9B7758414280FfD' as ContractAddress,
  lotteryManager: '0xA02A858E67c98320dCFB218831B645692E8f3483' as ContractAddress,
  vrfConsumer: '0x0265236984DE964CB0422BaeFbDb2de7C9d590F5' as ContractAddress,
  payoutRouterFactory: '0x9C53cEaA15AdDB436c89A1F929fF12ED2BD26ea9' as ContractAddress,

  // CREATE2 infra
  create2Factory: '0x4e59b44847b379578588920cA78FbF26c0B4956C' as ContractAddress,
  create2Deployer: '0xaBf645362104F34D9C3FE48440bE7c99aaDE58E7' as ContractAddress,
  universalBytecodeStore: '0xCDf45B94348DBBABba4bE6f4a5341badb83D4dC4' as ContractAddress,
  universalCreate2DeployerFromStore: '0xDb65C152B0496208A117FF7C04ddd5039F3035c6' as ContractAddress,

  // AA helpers
  vaultActivationBatcher: '0x4b67e3a4284090e5191c27B8F24248eC82DF055D' as ContractAddress,
  creatorVaultBatcher: '0xB695AEaD09868F287DAA38FA444B240847c50fB8' as ContractAddress,

  // Treasury
  protocolTreasury: '0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3' as ContractAddress,
  vaultActivator: '0x1bf02C90B226C028720D25dE535b345e5FfB9743' as ContractAddress,

  // Uniswap V4 core + hook
  poolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b' as ContractAddress,
  taxHook: '0xca975B9dAF772C71161f3648437c3616E5Be0088' as ContractAddress,

  // Uniswap V3 pools (Base) used for ZORA reference pricing (TWAP via observe)
  zoraUsdcV3Pool: '0xEdc625b74537ee3A10874f53D170e9C17a906B9c' as ContractAddress,
  zoraWethV3Pool: '0xA0Ca5BEBC42Cdbf3623b1C09206aE4E3975b0Fc7' as ContractAddress,

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

export const ERC4626_DEFAULTS = {
  token: AKITA_DEFAULTS.token,
  vault: AKITA_DEFAULTS.vault,
  wrapper: AKITA_DEFAULTS.wrapper,
  shareOFT: AKITA_DEFAULTS.shareOFT,
  gaugeController: AKITA_DEFAULTS.gaugeController,
  ccaStrategy: AKITA_DEFAULTS.ccaStrategy,
  oracle: AKITA_DEFAULTS.oracle,
} as const