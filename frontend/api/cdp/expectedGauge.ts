import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  type ApiEnvelope,
} from '../auth/_shared.js'
import { getApiContracts } from '../_lib/contracts.js'
import { DEPLOY_BYTECODE } from '../../src/deploy/bytecode.generated'

import {
  concatHex,
  createPublicClient,
  encodeAbiParameters,
  encodePacked,
  fallback,
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
  sessionAddress: Address
  ownerAddress: Address
  smartAccountAddress: Address
  deployerAddress: Address
  expectedGaugeController: Address
  payoutRecipient: Address
  matches: boolean
}

const BYTECODE_STORE_VIEW_ABI = [
  { type: 'function', name: 'pointers', stateMutability: 'view', inputs: [{ name: 'codeId', type: 'bytes32' }], outputs: [{ type: 'address' }] },
] as const

function getBaseRpcUrls(): string[] {
  const candidates = [
    process.env.BASE_READ_RPC_URL,
    process.env.BASE_RPC_URL,
    process.env.VITE_BASE_RPC,
    'https://mainnet.base.org',
  ]
  const out: string[] = []
  for (const raw of candidates) {
    const v = (raw ?? '').trim()
    if (!v) continue
    if (!out.includes(v)) out.push(v)
  }
  return out.length ? out : ['https://mainnet.base.org']
}

function formatRpcError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  if (/429|rate limit|too many requests/i.test(msg)) {
    return 'RPC rate limit reached. Try again shortly or configure BASE_READ_RPC_URL.'
  }
  if (/execution reverted|missing revert data|function selector was not recognized/i.test(msg)) {
    return 'Creator token does not expose payoutRecipient (not a Zora coin).'
  }
  return msg || 'Failed to fetch onchain data.'
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
    gaugeSalt: saltFor('gauge'),
  }
}

function deriveShareOftUniversalSalt(params: { owner: Address; shareSymbol: string; version: string }) {
  const base = keccak256(encodePacked(['address', 'string'], [params.owner, params.shareSymbol.toLowerCase()]))
  return keccak256(encodePacked(['bytes32', 'string'], [base, `CreatorShareOFT:${params.version}`]))
}

function deriveOftBootstrapSalt() {
  return keccak256(encodePacked(['string'], ['CreatorVault:OFTBootstrapRegistry:v1']))
}

function predictCreate2Address(create2Deployer: Address, salt: Hex, initCode: Hex): Address {
  const bytecodeHash = keccak256(initCode)
  return getCreate2Address({ from: create2Deployer, salt, bytecodeHash })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<RequestBody>(req)) ?? {}
  const creatorToken = typeof body.creatorToken === 'string' ? body.creatorToken : ''
  const shareSymbol = typeof body.shareSymbol === 'string' ? body.shareSymbol : ''
  const shareName = typeof body.shareName === 'string' ? body.shareName : ''
  const version = body.deploymentVersion ?? 'v3'
  const ownerOverride = typeof body.ownerAddress === 'string' ? body.ownerAddress : ''

  if (!isAddressLike(creatorToken) || !shareSymbol || !shareName || !isAddressLike(ownerOverride)) {
    return res.status(400).json({ success: false, error: 'Missing creator token, share metadata, or owner address' } satisfies ApiEnvelope<never>)
  }

  const rpcUrls = getBaseRpcUrls()
  const client = createPublicClient({
    chain: base,
    transport: fallback(rpcUrls.map((url) => http(url, { timeout: 12_000, retryCount: 2, retryDelay: 300 }))),
  })

  const ownerAddress = ownerOverride as Address
  const smartAccountAddress = ownerAddress
  const deployerAddress = ownerAddress
  const sessionAddress = ownerAddress

  const CONTRACTS = getApiContracts()
  const create2Factory = CONTRACTS.create2Factory as Address
  const create2Deployer = CONTRACTS.create2Deployer as Address
  const universalBytecodeStore = CONTRACTS.universalBytecodeStore as Address | undefined
  const universalCreate2FromStore = CONTRACTS.universalCreate2DeployerFromStore as Address | undefined
  const protocolTreasury = CONTRACTS.protocolTreasury as Address

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

  const gaugeConstructorArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address'), [
    shareOftAddress,
    protocolTreasury,
    protocolTreasury,
    deployerAddress,
  ])
  const gaugeInitCode = concatHex([DEPLOY_BYTECODE.CreatorGaugeController as Hex, gaugeConstructorArgs])
  const gaugeAddress = predictCreate2Address(localCreate2Deployer, salts.gaugeSalt, gaugeInitCode)

  let payoutRecipient: Address
  try {
    payoutRecipient = (await client.readContract({
      address: creatorToken as Address,
      abi: coinABI,
      functionName: 'payoutRecipient',
    })) as Address
  } catch (err) {
    return res.status(503).json({ success: false, error: formatRpcError(err) } satisfies ApiEnvelope<never>)
  }

  const payoutRecipientLc = String(payoutRecipient ?? '').toLowerCase()
  const expectedLc = gaugeAddress.toLowerCase()

  if (!isAddress(payoutRecipient)) {
    return res.status(500).json({ success: false, error: 'Invalid payout recipient returned from coin' } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: {
      sessionAddress,
      ownerAddress,
      smartAccountAddress,
      deployerAddress,
      expectedGaugeController: gaugeAddress,
      payoutRecipient: payoutRecipient as Address,
      matches: payoutRecipientLc === expectedLc,
    } satisfies ResponseBody,
  } satisfies ApiEnvelope<ResponseBody>)
}
