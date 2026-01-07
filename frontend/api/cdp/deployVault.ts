import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  type ApiEnvelope,
} from '../auth/_shared.js'
import { getSessionAddress } from '../_lib/session.js'
import { getCdpClient, makeOwnerAccountName, makeSmartAccountName } from '../_lib/cdp.js'
import { CONTRACTS } from '@/config/contracts'
import { DEPLOY_BYTECODE } from '@/deploy/bytecode.generated'

import {
  concatHex,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getCreate2Address,
  http,
  isAddress,
  keccak256,
  parseAbiParameters,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'
import { coinABI } from '@zoralabs/protocol-deployments'

declare const process: { env: Record<string, string | undefined> }

type RequestBody = {
  creatorToken?: string
  shareSymbol?: string
  shareName?: string
  deploymentVersion?: 'v1' | 'v2' | 'v3'
  ownerAddress?: string
}

type ResponseBody = {
  smartAccountAddress: Address
  deployerAddress: Address
  userOpHash: string
  addresses: {
    vault: Address
    wrapper: Address
    shareOFT: Address
    gaugeController: Address
    ccaStrategy: Address
    oracle: Address
  }
}

const CREATE2_DEPLOYER_ABI = [
  {
    type: 'function',
    name: 'deploy',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'salt', type: 'bytes32' },
      { name: 'initCode', type: 'bytes' },
    ],
    outputs: [{ name: 'addr', type: 'address' }],
  },
] as const

const UNIVERSAL_CREATE2_FROM_STORE_ABI = [
  {
    type: 'function',
    name: 'deploy',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'salt', type: 'bytes32' },
      { name: 'codeId', type: 'bytes32' },
      { name: 'constructorArgs', type: 'bytes' },
    ],
    outputs: [{ name: 'addr', type: 'address' }],
  },
] as const

const BYTECODE_STORE_VIEW_ABI = [
  { type: 'function', name: 'pointers', stateMutability: 'view', inputs: [{ name: 'codeId', type: 'bytes32' }], outputs: [{ type: 'address' }] },
] as const

const WRAPPER_ADMIN_ABI = [
  { type: 'function', name: 'setShareOFT', stateMutability: 'nonpayable', inputs: [{ name: '_shareOFT', type: 'address' }], outputs: [] },
] as const

const SHAREOFT_ADMIN_ABI = [
  { type: 'function', name: 'setVault', stateMutability: 'nonpayable', inputs: [{ name: '_vault', type: 'address' }], outputs: [] },
  { type: 'function', name: 'setRegistry', stateMutability: 'nonpayable', inputs: [{ name: '_registry', type: 'address' }], outputs: [] },
  { type: 'function', name: 'setMinter', stateMutability: 'nonpayable', inputs: [{ name: 'minter', type: 'address' }, { name: 'status', type: 'bool' }], outputs: [] },
  { type: 'function', name: 'setGaugeController', stateMutability: 'nonpayable', inputs: [{ name: '_controller', type: 'address' }], outputs: [] },
] as const

const GAUGE_ADMIN_ABI = [
  { type: 'function', name: 'setVault', stateMutability: 'nonpayable', inputs: [{ name: '_vault', type: 'address' }], outputs: [] },
  { type: 'function', name: 'setWrapper', stateMutability: 'nonpayable', inputs: [{ name: '_wrapper', type: 'address' }], outputs: [] },
  { type: 'function', name: 'setCreatorCoin', stateMutability: 'nonpayable', inputs: [{ name: '_creatorCoin', type: 'address' }], outputs: [] },
  { type: 'function', name: 'setLotteryManager', stateMutability: 'nonpayable', inputs: [{ name: '_lotteryManager', type: 'address' }], outputs: [] },
  { type: 'function', name: 'setOracle', stateMutability: 'nonpayable', inputs: [{ name: '_oracle', type: 'address' }], outputs: [] },
] as const

const VAULT_OWNER_ABI = [
  { type: 'function', name: 'setGaugeController', stateMutability: 'nonpayable', inputs: [{ name: '_gaugeController', type: 'address' }], outputs: [] },
  { type: 'function', name: 'setWhitelist', stateMutability: 'nonpayable', inputs: [{ name: '_account', type: 'address' }, { name: '_status', type: 'bool' }], outputs: [] },
] as const

const CCA_ADMIN_ABI = [
  { type: 'function', name: 'setApprovedLauncher', stateMutability: 'nonpayable', inputs: [{ name: 'launcher', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [] },
  { type: 'function', name: 'setOracleConfig', stateMutability: 'nonpayable', inputs: [{ name: '_oracle', type: 'address' }, { name: '_poolManager', type: 'address' }, { name: '_taxHook', type: 'address' }, { name: '_feeRecipient', type: 'address' }], outputs: [] },
  { type: 'function', name: 'setDefaultTickSpacing', stateMutability: 'nonpayable', inputs: [{ name: '_spacing', type: 'uint256' }], outputs: [] },
] as const

const WRAPPER_USER_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [{ name: 'shareOFTOut', type: 'uint256' }],
  },
] as const

const ERC20_APPROVE_ABI = [
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const

const CCA_LAUNCH_ABI = [
  {
    type: 'function',
    name: 'launchAuction',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'floorPrice', type: 'uint256' },
      { name: 'requiredRaise', type: 'uint128' },
      { name: 'auctionSteps', type: 'bytes' },
    ],
    outputs: [{ name: 'auction', type: 'address' }],
  },
] as const

const CCA_STATUS_VIEW_ABI = [
  {
    type: 'function',
    name: 'getAuctionStatus',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'auction', type: 'address' },
      { name: 'isActive', type: 'bool' },
      { name: 'isGraduated', type: 'bool' },
      { name: 'clearingPrice', type: 'uint256' },
      { name: 'currencyRaised', type: 'uint256' },
    ],
  },
] as const

const OWNABLE_ABI = [
  { type: 'function', name: 'transferOwnership', stateMutability: 'nonpayable', inputs: [{ name: 'newOwner', type: 'address' }], outputs: [] },
] as const

const Q96 = 2n ** 96n
const DEFAULT_FLOOR_PRICE_ETH_WEI_PER_TOKEN = 1_000_000_000_000_000n
const DEFAULT_FLOOR_PRICE_Q96 = (DEFAULT_FLOOR_PRICE_ETH_WEI_PER_TOKEN * Q96) / 10n ** 18n
const DEFAULT_TICK_SPACING_Q96_RAW = DEFAULT_FLOOR_PRICE_Q96 / 100n
const DEFAULT_TICK_SPACING_Q96 = DEFAULT_TICK_SPACING_Q96_RAW > 1n ? DEFAULT_TICK_SPACING_Q96_RAW : 2n
const DEFAULT_FLOOR_PRICE_Q96_ALIGNED = (DEFAULT_FLOOR_PRICE_Q96 / DEFAULT_TICK_SPACING_Q96) * DEFAULT_TICK_SPACING_Q96
const DEFAULT_REQUIRED_RAISE_WEI = 100_000_000_000_000_000n
const DEFAULT_AUCTION_PERCENT = 50n
const MIN_FIRST_DEPOSIT = 50_000_000n * 10n ** 18n
const DEFAULT_CCA_DURATION_BLOCKS = 302_400n

function getBaseRpcUrl(): string {
  const rpc = (process.env.BASE_RPC_URL ?? '').trim()
  return rpc.length > 0 ? rpc : 'https://mainnet.base.org'
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function deriveSalts(params: { creatorToken: Address; owner: Address; chainId: number; version: string }) {
  const { creatorToken, owner, chainId, version } = params
  const baseSalt = keccak256(
    encodePacked(
      ['address', 'address', 'uint256', 'string'],
      [creatorToken, owner, BigInt(chainId), `CreatorVault:deploy:${version}`],
    ),
  )
  const saltFor = (label: string) => keccak256(encodePacked(['bytes32', 'string'], [baseSalt, label]))
  return {
    baseSalt,
    vaultSalt: saltFor('vault'),
    wrapperSalt: saltFor('wrapper'),
    gaugeSalt: saltFor('gauge'),
    ccaSalt: saltFor('cca'),
    oracleSalt: saltFor('oracle'),
  }
}

function deriveShareOftUniversalSalt(params: { owner: Address; shareSymbol: string; version: string }) {
  const base = keccak256(encodePacked(['address', 'string'], [params.owner, params.shareSymbol.toLowerCase()]))
  return keccak256(encodePacked(['bytes32', 'string'], [base, `CreatorShareOFT:${params.version}`]))
}

function deriveOftBootstrapSalt() {
  return keccak256(encodePacked(['string'], ['CreatorVault:OFTBootstrapRegistry:v1']))
}

function encodeCreate2FactoryDeployData(salt: Hex, initCode: Hex): Hex {
  return concatHex([salt, initCode])
}

function predictCreate2Address(create2Deployer: Address, salt: Hex, initCode: Hex): Address {
  const bytecodeHash = keccak256(initCode)
  return getCreate2Address({ from: create2Deployer, salt, bytecodeHash })
}

function encodeUniswapCcaLinearSteps(durationBlocks: bigint): Hex {
  const MPS = 10_000_000n
  if (durationBlocks <= 0n) return '0x'

  const mpsLow = MPS / durationBlocks
  const remainder = MPS - mpsLow * durationBlocks
  const mpsHigh = mpsLow + 1n

  const highBlocks = remainder
  const lowBlocks = durationBlocks - highBlocks

  const packStep = (mps: bigint, blockDelta: bigint) =>
    encodePacked(['uint24', 'uint40'], [Number(mps), Number(blockDelta)])

  const steps: Hex[] = []
  if (highBlocks > 0n) steps.push(packStep(mpsHigh, highBlocks))
  if (lowBlocks > 0n) steps.push(packStep(mpsLow, lowBlocks))
  return concatHex(steps)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const sessionAddress = getSessionAddress(req)
  if (!sessionAddress) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<RequestBody>(req)) ?? {}
  const creatorToken = typeof body.creatorToken === 'string' ? body.creatorToken : ''
  const shareSymbol = typeof body.shareSymbol === 'string' ? body.shareSymbol : ''
  const shareName = typeof body.shareName === 'string' ? body.shareName : ''
  const version = body.deploymentVersion ?? 'v3'
  const ownerOverride = typeof body.ownerAddress === 'string' ? body.ownerAddress : ''

  if (!isAddressLike(creatorToken) || !shareSymbol || !shareName) {
    return res.status(400).json({ success: false, error: 'Missing creator token or share metadata' } satisfies ApiEnvelope<never>)
  }

  const client = createPublicClient({
    chain: base,
    transport: http(getBaseRpcUrl(), { timeout: 12_000, retryCount: 2, retryDelay: 300 }),
  })

  const cdp = getCdpClient()
  const owner = await cdp.evm.getOrCreateAccount({
    name: makeOwnerAccountName(sessionAddress),
  })
  const smartAccount = await cdp.evm.getOrCreateSmartAccount({
    owner,
    name: makeSmartAccountName(sessionAddress),
  })

  const smartAccountAddress = smartAccount.address as Address
  const deployerAddress = isAddressLike(ownerOverride) ? (ownerOverride as Address) : smartAccountAddress

  const create2Factory = CONTRACTS.create2Factory as Address
  const create2Deployer = CONTRACTS.create2Deployer as Address
  const registry = CONTRACTS.registry as Address
  const protocolTreasury = CONTRACTS.protocolTreasury as Address
  const poolManager = CONTRACTS.poolManager as Address
  const taxHook = CONTRACTS.taxHook as Address
  const lotteryManager = (CONTRACTS.lotteryManager ?? '0x0000000000000000000000000000000000000000') as Address
  const vaultActivationBatcher = CONTRACTS.vaultActivationBatcher as Address

  const universalBytecodeStore = (CONTRACTS as any).universalBytecodeStore as Address | undefined
  const universalCreate2FromStore = (CONTRACTS as any).universalCreate2DeployerFromStore as Address | undefined

  const bootstrapCodeId = keccak256(DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex)
  const shareOftCodeId = keccak256(DEPLOY_BYTECODE.CreatorShareOFT as Hex)
  const vaultCodeId = keccak256(DEPLOY_BYTECODE.CreatorOVault as Hex)
  const wrapperCodeId = keccak256(DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex)
  const gaugeCodeId = keccak256(DEPLOY_BYTECODE.CreatorGaugeController as Hex)
  const ccaCodeId = keccak256(DEPLOY_BYTECODE.CCALaunchStrategy as Hex)
  const oracleCodeId = keccak256(DEPLOY_BYTECODE.CreatorOracle as Hex)

  let useUniversalOftStore = false
  let useUniversalFullStore = false

  if ((version === 'v2' || version === 'v3') && universalBytecodeStore && universalCreate2FromStore) {
    try {
      const [storeCode, deployerCode] = await Promise.all([
        client.getBytecode({ address: universalBytecodeStore }),
        client.getBytecode({ address: universalCreate2FromStore }),
      ])
      if (storeCode && storeCode !== '0x' && deployerCode && deployerCode !== '0x') {
        const codeIds = [bootstrapCodeId, shareOftCodeId, vaultCodeId, wrapperCodeId, gaugeCodeId, ccaCodeId, oracleCodeId] as const
        const ptrs = await Promise.all(
          codeIds.map((codeId) =>
            client.readContract({
              address: universalBytecodeStore,
              abi: BYTECODE_STORE_VIEW_ABI,
              functionName: 'pointers',
              args: [codeId],
            }),
          ),
        )
        const has = (i: number) => (ptrs[i] as Address).toLowerCase() !== '0x0000000000000000000000000000000000000000'
        useUniversalOftStore = has(0) && has(1)
        useUniversalFullStore = useUniversalOftStore && has(2) && has(3) && has(4) && has(5) && has(6)
      }
    } catch {
      useUniversalOftStore = false
      useUniversalFullStore = false
    }
  }

  const localCreate2Deployer = useUniversalFullStore ? (universalCreate2FromStore as Address) : create2Deployer

  const salts = deriveSalts({
    creatorToken: creatorToken as Address,
    owner: deployerAddress,
    chainId: base.id,
    version,
  })

  const oftBootstrapSalt = deriveOftBootstrapSalt()
  const oftBootstrapInitCode = DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex
  const shareOftSalt = deriveShareOftUniversalSalt({
    owner: deployerAddress,
    shareSymbol,
    version,
  })

  const oftBootstrapRegistry = predictCreate2Address(
    useUniversalOftStore ? (universalCreate2FromStore as Address) : create2Factory,
    oftBootstrapSalt,
    oftBootstrapInitCode,
  )

  const shareOftConstructorArgs = encodeAbiParameters(parseAbiParameters('string,string,address,address'), [
    shareName,
    shareSymbol,
    oftBootstrapRegistry,
    deployerAddress,
  ])
  const shareOftInitCode = concatHex([DEPLOY_BYTECODE.CreatorShareOFT as Hex, shareOftConstructorArgs])
  const shareOftAddress = predictCreate2Address(
    useUniversalOftStore ? (universalCreate2FromStore as Address) : create2Factory,
    shareOftSalt,
    shareOftInitCode,
  )

  const vaultConstructorArgs = encodeAbiParameters(parseAbiParameters('address,address,string,string'), [
    creatorToken,
    deployerAddress,
    `${shareSymbol.replace(/^ws/i, '')} Vault Share`,
    `s${shareSymbol.replace(/^ws/i, '')}`,
  ])
  const vaultInitCode = concatHex([DEPLOY_BYTECODE.CreatorOVault as Hex, vaultConstructorArgs])
  const vaultAddress = predictCreate2Address(localCreate2Deployer, salts.vaultSalt, vaultInitCode)

  const wrapperConstructorArgs = encodeAbiParameters(parseAbiParameters('address,address,address'), [
    creatorToken,
    vaultAddress,
    deployerAddress,
  ])
  const wrapperInitCode = concatHex([DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex, wrapperConstructorArgs])
  const wrapperAddress = predictCreate2Address(localCreate2Deployer, salts.wrapperSalt, wrapperInitCode)

  const gaugeConstructorArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address'), [
    shareOftAddress,
    protocolTreasury,
    protocolTreasury,
    deployerAddress,
  ])
  const gaugeInitCode = concatHex([DEPLOY_BYTECODE.CreatorGaugeController as Hex, gaugeConstructorArgs])
  const gaugeAddress = predictCreate2Address(localCreate2Deployer, salts.gaugeSalt, gaugeInitCode)

  const ccaConstructorArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address,address'), [
    shareOftAddress,
    '0x0000000000000000000000000000000000000000',
    vaultAddress,
    vaultAddress,
    deployerAddress,
  ])
  const ccaInitCode = concatHex([DEPLOY_BYTECODE.CCALaunchStrategy as Hex, ccaConstructorArgs])
  const ccaAddress = predictCreate2Address(localCreate2Deployer, salts.ccaSalt, ccaInitCode)

  const oracleConstructorArgs = encodeAbiParameters(parseAbiParameters('address,address,string,address'), [
    registry,
    CONTRACTS.chainlinkEthUsd as Address,
    shareSymbol,
    deployerAddress,
  ])
  const oracleInitCode = concatHex([DEPLOY_BYTECODE.CreatorOracle as Hex, oracleConstructorArgs])
  const oracleAddress = predictCreate2Address(localCreate2Deployer, salts.oracleSalt, oracleInitCode)

  const payoutRecipient = (await client.readContract({
    address: creatorToken as Address,
    abi: coinABI,
    functionName: 'payoutRecipient',
  })) as Address

  if (!isAddress(payoutRecipient) || payoutRecipient.toLowerCase() !== gaugeAddress.toLowerCase()) {
    return res.status(400).json({
      success: false,
      error: `Payout recipient must be set to ${gaugeAddress}`,
    } satisfies ApiEnvelope<never>)
  }

  const deployerBalance = (await client.readContract({
    address: creatorToken as Address,
    abi: ERC20_APPROVE_ABI,
    functionName: 'balanceOf',
    args: [smartAccountAddress],
  })) as bigint

  if (deployerBalance < MIN_FIRST_DEPOSIT) {
    return res.status(400).json({
      success: false,
      error: `Deployment wallet needs 50,000,000 tokens. Send to ${smartAccountAddress}`,
    } satisfies ApiEnvelope<never>)
  }

  const existing = await Promise.all([
    client.getBytecode({ address: vaultAddress }),
    client.getBytecode({ address: wrapperAddress }),
    client.getBytecode({ address: shareOftAddress }),
    client.getBytecode({ address: gaugeAddress }),
    client.getBytecode({ address: ccaAddress }),
    client.getBytecode({ address: oracleAddress }),
    client.getBytecode({ address: oftBootstrapRegistry }),
  ])

  const deployCalls: { to: Address; data: Hex; value?: bigint }[] = []

  if (!existing[6] || existing[6] === '0x') {
    if (useUniversalOftStore) {
      deployCalls.push({
        to: universalCreate2FromStore as Address,
        data: encodeFunctionData({
          abi: UNIVERSAL_CREATE2_FROM_STORE_ABI,
          functionName: 'deploy',
          args: [oftBootstrapSalt, bootstrapCodeId, '0x'],
        }),
      })
    } else {
      deployCalls.push({
        to: create2Factory,
        data: encodeCreate2FactoryDeployData(oftBootstrapSalt, oftBootstrapInitCode),
      })
    }
  }

  if (!existing[2] || existing[2] === '0x') {
    if (useUniversalOftStore) {
      deployCalls.push({
        to: universalCreate2FromStore as Address,
        data: encodeFunctionData({
          abi: UNIVERSAL_CREATE2_FROM_STORE_ABI,
          functionName: 'deploy',
          args: [shareOftSalt, shareOftCodeId, shareOftConstructorArgs],
        }),
      })
    } else {
      deployCalls.push({
        to: create2Factory,
        data: encodeCreate2FactoryDeployData(shareOftSalt, shareOftInitCode),
      })
    }
  }

  if (!existing[0] || existing[0] === '0x') {
    const deployer = localCreate2Deployer
    const initCode = vaultInitCode
    deployCalls.push({
      to: deployer,
      data: encodeFunctionData({
        abi: useUniversalFullStore ? UNIVERSAL_CREATE2_FROM_STORE_ABI : CREATE2_DEPLOYER_ABI,
        functionName: 'deploy',
        args: useUniversalFullStore ? [salts.vaultSalt, vaultCodeId, vaultConstructorArgs] : [salts.vaultSalt, initCode],
      }) as Hex,
    })
  }

  if (!existing[1] || existing[1] === '0x') {
    deployCalls.push({
      to: localCreate2Deployer,
      data: encodeFunctionData({
        abi: useUniversalFullStore ? UNIVERSAL_CREATE2_FROM_STORE_ABI : CREATE2_DEPLOYER_ABI,
        functionName: 'deploy',
        args: useUniversalFullStore ? [salts.wrapperSalt, wrapperCodeId, wrapperConstructorArgs] : [salts.wrapperSalt, wrapperInitCode],
      }) as Hex,
    })
  }

  if (!existing[3] || existing[3] === '0x') {
    deployCalls.push({
      to: localCreate2Deployer,
      data: encodeFunctionData({
        abi: useUniversalFullStore ? UNIVERSAL_CREATE2_FROM_STORE_ABI : CREATE2_DEPLOYER_ABI,
        functionName: 'deploy',
        args: useUniversalFullStore ? [salts.gaugeSalt, gaugeCodeId, gaugeConstructorArgs] : [salts.gaugeSalt, gaugeInitCode],
      }) as Hex,
    })
  }

  if (!existing[4] || existing[4] === '0x') {
    deployCalls.push({
      to: localCreate2Deployer,
      data: encodeFunctionData({
        abi: useUniversalFullStore ? UNIVERSAL_CREATE2_FROM_STORE_ABI : CREATE2_DEPLOYER_ABI,
        functionName: 'deploy',
        args: useUniversalFullStore ? [salts.ccaSalt, ccaCodeId, ccaConstructorArgs] : [salts.ccaSalt, ccaInitCode],
      }) as Hex,
    })
  }

  if (!existing[5] || existing[5] === '0x') {
    deployCalls.push({
      to: localCreate2Deployer,
      data: encodeFunctionData({
        abi: useUniversalFullStore ? UNIVERSAL_CREATE2_FROM_STORE_ABI : CREATE2_DEPLOYER_ABI,
        functionName: 'deploy',
        args: useUniversalFullStore ? [salts.oracleSalt, oracleCodeId, oracleConstructorArgs] : [salts.oracleSalt, oracleInitCode],
      }) as Hex,
    })
  }

  const wiringCalls: { to: Address; data: Hex; value?: bigint }[] = []
  wiringCalls.push({ to: wrapperAddress, data: encodeFunctionData({ abi: WRAPPER_ADMIN_ABI, functionName: 'setShareOFT', args: [shareOftAddress] }) })
  wiringCalls.push({ to: shareOftAddress, data: encodeFunctionData({ abi: SHAREOFT_ADMIN_ABI, functionName: 'setRegistry', args: [registry] }) })
  wiringCalls.push({ to: shareOftAddress, data: encodeFunctionData({ abi: SHAREOFT_ADMIN_ABI, functionName: 'setVault', args: [vaultAddress] }) })
  wiringCalls.push({ to: shareOftAddress, data: encodeFunctionData({ abi: SHAREOFT_ADMIN_ABI, functionName: 'setMinter', args: [wrapperAddress, true] }) })
  wiringCalls.push({ to: shareOftAddress, data: encodeFunctionData({ abi: SHAREOFT_ADMIN_ABI, functionName: 'setGaugeController', args: [gaugeAddress] }) })
  wiringCalls.push({ to: gaugeAddress, data: encodeFunctionData({ abi: GAUGE_ADMIN_ABI, functionName: 'setVault', args: [vaultAddress] }) })
  wiringCalls.push({ to: gaugeAddress, data: encodeFunctionData({ abi: GAUGE_ADMIN_ABI, functionName: 'setWrapper', args: [wrapperAddress] }) })
  wiringCalls.push({ to: gaugeAddress, data: encodeFunctionData({ abi: GAUGE_ADMIN_ABI, functionName: 'setCreatorCoin', args: [creatorToken as Address] }) })
  if (lotteryManager !== '0x0000000000000000000000000000000000000000') {
    wiringCalls.push({ to: gaugeAddress, data: encodeFunctionData({ abi: GAUGE_ADMIN_ABI, functionName: 'setLotteryManager', args: [lotteryManager] }) })
  }
  wiringCalls.push({ to: gaugeAddress, data: encodeFunctionData({ abi: GAUGE_ADMIN_ABI, functionName: 'setOracle', args: [oracleAddress] }) })
  wiringCalls.push({ to: vaultAddress, data: encodeFunctionData({ abi: VAULT_OWNER_ABI, functionName: 'setGaugeController', args: [gaugeAddress] }) })
  wiringCalls.push({ to: vaultAddress, data: encodeFunctionData({ abi: VAULT_OWNER_ABI, functionName: 'setWhitelist', args: [wrapperAddress, true] }) })
  wiringCalls.push({ to: vaultAddress, data: encodeFunctionData({ abi: VAULT_OWNER_ABI, functionName: 'setWhitelist', args: [vaultActivationBatcher, true] }) })
  wiringCalls.push({ to: ccaAddress, data: encodeFunctionData({ abi: CCA_ADMIN_ABI, functionName: 'setApprovedLauncher', args: [vaultActivationBatcher, true] }) })
  wiringCalls.push({
    to: ccaAddress,
    data: encodeFunctionData({
      abi: CCA_ADMIN_ABI,
      functionName: 'setOracleConfig',
      args: [oracleAddress, poolManager, taxHook, gaugeAddress],
    }),
  })
  wiringCalls.push({
    to: ccaAddress,
    data: encodeFunctionData({
      abi: CCA_ADMIN_ABI,
      functionName: 'setDefaultTickSpacing',
      args: [DEFAULT_TICK_SPACING_Q96],
    }),
  })

  const launchCalls: { to: Address; data: Hex; value?: bigint }[] = []
  const auctionSteps = encodeUniswapCcaLinearSteps(DEFAULT_CCA_DURATION_BLOCKS)
  const auctionAmount = (MIN_FIRST_DEPOSIT * DEFAULT_AUCTION_PERCENT) / 100n

  let shouldLaunch = true
  try {
    const status = (await client.readContract({
      address: ccaAddress,
      abi: CCA_STATUS_VIEW_ABI,
      functionName: 'getAuctionStatus',
    })) as readonly [Address, boolean, boolean, bigint, bigint]
    const auctionAddr = status[0]
    if (isAddress(auctionAddr) && auctionAddr.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
      shouldLaunch = false
    }
  } catch {
    // If status read fails, continue and let launch attempt decide.
  }

  if (shouldLaunch) {
    launchCalls.push({
      to: creatorToken as Address,
      data: encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [wrapperAddress, MIN_FIRST_DEPOSIT],
      }),
    })
    launchCalls.push({
      to: wrapperAddress,
      data: encodeFunctionData({
        abi: WRAPPER_USER_ABI,
        functionName: 'deposit',
        args: [MIN_FIRST_DEPOSIT],
      }),
    })
    launchCalls.push({
      to: shareOftAddress,
      data: encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [ccaAddress, auctionAmount],
      }),
    })
    launchCalls.push({
      to: ccaAddress,
      data: encodeFunctionData({
        abi: CCA_LAUNCH_ABI,
        functionName: 'launchAuction',
        args: [auctionAmount, DEFAULT_FLOOR_PRICE_Q96_ALIGNED, DEFAULT_REQUIRED_RAISE_WEI, auctionSteps],
      }),
    })
  }

  const finalizeCalls: { to: Address; data: Hex }[] = []
  for (const addr of [vaultAddress, wrapperAddress, shareOftAddress, gaugeAddress, ccaAddress, oracleAddress]) {
    finalizeCalls.push({
      to: addr,
      data: encodeFunctionData({ abi: OWNABLE_ABI, functionName: 'transferOwnership', args: [protocolTreasury] }),
    })
  }

  const calls = [...deployCalls, ...wiringCalls, ...launchCalls, ...finalizeCalls]
  if (calls.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        smartAccountAddress,
        deployerAddress,
        userOpHash: 'already-deployed',
        addresses: {
          vault: vaultAddress,
          wrapper: wrapperAddress,
          shareOFT: shareOftAddress,
          gaugeController: gaugeAddress,
          ccaStrategy: ccaAddress,
          oracle: oracleAddress,
        },
      } satisfies ResponseBody,
    } satisfies ApiEnvelope<ResponseBody>)
  }

  const userOp = await cdp.evm.sendUserOperation({
    smartAccount,
    network: 'base',
    calls,
  })

  return res.status(200).json({
    success: true,
    data: {
      smartAccountAddress,
      deployerAddress,
      userOpHash: userOp.userOpHash,
      addresses: {
        vault: vaultAddress,
        wrapper: wrapperAddress,
        shareOFT: shareOftAddress,
        gaugeController: gaugeAddress,
        ccaStrategy: ccaAddress,
        oracle: oracleAddress,
      },
    } satisfies ResponseBody,
  } satisfies ApiEnvelope<ResponseBody>)
}
