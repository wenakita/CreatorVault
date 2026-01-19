import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  concatHex,
  decodeFunctionData,
  encodePacked,
  getAddress,
  getCreate2Address,
  isAddress,
  keccak256,
  type Address,
  type Hex,
} from 'viem'

import { getApiContracts } from './_lib/contracts.js'
import { logger } from './_lib/logger.js'
import { ensureCreatorAccessSchema, getDb, isDbConfigured } from './_lib/postgres.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from './_lib/supabaseAdmin.js'
import { COOKIE_SESSION, handleOptions, parseCookies, readJsonBody, readSessionToken, setCors, setNoStore } from './auth/_shared.js'

declare const process: { env: Record<string, string | undefined> }

type JsonRpcId = string | number | null
type JsonRpcRequest = { jsonrpc?: string; id?: JsonRpcId; method?: unknown; params?: unknown }

type UserOperation = { sender?: unknown; callData?: unknown; initCode?: unknown; factory?: unknown; factoryData?: unknown }

const ALLOWED_METHODS = new Set<string>([
  // Paymaster
  'pm_getPaymasterStubData',
  'pm_getPaymasterData',
  // Bundler
  'eth_sendUserOperation',
  'eth_estimateUserOperationGas',
  'eth_getUserOperationReceipt',
  'eth_supportedEntryPoints',
  'eth_getUserOperationByHash',
])

const METHODS_REQUIRING_USEROP = new Set<string>([
  'pm_getPaymasterStubData',
  'pm_getPaymasterData',
  'eth_sendUserOperation',
  'eth_estimateUserOperationGas',
])

const ENTRYPOINT_V06 = getAddress('0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789')
const BASE_CHAIN_ID = 8453

// Coinbase Smart Wallet callData
const COINBASE_SMART_WALLET_ABI = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'executeBatch',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
] as const

const COINBASE_SMART_WALLET_OWNER_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'isOwner', type: 'bool' }],
  },
] as const

const COINBASE_SMART_WALLET_FACTORY_ABI = [
  {
    inputs: [
      { name: 'owners', type: 'bytes[]' },
      { name: 'nonce', type: 'uint256' },
    ],
    name: 'createAccount',
    outputs: [{ name: 'account', type: 'address' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owners', type: 'bytes[]' },
      { name: 'nonce', type: 'uint256' },
    ],
    name: 'getAddress',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Coinbase Smart Wallet factories (see viem's `toCoinbaseSmartAccount` implementation).
const COINBASE_SMART_WALLET_FACTORIES = new Set<Address>([
  getAddress('0x0ba5ed0c6aa8c49038f819e587e2633c4a9f428a'), // v1
  getAddress('0xba5ed110efdba3d005bfc882d75358acbbb85842'), // v1.1
])

// Allowed inner call selectors
const SELECTOR_ERC20_APPROVE = '0x095ea7b3'
const SELECTOR_COIN_SET_PAYOUT_RECIPIENT = '0x46bb5954'
const SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM = '0x30f28b7a'

const SELECTOR_BATCHER_DEPLOY_AND_LAUNCH = '0xa3e15e3e'
const SELECTOR_BATCHER_DEPLOY_AND_LAUNCH_WITH_PERMIT = '0x662ab161'
const SELECTOR_BATCHER_DEPLOY_AND_LAUNCH_WITH_PERMIT2 = '0xa3342a28'
const SELECTOR_BATCHER_DEPLOY_AND_LAUNCH_WITH_PERMIT2_OPERATOR_IDENTITY_FUNDED = '0x8fa5407c'
const SELECTOR_BATCHER_DEPLOY_AND_LAUNCH_WITH_PERMIT2_OPERATOR_OPERATOR_FUNDED = '0xbe388971'

// Two-step batcher selectors (Base)
const SELECTOR_BATCHER_DEPLOY_PHASE1 = '0x3c51ca4e'
const SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH = '0x669fb9e2'
const SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH_WITH_PERMIT = '0xd76fbd95'
const SELECTOR_BATCHER_DEPLOY_PHASE3_STRATEGIES = '0x6e3f91b0'

const SELECTOR_ACTIVATION_BATCH_ACTIVATE = '0xc5c1e920'
const SELECTOR_ACTIVATION_BATCH_ACTIVATE_WITH_PERMIT2_FOR = '0xdc5de72c'

const SELECTOR_CREATE2_DEPLOY_FROM_STORE = '0xd76fad23' // deploy(bytes32,bytes32,bytes)

const SELECTOR_VAULT_SET_BURN_STREAM = '0xf3a1c8b6' // setBurnStream(address)
const SELECTOR_VAULT_SET_WHITELIST = '0x53d6fd59' // setWhitelist(address,bool)

const ALLOWED_BATCHER_SELECTORS = new Set<string>([
  SELECTOR_BATCHER_DEPLOY_AND_LAUNCH,
  SELECTOR_BATCHER_DEPLOY_AND_LAUNCH_WITH_PERMIT,
  SELECTOR_BATCHER_DEPLOY_AND_LAUNCH_WITH_PERMIT2,
  SELECTOR_BATCHER_DEPLOY_AND_LAUNCH_WITH_PERMIT2_OPERATOR_IDENTITY_FUNDED,
  SELECTOR_BATCHER_DEPLOY_AND_LAUNCH_WITH_PERMIT2_OPERATOR_OPERATOR_FUNDED,
  SELECTOR_BATCHER_DEPLOY_PHASE1,
  SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH,
  SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH_WITH_PERMIT,
  SELECTOR_BATCHER_DEPLOY_PHASE3_STRATEGIES,
])

const ALLOWED_ACTIVATION_SELECTORS = new Set<string>([
  SELECTOR_ACTIVATION_BATCH_ACTIVATE,
  SELECTOR_ACTIVATION_BATCH_ACTIVATE_WITH_PERMIT2_FOR,
])

const ALLOWED_TOKEN_SELECTORS = new Set<string>([SELECTOR_ERC20_APPROVE, SELECTOR_COIN_SET_PAYOUT_RECIPIENT])
const ALLOWED_PERMIT2_SELECTORS = new Set<string>([SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM])

// Payout routing (Base mainnet)
const PAYOUT_ROUTER_CODE_ID = '0xec3a19f83778a374ef791c3df99ec79478b68b0319515a6a7898b3c5d614a107' as const
const VAULT_SHARE_BURN_STREAM_CODE_ID = '0x9b5e26f68c206df4fb41253da53c3c1d377334db21d566adbf41ac43fc711a21' as const

// CreatorOVault runtime bytecode hash (EIP-170 safe; used for validating phase2 vault address)
const CREATOR_OVAULT_RUNTIME_CODE_HASH =
  '0xc78233e39d6cd4a86de4d70868329f503db425770d59d2341f874d41364c5f2f' as const

const BASE_WETH = getAddress('0x4200000000000000000000000000000000000006')
const BASE_SWAP_ROUTER = getAddress('0x2626664c2603336E57B271c5C0b26F421741e481')
const PAYOUT_ROUTER_SALT_TAG = 'CreatorVault:PayoutRouter' as const
const BURN_STREAM_SALT_TAG = 'CreatorVault:VaultShareBurnStream' as const

type InnerCall = { target: Address; value: bigint; data: Hex }

type RateLimitBucket = { count: number; resetAtMs: number }
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 50
const rateLimitBuckets: Map<string, RateLimitBucket> = new Map()

let _baseClient: any | null = null
async function getBaseClient() {
  if (_baseClient) return _baseClient
  const { createPublicClient, http } = await import('viem')
  const { base } = await import('viem/chains')

  const rpc = (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
  _baseClient = createPublicClient({
    chain: base,
    transport: http(rpc, { timeout: 12_000 }),
  })
  return _baseClient
}

type AllowlistMode = 'disabled' | 'enforced'

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set()
  const parts = raw
    .split(/[\s,]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
  const out = new Set<string>()
  for (const p of parts) {
    if (!isAddress(p)) continue
    out.add(p.toLowerCase())
  }
  return out
}

async function isCreatorAllowlisted(sessionAddress: Address): Promise<{ mode: AllowlistMode; allowed: boolean }> {
  const addr = sessionAddress.toLowerCase()

  if (isSupabaseAdminConfigured()) {
    const supabase = getSupabaseAdmin()
    const res = await supabase
      .from('creator_allowlist')
      .select('address')
      .eq('address', addr)
      .is('revoked_at', null)
      .limit(1)
    if (res.error) throw new Error('allowlist_check_failed')
    return { mode: 'enforced', allowed: Array.isArray(res.data) && res.data.length > 0 }
  }

  if (isDbConfigured()) {
    const db = await getDb()
    if (!db) throw new Error('allowlist_check_failed')
    await ensureCreatorAccessSchema()
    const { rows } = await db.sql`SELECT address FROM creator_allowlist WHERE address = ${addr} AND revoked_at IS NULL LIMIT 1;`
    return { mode: 'enforced', allowed: rows.length > 0 }
  }

  // Fallback (no DB): env allowlist (legacy/simple).
  const allowlist = parseAllowlist(process.env.CREATOR_ALLOWLIST)
  const mode: AllowlistMode = allowlist.size > 0 ? 'enforced' : 'disabled'
  const allowed = mode === 'disabled' ? true : allowlist.has(addr)
  return { mode, allowed }
}

async function assertCreatorAllowlisted(sessionAddress: Address): Promise<void> {
  const { mode, allowed } = await isCreatorAllowlisted(sessionAddress)
  if (mode === 'enforced' && !allowed) throw new Error('not_allowlisted')
}

function jsonRpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

function getCdpEndpoint(): string | null {
  const v =
    (process.env.CDP_PAYMASTER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT ?? '').trim() ||
    // Back-compat with repo root .env.example naming
    (process.env.PAYMASTER_URL ?? '').trim() ||
    (process.env.BUNDLER_URL ?? '').trim()
  return v.length > 0 ? v : null
}

function isRequestArray(body: unknown): body is JsonRpcRequest[] {
  return Array.isArray(body)
}

function isRequestObject(body: unknown): body is JsonRpcRequest {
  return !!body && typeof body === 'object' && !Array.isArray(body)
}

function isHexString(v: unknown): v is Hex {
  return typeof v === 'string' && /^0x[0-9a-fA-F]*$/.test(v)
}

function getSelector(data: Hex): string {
  return data.length >= 10 ? data.slice(0, 10).toLowerCase() : ''
}

function decodeAddressArgFromCalldata(data: Hex, argIndex: number): Address | null {
  // abi.encodeWithSelector packs selector (4) + each arg in 32 byte slots
  const start = 10 + argIndex * 64
  const word = data.slice(start, start + 64)
  if (word.length !== 64) return null
  const addr = `0x${word.slice(24)}` // last 20 bytes
  if (!isAddress(addr)) return null
  return getAddress(addr)
}

function decodeAddressArgFromAbiEncodedBytes(data: Hex, argIndex: number): Address | null {
  // abi.encode packs each arg in 32 byte slots (no selector).
  const start = 2 + argIndex * 64
  const word = data.slice(start, start + 64)
  if (word.length !== 64) return null
  const addr = `0x${word.slice(24)}` // last 20 bytes
  if (!isAddress(addr)) return null
  return getAddress(addr)
}

function expectedPayoutRouterSalt(params: { creatorToken: Address; sender: Address }): Hex {
  return keccak256(
    encodePacked(['string', 'address', 'address'], [PAYOUT_ROUTER_SALT_TAG, params.creatorToken, params.sender]),
  )
}

function expectedBurnStreamSalt(params: { creatorToken: Address; sender: Address }): Hex {
  return keccak256(
    encodePacked(['string', 'address', 'address'], [BURN_STREAM_SALT_TAG, params.creatorToken, params.sender]),
  )
}

function decodeBoolArgFromCalldata(data: Hex, argIndex: number): boolean | null {
  const start = 10 + argIndex * 64
  const word = data.slice(start, start + 64)
  if (word.length !== 64) return null
  try {
    const v = BigInt(`0x${word}`)
    if (v === 0n) return false
    if (v === 1n) return true
    // Non-canonical bool encoding; treat as invalid.
    return null
  } catch {
    return null
  }
}

function abiEncodeAddresses(addrs: Address[]): Hex {
  // abi.encode(address...) (static types only)
  // Each address is left-padded to 32 bytes.
  let out = '0x'
  for (const a of addrs) {
    const hex = a.toLowerCase().replace(/^0x/, '')
    out += '0'.repeat(24 * 2) + hex
  }
  return out as Hex
}

const BYTECODE_STORE_GET_ABI = [
  {
    type: 'function',
    name: 'get',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ name: 'creationCode', type: 'bytes' }],
  },
] as const

const _creationCodeCache: Map<string, Hex> = new Map()

async function getCreationCodeFromStore(params: { store: Address; codeId: Hex }): Promise<Hex> {
  const key = `${params.store.toLowerCase()}:${params.codeId.toLowerCase()}`
  const cached = _creationCodeCache.get(key)
  if (cached) return cached
  const client = await getBaseClient()
  const code = (await client.readContract({
    address: params.store,
    abi: BYTECODE_STORE_GET_ABI,
    functionName: 'get',
    args: [params.codeId],
  })) as Hex
  _creationCodeCache.set(key, code)
  return code
}

async function computeCreate2AddressFromStore(params: {
  store: Address
  deployer: Address
  salt: Hex
  codeId: Hex
  constructorArgs: Hex
}): Promise<Address> {
  const creationCode = await getCreationCodeFromStore({ store: params.store, codeId: params.codeId })
  const initCodeHash = keccak256(concatHex([creationCode, params.constructorArgs]))
  return getCreate2Address({ from: params.deployer, salt: params.salt, bytecodeHash: initCodeHash })
}

function enforceRateLimit(key: string) {
  const now = Date.now()
  const cur = rateLimitBuckets.get(key)
  if (!cur || now >= cur.resetAtMs) {
    rateLimitBuckets.set(key, { count: 1, resetAtMs: now + RATE_LIMIT_WINDOW_MS })
    return
  }
  cur.count += 1
  if (cur.count > RATE_LIMIT_MAX_REQUESTS) {
    throw new Error('rate_limited')
  }
}

function parseChainId(chainIdRaw: unknown): number | null {
  if (typeof chainIdRaw === 'number' && Number.isFinite(chainIdRaw)) return chainIdRaw
  if (typeof chainIdRaw === 'string') {
    const s = chainIdRaw.trim().toLowerCase()
    if (s.startsWith('0x')) {
      try {
        return Number(BigInt(s))
      } catch {
        return null
      }
    }
    const n = Number(s)
    if (Number.isFinite(n)) return n
  }
  return null
}

function extractUserOpAndEntryPoint(method: string, params: unknown): { userOp: UserOperation; entryPoint: Address; chainId: number | null } | null {
  if (!Array.isArray(params) || params.length < 2) return null
  const userOp = (params[0] ?? {}) as UserOperation
  const entryPointRaw = params[1]
  const chainIdRaw = method === 'pm_getPaymasterStubData' || method === 'pm_getPaymasterData' ? params[2] : null
  const chainId = parseChainId(chainIdRaw)
  if (typeof entryPointRaw !== 'string' || !isAddress(entryPointRaw)) return null
  return { userOp, entryPoint: getAddress(entryPointRaw), chainId }
}

async function assertSessionOwnsSender(params: { sender: Address; sessionAddress: Address; initCode: Hex | null; factory?: Address | null; factoryData?: Hex | null }) {
  const client = await getBaseClient()

  // Deployed accounts: verify onchain ownership.
  const code = await client.getBytecode({ address: params.sender })
  if (code && code !== '0x') {
    const isOwner = await client.readContract({
      address: params.sender,
      abi: COINBASE_SMART_WALLET_OWNER_ABI,
      functionName: 'isOwnerAddress',
      args: [params.sessionAddress],
    })
    if (!isOwner) throw new Error('not_owner')
    return
  }

  // Counterfactual accounts: validate initCode against known Coinbase factory + owners.
  const initCode = params.initCode
  if (!initCode || initCode === '0x') throw new Error('sender_not_deployed')
  if (!isHexString(initCode) || initCode.length < 42) throw new Error('invalid_init_code')

  const factoryRaw = initCode.slice(0, 42)
  if (!isAddress(factoryRaw)) throw new Error('invalid_factory')
  const factory = getAddress(factoryRaw)
  if (!COINBASE_SMART_WALLET_FACTORIES.has(factory)) throw new Error('factory_not_allowed')

  const factoryData = (`0x${initCode.slice(42)}` || '0x') as Hex
  const decoded = decodeFunctionData({ abi: COINBASE_SMART_WALLET_FACTORY_ABI, data: factoryData })
  if (decoded.functionName !== 'createAccount') throw new Error('factory_calldata_not_allowed')

  const owners = decoded.args[0] as readonly Hex[]
  const nonce = decoded.args[1] as bigint
  const sessionLc = params.sessionAddress.toLowerCase().slice(2)
  const hasOwner = owners.some((o) => typeof o === 'string' && o.toLowerCase().startsWith('0x') && o.toLowerCase().slice(-40) === sessionLc)
  if (!hasOwner) throw new Error('not_owner')

  const expected = await client.readContract({
    address: factory,
    abi: COINBASE_SMART_WALLET_FACTORY_ABI,
    functionName: 'getAddress',
    args: [owners as any, nonce],
  })
  if (getAddress(expected as Address) !== params.sender) throw new Error('sender_address_mismatch')
}

async function validateInnerCalls(params: { sender: Address; sessionAddress: Address; callData: Hex }) {
  const contracts = getApiContracts()
  if (!contracts.creatorVaultBatcher) throw new Error('creator_vault_batcher_not_configured')
  const creatorVaultBatcher = getAddress(contracts.creatorVaultBatcher)
  const vaultActivationBatcher = getAddress(contracts.vaultActivationBatcher)
  const permit2 = getAddress(contracts.permit2)
  const create2DeployerFromStoreRaw = contracts.universalCreate2DeployerFromStore
  if (!create2DeployerFromStoreRaw) throw new Error('create2_deployer_from_store_not_configured')
  const create2DeployerFromStore = getAddress(create2DeployerFromStoreRaw)

  const decoded = decodeFunctionData({ abi: COINBASE_SMART_WALLET_ABI, data: params.callData })
  const innerCalls: InnerCall[] =
    decoded.functionName === 'execute'
      ? [
          {
            target: getAddress(decoded.args[0] as Address),
            value: decoded.args[1] as bigint,
            data: decoded.args[2] as Hex,
          },
        ]
      : decoded.functionName === 'executeBatch'
        ? (decoded.args[0] as any[]).map((c: any) => ({
            target: getAddress(c.target as Address),
            value: BigInt(c.value),
            data: c.data as Hex,
          }))
        : []

  if (innerCalls.length === 0) throw new Error('no_inner_calls')
  for (const c of innerCalls) {
    if (c.value !== 0n) throw new Error('value_transfer_not_allowed')
  }

  // Pass 1: detect the "primary" token from the deploy/activate call.
  let mode: 'deploy_phase1' | 'deploy_phase2' | 'deploy_phase3' | 'deploy' | 'activate' | null = null
  let expectedCreatorToken: Address | null = null
  let expectedVault: Address | null = null

  for (const c of innerCalls) {
    const selector = getSelector(c.data)
    if (c.target === creatorVaultBatcher) {
      if (!ALLOWED_BATCHER_SELECTORS.has(selector)) throw new Error('batcher_selector_not_allowed')
      const creatorToken = decodeAddressArgFromCalldata(c.data, 0)
      const owner = decodeAddressArgFromCalldata(c.data, 1)
      if (!creatorToken || !owner) throw new Error('batcher_decode_failed')
      if (owner !== params.sender) throw new Error('batcher_owner_mismatch')
      // Two-step batcher: in phase2+ we can safely reference the deployed vault address from calldata.
      if (selector === SELECTOR_BATCHER_DEPLOY_PHASE1) {
        mode = 'deploy_phase1'
      } else if (selector === SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH || selector === SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH_WITH_PERMIT) {
        mode = 'deploy_phase2'
        expectedVault = decodeAddressArgFromCalldata(c.data, 4) // Phase2Params.vault
        if (!expectedVault) throw new Error('batcher_vault_decode_failed')
      } else if (selector === SELECTOR_BATCHER_DEPLOY_PHASE3_STRATEGIES) {
        mode = 'deploy_phase3'
        expectedVault = decodeAddressArgFromCalldata(c.data, 2) // Phase3Params.vault
        if (!expectedVault) throw new Error('batcher_vault_decode_failed')
      } else {
        mode = 'deploy'
      }
      expectedCreatorToken = creatorToken
      break
    }
    if (c.target === vaultActivationBatcher) {
      if (!ALLOWED_ACTIVATION_SELECTORS.has(selector)) throw new Error('activation_selector_not_allowed')
      const creatorToken =
        selector === SELECTOR_ACTIVATION_BATCH_ACTIVATE
          ? decodeAddressArgFromCalldata(c.data, 0)
          : decodeAddressArgFromCalldata(c.data, 1) // batchActivateWithPermit2For(identity, creatorToken, ...)
      if (!creatorToken) throw new Error('activation_decode_failed')
      mode = 'activate'
      expectedCreatorToken = creatorToken
      break
    }
  }

  if (!mode || !expectedCreatorToken) throw new Error('missing_primary_call')

  const bytecodeStoreRaw = contracts.universalBytecodeStore
  if (!bytecodeStoreRaw) throw new Error('bytecode_store_not_configured')
  const bytecodeStore = getAddress(bytecodeStoreRaw)

  // In Phase 2, validate the vault address is the expected CreatorOVault runtime code.
  // This prevents sponsoring calls that route through the batcher into arbitrary contracts.
  let expectedBurnStream: Address | null = null
  let expectedPayoutRouter: Address | null = null
  if (mode === 'deploy_phase2') {
    if (!expectedVault) throw new Error('missing_vault')
    const client = await getBaseClient()
    const vaultCode = (await client.getBytecode({ address: expectedVault })) as Hex | undefined
    if (!vaultCode || vaultCode === '0x') throw new Error('vault_not_deployed')
    const vaultCodeHash = keccak256(vaultCode)
    if (vaultCodeHash.toLowerCase() !== CREATOR_OVAULT_RUNTIME_CODE_HASH.toLowerCase()) {
      throw new Error('vault_code_hash_mismatch')
    }

    const burnSalt = expectedBurnStreamSalt({ creatorToken: expectedCreatorToken, sender: params.sender })
    expectedBurnStream = await computeCreate2AddressFromStore({
      store: bytecodeStore,
      deployer: create2DeployerFromStore,
      salt: burnSalt,
      codeId: VAULT_SHARE_BURN_STREAM_CODE_ID as Hex,
      constructorArgs: abiEncodeAddresses([expectedVault]),
    })

    const routerSalt = expectedPayoutRouterSalt({ creatorToken: expectedCreatorToken, sender: params.sender })
    expectedPayoutRouter = await computeCreate2AddressFromStore({
      store: bytecodeStore,
      deployer: create2DeployerFromStore,
      salt: routerSalt,
      codeId: PAYOUT_ROUTER_CODE_ID as Hex,
      constructorArgs: abiEncodeAddresses([
        expectedCreatorToken,
        expectedVault,
        expectedBurnStream,
        params.sender,
        BASE_SWAP_ROUTER,
        BASE_WETH,
      ]),
    })
  }

  // Pass 2: validate each inner call fits the expected patterns.
  for (const c of innerCalls) {
    const selector = getSelector(c.data)

    if (c.target === creatorVaultBatcher) {
      if (!ALLOWED_BATCHER_SELECTORS.has(selector)) throw new Error('batcher_selector_not_allowed')
      continue
    }
    if (c.target === vaultActivationBatcher) {
      if (!ALLOWED_ACTIVATION_SELECTORS.has(selector)) throw new Error('activation_selector_not_allowed')
      continue
    }

    if (c.target === permit2) {
      if (!ALLOWED_PERMIT2_SELECTORS.has(selector)) throw new Error('permit2_selector_not_allowed')
      const permit2Abi = [
        {
          type: 'function',
          name: 'permitTransferFrom',
          stateMutability: 'nonpayable',
          inputs: [
            {
              name: 'permit',
              type: 'tuple',
              components: [
                {
                  name: 'permitted',
                  type: 'tuple',
                  components: [
                    { name: 'token', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                  ],
                },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
              ],
            },
            {
              name: 'transferDetails',
              type: 'tuple',
              components: [
                { name: 'to', type: 'address' },
                { name: 'requestedAmount', type: 'uint256' },
              ],
            },
            { name: 'owner', type: 'address' },
            { name: 'signature', type: 'bytes' },
          ],
          outputs: [],
        },
      ] as const

      const decodedPermit2 = decodeFunctionData({ abi: permit2Abi, data: c.data })
      const permit = decodedPermit2.args[0] as any
      const details = decodedPermit2.args[1] as any
      const ownerArg = decodedPermit2.args[2] as Address
      if (getAddress(permit.permitted.token) !== expectedCreatorToken) throw new Error('permit2_token_mismatch')
      if (getAddress(details.to) !== params.sender) throw new Error('permit2_to_mismatch')
      if (getAddress(ownerArg) !== params.sessionAddress) throw new Error('permit2_owner_mismatch')
      continue
    }

    // Deterministic CREATE2 deploy via UniversalCreate2DeployerFromStore (used for burn stream + payout router).
    if (c.target === create2DeployerFromStore) {
      if (mode !== 'deploy_phase2') throw new Error('create2_deploy_not_allowed')
      if (!expectedVault || !expectedBurnStream || !expectedPayoutRouter) throw new Error('missing_expected_addresses')
      if (selector !== SELECTOR_CREATE2_DEPLOY_FROM_STORE) throw new Error('create2_selector_not_allowed')

      const create2Abi = [
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

      const decodedDeploy = decodeFunctionData({ abi: create2Abi, data: c.data })
      if (decodedDeploy.functionName !== 'deploy') throw new Error('create2_decode_failed')

      const salt = decodedDeploy.args[0] as Hex
      const codeId = decodedDeploy.args[1] as Hex
      const ctorArgs = decodedDeploy.args[2] as Hex

      const codeIdLc = String(codeId).toLowerCase()
      if (codeIdLc === String(VAULT_SHARE_BURN_STREAM_CODE_ID).toLowerCase()) {
        const expectedSalt = expectedBurnStreamSalt({ creatorToken: expectedCreatorToken, sender: params.sender })
        if (String(salt).toLowerCase() !== String(expectedSalt).toLowerCase()) throw new Error('create2_salt_not_allowed')
        const vaultArg = decodeAddressArgFromAbiEncodedBytes(ctorArgs, 0)
        if (!vaultArg || vaultArg !== expectedVault) throw new Error('burn_stream_vault_mismatch')
      } else if (codeIdLc === String(PAYOUT_ROUTER_CODE_ID).toLowerCase()) {
        const expectedSalt = expectedPayoutRouterSalt({ creatorToken: expectedCreatorToken, sender: params.sender })
        if (String(salt).toLowerCase() !== String(expectedSalt).toLowerCase()) throw new Error('create2_salt_not_allowed')

        // PayoutRouter constructor args:
        // constructor(address creatorCoin, address vault, address burnStream, address owner, address swapRouter, address weth)
        const creatorCoinArg = decodeAddressArgFromAbiEncodedBytes(ctorArgs, 0)
        const vaultArg = decodeAddressArgFromAbiEncodedBytes(ctorArgs, 1)
        const burnStreamArg = decodeAddressArgFromAbiEncodedBytes(ctorArgs, 2)
        const ownerArg = decodeAddressArgFromAbiEncodedBytes(ctorArgs, 3)
        const swapRouterArg = decodeAddressArgFromAbiEncodedBytes(ctorArgs, 4)
        const wethArg = decodeAddressArgFromAbiEncodedBytes(ctorArgs, 5)

        if (!creatorCoinArg || creatorCoinArg !== expectedCreatorToken) throw new Error('payout_router_creator_mismatch')
        if (!vaultArg || vaultArg !== expectedVault) throw new Error('payout_router_vault_mismatch')
        if (!burnStreamArg || burnStreamArg !== expectedBurnStream) throw new Error('payout_router_burn_stream_mismatch')
        if (!ownerArg || ownerArg !== params.sender) throw new Error('payout_router_owner_mismatch')
        if (!swapRouterArg || swapRouterArg !== BASE_SWAP_ROUTER) throw new Error('payout_router_swap_router_mismatch')
        if (!wethArg || wethArg !== BASE_WETH) throw new Error('payout_router_weth_mismatch')
      } else {
        throw new Error('create2_codeid_not_allowed')
      }

      continue
    }

    // Vault admin calls (phase2 only)
    if (mode === 'deploy_phase2' && expectedVault && expectedBurnStream && expectedPayoutRouter && c.target === expectedVault) {
      if (selector !== SELECTOR_VAULT_SET_BURN_STREAM && selector !== SELECTOR_VAULT_SET_WHITELIST) {
        throw new Error('vault_selector_not_allowed')
      }
      if (selector === SELECTOR_VAULT_SET_BURN_STREAM) {
        const burnStreamArg = decodeAddressArgFromCalldata(c.data, 0)
        if (!burnStreamArg || burnStreamArg !== expectedBurnStream) throw new Error('vault_burn_stream_mismatch')
      } else {
        const accountArg = decodeAddressArgFromCalldata(c.data, 0)
        const statusArg = decodeBoolArgFromCalldata(c.data, 1)
        if (!accountArg || accountArg !== expectedPayoutRouter) throw new Error('vault_whitelist_account_mismatch')
        if (statusArg !== true) throw new Error('vault_whitelist_status_mismatch')
      }
      continue
    }

    // Dynamic token calls: only allow calls to the same creatorToken used in the primary call.
    if (c.target !== expectedCreatorToken) throw new Error('called_address_not_allowed')
    if (!ALLOWED_TOKEN_SELECTORS.has(selector)) throw new Error('token_selector_not_allowed')

    if (selector === SELECTOR_ERC20_APPROVE) {
      const spender = decodeAddressArgFromCalldata(c.data, 0)
      if (!spender) throw new Error('approve_decode_failed')
      const allowedSpenders = new Set<Address>([creatorVaultBatcher, vaultActivationBatcher, permit2])
      if (!allowedSpenders.has(spender)) throw new Error('approve_spender_not_allowed')
      continue
    }

    if (selector === SELECTOR_COIN_SET_PAYOUT_RECIPIENT) {
      if (mode !== 'deploy_phase2' || !expectedPayoutRouter) throw new Error('payout_recipient_not_allowed')
      const recipient = decodeAddressArgFromCalldata(c.data, 0)
      if (!recipient || recipient !== expectedPayoutRouter) throw new Error('payout_recipient_mismatch')
      continue
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json(jsonRpcError(null, -32600, 'Method not allowed'))
  }

  const cdpEndpoint = getCdpEndpoint()
  if (!cdpEndpoint) {
    return res.status(500).json(jsonRpcError(null, -32000, 'CDP paymaster endpoint is not configured'))
  }

  // In production serverless, SIWE sessions MUST be signed with a stable secret.
  // If this is unset, /api/auth/verify and /api/paymaster may run on different instances and
  // the paymaster will always see "not authenticated".
  const sessionSecret = (process.env.AUTH_SESSION_SECRET ?? '').trim()
  const isVercel = Boolean((process.env.VERCEL ?? '').trim())
  if (isVercel && sessionSecret.length < 16) {
    return res.status(500).json(jsonRpcError(null, -32000, 'Server misconfigured: AUTH_SESSION_SECRET is not set'))
  }

  const body = await readJsonBody<unknown>(req)
  if (!body) {
    return res.status(400).json(jsonRpcError(null, -32600, 'Invalid JSON body'))
  }

  const requests: JsonRpcRequest[] = isRequestArray(body) ? body : isRequestObject(body) ? [body] : []
  if (requests.length === 0) {
    return res.status(400).json(jsonRpcError(null, -32600, 'Invalid JSON-RPC payload'))
  }

  for (const r of requests) {
    const method = typeof r?.method === 'string' ? r.method : ''
    if (!method) {
      return res.status(400).json(jsonRpcError((r as any)?.id ?? null, -32600, 'Missing method'))
    }
    if (!ALLOWED_METHODS.has(method)) {
      return res.status(403).json(jsonRpcError((r as any)?.id ?? null, -32601, `Method not allowed: ${method}`))
    }
  }

  // Require an active SIWE session for any sponsorship-related method.
  const cookies = parseCookies(req)
  const session = readSessionToken(cookies[COOKIE_SESSION])

  try {
    // Validate sponsorship requests (UserOperations only).
    for (const r of requests) {
      const method = r.method as string
      if (!METHODS_REQUIRING_USEROP.has(method)) continue
      if (!session) {
        return res.status(401).json(jsonRpcError((r as any)?.id ?? null, -32002, 'request denied - not authenticated'))
      }

      // Basic rate limit: per session address.
      enforceRateLimit(session.address)

      const extracted = extractUserOpAndEntryPoint(method, r.params)
      if (!extracted) {
        return res.status(400).json(jsonRpcError((r as any)?.id ?? null, -32602, 'Invalid params'))
      }

      if (extracted.entryPoint !== ENTRYPOINT_V06) {
        return res.status(403).json(jsonRpcError((r as any)?.id ?? null, -32002, 'request denied - unsupported entryPoint'))
      }
      if (typeof extracted.chainId === 'number' && extracted.chainId !== BASE_CHAIN_ID) {
        return res.status(403).json(jsonRpcError((r as any)?.id ?? null, -32002, 'request denied - unsupported chainId'))
      }

      const senderRaw = extracted.userOp?.sender
      const callDataRaw = extracted.userOp?.callData
      const initCodeRaw = extracted.userOp?.initCode
      if (typeof senderRaw !== 'string' || !isAddress(senderRaw)) {
        return res.status(400).json(jsonRpcError((r as any)?.id ?? null, -32602, 'Invalid userOperation.sender'))
      }
      if (!isHexString(callDataRaw) || callDataRaw === '0x') {
        return res.status(400).json(jsonRpcError((r as any)?.id ?? null, -32602, 'Invalid userOperation.callData'))
      }

      const sender = getAddress(senderRaw)
      const sessionAddress = getAddress(session.address)
      const initCode = isHexString(initCodeRaw) ? (initCodeRaw as Hex) : null

      // Only sponsor approved creators (Supabase/Postgres allowlist).
      await assertCreatorAllowlisted(sessionAddress)

      // Ensure this session is an onchain owner of the Coinbase Smart Wallet sender.
      await assertSessionOwnsSender({ sender, sessionAddress, initCode })

      // Validate inner calls match CreatorVault patterns.
      await validateInnerCalls({ sender, sessionAddress, callData: callDataRaw })
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'rate_limited') {
      return res.status(429).json(jsonRpcError(null, -32002, 'request denied - rate limited'))
    }
    if (err instanceof Error && err.message === 'not_allowlisted') {
      return res.status(403).json(jsonRpcError(null, -32002, 'request denied - creator not approved'))
    }
    if (err instanceof Error && err.message === 'allowlist_check_failed') {
      logger.error('[paymaster-proxy] allowlist check failed')
      return res.status(503).json(jsonRpcError(null, -32002, 'request denied - allowlist unavailable'))
    }
    const msg = err instanceof Error ? err.message : 'request denied'
    logger.warn('[paymaster-proxy] validation denied', { msg })
    return res.status(403).json(jsonRpcError(null, -32002, `request denied - ${msg}`))
  }

  // Forward to CDP if validation passed.
  try {
    const upstream = await fetch(cdpEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await upstream.text()

    // CDP returns JSON-RPC responses; pass through status + body.
    res.status(upstream.status)
    res.setHeader('Content-Type', 'application/json')
    return res.send(text)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upstream request failed'
    logger.error('[paymaster-proxy] upstream error', { msg })
    return res.status(502).json(jsonRpcError(null, -32000, msg))
  }
}

