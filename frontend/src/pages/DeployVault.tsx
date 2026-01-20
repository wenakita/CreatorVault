import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useConnect, useDisconnect, usePublicClient, useReadContract, useWalletClient } from 'wagmi'
import { base } from 'wagmi/chains'
import type { Address, Hex } from 'viem'
import {
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  erc20Abi,
  formatUnits,
  getAddress,
  getCreate2Address,
  isAddress,
  keccak256,
  parseAbiParameters,
  toBytes,
} from 'viem'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { coinABI } from '@zoralabs/protocol-deployments'
import { BarChart3, ChevronDown, Layers, Lock, Rocket, ShieldCheck } from 'lucide-react'
import { useOnchainKit } from '@coinbase/onchainkit'
import { ConnectButton } from '@/components/ConnectButton'
import { DerivedTokenIcon } from '@/components/DerivedTokenIcon'
import { RequestCreatorAccess } from '@/components/RequestCreatorAccess'
import { CONTRACTS } from '@/config/contracts'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useCreatorAllowlist, useFarcasterAuth, useMiniAppContext } from '@/hooks'
import { useZoraCoin, useZoraProfile } from '@/lib/zora/hooks'
import { getFarcasterUserByFid } from '@/lib/neynar-api'
import { resolveCreatorIdentity } from '@/lib/identity/creatorIdentity'
import { DEPLOY_BYTECODE } from '@/deploy/bytecode.generated'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import {
  normalizeUnderlyingSymbol,
  toShareName,
  toShareSymbol,
  toVaultName,
  toVaultSymbol,
  underlyingSymbolUpper as deriveUnderlyingUpper,
} from '@/lib/tokenSymbols'
import { computeMarketFloorQuote } from '@/lib/cca/marketFloor'
import { q96ToCurrencyPerTokenBaseUnits } from '@/lib/cca/q96'

const MIN_FIRST_DEPOSIT = 5_000_000n * 10n ** 18n
const addr = (hexWithout0x: string) => `0x${hexWithout0x}` as Address
const ZERO_ADDRESS = addr('0000000000000000000000000000000000000000')
const BASE_SWAP_ROUTER = addr('2626664c2603336E57B271c5C0b26F421741e481')
const BASE_WETH = addr('4200000000000000000000000000000000000006')
const BASE_USDC = addr('833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
const BASE_CHAINLINK_ETH_USD = addr('71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70')
const PAYOUT_ROUTER_SALT_TAG = 'CreatorVault:PayoutRouter' as const
const BURN_STREAM_SALT_TAG = 'CreatorVault:VaultShareBurnStream' as const

// Uniswap CCA uses Q96 fixed-point prices + a compact step schedule.
const DEFAULT_REQUIRED_RAISE_WEI = 100_000_000_000_000_000n // 0.1 ETH
const DEFAULT_AUCTION_PERCENT = 50
const DEFAULT_CCA_DURATION_BLOCKS = 302_400n // ~7 days on Base at ~2s blocks (must match CCALaunchStrategy defaultDuration)

// Minimum age for a Creator Coin before allowing vault deployment.
// Rationale: reduce launch-manipulation surface area on brand new coins with thin/no trading history.
const DEFAULT_MIN_COIN_AGE_DAYS = 30
const MIN_COIN_AGE_LOCALSTORAGE_KEY = 'cv:deploy:minCoinAgeDays'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type AdminAuthResponse = { address: string; isAdmin: boolean } | null
type ServerDeployResponse = {
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

const shortAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`

type DeploySessionCreateResponse = {
  sessionId: string
  sessionOwner: Address
  expiresAt: string
}

type DeploySessionStatusResponse = {
  id: string
  step: string
  expiresAt: string
  lastError?: string | null
  lastUserOpHash?: string | null
  lastTxHash?: string | null
  smartWallet: Address
  sessionOwner: Address
}

const SIWE_SESSION_TOKEN_KEY = 'cv_siwe_session_token'

function getSiweSessionToken(): string | null {
  try {
    const v = localStorage.getItem(SIWE_SESSION_TOKEN_KEY)
    const t = typeof v === 'string' ? v.trim() : ''
    return t.length > 0 ? t : null
  } catch {
    return null
  }
}

function getSiweAuthHeaders(): Record<string, string> {
  const token = getSiweSessionToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function createDeploySession(params: {
  smartWallet: Address
  creatorToken: Address
  ownerAddress: Address
  phase2Calls: Array<{ target: Address; value: bigint; data: Hex }>
  phase3Calls: Array<{ target: Address; value: bigint; data: Hex }>
  version?: string
}): Promise<DeploySessionCreateResponse> {
  const res = await fetch('/api/deploy/session/create', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...getSiweAuthHeaders() },
    body: JSON.stringify({
      smartWallet: params.smartWallet,
      creatorToken: params.creatorToken,
      ownerAddress: params.ownerAddress,
      version: params.version ?? '',
      // JSON can't serialize bigint; stringify values for server-side BigInt() parsing.
      phase2Calls: params.phase2Calls.map((c) => ({ to: c.target, value: c.value.toString(), data: c.data })),
      phase3Calls: params.phase3Calls.map((c) => ({ to: c.target, value: c.value.toString(), data: c.data })),
    }),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<DeploySessionCreateResponse> | null
  if (!res.ok || !json?.success || !json.data) throw new Error(json?.error || 'deploy_session_create_failed')
  return json.data
}

async function fetchDeploySessionStatus(sessionId: string): Promise<DeploySessionStatusResponse> {
  const res = await fetch('/api/deploy/session/status', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...getSiweAuthHeaders() },
    body: JSON.stringify({ sessionId }),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<DeploySessionStatusResponse> | null
  if (!res.ok || !json?.success || !json.data) throw new Error(json?.error || 'deploy_session_status_failed')
  return json.data
}

async function continueDeploySession(sessionId: string): Promise<{ step: string; lastTxHash?: Hex | null }> {
  const res = await fetch('/api/deploy/session/continue', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...getSiweAuthHeaders() },
    body: JSON.stringify({ sessionId }),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<any> | null
  if (!res.ok || !json?.success) throw new Error(json?.error || 'deploy_session_continue_failed')
  return json.data as any
}

async function cancelDeploySession(sessionId: string): Promise<{ step: string; lastTxHash?: Hex | null }> {
  const res = await fetch('/api/deploy/session/cancel', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...getSiweAuthHeaders() },
    body: JSON.stringify({ sessionId }),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<any> | null
  if (!res.ok || !json?.success) throw new Error(json?.error || 'deploy_session_cancel_failed')
  return json.data as any
}

const COINBASE_SMART_WALLET_OWNER_MGMT_ABI = [
  {
    type: 'function',
    name: 'addOwnerAddress',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [],
  },
] as const

function formatEthPerTokenForUi(weiPerToken: bigint): string {
  if (weiPerToken <= 0n) return '0'

  const BASE = 10n ** 18n
  const whole = weiPerToken / BASE
  const frac = weiPerToken % BASE

  const wholeStr = whole.toString()
  const fracStrFull = frac.toString().padStart(18, '0')

  const MIN_DECIMALS = 6
  const DEFAULT_MAX_DECIMALS = 12
  const FULL_MAX_DECIMALS = 18

  const formatWithMaxDecimals = (maxDecimals: number): string => {
    const firstNonZero = fracStrFull.search(/[1-9]/)
    const desiredDecimals =
      firstNonZero === -1
        ? MIN_DECIMALS
        : Math.min(maxDecimals, Math.max(MIN_DECIMALS, firstNonZero + 4 /* show a few significant digits */))

    const fracShownRaw = fracStrFull.slice(0, desiredDecimals)
    const fracShownTrimmed = fracShownRaw.replace(/0+$/, '')

    if (!fracShownTrimmed) return wholeStr
    return `${wholeStr}.${fracShownTrimmed}`
  }

  // Prefer a compact display, but never show "0" for non-zero values.
  const compact = formatWithMaxDecimals(DEFAULT_MAX_DECIMALS)
  if (compact === '0' && weiPerToken > 0n) return formatWithMaxDecimals(FULL_MAX_DECIMALS)
  return compact
}

function identitySourceLabel(source: string): string {
  switch (source) {
    case 'zoraCoinCreatorAddress':
      return 'Zora coin creator'
    case 'farcasterCustody':
      return 'Farcaster custody'
    case 'zoraProfilePublicWallet':
      return 'Zora profile public wallet'
    case 'connectedWallet':
      return 'Connected wallet'
    default:
      return source || 'unknown'
  }
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
    encodePacked(['uint24', 'uint40'], [Number(mps), Number(blockDelta)]) as Hex

  const steps: Hex[] = []
  if (highBlocks > 0n) steps.push(packStep(mpsHigh, highBlocks))
  if (lowBlocks > 0n) steps.push(packStep(mpsLow, lowBlocks))
  return concatHex(steps)
}

function deriveBaseSalt(params: { creatorToken: Address; owner: Address; chainId: number; version: string }): Hex {
  const { creatorToken, owner, chainId, version } = params
  return keccak256(
    encodePacked(['address', 'address', 'uint256', 'string'], [
      creatorToken,
      owner,
      BigInt(chainId),
      `CreatorVault:deploy:${version}`,
    ]),
  )
}

function saltFor(baseSalt: Hex, label: string): Hex {
  return keccak256(encodePacked(['bytes32', 'string'], [baseSalt, label]))
}

function derivePayoutRouterSalt(params: { creatorToken: Address; owner: Address }): Hex {
  return keccak256(
    encodePacked(['string', 'address', 'address'], [PAYOUT_ROUTER_SALT_TAG, params.creatorToken, params.owner]),
  )
}

function deriveVaultShareBurnStreamSalt(params: { creatorToken: Address; owner: Address }): Hex {
  return keccak256(
    encodePacked(['string', 'address', 'address'], [BURN_STREAM_SALT_TAG, params.creatorToken, params.owner]),
  )
}

function deriveShareOftSalt(params: { owner: Address; shareSymbol: string; version: string }): Hex {
  const base = keccak256(encodePacked(['address', 'string'], [params.owner, params.shareSymbol.toLowerCase()]))
  return keccak256(encodePacked(['bytes32', 'string'], [base, `CreatorShareOFT:${params.version}`]))
}

function deriveOftBootstrapSalt(): Hex {
  return keccak256(encodePacked(['string'], ['CreatorVault:OFTBootstrapRegistry:v1']))
}

function predictCreate2Address(params: { create2Deployer: Address; salt: Hex; initCode: Hex }): Address {
  const bytecodeHash = keccak256(params.initCode)
  return getCreate2Address({ from: params.create2Deployer, salt: params.salt, bytecodeHash })
}

async function fetchAdminAuth(): Promise<AdminAuthResponse> {
  const res = await fetch('/api/auth/admin', { method: 'GET', headers: { Accept: 'application/json' } })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AdminAuthResponse> | null
  if (!res.ok || !json) return null
  if (!json.success) return null
  return (json.data ?? null) as AdminAuthResponse
}

const COINBASE_SMART_WALLET_OWNER_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const

// Coinbase Smart Wallet (v1) has an EntryPoint v0.6 constant + MultiOwnable owner tracking.
// Use these reads as a positive/cheap preflight before attempting executeBatch.
const COINBASE_SMART_WALLET_PREFLIGHT_ABI = [
  {
    type: 'function',
    name: 'entryPoint',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

const COINBASE_ENTRYPOINT_V06 = addr('5FF137D4b0FDCD49DcA30c7CF57E578a026d2789')

const COIN_PAYOUT_RECIPIENT_ABI = [
  {
    type: 'function',
    name: 'setPayoutRecipient',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newPayoutRecipient', type: 'address' }],
    outputs: [],
  },
] as const

const UNIVERSAL_CREATE2_DEPLOY_FROM_STORE_ABI = [
  {
    type: 'function',
    name: 'deploy',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'salt', type: 'bytes32' },
      { name: 'codeId', type: 'bytes32' },
      { name: 'constructorArgs', type: 'bytes' },
    ],
    outputs: [{ name: 'deployed', type: 'address' }],
  },
] as const

const CREATOR_VAULT_ADMIN_ABI = [
  {
    type: 'function',
    name: 'setBurnStream',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'burnStream', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setWhitelist',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'status', type: 'bool' },
    ],
    outputs: [],
  },
] as const

// Legacy permit/permit2 ABIs were used for the one-tx deploy paths (now removed).

const CREATOR_VAULT_BATCHER_ABI = [
  {
    type: 'function',
    name: 'bytecodeStore',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'create2Deployer',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'protocolTreasury',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'permit2',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'deployNonces',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'deployPhase1',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vaultName', type: 'string' },
          { name: 'vaultSymbol', type: 'string' },
          { name: 'shareName', type: 'string' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'bytes32' },
          { name: 'wrapper', type: 'bytes32' },
          { name: 'shareOFT', type: 'bytes32' },
          { name: 'gauge', type: 'bytes32' },
          { name: 'cca', type: 'bytes32' },
          { name: 'oracle', type: 'bytes32' },
          { name: 'oftBootstrap', type: 'bytes32' },
        ],
      },
    ],
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'oftBootstrapRegistry', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'deployPhase2AndLaunch',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'creatorTreasury', type: 'address' },
          { name: 'payoutRecipient', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'depositAmount', type: 'uint256' },
          { name: 'auctionPercent', type: 'uint8' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'bytes32' },
          { name: 'wrapper', type: 'bytes32' },
          { name: 'shareOFT', type: 'bytes32' },
          { name: 'gauge', type: 'bytes32' },
          { name: 'cca', type: 'bytes32' },
          { name: 'oracle', type: 'bytes32' },
          { name: 'oftBootstrap', type: 'bytes32' },
        ],
      },
    ],
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'auction', type: 'address' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'deployPhase2AndLaunchWithPermit',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'creatorTreasury', type: 'address' },
          { name: 'payoutRecipient', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'depositAmount', type: 'uint256' },
          { name: 'auctionPercent', type: 'uint8' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'bytes32' },
          { name: 'wrapper', type: 'bytes32' },
          { name: 'shareOFT', type: 'bytes32' },
          { name: 'gauge', type: 'bytes32' },
          { name: 'cca', type: 'bytes32' },
          { name: 'oracle', type: 'bytes32' },
          { name: 'oftBootstrap', type: 'bytes32' },
        ],
      },
      {
        name: 'permit',
        type: 'tuple',
        components: [
          { name: 'deadline', type: 'uint256' },
          { name: 'v', type: 'uint8' },
          { name: 'r', type: 'bytes32' },
          { name: 's', type: 'bytes32' },
        ],
      },
    ],
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'auction', type: 'address' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'deployPhase3Strategies',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'initialSqrtPriceX96', type: 'uint160' },
          { name: 'charmVaultName', type: 'string' },
          { name: 'charmVaultSymbol', type: 'string' },
          { name: 'charmWeightBps', type: 'uint256' },
          { name: 'ajnaWeightBps', type: 'uint256' },
          { name: 'enableAutoAllocate', type: 'bool' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'charmAlphaVaultDeploy', type: 'bytes32' },
          { name: 'creatorCharmStrategy', type: 'bytes32' },
          { name: 'ajnaStrategy', type: 'bytes32' },
        ],
      },
    ],
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'v3Pool', type: 'address' },
          { name: 'charmVault', type: 'address' },
          { name: 'charmStrategy', type: 'address' },
          { name: 'ajnaStrategy', type: 'address' },
        ],
      },
    ],
  },
] as const

// UniversalBytecodeStore (v1 + v2 compatible) helpers.
const UNIVERSAL_BYTECODE_STORE_POINTERS_ABI = [
  {
    type: 'function',
    name: 'pointers',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
] as const

// UniversalBytecodeStoreV2 adds chunking for >24KB creation code. v1 stores won't recognize this selector.
const UNIVERSAL_BYTECODE_STORE_CHUNKCOUNT_ABI = [
  {
    type: 'function',
    name: 'chunkCount',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const CREATE2_DEPLOYER_STORE_ABI = [
  {
    type: 'function',
    name: 'store',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

function ExplainerRow({
  icon,
  label,
  title,
  contractName,
  note,
  metaLine,
}: {
  icon: ReactNode
  label: string
  title: ReactNode
  contractName: string
  note: string
  metaLine?: ReactNode
}) {
  return (
    <div className="px-4 py-4 grid grid-cols-[56px_minmax(0,1fr)_auto] gap-x-4 items-start hover:bg-white/[0.02] transition-colors">
      <div className="w-14 shrink-0 pt-0.5 flex justify-center">{icon}</div>

      <div className="min-w-0">
        <div className="text-[15px] leading-5 text-zinc-100 font-medium truncate min-w-0">{title}</div>

        <div className="text-[11px] text-zinc-500 mt-1 leading-5">
          <span className="inline-flex align-middle items-center rounded-md border border-white/5 bg-black/20 px-2 py-0.5 font-mono text-[10px] leading-4 text-zinc-300">
            {contractName}
          </span>
          {metaLine ? (
            <>
              <span className="text-zinc-800">{' · '}</span>
              <span className="align-middle">{metaLine}</span>
            </>
          ) : null}
        </div>

        <div className="text-[11px] text-zinc-600 leading-relaxed mt-2">{note}</div>
      </div>

      <div className="shrink-0 pt-[3px] text-[10px] leading-4 uppercase tracking-[0.34em] text-zinc-500/90 font-medium whitespace-nowrap text-right">
        {label}
      </div>
    </div>
  )
}

function AddressRow({ label, address }: { label: string; address: Address | null | undefined }) {
  const a = address ? String(address) : ''
  const ok = a && a !== String(ZERO_ADDRESS)
  const href = ok ? `https://basescan.org/address/${a}` : null
  return (
    <div className="flex items-center justify-between gap-4 text-[11px]">
      <div className="text-zinc-500">{label}</div>
      {ok && href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-zinc-200/90 hover:text-white transition-colors"
        >
          {shortAddress(a)}
        </a>
      ) : (
        <div className="font-mono text-zinc-600">—</div>
      )}
    </div>
  )
}

function DeployVaultBatcher({
  creatorToken,
  owner,
  connectorId,
  executeBatchEligible = false,
  isSignedIn,
  minFirstDeposit,
  tokenDecimals,
  depositSymbol,
  shareSymbol,
  shareName,
  vaultSymbol,
  vaultName,
  deploymentVersion,
  currentPayoutRecipient,
  floorPriceQ96Aligned,
  marketFloorTwapDurationSec,
  marketFloorDiscountBps,
  onSuccess,
}: {
  creatorToken: Address
  owner: Address
  connectorId?: string | null
  executeBatchEligible?: boolean
  isSignedIn: boolean
  minFirstDeposit: bigint
  tokenDecimals: number | null
  depositSymbol: string
  shareSymbol: string
  shareName: string
  vaultSymbol: string
  vaultName: string
  deploymentVersion: 'v1' | 'v2' | 'v3'
  currentPayoutRecipient: Address | null
  floorPriceQ96Aligned: bigint | null
  marketFloorTwapDurationSec: number | null
  marketFloorDiscountBps: number | null
  onSuccess: (addresses: ServerDeployResponse['addresses']) => void
}) {
  const publicClient = usePublicClient({ chainId: base.id })
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const { config: onchainKitConfig } = useOnchainKit()

  // Gas sponsorship (EIP-4337 paymaster) for ERC-4337 UserOperations.
  // See docs/aa/notes.md for the AA mental model (EntryPoint + bundler + paymaster).
  const cdpApiKey = import.meta.env.VITE_CDP_API_KEY as string | undefined
  const paymasterUrl = resolveCdpPaymasterUrl(onchainKitConfig?.paymaster ?? null, cdpApiKey)

  const resolvedTokenDecimals = typeof tokenDecimals === 'number' ? tokenDecimals : 18
  const formatDeposit = (raw?: bigint): string => {
    if (raw === undefined) return '—'
    const s = formatUnits(raw, resolvedTokenDecimals)
    const n = Number(s)
    if (Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
    return s
  }

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txId, setTxId] = useState<string | null>(null)
  const [deploySessionId, setDeploySessionId] = useState<string | null>(null)
  const [deploySessionStatus, setDeploySessionStatus] = useState<DeploySessionStatusResponse | null>(null)
  const [serverCompleting, setServerCompleting] = useState(false)
  const [serverCompleteError, setServerCompleteError] = useState<string | null>(null)
  const [showUserOpSignModal, setShowUserOpSignModal] = useState(false)
  const [dontShowUserOpSignAgain, setDontShowUserOpSignAgain] = useState(true)
  const [userOpSignModalResolve, setUserOpSignModalResolve] = useState<((ok: boolean) => void) | null>(null)

  const USEROP_SIGNING_ACK_KEY = 'cv_ack_userop_hash_signing_v1'

  const openUserOpSignModal = async (): Promise<boolean> => {
    // Persisted “don’t show again”
    try {
      if (localStorage.getItem(USEROP_SIGNING_ACK_KEY) === '1') return true
    } catch {
      // ignore
    }

    return await new Promise<boolean>((resolve) => {
      setUserOpSignModalResolve(() => resolve)
      setShowUserOpSignModal(true)
    })
  }

  const closeUserOpSignModal = (ok: boolean) => {
    try {
      if (ok && dontShowUserOpSignAgain) localStorage.setItem(USEROP_SIGNING_ACK_KEY, '1')
    } catch {
      // ignore
    }
    setShowUserOpSignModal(false)
    const r = userOpSignModalResolve
    setUserOpSignModalResolve(null)
    r?.(ok)
  }

  useEffect(() => {
    let cancelled = false
    let interval: any = null

    async function start() {
      if (!deploySessionId) return

      // Initial fetch (best effort)
      try {
        await refreshDeploySessionStatus(deploySessionId)
      } catch {
        // ignore
      }

      interval = setInterval(async () => {
        if (cancelled) return
        try {
          const s = await refreshDeploySessionStatus(deploySessionId)
          const step = String(s.step ?? '')
          if (step === 'completed' || step === 'failed') {
            clearInterval(interval)
            interval = null
            setServerCompleting(false)
          }
        } catch {
          // keep polling; user can retry server completion manually
        }
      }, 2000)
    }

    void start()

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [deploySessionId])

  const stepLabel = (step: string | null | undefined): string => {
    switch (String(step ?? '')) {
      case 'created':
        return 'Session created'
      case 'phase1_sent':
        return 'Phase 1 submitted'
      case 'phase1_confirmed':
        return 'Phase 1 confirmed'
      case 'phase2_sent':
        return 'Phase 2 submitted (server)'
      case 'phase2_confirmed':
        return 'Phase 2 confirmed'
      case 'phase3_sent':
        return 'Phase 3 submitted (server)'
      case 'phase3_confirmed':
        return 'Phase 3 confirmed'
      case 'cleanup_sent':
        return 'Cleanup submitted (server)'
      case 'cancelled':
        return 'Cancelled (cleanup complete)'
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      default:
        return step ? step : '—'
    }
  }

  const refreshDeploySessionStatus = async (sessionId: string) => {
    const s = await fetchDeploySessionStatus(sessionId)
    setDeploySessionStatus(s)
    if (s.lastTxHash) setTxId(String(s.lastTxHash))
    return s
  }

  const runServerCompletion = async (sessionId: string) => {
    setServerCompleting(true)
    setServerCompleteError(null)
    try {
      // Kick server completion; status polling will show intermediate steps.
      await continueDeploySession(sessionId)
      await refreshDeploySessionStatus(sessionId)
    } catch (e: any) {
      setServerCompleteError(e?.message ? String(e.message) : 'Server completion failed')
      throw e
    } finally {
      setServerCompleting(false)
    }
  }

  const runServerCancel = async (sessionId: string) => {
    setServerCompleting(true)
    setServerCompleteError(null)
    try {
      await cancelDeploySession(sessionId)
      await refreshDeploySessionStatus(sessionId)
    } catch (e: any) {
      setServerCompleteError(e?.message ? String(e.message) : 'Cancel failed')
      throw e
    } finally {
      setServerCompleting(false)
    }
  }

  const batcherAddress = (CONTRACTS.creatorVaultBatcher ?? null) as Address | null

  const marketFloorWeiPerTokenAligned = useMemo(() => {
    if (!floorPriceQ96Aligned || floorPriceQ96Aligned <= 0n) return null
    // ShareOFT (■token) uses 18 decimals, so convert Q96 → wei/token using 18.
    return q96ToCurrencyPerTokenBaseUnits(floorPriceQ96Aligned, 18)
  }, [floorPriceQ96Aligned])

  const marketFloorText = useMemo(() => {
    if (!marketFloorWeiPerTokenAligned) return null
    const ethShort = formatEthPerTokenForUi(marketFloorWeiPerTokenAligned)

    const duration = typeof marketFloorTwapDurationSec === 'number' ? marketFloorTwapDurationSec : null
    const mins = duration && duration > 0 ? Math.round(duration / 60) : null

    const discount = typeof marketFloorDiscountBps === 'number' ? marketFloorDiscountBps : null
    const bufferBps = discount !== null ? Math.max(0, 10_000 - discount) : null
    const bufferPct = bufferBps !== null ? Math.round(bufferBps / 100) : null

    const meta = [
      mins ? `TWAP ${mins}m` : null,
      bufferPct !== null ? `-${bufferPct}% buffer` : null,
    ]
      .filter(Boolean)
      .join(', ')

    return meta ? `${ethShort} ETH / ${shareSymbol} (${meta})` : `${ethShort} ETH / ${shareSymbol}`
  }, [marketFloorWeiPerTokenAligned, marketFloorTwapDurationSec, marketFloorDiscountBps, shareSymbol])

  // ERC-4337 deploy requires the initial deposit to be owned by the smart wallet sender.
  const { data: smartWalletTokenBalance } = useReadContract({
    address: creatorToken as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [owner as `0x${string}`],
    query: { enabled: Boolean(creatorToken && owner) },
  })

  const codeIds = useMemo(() => {
    return {
      vault: keccak256(DEPLOY_BYTECODE.CreatorOVault as Hex),
      wrapper: keccak256(DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex),
      shareOFT: keccak256(DEPLOY_BYTECODE.CreatorShareOFT as Hex),
      gauge: keccak256(DEPLOY_BYTECODE.CreatorGaugeController as Hex),
      cca: keccak256(DEPLOY_BYTECODE.CCALaunchStrategy as Hex),
      oracle: keccak256(DEPLOY_BYTECODE.CreatorOracle as Hex),
      oftBootstrap: keccak256(DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex),
    } as const
  }, [])

  const payoutRouterCodeId = useMemo(() => {
    return keccak256(DEPLOY_BYTECODE.PayoutRouter as Hex)
  }, [])

  const vaultShareBurnStreamCodeId = useMemo(() => {
    return keccak256(DEPLOY_BYTECODE.VaultShareBurnStream as Hex)
  }, [])

  const strategyCodeIds = useMemo(() => {
    return {
      charmAlphaVaultDeploy: keccak256(DEPLOY_BYTECODE.CharmAlphaVaultDeploy as Hex),
      creatorCharmStrategy: keccak256(DEPLOY_BYTECODE.CreatorCharmStrategy as Hex),
      ajnaStrategy: keccak256(DEPLOY_BYTECODE.AjnaStrategy as Hex),
    } as const
  }, [])

  const expectedQuery = useQuery({
    queryKey: ['creatorVaultBatcher', 'expected', batcherAddress, creatorToken, owner, shareSymbol, shareName, vaultName, vaultSymbol, deploymentVersion],
    enabled: !!publicClient && !!batcherAddress && !!creatorToken && !!owner && !!shareSymbol && !!shareName && !!vaultName && !!vaultSymbol,
    staleTime: 30_000,
    retry: 0,
    queryFn: async () => {
      const create2Deployer = (await publicClient!.readContract({
        address: batcherAddress as Address,
        abi: CREATOR_VAULT_BATCHER_ABI,
        functionName: 'create2Deployer',
      })) as Address

      const protocolTreasury = (await publicClient!.readContract({
        address: batcherAddress as Address,
        abi: CREATOR_VAULT_BATCHER_ABI,
        functionName: 'protocolTreasury',
      })) as Address

      const tempOwner = batcherAddress as Address

      const baseSalt = deriveBaseSalt({ creatorToken, owner, chainId: base.id, version: deploymentVersion })
      const vaultSalt = saltFor(baseSalt, 'vault')
      const wrapperSalt = saltFor(baseSalt, 'wrapper')
      const gaugeSalt = saltFor(baseSalt, 'gauge')
      const ccaSalt = saltFor(baseSalt, 'cca')
      const oracleSalt = saltFor(baseSalt, 'oracle')

      const oftBootstrapSalt = deriveOftBootstrapSalt()
      const shareOftSalt = deriveShareOftSalt({ owner, shareSymbol, version: deploymentVersion })

      const oftBootstrapRegistry = predictCreate2Address({
        create2Deployer,
        salt: oftBootstrapSalt,
        initCode: DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex,
      })

      // IMPORTANT: The onchain `CreatorVaultBatcher` normalizes `shareSymbol` to lowercase
      // when constructing the ShareOFT + Oracle init code (for deterministic addresses).
      // We must mirror that here, otherwise `expected.*` (especially `expectedGauge`) will be wrong
      // and we’ll set the coin payoutRecipient to an address that will never be deployed.
      const shareSymbolDeploy = shareSymbol.toLowerCase()

      const shareOftArgs = encodeAbiParameters(parseAbiParameters('string,string,address,address'), [
        shareName,
        shareSymbolDeploy,
        oftBootstrapRegistry,
        tempOwner,
      ])
      const shareOftInitCode = concatHex([DEPLOY_BYTECODE.CreatorShareOFT as Hex, shareOftArgs])
      const shareOftAddress = predictCreate2Address({ create2Deployer, salt: shareOftSalt, initCode: shareOftInitCode })

      const vaultArgs = encodeAbiParameters(parseAbiParameters('address,address,string,string'), [
        creatorToken,
        tempOwner,
        vaultName,
        vaultSymbol,
      ])
      const vaultInitCode = concatHex([DEPLOY_BYTECODE.CreatorOVault as Hex, vaultArgs])
      const vaultAddress = predictCreate2Address({ create2Deployer, salt: vaultSalt, initCode: vaultInitCode })

      const wrapperArgs = encodeAbiParameters(parseAbiParameters('address,address,address'), [creatorToken, vaultAddress, tempOwner])
      const wrapperInitCode = concatHex([DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex, wrapperArgs])
      const wrapperAddress = predictCreate2Address({ create2Deployer, salt: wrapperSalt, initCode: wrapperInitCode })

      const gaugeArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address'), [
        shareOftAddress,
        owner,
        protocolTreasury,
        tempOwner,
      ])
      const gaugeInitCode = concatHex([DEPLOY_BYTECODE.CreatorGaugeController as Hex, gaugeArgs])
      const gaugeAddress = predictCreate2Address({ create2Deployer, salt: gaugeSalt, initCode: gaugeInitCode })

      const ccaArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address,address'), [
        shareOftAddress,
        ZERO_ADDRESS,
        vaultAddress,
        vaultAddress,
        tempOwner,
      ])
      const ccaInitCode = concatHex([DEPLOY_BYTECODE.CCALaunchStrategy as Hex, ccaArgs])
      const ccaAddress = predictCreate2Address({ create2Deployer, salt: ccaSalt, initCode: ccaInitCode })

      const weth = getAddress((CONTRACTS.weth ?? BASE_WETH) as Address)
      const burnStreamSalt = deriveVaultShareBurnStreamSalt({ creatorToken, owner })
      const burnStreamArgs = encodeAbiParameters(parseAbiParameters('address'), [vaultAddress])
      const burnStreamInitCode = concatHex([DEPLOY_BYTECODE.VaultShareBurnStream as Hex, burnStreamArgs])
      const burnStreamAddress = predictCreate2Address({ create2Deployer, salt: burnStreamSalt, initCode: burnStreamInitCode })

      const payoutRouterSalt = derivePayoutRouterSalt({ creatorToken, owner })
      const payoutRouterArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address,address,address'), [
        creatorToken,
        vaultAddress,
        burnStreamAddress,
        owner,
        getAddress(BASE_SWAP_ROUTER as Address),
        weth,
      ])
      const payoutRouterInitCode = concatHex([DEPLOY_BYTECODE.PayoutRouter as Hex, payoutRouterArgs])
      const payoutRouterAddress = predictCreate2Address({ create2Deployer, salt: payoutRouterSalt, initCode: payoutRouterInitCode })

      // NOTE: Oracle address depends on batcher immutables (registry/chainlink feed). We don't need it for gating.
      // Still return placeholders for UI consistency.
      const oracleInitCode = concatHex([DEPLOY_BYTECODE.CreatorOracle as Hex, '0x' as Hex])
      void oracleSalt
      void oracleInitCode

      return {
        create2Deployer,
        protocolTreasury,
        expected: {
          vault: vaultAddress,
          wrapper: wrapperAddress,
          shareOFT: shareOftAddress,
          gaugeController: gaugeAddress,
          ccaStrategy: ccaAddress,
          oracle: ZERO_ADDRESS as Address,
          burnStream: burnStreamAddress,
          payoutRouter: payoutRouterAddress,
        },
      }
    },
  })

  const expected = expectedQuery.data?.expected ?? null
  const expectedCreate2Deployer = expectedQuery.data?.create2Deployer ?? null
  const expectedGauge = expected?.gaugeController ?? null
  const expectedBurnStream = expected?.burnStream ?? null
  const expectedPayoutRouter = expected?.payoutRouter ?? null

  const payoutMismatch =
    !!expectedPayoutRouter &&
    !!currentPayoutRecipient &&
    expectedPayoutRouter.toLowerCase() !== currentPayoutRecipient.toLowerCase()

  const submit = async () => {
    setBusy(true)
    setError(null)
    setTxId(null)
    setDeploySessionId(null)
    setDeploySessionStatus(null)
    setServerCompleting(false)
    setServerCompleteError(null)

    try {
      if (!batcherAddress) throw new Error('CreatorVaultBatcher is not configured. Set VITE_CREATOR_VAULT_BATCHER.')
      if (!publicClient) throw new Error('Network client not ready')
      if (!walletClient) throw new Error('Wallet not ready')
      if (!expected || !expectedGauge || !expectedBurnStream || !expectedPayoutRouter || !expectedCreate2Deployer)
        throw new Error('Failed to compute expected deployment addresses')
      if (!floorPriceQ96Aligned || floorPriceQ96Aligned <= 0n) {
        throw new Error('Market floor price not available. Wait for pricing to load.')
      }

      const connected = (((walletClient as any).account?.address ?? (walletClient as any).account) as Address | null) ?? null
      if (!connected) throw new Error('Wallet not ready')

      const depositAmount = minFirstDeposit
      const auctionSteps = encodeUniswapCcaLinearSteps(DEFAULT_CCA_DURATION_BLOCKS)
      // Safety: `CreatorVaultBatcher` tries to call `CreatorCoin.setPayoutRecipient(payoutRecipient)` when non-zero.
      // Zora Creator Coins restrict `setPayoutRecipient` to the coin owner, so that internal call reverts (msg.sender=batcher).
      // We always pass `address(0)` to the batcher and, when needed, set payoutRecipient from the identity wallet separately.
      const payoutForDeploy = ZERO_ADDRESS as Address

      const weth = getAddress((CONTRACTS.weth ?? BASE_WETH) as Address)
      const burnStreamSalt = deriveVaultShareBurnStreamSalt({ creatorToken, owner })
      const burnStreamConstructorArgs = encodeAbiParameters(parseAbiParameters('address'), [expected.vault])
      const burnStreamDeployCall = {
        target: expectedCreate2Deployer,
        value: 0n,
        data: encodeFunctionData({
          abi: UNIVERSAL_CREATE2_DEPLOY_FROM_STORE_ABI,
          functionName: 'deploy',
          args: [burnStreamSalt, vaultShareBurnStreamCodeId, burnStreamConstructorArgs],
        }),
      } as const

      const burnStreamAlreadyDeployed = await (async () => {
        const bc = await publicClient.getBytecode({ address: expectedBurnStream })
        return !!bc && bc !== '0x'
      })()

      const payoutRouterSalt = derivePayoutRouterSalt({ creatorToken, owner })
      const payoutRouterConstructorArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address,address,address'), [
        creatorToken,
        expected.vault,
        expectedBurnStream,
        owner,
        getAddress(BASE_SWAP_ROUTER as Address),
        weth,
      ])
      const payoutRouterDeployCall = {
        target: expectedCreate2Deployer,
        value: 0n,
        data: encodeFunctionData({
          abi: UNIVERSAL_CREATE2_DEPLOY_FROM_STORE_ABI,
          functionName: 'deploy',
          args: [payoutRouterSalt, payoutRouterCodeId, payoutRouterConstructorArgs],
        }),
      } as const

      const payoutRouterAlreadyDeployed = await (async () => {
        const bc = await publicClient.getBytecode({ address: expectedPayoutRouter })
        return !!bc && bc !== '0x'
      })()

      const vaultSetBurnStreamCall = {
        target: expected.vault,
        value: 0n,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_ADMIN_ABI,
          functionName: 'setBurnStream',
          args: [expectedBurnStream],
        }),
      } as const

      const vaultWhitelistRouterCall = {
        target: expected.vault,
        value: 0n,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_ADMIN_ABI,
          functionName: 'setWhitelist',
          args: [expectedPayoutRouter, true],
        }),
      } as const

      // ===========================
      // Two-step batcher (Phase 1 + Phase 2) path
      // ===========================
      // Base mainnet can no longer fit the full stack deploy (vault + wrapper + shareOFT + gauge + CCA + oracle + deposit + launch)
      // in a single transaction due to code-deposit gas limits. If the configured batcher supports the two-step ABI,
      // prefer it and bypass the legacy one-tx deploy flow below.
      const isTwoStepBatcher = await (async () => {
        const bc = await publicClient.getBytecode({ address: batcherAddress })
        if (!bc || bc === '0x') return false
        const phase1Topic = keccak256(
          toBytes('Phase1Deployed(address,address,address,address,address,address)'),
        ).slice(2).toLowerCase()
        return bc.toLowerCase().includes(phase1Topic)
      })()

      if (isTwoStepBatcher) {
        const phase1Call = {
          target: batcherAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: CREATOR_VAULT_BATCHER_ABI,
            functionName: 'deployPhase1',
            args: [
              { creatorToken, owner, vaultName, vaultSymbol, shareName, shareSymbol, version: deploymentVersion },
              codeIds,
            ],
          }),
        } as const

        const phase2Params = {
          creatorToken,
          owner,
          creatorTreasury: owner,
          payoutRecipient: payoutForDeploy,
          vault: expected.vault,
          wrapper: expected.wrapper,
          shareOFT: expected.shareOFT,
          shareSymbol,
          version: deploymentVersion,
          depositAmount,
          auctionPercent: DEFAULT_AUCTION_PERCENT,
          requiredRaise: DEFAULT_REQUIRED_RAISE_WEI,
          floorPriceQ96: floorPriceQ96Aligned,
          auctionSteps,
        } as const

        // Phase 3 (strategies): Charm CREATOR/USDC + Ajna lending
        const charmWeightBps = 6900n
        const ajnaWeightBps = 2139n
        if (charmWeightBps <= 0n) throw new Error('Charm strategy is required')
        if (ajnaWeightBps <= 0n) throw new Error('Ajna strategy is required')
        const charmLabel = (depositSymbol || '').toLowerCase()

        // If the CREATOR/USDC v3 pool doesn't exist yet, `deployPhase3Strategies` needs a non-zero
        // `initialSqrtPriceX96` to create+initialize it.
        //
        // Prefer the same onchain market-derived pricing we use for the CCA floor price (CREATOR/ZORA v4 + references),
        // converted into USDC per CREATOR via Chainlink ETH/USD. Fall back to a conservative default (100 CREATOR/USDC).
        const sqrtBigInt = (n: bigint) => {
          if (n < 0n) throw new Error('sqrtBigInt: negative')
          if (n < 2n) return n
          // Newton iteration
          let x0 = n
          let x1 = (x0 + 1n) >> 1n
          while (x1 < x0) {
            x0 = x1
            x1 = (x1 + n / x1) >> 1n
          }
          return x0
        }

        const usdcForV3 = getAddress(((CONTRACTS as any).usdc ?? BASE_USDC) as Address)
        const chainlinkEthUsdForPricing = getAddress(((CONTRACTS as any).chainlinkEthUsd ?? BASE_CHAINLINK_ETH_USD) as Address)

        const fallbackV3InitialSqrtPriceX96 = (() => {
          const creatorDecimals = typeof tokenDecimals === 'number' ? tokenDecimals : 18
          const usdcDecimals = 6
          const usdcAddr = usdcForV3
          const creatorAddr = getAddress(creatorToken as Address)
          const token0 = creatorAddr.toLowerCase() < usdcAddr.toLowerCase() ? creatorAddr : usdcAddr
          const token1 = token0 === creatorAddr ? usdcAddr : creatorAddr

          const pow10 = (d: number) => 10n ** BigInt(d)
          const CREATOR_PER_USDC = 100n

          // Choose integer amounts that encode 100 CREATOR == 1 USDC.
          // Uniswap v3 initialization uses sqrt(price) where price = amount1/amount0 in raw units.
          const amount0 =
            token0.toLowerCase() === usdcAddr.toLowerCase() ? pow10(usdcDecimals) : CREATOR_PER_USDC * pow10(creatorDecimals)
          const amount1 =
            token1.toLowerCase() === usdcAddr.toLowerCase() ? pow10(usdcDecimals) : CREATOR_PER_USDC * pow10(creatorDecimals)

          const numerator = amount1 << 192n
          const ratioX192 = numerator / amount0
          const sqrtPriceX96 = sqrtBigInt(ratioX192)
          // Clamp to uint160 range (contract expects uint160).
          return sqrtPriceX96 > (2n ** 160n - 1n) ? (2n ** 160n - 1n) : sqrtPriceX96
        })()

        const CHAINLINK_AGGREGATOR_ABI = [
          { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
          {
            type: 'function',
            name: 'latestRoundData',
            stateMutability: 'view',
            inputs: [],
            outputs: [
              { name: 'roundId', type: 'uint80' },
              { name: 'answer', type: 'int256' },
              { name: 'startedAt', type: 'uint256' },
              { name: 'updatedAt', type: 'uint256' },
              { name: 'answeredInRound', type: 'uint80' },
            ],
          },
        ] as const

        const marketV3InitialSqrtPriceX96 = await (async () => {
          try {
            // `floorPriceQ96Aligned` is derived from the same market pricing logic we use for CCA;
            // convert it back to a wei/token quote (ShareOFT uses 18 decimals).
            const weiPerCreator = marketFloorWeiPerTokenAligned
            if (typeof weiPerCreator !== 'bigint' || weiPerCreator <= 0n) return null

            const chainlink = chainlinkEthUsdForPricing
            const [decimals, round] = await Promise.all([
              publicClient.readContract({
                address: chainlink,
                abi: CHAINLINK_AGGREGATOR_ABI,
                functionName: 'decimals',
              }) as Promise<number>,
              publicClient.readContract({
                address: chainlink,
                abi: CHAINLINK_AGGREGATOR_ABI,
                functionName: 'latestRoundData',
              }),
            ])

            const answer = BigInt((round as any)?.[1] ?? 0n)
            if (answer <= 0n) return null

            // USDC per 1 CREATOR (in USDC base units, 6 decimals):
            // usdPerCreator = ethPerCreator * ethUsd
            // usdcBase = weiPerCreator * ethUsdAnswer * 1e6 / (1e18 * 10^chainlinkDecimals)
            const usdcPerCreatorBase =
              (weiPerCreator * answer * 1_000_000n) / (10n ** 18n * 10n ** BigInt(Number(decimals)))
            if (usdcPerCreatorBase <= 0n) return null

            const creatorDecimals = typeof tokenDecimals === 'number' ? tokenDecimals : 18
            const usdcDecimals = 6
            const pow10 = (d: number) => 10n ** BigInt(d)
            const creatorUnit = pow10(creatorDecimals)
            const usdcUnit = pow10(usdcDecimals)

            const usdcAddr = usdcForV3
            const creatorAddr = getAddress(creatorToken as Address)

            // Uniswap v3 init expects sqrt(price) where price = amount1/amount0 in raw units (token1/token0).
            // If token0=CREATOR, token1=USDC: amount0 = 1 CREATOR, amount1 = USDC per CREATOR.
            // If token0=USDC, token1=CREATOR: amount0 = 1 USDC, amount1 = CREATOR per USDC.
            const token0IsCreator = creatorAddr.toLowerCase() < usdcAddr.toLowerCase()

            let amount0: bigint
            let amount1: bigint
            if (token0IsCreator) {
              amount0 = creatorUnit
              amount1 = usdcPerCreatorBase
            } else {
              amount0 = usdcUnit
              // creatorPerUsdcBase = (creatorUnit * 1 USDC) / (USDC per CREATOR)
              amount1 = (creatorUnit * usdcUnit) / usdcPerCreatorBase
            }

            if (amount0 <= 0n || amount1 <= 0n) return null

            const ratioX192 = (amount1 << 192n) / amount0
            const sqrtPriceX96 = sqrtBigInt(ratioX192)
            return sqrtPriceX96 > (2n ** 160n - 1n) ? (2n ** 160n - 1n) : sqrtPriceX96
          } catch {
            return null
          }
        })()

        const phase3Params = {
          creatorToken,
          owner,
          vault: expected.vault,
          version: deploymentVersion,
          initialSqrtPriceX96: marketV3InitialSqrtPriceX96 ?? fallbackV3InitialSqrtPriceX96,
          charmVaultName: charmLabel ? `CreatorVault: ${charmLabel}/USDC` : 'CreatorVault: CREATOR/USDC',
          charmVaultSymbol: charmLabel ? `CV-${charmLabel}-USDC` : 'CV-CREATOR-USDC',
          charmWeightBps,
          ajnaWeightBps,
          enableAutoAllocate: false,
        } as const

        // ============================================================
        // Single deploy path: ERC-4337 UserOperations (paymaster + bundler)
        // ============================================================
        if (!executeBatchEligible) {
          throw new Error('Connect an owner EOA of the creator Coinbase Smart Wallet to deploy.')
        }
        if (!isSignedIn) throw new Error('Sign in to deploy (required for sponsored ERC-4337 UserOperations).')
        if (!paymasterUrl) throw new Error('Paymaster is not configured.')

        // Enforce custody: the smart wallet sender must already hold the initial deposit.
        const smartWalletBalance = (await publicClient.readContract({
          address: creatorToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [owner],
        })) as bigint
        if (smartWalletBalance < depositAmount) {
          throw new Error(
            `Creator smart wallet needs ${formatDeposit(depositAmount)} ${depositSymbol} (has ${formatDeposit(smartWalletBalance)}). Transfer funds to ${shortAddress(owner)} and retry.`,
          )
        }

        const cdpBundlerUrl = paymasterUrl

        // Prefer `eth_sign` only when using Coinbase Wallet connectors (they support it).
        // For injected wallets (e.g. Rabby), avoid `eth_sign` and sign via `personal_sign` (EIP-191).
        const resolvedConnectorId = String(connectorId ?? '')
        const userOpSignMode =
          resolvedConnectorId === 'coinbaseWallet' || resolvedConnectorId === 'coinbaseSmartWallet' ? 'eth_sign' : 'signMessage'

        const phase1Calls: Array<{ target: Address; value: bigint; data: Hex }> = [phase1Call]

        const phase2Calls: Array<{ target: Address; value: bigint; data: Hex }> = []
        const swAllowanceToBatcher = (await publicClient.readContract({
          address: creatorToken,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [owner, batcherAddress],
        })) as bigint

        if (swAllowanceToBatcher < depositAmount) {
          if (swAllowanceToBatcher !== 0n) {
            phase2Calls.push({
              target: creatorToken,
              value: 0n,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'approve',
                args: [batcherAddress, 0n],
              }),
            })
          }
          phase2Calls.push({
            target: creatorToken,
            value: 0n,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [batcherAddress, depositAmount],
            }),
          })
        }

        phase2Calls.push({
          target: batcherAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: CREATOR_VAULT_BATCHER_ABI,
            functionName: 'deployPhase2AndLaunch',
            args: [phase2Params, codeIds],
          }),
        })

        if (!burnStreamAlreadyDeployed) phase2Calls.push(burnStreamDeployCall)
        if (!payoutRouterAlreadyDeployed) phase2Calls.push(payoutRouterDeployCall)
        phase2Calls.push(vaultSetBurnStreamCall)
        phase2Calls.push(vaultWhitelistRouterCall)
        if (payoutMismatch) {
          phase2Calls.push({
            target: creatorToken,
            value: 0n,
            data: encodeFunctionData({
              abi: COIN_PAYOUT_RECIPIENT_ABI,
              functionName: 'setPayoutRecipient',
              args: [expectedPayoutRouter],
            }),
          })
        }

        const phase3Calls: Array<{ target: Address; value: bigint; data: Hex }> = [
          {
            target: batcherAddress,
            value: 0n,
            data: encodeFunctionData({
              abi: CREATOR_VAULT_BATCHER_ABI,
              functionName: 'deployPhase3Strategies',
              args: [phase3Params, strategyCodeIds],
            }),
          },
        ]

        // Best UX: 1 signature, server completes Phase 2/3 and cleans up temporary owner.
        try {
          const deploySession = await createDeploySession({
            smartWallet: owner,
            creatorToken,
            ownerAddress: owner,
            phase2Calls,
            phase3Calls,
            version: deploymentVersion,
          })
          setDeploySessionId(deploySession.sessionId)
          setDeploySessionStatus({
            id: deploySession.sessionId,
            step: 'created',
            expiresAt: deploySession.expiresAt,
            smartWallet: owner,
            sessionOwner: deploySession.sessionOwner,
          } as any)

          const ok1 = await openUserOpSignModal()
          if (!ok1) throw new Error('Cancelled')

          const addOwnerCall = {
            target: owner,
            value: 0n,
            data: encodeFunctionData({
              abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
              functionName: 'addOwnerAddress',
              args: [deploySession.sessionOwner],
            }),
          } as const

          const res1 = await sendCoinbaseSmartWalletUserOperation({
            publicClient,
            walletClient,
            bundlerUrl: cdpBundlerUrl,
            smartWallet: owner,
            ownerAddress: connected,
            calls: [addOwnerCall, ...phase1Calls].map((c) => ({ to: c.target, value: c.value, data: c.data })),
            version: '1',
            userOpSignMode,
          })
          setTxId(res1.transactionHash)

          setServerCompleting(true)
          void runServerCompletion(deploySession.sessionId)

          onSuccess(expected)
          return
        } catch (e: any) {
          // No fallback to multi-UserOp / multi-approval deploys.
          // If deploy-session is unavailable (DB misconfig, server error, etc) we fail fast.
          const msg = e?.message ? String(e.message) : 'deploy_session_unavailable'
          throw new Error(`1‑click deploy unavailable: ${msg}`)
        }
      }

      throw new Error('No supported deploy path matched. Ensure ERC-4337 prerequisites are met and retry.')
    } catch (e: any) {
      setError(e?.message || 'Deployment failed')
    } finally {
      setBusy(false)
    }
  }

  const canAutoUpdatePayoutRecipient = !payoutMismatch || executeBatchEligible

  const disabled =
    busy ||
    expectedQuery.isLoading ||
    !expected ||
    !canAutoUpdatePayoutRecipient ||
    !executeBatchEligible

  return (
    <div className="space-y-3">
      {payoutMismatch ? (
        <div className="text-[11px] text-amber-300/80">
          {canAutoUpdatePayoutRecipient ? (
            <>
              Payout recipient will update to <span className="font-mono text-amber-200">{shortAddress(expectedGauge!)}</span> during deploy.
            </>
          ) : (
            <>
              Payout recipient must be updated to{' '}
              <span className="font-mono text-amber-200">{shortAddress(expectedGauge!)}</span> by the identity wallet.
            </>
          )}
        </div>
      ) : null}

      <details className="group rounded-lg border border-white/5 bg-black/20">
        <summary className="cursor-pointer select-none list-none px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Deployment plan</div>
            <div className="text-[12px] text-zinc-200 truncate">Phases 1–3 · deterministic addresses</div>
          </div>
          <ChevronDown className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4 pt-1">
          <div className="text-[11px] text-zinc-600 mb-3">
            Addresses are deterministic on Base. Click to view on BaseScan.
          </div>

          <div className="rounded-md border border-white/5 bg-black/30 divide-y divide-white/5">
            <div className="py-3">
              <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-2">Phase 1</div>
              <div className="space-y-2">
                <AddressRow label="Vault" address={expected?.vault} />
                <AddressRow label="Wrapper" address={expected?.wrapper} />
                <AddressRow label="Share token" address={expected?.shareOFT} />
              </div>
            </div>

            <div className="py-3">
              <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-2">Phase 2</div>
              <div className="space-y-2">
                <AddressRow label="Gauge controller" address={expected?.gaugeController} />
                <AddressRow label="CCA strategy" address={expected?.ccaStrategy} />
                <AddressRow label="Burn stream" address={expected?.burnStream} />
                <AddressRow label="Payout router" address={expected?.payoutRouter} />
                <div className="flex items-center justify-between gap-4 text-[11px]">
                  <div className="text-zinc-500">Initial deposit</div>
                  <div className="font-mono text-zinc-200/90">
                    {formatDeposit(minFirstDeposit)} {depositSymbol}
                  </div>
                </div>
                {marketFloorText ? (
                  <div className="flex items-center justify-between gap-4 text-[11px]">
                    <div className="text-zinc-500">CCA floor</div>
                    <div className="text-zinc-200/90">{marketFloorText}</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="py-3">
              <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-2">Phase 3</div>
              <div className="text-[11px] text-zinc-600">
                Strategy deployments + registrations (Charm CREATOR/USDC + Ajna).
              </div>
            </div>
          </div>
        </div>
      </details>

      <div className="rounded-lg border border-white/5 bg-black/20 p-4 space-y-2">
        <div className="text-[11px] text-zinc-400">
          Deploy runs as <span className="text-white">ERC‑4337 UserOperations</span> from{' '}
          <span className="font-mono text-zinc-200">{shortAddress(owner)}</span>.
        </div>
        {typeof smartWalletTokenBalance === 'bigint' ? (
          <div className="text-[11px] text-zinc-500">
            Smart wallet balance: <span className="text-zinc-200 font-mono">{formatDeposit(smartWalletTokenBalance)}</span> {depositSymbol}
          </div>
        ) : (
          <div className="text-[11px] text-zinc-600">Checking smart wallet balance…</div>
        )}
      </div>

      <button type="button" onClick={() => void submit()} disabled={disabled} className="btn-accent w-full rounded-lg">
        {busy ? 'Deploying…' : '1‑Click Deploy (ERC‑4337)'}
      </button>

      {isSignedIn ? (
        <div className="text-[11px] text-zinc-500 leading-relaxed">
          You may be asked to sign an <span className="text-zinc-200">“Unknown signature type”</span> hash in your wallet. That’s expected for
          ERC‑4337 batched deploys.{' '}
          <button type="button" className="underline text-zinc-300 hover:text-white" onClick={() => void openUserOpSignModal()}>
            Learn why
          </button>
          .
        </div>
      ) : null}

      {marketFloorText ? <div className="text-[11px] text-zinc-500">Market floor: {marketFloorText}</div> : null}

      {error ? <div className="text-[11px] text-red-400/90">{error}</div> : null}
      {deploySessionId ? (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-zinc-500">Server completion</div>
            <div className="text-[11px] text-zinc-400">{stepLabel(deploySessionStatus?.step)}</div>
          </div>
          <div className="text-[11px] text-zinc-600 break-all">
            Session: <span className="font-mono text-zinc-300">{deploySessionId}</span>
          </div>
          {deploySessionStatus?.lastError ? (
            <div className="text-[11px] text-red-400/90">{String(deploySessionStatus.lastError)}</div>
          ) : null}
          {serverCompleteError ? <div className="text-[11px] text-red-400/90">{serverCompleteError}</div> : null}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              className="px-3 py-2 rounded-md border border-white/10 bg-white/5 text-[11px] text-zinc-200 hover:bg-white/10 disabled:opacity-50"
              disabled={!deploySessionId || serverCompleting}
              onClick={() => {
                if (!deploySessionId) return
                void runServerCompletion(deploySessionId)
              }}
            >
              {serverCompleting ? 'Completing…' : 'Retry server completion'}
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-md border border-white/10 bg-white/5 text-[11px] text-zinc-200 hover:bg-white/10 disabled:opacity-50"
              disabled={!deploySessionId}
              onClick={() => {
                if (!deploySessionId) return
                void refreshDeploySessionStatus(deploySessionId)
              }}
            >
              Refresh
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-md border border-white/10 bg-white/5 text-[11px] text-zinc-200 hover:bg-white/10 disabled:opacity-50"
              disabled={!deploySessionId || serverCompleting}
              onClick={() => {
                if (!deploySessionId) return
                void runServerCancel(deploySessionId)
              }}
            >
              Cancel session (cleanup)
            </button>
          </div>
        </div>
      ) : null}
      {txId ? (
        <div className="text-[11px] text-zinc-500">
          Submitted: <span className="font-mono text-zinc-300 break-all">{txId}</span>
        </div>
      ) : null}

      {showUserOpSignModal ? (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/70" onClick={() => closeUserOpSignModal(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl border border-white/10 bg-zinc-950 shadow-2xl">
              <div className="p-5 border-b border-white/10">
                <div className="text-[14px] text-zinc-100 font-medium">Before you sign</div>
                <div className="text-[11px] text-zinc-500 mt-1">
                  Some wallets (like Rabby) show this as <span className="text-zinc-200">“Unknown signature type”</span>.
                </div>
              </div>

              <div className="p-5 space-y-3 text-[12px] text-zinc-300 leading-relaxed">
                <div>
                  <span className="font-medium text-zinc-100">What you’re signing:</span> a short 32‑byte hash. It’s the ERC‑4337 “UserOp hash”
                  that authorizes a single batched deploy.
                </div>
                <div>
                  <span className="font-medium text-zinc-100">This is not a transaction:</span> signing alone does not move funds. After you sign,
                  the bundler submits the actual onchain transaction.
                </div>
                <div>
                  <span className="font-medium text-zinc-100">Why you saw another transaction:</span> after the signature, you’ll typically see an
                  onchain transaction executed by the bundler/EntryPoint that triggers your{' '}
                  <span className="font-mono text-zinc-200">{shortAddress(owner)}</span> smart wallet to run the batched deploy.
                </div>

                <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-1 text-[11px] text-zinc-400">
                  <div>
                    <span className="text-zinc-500">Site:</span>{' '}
                    <span className="font-mono text-zinc-200">{typeof window !== 'undefined' ? window.location.origin : '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Smart wallet:</span> <span className="font-mono text-zinc-200">{owner}</span>
                  </div>
                </div>

                <label className="flex items-center gap-2 pt-1 text-[11px] text-zinc-500 select-none">
                  <input
                    type="checkbox"
                    checked={dontShowUserOpSignAgain}
                    onChange={(e) => setDontShowUserOpSignAgain(e.target.checked)}
                  />
                  Don’t show this again on this device
                </label>
              </div>

              <div className="p-5 border-t border-white/10 flex items-center justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => closeUserOpSignModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-accent" onClick={() => closeUserOpSignModal(true)}>
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function DeployVault() {
  const { address, isConnected, connector } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { config: onchainKitConfig } = useOnchainKit()
  const [creatorToken, setCreatorToken] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [deploymentVersion, setDeploymentVersion] = useState<'v1' | 'v2' | 'v3'>('v3')

  const [searchParams] = useSearchParams()
  const prefillToken = useMemo(() => searchParams.get('token') ?? '', [searchParams])
  const cdpApiKey = import.meta.env.VITE_CDP_API_KEY as string | undefined
  const paymasterStatus = useMemo(() => {
    const paymasterUrl = resolveCdpPaymasterUrl(onchainKitConfig?.paymaster ?? null, cdpApiKey)
    if (!paymasterUrl || typeof paymasterUrl !== 'string') {
      return { ok: false, hint: 'missing' }
    }
    try {
      const url = new URL(paymasterUrl)
      return { ok: true, hint: url.host }
    } catch {
      return { ok: true, hint: 'configured' }
    }
  }, [cdpApiKey, onchainKitConfig?.paymaster])

  useEffect(() => {
    if (!prefillToken) return
    if (creatorToken.length > 0) return
    setCreatorToken(prefillToken)
  }, [prefillToken, creatorToken.length])

  // Detect "your" creator coin + smart wallet from your Zora profile and prefill inputs once.
  const myProfileQuery = useZoraProfile(address)
  const myProfile = myProfileQuery.data
  const miniApp = useMiniAppContext()
  const farcasterAuth = useFarcasterAuth()

  // `sdk.context.*` is untrusted. Prefer verified Farcaster auth (Quick Auth / SIWF) when available.
  const farcasterFidForLookup = useMemo(() => {
    if (typeof farcasterAuth.fid === 'number' && farcasterAuth.fid > 0) return farcasterAuth.fid
    if (typeof miniApp.fid === 'number' && miniApp.fid > 0) return miniApp.fid
    return null
  }, [farcasterAuth.fid, miniApp.fid])

  const farcasterIdentityQuery = useQuery({
    queryKey: ['farcasterIdentity', farcasterFidForLookup ?? 'none'],
    enabled: typeof farcasterFidForLookup === 'number' && farcasterFidForLookup > 0,
    queryFn: async () => {
      return await getFarcasterUserByFid(farcasterFidForLookup as number)
    },
    staleTime: 60_000,
    retry: 0,
  })

  const verifiedFarcasterUsername = useMemo(() => {
    if (typeof farcasterAuth.fid !== 'number' || farcasterAuth.fid <= 0) return null
    const u = farcasterIdentityQuery.data?.username
    if (typeof u !== 'string') return null
    const trimmed = u.trim()
    return trimmed.length > 0 ? trimmed : null
  }, [farcasterAuth.fid, farcasterIdentityQuery.data?.username])

  const farcasterUsernameForZoraLookup = useMemo(() => {
    // Prefer verified username (derived from verified fid); otherwise use untrusted context for suggestion-only.
    const ctx = typeof miniApp.username === 'string' ? miniApp.username.trim() : ''
    const fallback = typeof farcasterIdentityQuery.data?.username === 'string' ? farcasterIdentityQuery.data.username.trim() : ''
    const out = verifiedFarcasterUsername || ctx || fallback
    return out && out.length > 0 ? out : null
  }, [verifiedFarcasterUsername, miniApp.username, farcasterIdentityQuery.data?.username])

  const farcasterProfileQuery = useZoraProfile(farcasterUsernameForZoraLookup ?? undefined)

  const farcasterCustodyAddress = useMemo(() => {
    const v = farcasterIdentityQuery.data?.custodyAddress ? String(farcasterIdentityQuery.data.custodyAddress) : ''
    return isAddress(v) ? (v as Address) : null
  }, [farcasterIdentityQuery.data?.custodyAddress])

  const farcasterVerifiedEthAddresses = useMemo(() => {
    const raw = farcasterIdentityQuery.data?.verifiedEthAddresses ?? []
    const out: Address[] = []
    for (const a of raw) {
      const v = typeof a === 'string' ? a : ''
      if (!isAddress(v)) continue
      out.push(v as Address)
    }
    return out
  }, [farcasterIdentityQuery.data?.verifiedEthAddresses])

  const { isSignedIn, busy: authBusy, error: authError, signIn } = useSiweAuth()
  const adminAuthQuery = useQuery({
    queryKey: ['adminAuth'],
    enabled: isConnected && showAdvanced && isSignedIn,
    queryFn: fetchAdminAuth,
    staleTime: 30_000,
    retry: 0,
  })
  const isAdmin = Boolean(adminAuthQuery.data?.isAdmin)

  const [minCoinAgeDays, setMinCoinAgeDays] = useState<number>(DEFAULT_MIN_COIN_AGE_DAYS)
  useEffect(() => {
    if (!isAdmin) {
      setMinCoinAgeDays(DEFAULT_MIN_COIN_AGE_DAYS)
      return
    }
    try {
      const raw = localStorage.getItem(MIN_COIN_AGE_LOCALSTORAGE_KEY)
      const n = Number(raw)
      if (Number.isFinite(n) && n >= 0 && n <= 3650) setMinCoinAgeDays(Math.floor(n))
    } catch {
      // ignore
    }
  }, [isAdmin])
  useEffect(() => {
    if (!isAdmin) return
    try {
      localStorage.setItem(MIN_COIN_AGE_LOCALSTORAGE_KEY, String(minCoinAgeDays))
    } catch {
      // ignore
    }
  }, [isAdmin, minCoinAgeDays])

  useEffect(() => {
    // v1 is legacy/admin-only; never allow non-admins to select it.
    if (!isAdmin && deploymentVersion === 'v1') setDeploymentVersion('v3')
  }, [isAdmin, deploymentVersion])

  const detectedCreatorCoin = useMemo(() => {
    const v = myProfile?.creatorCoin?.address ? String(myProfile.creatorCoin.address) : ''
    return isAddress(v) ? (v as Address) : null
  }, [myProfile?.creatorCoin?.address])

  const detectedCreatorCoinFromFarcaster = useMemo(() => {
    const v = farcasterProfileQuery.data?.creatorCoin?.address ? String(farcasterProfileQuery.data.creatorCoin.address) : ''
    return isAddress(v) ? (v as Address) : null
  }, [farcasterProfileQuery.data?.creatorCoin?.address])

  const detectedSmartWallet = useMemo(() => {
    const edges = myProfile?.linkedWallets?.edges ?? []
    for (const e of edges) {
      const n: any = (e as any)?.node
      const t = typeof n?.walletType === 'string' ? n.walletType : ''
      const a = typeof n?.walletAddress === 'string' ? n.walletAddress : ''
      if (String(t).toUpperCase() !== 'SMART_WALLET') continue
      if (isAddress(a)) return a as Address
    }
    return null
  }, [myProfile?.linkedWallets?.edges])

  // Defensive: some indexers/wallet graphs can incorrectly label an EOA as a "SMART_WALLET".
  // Coinbase Smart Wallet is a contract account onchain, so require bytecode to treat it as a smart wallet.
  const publicClient = usePublicClient({ chainId: base.id })
  const smartWalletBytecodeQuery = useQuery({
    queryKey: ['bytecode', 'smartWallet', detectedSmartWallet],
    enabled: !!publicClient && !!detectedSmartWallet,
    queryFn: async () => {
      return await publicClient!.getBytecode({ address: detectedSmartWallet as Address })
    },
    staleTime: 60_000,
    retry: 0,
  })
  const entryPointBytecodeQuery = useQuery({
    queryKey: ['bytecode', 'entryPointV06', COINBASE_ENTRYPOINT_V06],
    enabled: !!publicClient,
    queryFn: async () => {
      return await publicClient!.getBytecode({ address: COINBASE_ENTRYPOINT_V06 as Address })
    },
    staleTime: 60_000,
    retry: 0,
  })

  const detectedSmartWalletContract = useMemo(() => {
    const code = smartWalletBytecodeQuery.data
    if (!detectedSmartWallet) return null
    if (!code || code === '0x') return null
    return detectedSmartWallet
  }, [detectedSmartWallet, smartWalletBytecodeQuery.data])
  const entryPointV06Ready = useMemo(() => {
    const code = entryPointBytecodeQuery.data
    return !!code && code !== '0x'
  }, [entryPointBytecodeQuery.data])

  const autofillRef = useRef<{ tokenFor?: string }>({})
  const addressLc = (address ?? '').toLowerCase()

  useEffect(() => {
    if (!isConnected || !addressLc) return
    if (prefillToken) return
    if (creatorToken.trim().length > 0) return
    if (!detectedCreatorCoin) return
    if (autofillRef.current.tokenFor === addressLc) return

    setCreatorToken(detectedCreatorCoin)
    autofillRef.current.tokenFor = addressLc
  }, [isConnected, addressLc, prefillToken, creatorToken, detectedCreatorCoin])

  // Mini App fallback (verified): only prefill from Farcaster-derived data once we have a verified session.
  // `sdk.context.*` is suggestion-only and should not trigger irreversible defaults.
  useEffect(() => {
    if (prefillToken) return
    if (creatorToken.trim().length > 0) return
    if (!verifiedFarcasterUsername) return
    if (!detectedCreatorCoinFromFarcaster) return
    const key = `miniapp:${verifiedFarcasterUsername.toLowerCase()}`
    if (autofillRef.current.tokenFor === key) return
    setCreatorToken(detectedCreatorCoinFromFarcaster)
    autofillRef.current.tokenFor = key
  }, [prefillToken, creatorToken, verifiedFarcasterUsername, detectedCreatorCoinFromFarcaster])

  const tokenIsValid = isAddress(creatorToken)

  const connectedWalletAddress = useMemo(() => {
    const a = address ? String(address) : ''
    return isAddress(a) ? (a as Address) : null
  }, [address])

  // NOTE: selectedOwnerWallet (smart wallet vs connected wallet) is computed further down once we know
  // payoutRecipient/creatorAddress.

  const {
    data: zoraCoin,
    isLoading: zoraLoading,
  } = useZoraCoin(
    tokenIsValid ? (creatorToken as Address) : undefined,
  )
  // Prefetch creator profile (used elsewhere in the app); we don't depend on the result here.
  useZoraProfile(zoraCoin?.creatorAddress)

  const { data: tokenSymbol, isLoading: symbolLoading } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'symbol',
    query: { enabled: tokenIsValid },
  })

  const { data: tokenName } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'name',
    query: { enabled: tokenIsValid },
  })
  const { data: tokenDecimals } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: tokenIsValid },
  })
  const resolvedTokenDecimals = useMemo<number | null>(() => {
    if (typeof tokenDecimals === 'number' && Number.isFinite(tokenDecimals)) return tokenDecimals
    if (typeof tokenDecimals === 'bigint') return Number(tokenDecimals)
    return null
  }, [tokenDecimals])

  // Auto-derive ShareOFT symbol and name (preserve original case)
  const baseSymbol = tokenSymbol ?? zoraCoin?.symbol ?? ''
  const baseName = (tokenName ? String(tokenName) : zoraCoin?.name ?? '').trim()

  const underlyingSymbol = useMemo(() => {
    if (!baseSymbol) return ''
    return normalizeUnderlyingSymbol(String(baseSymbol))
  }, [baseSymbol])

  const underlyingSymbolUpper = useMemo(() => {
    if (underlyingSymbol) return deriveUnderlyingUpper(underlyingSymbol)
    if (baseSymbol) return deriveUnderlyingUpper(baseSymbol)
    return ''
  }, [baseSymbol, underlyingSymbol])

  const derivedVaultSymbol = useMemo(() => {
    if (!underlyingSymbolUpper) return ''
    return toVaultSymbol(underlyingSymbolUpper)
  }, [underlyingSymbolUpper])

  const derivedVaultName = useMemo(() => {
    if (!underlyingSymbolUpper) return ''
    return toVaultName(underlyingSymbolUpper, baseName)
  }, [underlyingSymbolUpper, baseName])

  const derivedShareSymbol = useMemo(() => {
    if (!underlyingSymbolUpper) return ''
    return toShareSymbol(underlyingSymbolUpper)
  }, [underlyingSymbolUpper])

  const derivedShareName = useMemo(() => {
    if (!underlyingSymbolUpper) return ''
    return toShareName(underlyingSymbolUpper, baseName)
  }, [underlyingSymbolUpper, baseName])

  function formatToken18(raw?: bigint): string {
    if (raw === undefined) return '—'
    const decimals = typeof tokenDecimals === 'number' ? tokenDecimals : 18
    const s = formatUnits(raw, decimals)
    const n = Number(s)
    if (Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
    return s
  }

  const creatorAddress = zoraCoin?.creatorAddress ? String(zoraCoin.creatorAddress) : null
  const isOriginalCreator =
    !!address && !!creatorAddress && address.toLowerCase() === creatorAddress.toLowerCase()

  // Onchain read of payoutRecipient (immediate after tx, no indexer delay).
  const { data: onchainPayoutRecipient } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: coinABI,
    functionName: 'payoutRecipient',
    query: { enabled: tokenIsValid },
  })

  const payoutRecipient = useMemo(() => {
    // Prefer onchain value (instant). Fall back to Zora indexed value.
    const onchain = typeof onchainPayoutRecipient === 'string' ? onchainPayoutRecipient : ''
    if (isAddress(onchain)) return onchain as Address
    const r = zoraCoin?.payoutRecipientAddress ? String(zoraCoin.payoutRecipientAddress) : ''
    return isAddress(r) ? (r as Address) : null
  }, [onchainPayoutRecipient, zoraCoin?.payoutRecipientAddress])

  // Prefer onchain truth over indexer graphs:
  // If the coin's payoutRecipient is a deployed contract, treat it as the canonical smart wallet.
  // This matches how many creators deploy their Zora coin (Smart Wallet payout recipient).
  const payoutRecipientBytecodeQuery = useQuery({
    queryKey: ['bytecode', 'payoutRecipient', creatorToken, payoutRecipient],
    enabled: !!publicClient && !!payoutRecipient,
    queryFn: async () => {
      return await publicClient!.getBytecode({ address: payoutRecipient as Address })
    },
    staleTime: 60_000,
    retry: 0,
  })

  const payoutRecipientContract = useMemo(() => {
    if (!payoutRecipient) return null
    const code = payoutRecipientBytecodeQuery.data
    if (!code || code === '0x') return null
    return payoutRecipient
  }, [payoutRecipient, payoutRecipientBytecodeQuery.data])

  const { data: payoutRecipientTokenBalance } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [((payoutRecipient ?? ZERO_ADDRESS) as Address) as `0x${string}`],
    query: { enabled: tokenIsValid && !!payoutRecipient },
  })

  void payoutRecipientTokenBalance // reserved for future UX

  const isPayoutRecipient =
    !!address && !!payoutRecipient && address.toLowerCase() === payoutRecipient.toLowerCase()

  // Zora creators often deploy coins from a smart wallet (Privy-managed), then add EOAs later.
  // Treat the Smart Wallet address as canonical and allow the connected EOA to act if it is an onchain owner.
  const coinSmartWallet = useMemo(() => {
    // Highest-confidence: the coin's payout recipient is already a deployed contract.
    // (This is the common Coinbase Smart Wallet setup.)
    if (payoutRecipientContract) return payoutRecipientContract

    // Fallback: use Zora profile-linked wallet graphs if present (requires onchain bytecode).
    if (!detectedSmartWalletContract) return null
    const smartLc = detectedSmartWalletContract.toLowerCase()
    if (payoutRecipient && payoutRecipient.toLowerCase() === smartLc) return detectedSmartWalletContract
    if (creatorAddress && creatorAddress.toLowerCase() === smartLc) return detectedSmartWalletContract
    return null
  }, [payoutRecipientContract, detectedSmartWalletContract, payoutRecipient, creatorAddress])

  const coinbaseSmartWalletConnector = useMemo(() => {
    return connectors.find((c) => String(c.id) === 'coinbaseSmartWallet')
  }, [connectors])

  const smartWalletConnectionHint = useMemo(() => {
    // Only show the hint when the coin is owned by a smart wallet.
    if (!coinSmartWallet) return null
    if (!isConnected) return null
    const connectorName = String((connector as any)?.name ?? (connector as any)?.id ?? 'Unknown connector')
    return { connectorName }
  }, [coinSmartWallet, connector, isConnected])

  const smartWalletOwnerQuery = useReadContract({
    address: coinSmartWallet ? (coinSmartWallet as `0x${string}`) : undefined,
    abi: COINBASE_SMART_WALLET_OWNER_ABI,
    functionName: 'isOwnerAddress',
    args: [(connectedWalletAddress ?? ZERO_ADDRESS) as `0x${string}`],
    query: {
      enabled: !!coinSmartWallet && !!connectedWalletAddress && !isOriginalCreator && !isPayoutRecipient,
      retry: false,
    },
  })

  const isAuthorizedViaSmartWallet =
    !!coinSmartWallet && smartWalletOwnerQuery.data === true

  const isAuthorizedDeployer = isOriginalCreator || isPayoutRecipient || isAuthorizedViaSmartWallet

  // Canonical identity enforcement (prevents irreversible fragmentation).
  // For existing creator coins, we enforce `zoraCoin.creatorAddress` as the identity wallet.
  const identity = useMemo(() => {
    return resolveCreatorIdentity({
      connectedWallet: connectedWalletAddress,
      zoraCoin: zoraCoin ?? null,
      farcasterZoraProfile: farcasterProfileQuery.data ?? null,
      farcasterCustodyAddress,
    })
  }, [connectedWalletAddress, farcasterCustodyAddress, farcasterProfileQuery.data, zoraCoin])

  const canonicalIdentityAddress = identity.canonicalIdentity.address
  const deploySender = (coinSmartWallet ?? canonicalIdentityAddress) as Address | null

  const { data: deploySenderTokenBalance } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [((deploySender ?? ZERO_ADDRESS) as Address) as `0x${string}`],
    query: { enabled: tokenIsValid && !!deploySender },
  })

  // ============================================================
  // Smart-wallet executeBatch eligibility (EOA owner → deploy via SW)
  // ============================================================
  const operatorModeForIdentity =
    !!connectedWalletAddress &&
    !!canonicalIdentityAddress &&
    connectedWalletAddress.toLowerCase() !== canonicalIdentityAddress.toLowerCase()

  const canonicalIdentityBytecodeQuery = useQuery({
    queryKey: ['bytecode', 'canonicalIdentity', creatorToken, canonicalIdentityAddress],
    enabled: !!publicClient && !!canonicalIdentityAddress,
    queryFn: async () => {
      return await publicClient!.getBytecode({ address: canonicalIdentityAddress as Address })
    },
    staleTime: 60_000,
    retry: 0,
  })

  const canonicalIdentityIsContract = useMemo(() => {
    if (!canonicalIdentityAddress) return false
    const code = canonicalIdentityBytecodeQuery.data
    return !!code && code !== '0x'
  }, [canonicalIdentityAddress, canonicalIdentityBytecodeQuery.data])

  const smartWalletEntryPointQuery = useReadContract({
    address: canonicalIdentityIsContract ? (canonicalIdentityAddress as `0x${string}`) : undefined,
    abi: COINBASE_SMART_WALLET_PREFLIGHT_ABI,
    functionName: 'entryPoint',
    query: {
      enabled: canonicalIdentityIsContract && operatorModeForIdentity,
      retry: false,
    },
  })

  const smartWalletOwnerForCanonicalQuery = useReadContract({
    address: canonicalIdentityIsContract ? (canonicalIdentityAddress as `0x${string}`) : undefined,
    abi: COINBASE_SMART_WALLET_OWNER_ABI,
    functionName: 'isOwnerAddress',
    args: [(connectedWalletAddress ?? ZERO_ADDRESS) as `0x${string}`],
    query: {
      enabled: canonicalIdentityIsContract && operatorModeForIdentity && !!connectedWalletAddress,
      retry: false,
    },
  })

  const smartWalletPreflightOk = useMemo(() => {
    const ep = smartWalletEntryPointQuery.data ? String(smartWalletEntryPointQuery.data) : ''
    return isAddress(ep) && ep.toLowerCase() === COINBASE_ENTRYPOINT_V06.toLowerCase()
  }, [smartWalletEntryPointQuery.data])

  const executeBatchEligible =
    operatorModeForIdentity &&
    canonicalIdentityIsContract &&
    smartWalletPreflightOk &&
    smartWalletOwnerForCanonicalQuery.data === true

  // Creator access gate:
  // - include the connected wallet (for smart-wallet-owned coins, this may be the only EOA we can approve)
  // - include the coin (so we can also allowlist creator/payoutRecipient)
  const creatorAllowlistQuery = useCreatorAllowlist(
    connectedWalletAddress || tokenIsValid
      ? {
          address: connectedWalletAddress ?? null,
          coin: tokenIsValid ? creatorToken : null,
        }
      : undefined,
  )
  const allowlistMode = creatorAllowlistQuery.data?.mode
  const allowlistEnforced = allowlistMode === 'enforced'
  const isAllowlistedCreator = creatorAllowlistQuery.data?.allowed === true
  const passesCreatorAllowlist = allowlistMode === 'disabled' ? true : isAllowlistedCreator


  // NOTE: We previously supported an optional “fund owner wallet” helper flow, but it’s not wired into
  // the current UX. Keeping the deploy path deterministic + minimal for now.

  // Creator Vaults are creator-initiated. If we can't confidently identify the creator, default to locked.
  const coinTypeUpper = String(zoraCoin?.coinType ?? '').toUpperCase()
  const isCreatorCoin = coinTypeUpper === 'CREATOR'
  const coinTypeLabel =
    coinTypeUpper === 'CREATOR' ? 'Creator Coin' : coinTypeUpper === 'CONTENT' ? 'Content Coin' : 'Coin'
  const coinTypePillClass =
    coinTypeUpper === 'CREATOR'
      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
      : coinTypeUpper === 'CONTENT'
        ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
        : 'bg-zinc-500/10 border border-zinc-500/20 text-zinc-300'

  const coinCreatedAtMs = useMemo(() => {
    const raw = typeof zoraCoin?.createdAt === 'string' ? zoraCoin.createdAt.trim() : ''
    if (!raw) return null
    const ms = Date.parse(raw)
    return Number.isFinite(ms) ? ms : null
  }, [zoraCoin?.createdAt])

  const coinAgeDays = useMemo(() => {
    if (!coinCreatedAtMs) return null
    const ageMs = Date.now() - coinCreatedAtMs
    if (!Number.isFinite(ageMs) || ageMs < 0) return null
    return ageMs / (1000 * 60 * 60 * 24)
  }, [coinCreatedAtMs])

  const coinAgeOk = useMemo(() => {
    if (!tokenIsValid || !zoraCoin || !isCreatorCoin) return false
    if (!coinCreatedAtMs) return false
    const ageMs = Date.now() - coinCreatedAtMs
    if (!Number.isFinite(ageMs) || ageMs < 0) return false
    return ageMs >= minCoinAgeDays * 24 * 60 * 60 * 1000
  }, [coinCreatedAtMs, isCreatorCoin, minCoinAgeDays, tokenIsValid, zoraCoin])

  const marketFloorQuery = useQuery({
    queryKey: ['cca', 'marketFloor', creatorToken],
    enabled: !!publicClient && tokenIsValid && !!zoraCoin && isCreatorCoin,
    queryFn: async () => {
      // Derive a market-based ETH floor price for the CCA:
      // - CREATOR/ZORA v4 spot tick (from the coin’s pool key)
      // - ZORA→ETH via Uniswap v3 TWAP (ZORA/WETH + ZORA/USDC+Chainlink), conservative min + discount
      return await computeMarketFloorQuote({
        publicClient: publicClient!,
        creatorCoin: creatorToken as Address,
      })
    },
    staleTime: 60_000,
    retry: 0,
  })

  const marketFloorOk = Boolean(
    marketFloorQuery.isSuccess &&
      marketFloorQuery.data &&
      typeof marketFloorQuery.data.floorPriceQ96Aligned === 'bigint' &&
      marketFloorQuery.data.floorPriceQ96Aligned > 0n,
  )

  const creatorVaultBatcherAddress = (() => {
    const v = String((CONTRACTS as any).creatorVaultBatcher ?? '')
    return isAddress(v) ? (v as Address) : null
  })()
  const creatorVaultBatcherConfigured = Boolean(creatorVaultBatcherAddress)

  const deployCodeIds = useMemo(() => {
    return {
      vault: keccak256(DEPLOY_BYTECODE.CreatorOVault as Hex),
      wrapper: keccak256(DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex),
      shareOFT: keccak256(DEPLOY_BYTECODE.CreatorShareOFT as Hex),
      gauge: keccak256(DEPLOY_BYTECODE.CreatorGaugeController as Hex),
      cca: keccak256(DEPLOY_BYTECODE.CCALaunchStrategy as Hex),
      oracle: keccak256(DEPLOY_BYTECODE.CreatorOracle as Hex),
      oftBootstrap: keccak256(DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex),
      // Newly required per-vault contracts (deployed via UniversalCreate2DeployerFromStore)
      payoutRouter: keccak256(DEPLOY_BYTECODE.PayoutRouter as Hex),
      vaultShareBurnStream: keccak256(DEPLOY_BYTECODE.VaultShareBurnStream as Hex),
      charmAlphaVaultDeploy: keccak256(DEPLOY_BYTECODE.CharmAlphaVaultDeploy as Hex),
      creatorCharmStrategy: keccak256(DEPLOY_BYTECODE.CreatorCharmStrategy as Hex),
      ajnaStrategy: keccak256(DEPLOY_BYTECODE.AjnaStrategy as Hex),
    } as const
  }, [])

  const bytecodeInfraQuery = useQuery({
    queryKey: [
      'creatorVaultBatcher',
      'bytecodeInfra',
      creatorVaultBatcherAddress,
      deployCodeIds.vault,
      deployCodeIds.wrapper,
      deployCodeIds.shareOFT,
      deployCodeIds.gauge,
      deployCodeIds.cca,
      deployCodeIds.oracle,
      deployCodeIds.oftBootstrap,
      deployCodeIds.payoutRouter,
      deployCodeIds.vaultShareBurnStream,
      deployCodeIds.charmAlphaVaultDeploy,
      deployCodeIds.creatorCharmStrategy,
      deployCodeIds.ajnaStrategy,
    ],
    enabled: Boolean(publicClient && creatorVaultBatcherAddress),
    staleTime: 60_000,
    retry: 0,
    queryFn: async () => {
      const batcher = creatorVaultBatcherAddress as Address

      const [bytecodeStore, create2Deployer] = (await Promise.all([
        publicClient!.readContract({
          address: batcher,
          abi: CREATOR_VAULT_BATCHER_ABI,
          functionName: 'bytecodeStore',
        }),
        publicClient!.readContract({
          address: batcher,
          abi: CREATOR_VAULT_BATCHER_ABI,
          functionName: 'create2Deployer',
        }),
      ])) as [Address, Address]

      const deployerStore = (await publicClient!.readContract({
        address: create2Deployer,
        abi: CREATE2_DEPLOYER_STORE_ABI,
        functionName: 'store',
      })) as Address

      if (bytecodeStore.toLowerCase() !== deployerStore.toLowerCase()) {
        throw new Error(
          `Misconfigured infra: batcher.bytecodeStore=${bytecodeStore} but create2Deployer.store=${deployerStore}`,
        )
      }

      // v2 store detection: v1 stores won't have `chunkCount(bytes32)`.
      let storeSupportsChunking = false
      try {
        await publicClient!.readContract({
          address: bytecodeStore,
          abi: UNIVERSAL_BYTECODE_STORE_CHUNKCOUNT_ABI,
          functionName: 'chunkCount',
          args: [deployCodeIds.vault],
        })
        storeSupportsChunking = true
      } catch {
        storeSupportsChunking = false
      }

      const codeEntries = [
        { key: 'oftBootstrap', label: 'OFTBootstrapRegistry', codeId: deployCodeIds.oftBootstrap },
        { key: 'shareOFT', label: 'CreatorShareOFT', codeId: deployCodeIds.shareOFT },
        { key: 'vault', label: 'CreatorOVault', codeId: deployCodeIds.vault },
        { key: 'wrapper', label: 'CreatorOVaultWrapper', codeId: deployCodeIds.wrapper },
        { key: 'gauge', label: 'CreatorGaugeController', codeId: deployCodeIds.gauge },
        { key: 'cca', label: 'CCALaunchStrategy', codeId: deployCodeIds.cca },
        { key: 'oracle', label: 'CreatorOracle', codeId: deployCodeIds.oracle },
        { key: 'vaultShareBurnStream', label: 'VaultShareBurnStream', codeId: deployCodeIds.vaultShareBurnStream },
        { key: 'payoutRouter', label: 'PayoutRouter', codeId: deployCodeIds.payoutRouter },
        { key: 'charmAlphaVaultDeploy', label: 'CharmAlphaVaultDeploy', codeId: deployCodeIds.charmAlphaVaultDeploy },
        { key: 'creatorCharmStrategy', label: 'CreatorCharmStrategy', codeId: deployCodeIds.creatorCharmStrategy },
        { key: 'ajnaStrategy', label: 'AjnaStrategy', codeId: deployCodeIds.ajnaStrategy },
      ] as const

      const pointerResults = await publicClient!.multicall({
        allowFailure: true,
        contracts: codeEntries.map((c) => ({
          address: bytecodeStore,
          abi: UNIVERSAL_BYTECODE_STORE_POINTERS_ABI,
          functionName: 'pointers',
          args: [c.codeId],
        })),
      })

      const entries = codeEntries.map((c, i) => {
        const r: any = pointerResults[i]
        const pointer = r?.status === 'success' ? (r.result as Address) : (ZERO_ADDRESS as Address)
        const ok = r?.status === 'success' && pointer !== ZERO_ADDRESS
        return { ...c, pointer, ok }
      })

      const missing = entries.filter((e) => !e.ok).map((e) => e.label)

      return {
        bytecodeStore,
        create2Deployer,
        storeSupportsChunking,
        entries,
        missing,
      }
    },
  })

  const bytecodeInfraOk = Boolean(
    creatorVaultBatcherConfigured &&
      bytecodeInfraQuery.isSuccess &&
      bytecodeInfraQuery.data &&
      bytecodeInfraQuery.data.missing.length === 0,
  )

  const bytecodeInfraBlocker = useMemo(() => {
    if (!creatorVaultBatcherConfigured) return null
    if (bytecodeInfraQuery.isFetching) return 'Checking deployment bytecode store…'
    if (bytecodeInfraQuery.isError) return (bytecodeInfraQuery.error as any)?.message || 'Deployment bytecode check failed.'
    if (!bytecodeInfraQuery.data) return 'Deployment bytecode check failed.'
    if (!bytecodeInfraQuery.data.storeSupportsChunking) {
      return 'Deployment infra uses a v1 bytecode store (no chunking). Deploy the v2 bytecode store + v2 deployer + new CreatorVaultBatcher.'
    }
    if (bytecodeInfraQuery.data.missing.length > 0) {
      return `Bytecode store is missing: ${bytecodeInfraQuery.data.missing.join(', ')}. Seed the v2 store, then retry.`
    }
    return null
  }, [
    creatorVaultBatcherConfigured,
    bytecodeInfraQuery.data,
    bytecodeInfraQuery.error,
    bytecodeInfraQuery.isError,
    bytecodeInfraQuery.isFetching,
  ])

  const minFirstDeposit = useMemo(() => {
    if (typeof resolvedTokenDecimals === 'number' && resolvedTokenDecimals >= 0) {
      return 5_000_000n * 10n ** BigInt(resolvedTokenDecimals)
    }
    return MIN_FIRST_DEPOSIT
  }, [resolvedTokenDecimals])

  const walletHasMinDeposit =
    typeof deploySenderTokenBalance === 'bigint' && deploySenderTokenBalance >= minFirstDeposit

  // Single deploy path: ERC-4337 only (no operator mode / no wallet_sendCalls / no direct tx fallbacks).
  const operatorMode = false

  const isAuthorizedDeployerOrOperator = isAuthorizedDeployer && executeBatchEligible

  const fundingGateOk = walletHasMinDeposit

  const canDeploy =
    tokenIsValid &&
    !!zoraCoin &&
    isCreatorCoin &&
    coinAgeOk &&
    marketFloorOk &&
    isAuthorizedDeployerOrOperator &&
    creatorAllowlistQuery.isSuccess &&
    passesCreatorAllowlist &&
    !!derivedShareSymbol &&
    !!derivedShareName &&
    !!derivedVaultName &&
    !!derivedVaultSymbol &&
    !!connectedWalletAddress &&
    fundingGateOk &&
    creatorVaultBatcherConfigured &&
    bytecodeInfraOk &&
    (!identity.blockingReason || executeBatchEligible)

  const vrfConsumerAddress = (CONTRACTS.vrfConsumer ?? null) as Address | null
  const vrfConsumerConfigured = isAddress(String(vrfConsumerAddress ?? ''))
  const allowlistReady = allowlistMode === 'disabled' ? true : isAllowlistedCreator
  const creatorCoinReady = tokenIsValid && !!zoraCoin && isCreatorCoin
  const coinAgeReady = creatorCoinReady && coinAgeOk
  const fundingReady = fundingGateOk
  const authReady = isAuthorizedDeployerOrOperator

  const firstLaunchChecklist = [
    {
      label: 'CreatorVaultBatcher configured',
      ok: creatorVaultBatcherConfigured,
      hint: creatorVaultBatcherConfigured && creatorVaultBatcherAddress ? shortAddress(creatorVaultBatcherAddress) : 'missing',
    },
    {
      label: 'Deployment bytecode ready',
      ok: bytecodeInfraOk,
      hint: !creatorVaultBatcherConfigured
        ? 'missing'
        : bytecodeInfraQuery.isFetching
          ? 'checking'
          : bytecodeInfraQuery.isError
            ? 'error'
            : bytecodeInfraOk
              ? 'ok'
              : bytecodeInfraQuery.data?.storeSupportsChunking
                ? 'missing code'
                : 'needs v2 store',
    },
    {
      label: 'Smart wallet (ERC-4337) ready',
      ok: smartWalletPreflightOk,
      hint: smartWalletPreflightOk ? 'EntryPoint v0.6' : 'no EntryPoint',
    },
    {
      label: 'EntryPoint v0.6 deployed',
      ok: entryPointV06Ready,
      hint: entryPointBytecodeQuery.isFetching
        ? 'checking'
        : entryPointV06Ready
          ? shortAddress(COINBASE_ENTRYPOINT_V06)
          : 'no bytecode',
    },
    {
      label: 'Paymaster configured',
      ok: paymasterStatus.ok,
      hint: paymasterStatus.hint,
    },
    {
      label: 'VRF consumer configured',
      ok: vrfConsumerConfigured,
      hint: vrfConsumerConfigured && vrfConsumerAddress ? shortAddress(vrfConsumerAddress) : 'missing',
    },
    {
      label: 'Allowlist status',
      ok: allowlistReady,
      hint: allowlistMode === 'disabled' ? 'disabled' : isAllowlistedCreator ? 'allowed' : 'blocked',
    },
    {
      label: 'Creator coin detected',
      ok: creatorCoinReady,
      hint: creatorCoinReady ? (underlyingSymbolUpper || 'ok') : tokenIsValid ? 'not a creator coin' : 'invalid token',
    },
    {
      label: `Coin age ≥ ${minCoinAgeDays}d`,
      ok: coinAgeReady,
      hint:
        coinAgeDays !== null
          ? `${coinAgeDays.toFixed(1)}d`
          : typeof zoraCoin?.createdAt === 'string' && zoraCoin.createdAt.trim().length > 0
            ? 'invalid createdAt'
            : 'missing',
    },
    {
      label: 'Authorized + funded',
      ok: authReady && fundingReady,
      hint: authReady
        ? fundingReady
          ? 'ready'
          : `needs 5,000,000 ${underlyingSymbolUpper || 'TOKENS'}`
        : 'not authorized',
    },
    {
      label: 'Market floor price',
      ok: marketFloorOk,
      hint: marketFloorQuery.isFetching
        ? 'computing'
        : marketFloorQuery.isError
          ? 'error'
          : marketFloorQuery.data?.weiPerToken
            ? `${Number(formatUnits(marketFloorQuery.data.weiPerToken, 18)).toFixed(6)} ETH`
            : 'missing',
    },
    {
      label: 'Ready to deploy',
      ok: canDeploy,
      hint: canDeploy ? 'ready' : 'missing requirements',
    },
  ] as const

  const deployBlocker =
    !tokenIsValid
      ? 'Enter a creator coin address to continue.'
      : tokenIsValid && !zoraCoin
        ? 'Token is not a Zora Creator Coin.'
        : tokenIsValid && zoraCoin && !isCreatorCoin
          ? 'Only Creator Coins can deploy a vault.'
          : tokenIsValid && zoraCoin && isCreatorCoin && !coinAgeOk
            ? `Creator Coin must be at least ${minCoinAgeDays} days old to deploy.`
          : creatorAllowlistQuery.isLoading
            ? 'Checking creator access…'
            : creatorAllowlistQuery.isError
              ? 'Creator access check failed.'
              : allowlistEnforced && !isAllowlistedCreator
                ? 'Creator access required.'
                : !creatorVaultBatcherConfigured
                  ? 'Deployment not configured (missing CreatorVaultBatcher).'
                  : !isAuthorizedDeployerOrOperator
                    ? 'Connect the creator or payout recipient wallet.'
                    : !fundingGateOk
                      ? `Needs 5,000,000 ${underlyingSymbolUpper || 'TOKENS'} to deploy.`
                      : identity.blockingReason && !executeBatchEligible
                        ? identity.blockingReason
                    : bytecodeInfraQuery.isFetching
                      ? 'Checking deployment bytecode store…'
                      : bytecodeInfraQuery.isError
                        ? (bytecodeInfraQuery.error as any)?.message || 'Deployment bytecode check failed.'
                        : !bytecodeInfraOk
                          ? bytecodeInfraBlocker || 'Deployment infra is not ready.'
                        : marketFloorQuery.isFetching
                          ? 'Computing market floor price…'
                          : marketFloorQuery.isError
                            ? (marketFloorQuery.error as any)?.message || 'Could not compute market floor price.'
                            : !marketFloorOk
                              ? 'Market floor price is required to deploy.'
                              : null

  return (
    <div className="relative">
      <section className="cinematic-section">
        <div className="max-w-3xl mx-auto px-6">
          <div className="space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-2">
                <span className="label">Deploy</span>
                <h1 className="headline text-4xl sm:text-6xl">Deploy Vault</h1>
                <p className="text-zinc-600 text-sm font-light">
                  Deploy a vault for your Creator Coin on Base. Only the creator or current payout recipient can deploy.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-900/70 bg-black/40 px-3 py-1 text-[10px] text-zinc-400">
                <img src="/protocols/base.png" alt="" aria-hidden="true" loading="lazy" className="w-3.5 h-3.5 opacity-90" />
                Base
              </div>
            </div>

            {isAdmin ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-wide text-amber-200">Launch checklist (admin)</div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span>Min coin age (days)</span>
                    <input
                      type="number"
                      min={0}
                      max={3650}
                      step={1}
                      value={minCoinAgeDays}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        if (!Number.isFinite(n)) return
                        const clamped = Math.max(0, Math.min(3650, Math.floor(n)))
                        setMinCoinAgeDays(clamped)
                      }}
                      className="w-16 bg-black/30 border border-zinc-900/70 rounded-md px-2 py-1 text-zinc-200 font-mono text-[11px] outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1 text-xs text-zinc-300">
                  {firstLaunchChecklist.map((item) => (
                    <div key={item.label} className="flex items-start gap-2">
                      <span className={`mt-[5px] h-1.5 w-1.5 rounded-full ${item.ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <span>{item.label}</span>
                        {item.hint ? (
                          <span className="ml-2 text-[11px] text-zinc-500 font-mono">{item.hint}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Review */}
            {tokenIsValid && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="overflow-hidden"
              >
                {symbolLoading || zoraLoading ? (
                  <div className="text-sm text-zinc-600">Loading coin details…</div>
                ) : !zoraCoin ? (
                  <div className="text-sm text-red-400/80">
                    This token does not appear to be a Zora Coin. Creator Vaults can only be created for Zora{' '}
                    <span className="text-zinc-200">Creator Coins</span>.
                  </div>
                ) : baseSymbol ? (
                  <div className="card rounded-xl p-8 space-y-6">
                    {/* Token card */}
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex items-center gap-4 min-w-0">
                        {zoraCoin?.mediaContent?.previewImage?.medium ? (
                          <img
                            src={zoraCoin.mediaContent.previewImage.medium}
                            alt={zoraCoin.symbol ? String(zoraCoin.symbol) : 'Coin'}
                            className="w-14 h-14 rounded-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-primary/20 to-brand-accent/20 flex items-center justify-center text-sm font-medium text-brand-accent">
                            {String(baseSymbol).slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="text-white font-light text-xl">
                            {zoraCoin?.name
                              ? String(zoraCoin.name)
                              : tokenName
                                ? String(tokenName)
                                : String(baseSymbol)}
                            {baseSymbol ? (
                              <span className="text-zinc-500"> ({`$${String(baseSymbol)}`})</span>
                            ) : null}
                          </div>
                          <div className="text-xs text-zinc-600 font-mono mt-1">{String(creatorToken)}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-medium ${coinTypePillClass}`}>
                          {coinTypeLabel}
                        </span>
                      </div>
                    </div>

                    {/* Key rows */}
                    <div className="space-y-0">
                      {payoutRecipient && (
                        <div className="data-row">
                          <div className="label">Payout recipient</div>
                          <div className="text-xs text-zinc-300 font-mono">{shortAddress(payoutRecipient)}</div>
                        </div>
                      )}

                      <div className="data-row">
                        <div className="label">Chain</div>
                        <div className="text-xs text-zinc-300 inline-flex items-center gap-2">
                          <img
                            src="/protocols/base.png"
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            className="w-3.5 h-3.5 opacity-90"
                          />
                          Base
                        </div>
                      </div>
                    </div>

                    {String(zoraCoin?.coinType ?? '').toUpperCase() === 'CONTENT' && (
                      <div className="text-xs text-amber-300/90 pt-4 border-t border-zinc-900/50">
                        This is a <span className="font-mono">Content Coin</span>. Creator Vaults can only be created for{' '}
                        <span className="font-mono">Creator Coins</span>.
                      </div>
                    )}

                    {isConnected && zoraCoin?.creatorAddress && !isAuthorizedDeployerOrOperator && (
                      <div className="text-xs text-red-400/90">
                        You are connected as{' '}
                        <span className="font-mono">
                          {address?.slice(0, 6)}…{address?.slice(-4)}
                        </span>
                        . Only the coin creator or current payout recipient can deploy this vault.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-red-400/80">Could not read token. Is this a valid ERC-20?</div>
                )}
              </motion.div>
            )}

            {/* Essentials */}
            <div className="card rounded-xl p-6 space-y-6">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-1">
                  <div className="label">Launch</div>
                  <div className="text-xs text-zinc-600">Minimal launch details for your Creator Coin.</div>
                </div>
                {isConnected ? (
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    {showAdvanced ? 'Hide details' : 'Details'}
                  </button>
                ) : null}
              </div>

              {!isConnected ? (
                <div className="space-y-3">
                  <div className="label">Wallet</div>
                  <ConnectButton />
                </div>
              ) : null}

              {/* Creator Coin */}
              <div className="space-y-2">
                <label className="label">Creator Coin</label>

                {miniApp.isMiniApp && farcasterAuth.status !== 'verified' && farcasterAuth.canSiwf !== false ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] text-zinc-600">
                      Verify Farcaster to enable Mini App autofill.
                    </div>
                    <button
                      type="button"
                      onClick={() => void farcasterAuth.signIn()}
                      disabled={farcasterAuth.status === 'loading'}
                      className="text-[10px] text-zinc-600 hover:text-zinc-200 transition-colors disabled:opacity-60"
                      title="Requests a Sign in With Farcaster credential (no transaction)"
                    >
                      {farcasterAuth.status === 'loading' ? 'Verifying…' : 'Verify'}
                    </button>
                  </div>
                ) : null}
                {miniApp.isMiniApp && farcasterAuth.status === 'error' && farcasterAuth.error ? (
                  <div className="text-[11px] text-red-400/80">{farcasterAuth.error}</div>
                ) : null}

                {!isConnected ? (
                  tokenIsValid ? (
                    <input
                      value={creatorToken}
                      disabled
                      className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                    />
                  ) : (
                    <>
                      <input
                        value=""
                        disabled
                        placeholder="Connect wallet to detect your creator coin"
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                      />
                      <div className="text-xs text-zinc-600">Connect your wallet to continue.</div>
                    </>
                  )
                ) : !showAdvanced ? (
                  tokenIsValid ? (
                    <>
                      <input
                        value={creatorToken}
                        disabled
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                      />
                      <div className="text-xs text-zinc-600">
                        {detectedCreatorCoin &&
                        creatorToken.toLowerCase() === detectedCreatorCoin.toLowerCase()
                          ? 'Prefilled for this wallet.'
                          : prefillToken
                            ? 'Set from a link.'
                            : 'Set manually.'}
                      </div>
                    </>
                  ) : detectedCreatorCoin ? (
                    <>
                      <input
                        value={detectedCreatorCoin}
                        disabled
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                      />
                      <div className="text-xs text-zinc-600">Prefilled for this wallet.</div>
                    </>
                  ) : myProfileQuery.isLoading || myProfileQuery.isFetching ? (
                    <>
                      <input
                        value=""
                        disabled
                        placeholder="Detecting your creator coin…"
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                      />
                      <div className="text-xs text-zinc-600">If you don’t have a Creator Coin yet, you won’t be able to deploy a vault.</div>
                    </>
                  ) : (
                    <>
                      <input
                        value=""
                        disabled
                        placeholder="No creator coin detected for this wallet"
                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 placeholder:text-zinc-700 outline-none font-mono opacity-70 cursor-not-allowed"
                      />
                      <div className="text-xs text-zinc-600">Open Details if you need to paste a coin address.</div>
                    </>
                  )
                ) : (
                  <>
                    <div className="text-xs text-zinc-600">
                      Paste a Creator Coin address if you want to deploy a different coin.
                    </div>
                    <input
                      value={creatorToken}
                      onChange={(e) => setCreatorToken(e.target.value)}
                      placeholder="0x..."
                      className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-cyan-500/50 transition-colors font-mono"
                    />
                    {isConnected && detectedCreatorCoin ? (
                      <button
                        type="button"
                        onClick={() => setCreatorToken(detectedCreatorCoin)}
                        className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
                      >
                        Use my coin
                      </button>
                    ) : null}
                  </>
                )}
              </div>

              {/* Details */}
              {isConnected && showAdvanced ? (
                <div className="pt-3 border-t border-zinc-900/50 space-y-4">
                  <div className="space-y-2">
                    <div className="label">Deployment</div>
                    <div className="text-[10px] text-zinc-700">
                      {deploymentVersion === 'v3' ? 'Default (v3)' : deploymentVersion === 'v2' ? 'Alt (v2)' : 'Legacy (v1)'}
                    </div>

                    {isAdmin ? (
                      <div className="inline-flex rounded-lg border border-zinc-900/60 bg-black/30 p-1 gap-1">
                        <button
                          type="button"
                          onClick={() => setDeploymentVersion('v3')}
                          className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${
                            deploymentVersion === 'v3'
                              ? 'bg-white/[0.06] text-zinc-100'
                              : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]'
                          }`}
                          title="Default deterministic addresses (v3). Fresh namespace to avoid collisions with earlier deploy attempts."
                        >
                          v3
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeploymentVersion('v2')}
                          className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${
                            deploymentVersion === 'v2'
                              ? 'bg-white/[0.06] text-zinc-100'
                              : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]'
                          }`}
                          title="Alternative deterministic addresses (v2)."
                        >
                          v2
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeploymentVersion('v1')}
                          className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${
                            deploymentVersion === 'v1'
                              ? 'bg-white/[0.06] text-zinc-100'
                              : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]'
                          }`}
                          title="Legacy deterministic addresses (v1). Admin-only."
                        >
                          v1 (admin)
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-600">Using v3 (default). Legacy v1 is admin-only.</div>
                    )}

                    <div className="text-xs text-zinc-600">
                      v3 uses a fresh deterministic address namespace to avoid collisions with earlier deployments. v2 is kept as an alternative.
                    </div>

                    {!isSignedIn ? (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => void signIn()}
                          disabled={authBusy}
                          className="text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-60"
                          title="Admin sign-in unlocks legacy v1 controls if your wallet is allowlisted."
                        >
                          {authBusy ? 'Signing in…' : 'Admin sign-in (optional)'}
                        </button>
                        {authError ? <div className="text-[11px] text-red-400/90 mt-1">{authError}</div> : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="text-xs text-zinc-600">
                    Allowlist:{' '}
                    <span className="text-zinc-300">
                      {allowlistMode === 'disabled' ? 'disabled' : isAllowlistedCreator ? 'allowed' : 'blocked'}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Smart Wallet Requirement */}
              {isConnected && showAdvanced ? (
                <div className="pt-3 border-t border-zinc-900/50 space-y-4">
                  <div>
                    <div className="label mb-2">Your Smart Wallet</div>

                    {smartWalletConnectionHint && coinSmartWallet ? (
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                        <div className="text-amber-300/90 text-sm font-medium">Coin is owned by a Smart Wallet</div>
                        <div className="text-amber-300/70 text-xs leading-relaxed space-y-2">
                          <div>
                            Coin owner (smart wallet): <span className="text-white font-mono">{shortAddress(coinSmartWallet as string)}</span>
                          </div>
                          <div>
                            You’re connected via <span className="text-white font-mono">{smartWalletConnectionHint.connectorName}</span> as{' '}
                            <span className="text-white font-mono">{shortAddress(String(address ?? ''))}</span>.
                          </div>
                          {smartWalletOwnerQuery.data === true ? (
                            <div className="text-emerald-300/90 text-xs">
                              Owner verified — you can deploy while staying connected to this wallet. Deployment will execute through the smart wallet.
                            </div>
                          ) : smartWalletOwnerQuery.isLoading ? (
                            <div className="text-amber-300/70 text-xs">Verifying onchain ownership…</div>
                          ) : null}
                          <div>
                            To deploy, you must connect with an <span className="text-white">onchain owner</span> of the coin owner wallet.
                            Connecting “Coinbase Smart Wallet” may show a different smart wallet address if you’re in a different Coinbase account.
                          </div>
                        </div>
                        {coinbaseSmartWalletConnector ? (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                disconnect()
                              } catch {
                                // ignore
                              }
                              connect({ connector: coinbaseSmartWalletConnector })
                            }}
                            className="btn-accent w-full"
                          >
                            Connect Coinbase Smart Wallet (recommended)
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="text-xs text-zinc-600 space-y-3">
                      <div>
                        {executeBatchEligible ? (
                          <>
                            You’re an onchain owner of the creator smart wallet. Deploy will execute <span className="text-white">through</span> it.
                            If the smart wallet is underfunded, we’ll pull the shortfall from your connected wallet via Permit2 (one-time approval).
                          </>
                        ) : (
                          <>
                            Deployment executes onchain from your <span className="text-white">connected wallet</span>. It must hold the first{' '}
                            <span className="text-white font-medium">5,000,000 {underlyingSymbolUpper || 'TOKENS'}</span> deposit.
                          </>
                        )}
                      </div>

                      {tokenIsValid ? (
                        <div className="flex items-center justify-between text-sm p-3 bg-black/40 border border-zinc-800 rounded-lg">
                          <span className="text-zinc-500">Creator smart wallet balance:</span>
                          <span className={walletHasMinDeposit ? 'text-emerald-400 font-medium' : 'text-amber-300/90 font-medium'}>
                            {formatToken18(typeof deploySenderTokenBalance === 'bigint' ? deploySenderTokenBalance : undefined)}{' '}
                            {underlyingSymbolUpper || 'TOKENS'}
                          </span>
                        </div>
                      ) : null}

                      <div className="text-[11px] text-zinc-700">
                        After deployment: the Vault is owned by your canonical identity wallet; protocol-owned components handle shared ops (hooks, auction wiring, fee routing).
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

            {/* Deploy */}
            <div className="card rounded-xl p-8 space-y-4">
              <div className="label">Deploy</div>

              {showAdvanced && isConnected && tokenIsValid && zoraCoin && canonicalIdentityAddress && connectedWalletAddress ? (
                <div className="rounded-lg border border-white/5 bg-black/20 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[11px] text-zinc-500">Canonical identity</div>
                    <div className="text-[11px] font-mono text-zinc-200">{shortAddress(String(canonicalIdentityAddress))}</div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[11px] text-zinc-500">Identity source</div>
                    <div className="text-[11px] text-zinc-400">{identitySourceLabel(String(identity.canonicalIdentity.source))}</div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[11px] text-zinc-500">Execution wallet</div>
                    <div className="text-[11px] font-mono text-zinc-200">{shortAddress(String(connectedWalletAddress))}</div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[11px] text-zinc-500">Deploy path</div>
                    <div className="text-[11px] text-zinc-300">
                      {executeBatchEligible ? 'ERC-4337 Smart Wallet' : '—'}
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-700">
                    Vault ownership will be set to the canonical identity. Your connected wallet only executes the transaction.
                  </div>
                </div>
              ) : null}

              {isConnected && showAdvanced && !isSignedIn ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                  <div className="text-amber-300/90 text-sm font-medium">Sign-in required (paymaster)</div>
                  <div className="text-amber-300/70 text-xs leading-relaxed">
                    Deploy uses sponsored ERC‑4337 UserOperations. Sign-in is required so our paymaster can validate and sponsor the calls.
                  </div>
                  <button
                    type="button"
                    onClick={() => void signIn()}
                    disabled={authBusy}
                    className="btn-accent w-full"
                  >
                    {authBusy ? 'Signing in…' : 'Sign in'}
                  </button>
                </div>
              ) : null}

              {!isConnected ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Connect wallet to deploy
                </button>
              ) : !tokenIsValid && creatorAllowlistQuery.isLoading ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Checking creator access…
                </button>
              ) : !tokenIsValid && creatorAllowlistQuery.isError ? (
                <RequestCreatorAccess />
              ) : !tokenIsValid && allowlistEnforced && !isAllowlistedCreator ? (
                <RequestCreatorAccess />
              ) : tokenIsValid && zoraCoin && String(zoraCoin.coinType ?? '').toUpperCase() !== 'CREATOR' ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Not eligible: vaults are Creator Coin–only
                </button>
              ) : tokenIsValid && (symbolLoading || zoraLoading) ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Loading…
                </button>
              ) : tokenIsValid && zoraCoin && !isAuthorizedDeployerOrOperator ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  {coinSmartWallet ? (
                    smartWalletOwnerQuery.isLoading ? (
                      'Verifying owner authorization…'
                    ) : (
                      operatorMode
                        ? 'Authorized only: connect the canonical identity wallet (or an onchain owner of the identity smart wallet).'
                        : 'Authorized only: connect the coin’s creator/payout wallet (or an owner wallet for the coin owner address).'
                    )
                  ) : (
                    operatorMode
                      ? 'Authorized only: connect the canonical identity wallet (or an onchain owner of the identity smart wallet).'
                      : 'Authorized only: connect the coin’s creator or payout recipient wallet to deploy'
                  )}
                </button>
              ) : tokenIsValid && zoraCoin && identity.blockingReason && !executeBatchEligible ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                  <div className="text-amber-300/90 text-sm font-medium">Identity mismatch</div>
                  <div className="text-amber-300/70 text-xs leading-relaxed">{identity.blockingReason}</div>
                  <div className="pt-2 space-y-2">
                    <div className="text-[11px] text-amber-300/70">
                      Connect an owner EOA of the creator smart wallet (ERC‑4337 sender) to continue.
                    </div>
                    {farcasterVerifiedEthAddresses.length > 0 ? (
                      <div className="text-[11px] text-amber-300/70">
                        Verified wallets (Farcaster, suggestion-only):{' '}
                        <span className="font-mono text-amber-200">
                          {farcasterVerifiedEthAddresses.map((a) => shortAddress(a)).join(', ')}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : tokenIsValid && zoraCoin && creatorAllowlistQuery.isLoading ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Checking creator access…
                </button>
              ) : tokenIsValid && zoraCoin && creatorAllowlistQuery.isError ? (
                <RequestCreatorAccess coin={creatorToken} />
              ) : tokenIsValid && zoraCoin && allowlistEnforced && !isAllowlistedCreator ? (
                <RequestCreatorAccess coin={creatorToken} />
              ) : tokenIsValid && zoraCoin && !creatorVaultBatcherConfigured ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Deployment is not configured (missing CreatorVaultBatcher address)
                </button>
              ) : tokenIsValid && zoraCoin && !walletHasMinDeposit ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  {`Creator smart wallet needs 5,000,000 ${underlyingSymbolUpper || 'TOKENS'} to deploy & launch`}
                </button>
              ) : canDeploy ? (
                <>
                  {tokenIsValid && zoraCoin && identity.warnings.includes('CUSTODY_MISMATCH') && farcasterCustodyAddress ? (
                    <div className="text-[11px] text-amber-300/80">
                      Farcaster custody wallet{' '}
                      <span className="font-mono text-amber-200">{shortAddress(farcasterCustodyAddress)}</span> does not match the coin’s
                      canonical identity{' '}
                      <span className="font-mono text-amber-200">
                        {shortAddress(identity.canonicalIdentity.address as Address)}
                      </span>
                      . This does not block deploy, but double-check you’re using the intended identity.
                    </div>
                  ) : null}

                  <DeployVaultBatcher
                    creatorToken={creatorToken as Address}
                    owner={(coinSmartWallet ?? identity.canonicalIdentity.address) as Address}
                    connectorId={String((connector as any)?.id ?? '')}
                    executeBatchEligible={executeBatchEligible}
                    isSignedIn={isSignedIn}
                    minFirstDeposit={minFirstDeposit}
                    tokenDecimals={typeof tokenDecimals === 'number' ? tokenDecimals : null}
                    depositSymbol={underlyingSymbolUpper || 'TOKENS'}
                    shareSymbol={derivedShareSymbol}
                    shareName={derivedShareName}
                    vaultSymbol={derivedVaultSymbol}
                    vaultName={derivedVaultName}
                    deploymentVersion={deploymentVersion}
                    currentPayoutRecipient={payoutRecipient}
                    floorPriceQ96Aligned={marketFloorQuery.data?.floorPriceQ96Aligned ?? null}
                    marketFloorTwapDurationSec={marketFloorQuery.data?.creatorZora.durationSec ?? null}
                    marketFloorDiscountBps={marketFloorQuery.data?.zoraEth.discountBps ?? null}
                    onSuccess={() => {}}
                  />
                </>
              ) : (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  {deployBlocker || 'Enter token address to continue'}
                </button>
              )}

              {!canDeploy && deployBlocker ? (
                <div className="text-xs text-amber-300/80">{deployBlocker}</div>
              ) : null}

              <div className="text-xs text-zinc-600">
                Requires a 5,000,000 {underlyingSymbolUpper || 'TOKENS'} deposit. Some wallets may prompt multiple confirmations.
              </div>
            </div>

            {/* Contracts (details) */}
            {showAdvanced ? (
              <details className="card rounded-xl p-8">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none">
                  <div className="label">Contracts</div>
                  <div className="text-[10px] text-zinc-600">View</div>
                </summary>

              <div className="mt-6 rounded-2xl border border-white/5 bg-[#080808]/60 backdrop-blur-2xl overflow-hidden divide-y divide-white/5">
                <div className="px-4 py-2 text-[10px] uppercase tracking-wide text-zinc-500 bg-white/[0.02]">
                  Core stack
                </div>

                <ExplainerRow
                  icon={
                    <div className="w-14 h-14 rounded-full bg-black/30 border border-white/5 shadow-[inset_0_0_24px_rgba(0,0,0,0.9)] flex items-center justify-center text-zinc-500">
                      <Lock className="w-5 h-5" />
                    </div>
                  }
                  label="Vault token"
                  title={`${derivedVaultName || '—'} (${derivedVaultSymbol || '—'})`}
                  contractName="CreatorOVault"
                  note="Core vault that holds creator coin deposits and mints shares."
                  metaLine={
                    <>
                      <span className="font-mono text-zinc-400">ERC-4626</span>
                      {' · '}
                      <span className="inline-flex items-center gap-1.5 text-zinc-400">
                        <img
                          src="/protocols/layerzero.svg"
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="w-3.5 h-3.5 opacity-90"
                        />
                        LayerZero
                      </span>
                      {' · '}
                      <span className="inline-flex items-center gap-1.5 text-zinc-400">
                        <img
                          src="/protocols/yearn.svg"
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="w-3.5 h-3.5 opacity-90"
                        />
                        Yearn v3
                      </span>
                    </>
                  }
                />

                <ExplainerRow
                  icon={
                    tokenIsValid ? (
                      <DerivedTokenIcon
                        tokenAddress={creatorToken as `0x${string}`}
                        symbol={underlyingSymbolUpper || 'TOKEN'}
                        variant="share"
                        size="lg"
                      />
                    ) : null
                  }
                  label="Share token"
                  title={`${derivedShareName || '—'} (${derivedShareSymbol || '—'})`}
                  contractName="CreatorShareOFT"
                  note="Wrapped vault shares token (■TOKEN) used for routing fees."
                  metaLine={
                    <>
                      <span className="inline-flex items-center gap-1.5 text-zinc-400">
                        <img
                          src="/protocols/layerzero.svg"
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="w-3.5 h-3.5 opacity-90"
                        />
                        LayerZero OFT
                      </span>
                    </>
                  }
                />

                <ExplainerRow
                  icon={
                    <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                      <Layers className="w-4 h-4" />
                    </div>
                  }
                  label="Wrapper"
                  title="Vault Wrapper"
                  contractName="CreatorOVaultWrapper"
                  note="Wraps/unlocks vault shares into ■TOKEN."
                />

                <ExplainerRow
                  icon={
                    <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                  }
                  label="Gauge controller"
                  title="Fees & incentives"
                  contractName="CreatorGaugeController"
                  note="Routes fees (burn / lottery / voters) and manages gauges."
                />

                <ExplainerRow
                  icon={
                    <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                      <Rocket className="w-4 h-4" />
                    </div>
                  }
                  label="Launch strategy"
                  title={
                    <a
                      href="https://cca.uniswap.org"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block max-w-full hover:text-white transition-colors underline underline-offset-4 decoration-white/15 hover:decoration-white/30"
                      title="Open cca.uniswap.org"
                    >
                      Uniswap Continuous Clearing Auction
                    </a>
                  }
                  contractName="CCALaunchStrategy"
                  note="Runs Uniswap’s Continuous Clearing Auction (CCA) for fair price discovery."
                  metaLine={
                    <>
                      <span className="inline-flex items-center gap-1.5 text-zinc-400">
                        <img
                          src="/protocols/uniswap.png"
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="w-3.5 h-3.5 opacity-90"
                        />
                        Uniswap
                      </span>
                    </>
                  }
                />

                <ExplainerRow
                  icon={
                    <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  }
                  label="Oracle"
                  title="Price oracle"
                  contractName="CreatorOracle"
                  note="Price oracle used by the auction and strategies."
                  metaLine={
                    <>
                      <span className="inline-flex items-center gap-1.5 text-zinc-400">
                        <img
                          src="/protocols/chainlink.svg"
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="w-3.5 h-3.5 opacity-90"
                        />
                        Chainlink
                      </span>
                    </>
                  }
                />

                <div className="px-4 py-2 text-[10px] uppercase tracking-wide text-zinc-500 bg-white/[0.02]">
                  Yield strategies (post-auction)
                </div>
                <div className="px-4 py-3 text-[12px] text-zinc-500">
                  Yield strategies are deployed after launch (post-auction) to keep the initial deployment deterministic and compatible with wallet
                  simulation.
                </div>
              </div>
              </details>
            ) : null}
          </div>
        </div>
      </div>
      </section>
    </div>
  )
}
