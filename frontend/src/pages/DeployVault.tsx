import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useAccount, useConnect, useDisconnect, usePublicClient, useReadContract, useWalletClient } from 'wagmi'
import { useSendCalls } from 'wagmi/experimental'
import { base } from 'wagmi/chains'
import type { Address, Hex } from 'viem'
import {
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  erc20Abi,
  formatUnits,
  getCreate2Address,
  hashTypedData,
  isAddress,
  keccak256,
  parseAbiParameters,
} from 'viem'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { coinABI } from '@zoralabs/protocol-deployments'
import { BarChart3, Layers, Lock, Rocket, ShieldCheck } from 'lucide-react'
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
import {
  normalizeUnderlyingSymbol,
  toShareName,
  toShareSymbol,
  toVaultName,
  toVaultSymbol,
  underlyingSymbolUpper as deriveUnderlyingUpper,
} from '@/lib/tokenSymbols'
import {
  buildDeployAuthorizationTypedData,
  computeDeployParamsHash as computeParamsHashFromLib,
  fetchDeployNonce,
  preflightErc1271Signature,
} from '@/lib/deploy/deployAuthorization'
import { appendPermit2SignatureType, buildPermit2PermitTransferFrom } from '@/lib/deploy/permit2'

const MIN_FIRST_DEPOSIT = 50_000_000n * 10n ** 18n
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

// Uniswap CCA uses Q96 fixed-point prices + a compact step schedule.
const Q96 = 2n ** 96n
const DEFAULT_FLOOR_PRICE_ETH_WEI_PER_TOKEN = 1_000_000_000_000_000n // 0.001 ETH / token
const DEFAULT_FLOOR_PRICE_Q96 = (DEFAULT_FLOOR_PRICE_ETH_WEI_PER_TOKEN * Q96) / 10n ** 18n
const DEFAULT_TICK_SPACING_Q96_RAW = DEFAULT_FLOOR_PRICE_Q96 / 100n
const DEFAULT_TICK_SPACING_Q96 = DEFAULT_TICK_SPACING_Q96_RAW > 1n ? DEFAULT_TICK_SPACING_Q96_RAW : 2n
const DEFAULT_FLOOR_PRICE_Q96_ALIGNED = (DEFAULT_FLOOR_PRICE_Q96 / DEFAULT_TICK_SPACING_Q96) * DEFAULT_TICK_SPACING_Q96
const DEFAULT_REQUIRED_RAISE_WEI = 100_000_000_000_000_000n // 0.1 ETH
const DEFAULT_AUCTION_PERCENT = 50
const DEFAULT_CCA_DURATION_BLOCKS = 302_400n // ~7 days on Base at ~2s blocks (must match CCALaunchStrategy defaultDuration)

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

type DeployAuthorization = {
  owner: Address
  operator: Address
  leftoverRecipient: Address
  fundingModel: 0 | 1
  paramsHash: Hex
  nonce: bigint
  deadline: bigint
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

const COINBASE_ENTRYPOINT_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as const

const COINBASE_SMART_WALLET_EXECUTE_BATCH_ABI = [
  {
    type: 'function',
    name: 'executeBatch',
    stateMutability: 'payable',
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

const COIN_PAYOUT_RECIPIENT_ABI = [
  {
    type: 'function',
    name: 'setPayoutRecipient',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newPayoutRecipient', type: 'address' }],
    outputs: [],
  },
] as const

const PERMIT2_VIEW_ABI = [
  {
    type: 'function',
    name: 'nonceBitmap',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'wordPos', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

const PERMIT2_SIGNATURE_TRANSFER_ABI = [
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

const CREATOR_VAULT_BATCHER_ABI = [
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
    name: 'deployAndLaunch',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'creatorToken', type: 'address' },
      { name: 'owner', type: 'address' },
      { name: 'creatorTreasury', type: 'address' },
      { name: 'payoutRecipient', type: 'address' },
      { name: 'vaultName', type: 'string' },
      { name: 'vaultSymbol', type: 'string' },
      { name: 'shareName', type: 'string' },
      { name: 'shareSymbol', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'depositAmount', type: 'uint256' },
      { name: 'auctionPercent', type: 'uint8' },
      { name: 'requiredRaise', type: 'uint128' },
      { name: 'floorPriceQ96', type: 'uint256' },
      { name: 'auctionSteps', type: 'bytes' },
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
        name: 'result',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
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
    name: 'deployAndLaunchWithPermit2',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'creatorToken', type: 'address' },
      { name: 'owner', type: 'address' },
      { name: 'creatorTreasury', type: 'address' },
      { name: 'payoutRecipient', type: 'address' },
      { name: 'vaultName', type: 'string' },
      { name: 'vaultSymbol', type: 'string' },
      { name: 'shareName', type: 'string' },
      { name: 'shareSymbol', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'depositAmount', type: 'uint256' },
      { name: 'auctionPercent', type: 'uint8' },
      { name: 'requiredRaise', type: 'uint128' },
      { name: 'floorPriceQ96', type: 'uint256' },
      { name: 'auctionSteps', type: 'bytes' },
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
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [
      {
        name: 'result',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
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
    name: 'deployNonces',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'deployAndLaunchWithPermit2AsOperatorIdentityFunded',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'creatorToken', type: 'address' },
      { name: 'owner', type: 'address' },
      { name: 'creatorTreasury', type: 'address' },
      { name: 'payoutRecipient', type: 'address' },
      { name: 'vaultName', type: 'string' },
      { name: 'vaultSymbol', type: 'string' },
      { name: 'shareName', type: 'string' },
      { name: 'shareSymbol', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'depositAmount', type: 'uint256' },
      { name: 'auctionPercent', type: 'uint8' },
      { name: 'requiredRaise', type: 'uint128' },
      { name: 'floorPriceQ96', type: 'uint256' },
      { name: 'auctionSteps', type: 'bytes' },
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
        name: 'auth',
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'operator', type: 'address' },
          { name: 'leftoverRecipient', type: 'address' },
          { name: 'fundingModel', type: 'uint8' },
          { name: 'paramsHash', type: 'bytes32' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { name: 'authSig', type: 'bytes' },
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
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [
      {
        name: 'result',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
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
    name: 'deployAndLaunchWithPermit2AsOperatorOperatorFunded',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'creatorToken', type: 'address' },
      { name: 'owner', type: 'address' },
      { name: 'creatorTreasury', type: 'address' },
      { name: 'payoutRecipient', type: 'address' },
      { name: 'vaultName', type: 'string' },
      { name: 'vaultSymbol', type: 'string' },
      { name: 'shareName', type: 'string' },
      { name: 'shareSymbol', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'depositAmount', type: 'uint256' },
      { name: 'auctionPercent', type: 'uint8' },
      { name: 'requiredRaise', type: 'uint128' },
      { name: 'floorPriceQ96', type: 'uint256' },
      { name: 'auctionSteps', type: 'bytes' },
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
        name: 'auth',
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'operator', type: 'address' },
          { name: 'leftoverRecipient', type: 'address' },
          { name: 'fundingModel', type: 'uint8' },
          { name: 'paramsHash', type: 'bytes32' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { name: 'authSig', type: 'bytes' },
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
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [
      {
        name: 'result',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'auction', type: 'address' },
        ],
      },
    ],
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

function DeployVaultBatcher({
  creatorToken,
  owner,
  connectedWalletAddress,
  executeBatchEligible = false,
  depositSymbol,
  shareSymbol,
  shareName,
  vaultSymbol,
  vaultName,
  deploymentVersion,
  currentPayoutRecipient,
  onSuccess,
}: {
  creatorToken: Address
  owner: Address
  connectedWalletAddress: Address | null
  executeBatchEligible?: boolean
  depositSymbol: string
  shareSymbol: string
  shareName: string
  vaultSymbol: string
  vaultName: string
  deploymentVersion: 'v1' | 'v2' | 'v3'
  currentPayoutRecipient: Address | null
  onSuccess: (addresses: ServerDeployResponse['addresses']) => void
}) {
  const publicClient = usePublicClient({ chainId: base.id })
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const { sendCallsAsync } = useSendCalls()
  const { config: onchainKitConfig } = useOnchainKit()

  // Optional gas sponsorship (EIP-4337 paymaster) for EIP-5792 `wallet_sendCalls`.
  // See docs/aa/notes.md for the AA mental model (EntryPoint + bundler + paymaster).
  const paymasterUrl = onchainKitConfig?.paymaster ?? null
  const capabilities =
    paymasterUrl && typeof paymasterUrl === 'string'
      ? ({ paymasterService: { url: paymasterUrl } } as const)
      : undefined

  const formatDeposit = (raw?: bigint): string => {
    if (raw === undefined) return '—'
    const s = formatUnits(raw, 18)
    const n = Number(s)
    if (Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
    return s
  }

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txId, setTxId] = useState<string | null>(null)
  const [approveBusy, setApproveBusy] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [approveTxId, setApproveTxId] = useState<string | null>(null)

  const batcherAddress = (CONTRACTS.creatorVaultBatcher ?? null) as Address | null

  const connectedLc = connectedWalletAddress ? connectedWalletAddress.toLowerCase() : ''
  const ownerLc = owner.toLowerCase()
  const isExecuteBatchPath = executeBatchEligible && connectedLc.length > 0 && connectedLc !== ownerLc

  const permit2FromConfig = useMemo(() => {
    const p = String(CONTRACTS.permit2 ?? '')
    return isAddress(p) ? (p as Address) : null
  }, [])
  const { data: permit2FromBatcher } = useReadContract({
    address: batcherAddress ? (batcherAddress as `0x${string}`) : undefined,
    abi: CREATOR_VAULT_BATCHER_ABI,
    functionName: 'permit2',
    query: { enabled: Boolean(batcherAddress && isExecuteBatchPath) },
  })
  const permit2Address = useMemo(() => {
    const p = permit2FromBatcher ? String(permit2FromBatcher) : ''
    if (isAddress(p)) return p as Address
    return permit2FromConfig
  }, [permit2FromBatcher, permit2FromConfig])

  const { data: smartWalletTokenBalance } = useReadContract({
    address: creatorToken as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [owner as `0x${string}`],
    query: { enabled: Boolean(isExecuteBatchPath) },
  })

  const { data: connectedTokenBalanceForTopUp } = useReadContract({
    address: creatorToken as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [((connectedWalletAddress ?? ZERO_ADDRESS) as Address) as `0x${string}`],
    query: { enabled: Boolean(isExecuteBatchPath && connectedWalletAddress) },
  })

  const { data: connectedPermit2Allowance, refetch: refetchConnectedPermit2Allowance } = useReadContract({
    address: creatorToken as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [
      ((connectedWalletAddress ?? ZERO_ADDRESS) as Address) as `0x${string}`,
      ((permit2Address ?? ZERO_ADDRESS) as Address) as `0x${string}`,
    ],
    query: { enabled: Boolean(isExecuteBatchPath && connectedWalletAddress && permit2Address) },
  })

  const executeBatchShortfall = useMemo(() => {
    if (!isExecuteBatchPath) return null
    if (typeof smartWalletTokenBalance !== 'bigint') return null
    if (smartWalletTokenBalance >= MIN_FIRST_DEPOSIT) return 0n
    return MIN_FIRST_DEPOSIT - smartWalletTokenBalance
  }, [isExecuteBatchPath, smartWalletTokenBalance])

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

      const shareOftArgs = encodeAbiParameters(parseAbiParameters('string,string,address,address'), [
        shareName,
        shareSymbol,
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
        },
      }
    },
  })

  const expected = expectedQuery.data?.expected ?? null
  const expectedGauge = expected?.gaugeController ?? null

  const payoutMismatch =
    !!expectedGauge &&
    !!currentPayoutRecipient &&
    expectedGauge.toLowerCase() !== currentPayoutRecipient.toLowerCase()

  const submit = async () => {
    setBusy(true)
    setError(null)
    setTxId(null)

    try {
      if (!batcherAddress) throw new Error('CreatorVaultBatcher is not configured. Set VITE_CREATOR_VAULT_BATCHER.')
      if (!publicClient) throw new Error('Network client not ready')
      if (!walletClient) throw new Error('Wallet not ready')
      if (!expected || !expectedGauge) throw new Error('Failed to compute expected deployment addresses')

      const connected = (((walletClient as any).account?.address ?? (walletClient as any).account) as Address | null) ?? null
      if (!connected) throw new Error('Wallet not ready')

      const depositAmount = MIN_FIRST_DEPOSIT
      const auctionSteps = encodeUniswapCcaLinearSteps(DEFAULT_CCA_DURATION_BLOCKS)
      const payoutForDeploy = ((payoutMismatch ? expectedGauge : currentPayoutRecipient) ?? expectedGauge) as Address

      // Ensure Permit2 address matches the batcher config (defensive).
      const permit2 = (await publicClient.readContract({
        address: batcherAddress,
        abi: CREATOR_VAULT_BATCHER_ABI,
        functionName: 'permit2',
      })) as Address

      const isOperatorSubmit = connected.toLowerCase() !== owner.toLowerCase()

      // =================================
      // Smart wallet executeBatch path (EOA owner submits, SW executes)
      // =================================
      if (isOperatorSubmit && isExecuteBatchPath) {
        // Determine how much the smart wallet needs to be topped up (if any).
        const smartWalletBalance = (await publicClient.readContract({
          address: creatorToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [owner],
        })) as bigint

        const shortfall = smartWalletBalance >= depositAmount ? 0n : depositAmount - smartWalletBalance

        const calls: { target: Address; value: bigint; data: Hex }[] = []

        // If the smart wallet is unfunded, pull the exact shortfall from the connected EOA via Permit2.
        if (shortfall > 0n) {
          const eoaBalance = (await publicClient.readContract({
            address: creatorToken,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [connected],
          })) as bigint
          if (eoaBalance < shortfall) {
            throw new Error(
              `Your wallet needs at least ${formatDeposit(shortfall)} ${depositSymbol} to top up the creator smart wallet.`,
            )
          }

          const eoaPermit2Allowance = (await publicClient.readContract({
            address: creatorToken,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [connected, permit2],
          })) as bigint
          if (eoaPermit2Allowance < shortfall) {
            throw new Error(
              `Approve Permit2 before deploying (required to pull ${formatDeposit(shortfall)} ${depositSymbol} into the smart wallet).`,
            )
          }

          // Pick a one-time unordered nonce from Permit2 word 0 (nonce = wordPos*256 + bitPos).
          const bitmap = (await publicClient.readContract({
            address: permit2,
            abi: PERMIT2_VIEW_ABI,
            functionName: 'nonceBitmap',
            args: [connected, 0n],
          })) as bigint

          let bitPos = -1
          for (let i = 0; i < 256; i++) {
            const used = (bitmap >> BigInt(i)) & 1n
            if (used === 0n) {
              bitPos = i
              break
            }
          }
          if (bitPos < 0) throw new Error('Permit2 nonce bitmap is full (word 0).')
          const wordPos = 0n
          const nonce = (wordPos << 8n) | BigInt(bitPos)

          const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10) // 10 minutes

          const permitSig = appendPermit2SignatureType(
            (await walletClient.signTypedData({
              account: (walletClient as any).account,
              domain: { name: 'Permit2', version: '1', chainId: base.id, verifyingContract: permit2 },
              types: {
                TokenPermissions: [
                  { name: 'token', type: 'address' },
                  { name: 'amount', type: 'uint256' },
                ],
                PermitTransferFrom: [
                  { name: 'permitted', type: 'TokenPermissions' },
                  { name: 'spender', type: 'address' },
                  { name: 'nonce', type: 'uint256' },
                  { name: 'deadline', type: 'uint256' },
                ],
              },
              primaryType: 'PermitTransferFrom',
              message: {
                permitted: { token: creatorToken, amount: shortfall },
                spender: owner, // smart wallet will call Permit2 inside executeBatch
                nonce,
                deadline,
              },
            })) as Hex,
          )

          calls.push({
            target: permit2,
            value: 0n,
            data: encodeFunctionData({
              abi: PERMIT2_SIGNATURE_TRANSFER_ABI,
              functionName: 'permitTransferFrom',
              args: [
                { permitted: { token: creatorToken, amount: shortfall }, nonce, deadline },
                { to: owner, requestedAmount: shortfall },
                connected,
                permitSig,
              ],
            }),
          })
        }

        if (payoutMismatch) {
          calls.push({
            target: creatorToken,
            value: 0n,
            data: encodeFunctionData({
              abi: COIN_PAYOUT_RECIPIENT_ABI,
              functionName: 'setPayoutRecipient',
              args: [expectedGauge],
            }),
          })
        }

        // Ensure the smart wallet has approved the batcher to pull the full depositAmount.
        const swAllowanceToBatcher = (await publicClient.readContract({
          address: creatorToken,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [owner, batcherAddress],
        })) as bigint

        if (swAllowanceToBatcher < depositAmount) {
          // Some tokens require setting allowance to 0 before raising it.
          if (swAllowanceToBatcher !== 0n) {
            calls.push({
              target: creatorToken,
              value: 0n,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'approve',
                args: [batcherAddress, 0n],
              }),
            })
          }
          calls.push({
            target: creatorToken,
            value: 0n,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [batcherAddress, depositAmount],
            }),
          })
        }

        // Finally: owner-only deploy executed from the smart wallet.
        calls.push({
          target: batcherAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: CREATOR_VAULT_BATCHER_ABI,
            functionName: 'deployAndLaunch',
            args: [
              creatorToken,
              owner,
              owner,
              payoutForDeploy,
              vaultName,
              vaultSymbol,
              shareName,
              shareSymbol,
              deploymentVersion,
              depositAmount,
              DEFAULT_AUCTION_PERCENT,
              DEFAULT_REQUIRED_RAISE_WEI,
              DEFAULT_FLOOR_PRICE_Q96_ALIGNED,
              auctionSteps,
              codeIds,
            ],
          }),
        })

        // ===========================================
        // Preferred: "true" ERC-4337 UserOperation path
        // ===========================================
        // If CDP bundler/paymaster is configured, send a UserOperation via EntryPoint v0.6.
        // This avoids direct EOA tx execution and enables sponsorship.
        const cdpApiKey = import.meta.env.VITE_CDP_API_KEY as string | undefined
        const cdpBundlerUrl =
          (paymasterUrl && typeof paymasterUrl === 'string' ? paymasterUrl : null) ??
          (cdpApiKey ? `https://api.developer.coinbase.com/rpc/v1/base/${cdpApiKey}` : null)

        if (cdpBundlerUrl) {
          try {
            const res = await sendCoinbaseSmartWalletUserOperation({
              publicClient,
              walletClient,
              bundlerUrl: cdpBundlerUrl,
              smartWallet: owner,
              ownerAddress: connected,
              calls: calls.map((c) => ({ to: c.target, value: c.value, data: c.data })),
              version: '1',
            })
            setTxId(res.userOpHash)
            onSuccess(expected)
            return
          } catch {
            // Fallback below: direct executeBatch tx from the connected owner EOA.
          }
        }

        const executeBatchData = encodeFunctionData({
          abi: COINBASE_SMART_WALLET_EXECUTE_BATCH_ABI,
          functionName: 'executeBatch',
          args: [calls],
        })

        const hash = await walletClient.sendTransaction({
          account: (walletClient as any).account,
          chain: base as any,
          to: owner,
          data: executeBatchData,
          value: 0n,
        })
        await publicClient.waitForTransactionReceipt({ hash })
        setTxId(hash)
        onSuccess(expected)
        return
      }

      // =================================
      // Operator-submit flow (in-app, no JSON)
      // =================================
      if (isOperatorSubmit) {
        // Operator mode only works when the canonical identity is a contract wallet that will accept
        // this operator's signature via ERC-1271 (EIP-1271).
        const ownerCode = await publicClient.getBytecode({ address: owner })
        const ownerIsContract = Boolean(ownerCode && ownerCode !== '0x')
        if (!ownerIsContract) {
          throw new Error('Canonical identity is an EOA. Connect the canonical identity wallet to deploy.')
        }

        // Default to operator-funded for now (simplest, no identity-side Permit2 signing needed).
        const fundingModel: 0 | 1 = 1
        const paramsHash = computeParamsHashFromLib({
          creatorToken,
          owner,
          creatorTreasury: owner,
          payoutRecipient: ZERO_ADDRESS,
          vaultName,
          vaultSymbol,
          shareName,
          shareSymbol,
          version: deploymentVersion,
          depositAmount,
          auctionPercent: DEFAULT_AUCTION_PERCENT,
          requiredRaise: DEFAULT_REQUIRED_RAISE_WEI,
          floorPriceQ96: DEFAULT_FLOOR_PRICE_Q96_ALIGNED,
          auctionSteps,
          codeIds,
          leftoverRecipient: owner,
          fundingModel,
        })

        const nonce = await fetchDeployNonce({ publicClient, batcher: batcherAddress, owner })
        const authDeadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20)
        const auth: DeployAuthorization = {
          owner,
          operator: connected,
          leftoverRecipient: owner,
          fundingModel,
          paramsHash,
          nonce,
          deadline: authDeadline,
        }

        const authTypedData = buildDeployAuthorizationTypedData({
          chainId: base.id,
          verifyingContract: batcherAddress,
          auth,
        })

        const authSig = (await walletClient.signTypedData({
          account: (walletClient as any).account,
          domain: authTypedData.domain,
          types: authTypedData.types,
          primaryType: authTypedData.primaryType,
          message: authTypedData.message,
        })) as Hex

        const authDigest = hashTypedData({
          domain: authTypedData.domain,
          types: authTypedData.types,
          primaryType: authTypedData.primaryType,
          message: authTypedData.message,
        })

        const authOk = await preflightErc1271Signature({
          publicClient,
          contract: owner,
          digest: authDigest,
          signature: authSig,
        })

        if (!authOk) {
          throw new Error(
            'This wallet is not authorized to deploy for the canonical identity smart wallet. Connect an onchain owner of the identity wallet, or deploy from the identity wallet directly.',
          )
        }

        const calls: { to: Address; data: Hex; value?: bigint }[] = []

        // Operator-funded Permit2 (pulls deposit from the connected operator wallet).
        const allowance = (await publicClient.readContract({
          address: creatorToken,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [connected, permit2],
        })) as bigint

        if (allowance < depositAmount) {
          calls.push({
            to: creatorToken,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [permit2, depositAmount],
            }),
          })
        }

        const { permit, signTypedDataArgs } = await buildPermit2PermitTransferFrom({
          publicClient,
          permit2,
          token: creatorToken,
          amount: depositAmount,
          owner: connected,
          spender: batcherAddress,
          ttlSeconds: 20 * 60,
        })

        const permitSig = appendPermit2SignatureType(
          (await walletClient.signTypedData({
            account: (walletClient as any).account,
            domain: signTypedDataArgs.domain,
            types: signTypedDataArgs.types,
            primaryType: signTypedDataArgs.primaryType,
            message: signTypedDataArgs.message,
          })) as Hex,
        )

        calls.push({
          to: batcherAddress,
          data: encodeFunctionData({
            abi: CREATOR_VAULT_BATCHER_ABI,
            functionName: 'deployAndLaunchWithPermit2AsOperatorOperatorFunded',
            args: [
              creatorToken,
              owner,
              owner,
              ZERO_ADDRESS,
              vaultName,
              vaultSymbol,
              shareName,
              shareSymbol,
              deploymentVersion,
              depositAmount,
              DEFAULT_AUCTION_PERCENT,
              DEFAULT_REQUIRED_RAISE_WEI,
              DEFAULT_FLOOR_PRICE_Q96_ALIGNED,
              auctionSteps,
              codeIds,
              auth,
              authSig,
              permit,
              permitSig,
            ],
          }),
        })

        try {
          const res = await sendCallsAsync({
            calls: calls.map((c) => ({ to: c.to, data: c.data, value: c.value ?? 0n })),
            account: connected,
            chainId: base.id,
            forceAtomic: true,
            capabilities: capabilities as any,
          })
          setTxId(res.id)
          onSuccess(expected)
          return
        } catch {
          // sequential fallback
        }

        for (const c of calls) {
          const hash = await walletClient.sendTransaction({
            account: (walletClient as any).account,
            chain: base as any,
            to: c.to,
            data: c.data,
            value: c.value ?? 0n,
          })
          await publicClient.waitForTransactionReceipt({ hash })
          setTxId(hash)
        }

        onSuccess(expected)
        return
      }

      if (payoutMismatch) {
        if (connected.toLowerCase() !== owner.toLowerCase()) {
          throw new Error('Payout recipient update requires the identity wallet. Connect it to continue.')
        }
        const hash = await walletClient.sendTransaction({
          account: (walletClient as any).account,
          chain: base as any,
          to: creatorToken,
          data: encodeFunctionData({
            abi: COIN_PAYOUT_RECIPIENT_ABI,
            functionName: 'setPayoutRecipient',
            args: [expectedGauge],
          }),
          value: 0n,
        })
        await publicClient.waitForTransactionReceipt({ hash })
      }

      const calls: { to: Address; data: Hex; value?: bigint }[] = []

      // ===========================
      // Permit2-first path
      // ===========================
      try {
        const allowance = (await publicClient.readContract({
          address: creatorToken,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [owner, permit2],
        })) as bigint

        if (allowance < depositAmount) {
          calls.push({
            to: creatorToken,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [permit2, depositAmount],
            }),
          })
        }

        // Find an unused unordered nonce in word 0.
        const bitmap = (await publicClient.readContract({
          address: permit2,
          abi: PERMIT2_VIEW_ABI,
          functionName: 'nonceBitmap',
          args: [owner, 0n],
        })) as bigint

        let bitPos = -1
        for (let i = 0; i < 256; i++) {
          const used = (bitmap >> BigInt(i)) & 1n
          if (used === 0n) {
            bitPos = i
            break
          }
        }
        if (bitPos < 0) throw new Error('Permit2 nonce bitmap is full (word 0).')

        const nonce = (0n << 8n) | BigInt(bitPos)
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20) // 20 minutes

        const signature = appendPermit2SignatureType(
          (await walletClient.signTypedData({
            account: (walletClient as any).account,
            domain: { name: 'Permit2', version: '1', chainId: base.id, verifyingContract: permit2 },
            types: {
              TokenPermissions: [
                { name: 'token', type: 'address' },
                { name: 'amount', type: 'uint256' },
              ],
              PermitTransferFrom: [
                { name: 'permitted', type: 'TokenPermissions' },
                { name: 'spender', type: 'address' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
              ],
            },
            primaryType: 'PermitTransferFrom',
            message: {
              permitted: { token: creatorToken, amount: depositAmount },
              spender: batcherAddress,
              nonce,
              deadline,
            },
          })) as Hex,
        )

        calls.push({
          to: batcherAddress,
          data: encodeFunctionData({
            abi: CREATOR_VAULT_BATCHER_ABI,
            functionName: 'deployAndLaunchWithPermit2',
            args: [
              creatorToken,
              owner,
              owner, // creatorTreasury
              payoutForDeploy,
              vaultName,
              vaultSymbol,
              shareName,
              shareSymbol,
              deploymentVersion,
              depositAmount,
              DEFAULT_AUCTION_PERCENT,
              DEFAULT_REQUIRED_RAISE_WEI,
              DEFAULT_FLOOR_PRICE_Q96_ALIGNED,
              auctionSteps,
              codeIds,
              { permitted: { token: creatorToken, amount: depositAmount }, nonce, deadline },
              signature,
            ],
          }),
        })

        // Prefer atomic EIP-5792 batching when supported.
        try {
          const res = await sendCallsAsync({
            calls: calls.map((c) => ({ to: c.to, data: c.data, value: c.value ?? 0n })),
            account: connected,
            chainId: base.id,
            forceAtomic: true,
            capabilities: capabilities as any,
          })
          setTxId(res.id)
          onSuccess(expected)
          return
        } catch {
          // Fall through to sequential transactions.
        }

        if (!walletClient) throw new Error('Wallet not ready')
        for (const c of calls) {
          const hash = await walletClient.sendTransaction({
            account: (walletClient as any).account,
            chain: base as any,
            to: c.to,
            data: c.data,
            value: c.value ?? 0n,
          })
          await publicClient.waitForTransactionReceipt({ hash })
          setTxId(hash)
        }

        onSuccess(expected)
        return
      } catch (permit2Err) {
        // Permit2 signing isn’t supported in every wallet; fall back to token approve + deployAndLaunch.
        void permit2Err
      }

      // ===========================
      // Approve fallback path
      // ===========================
      const fallbackCalls: { to: Address; data: Hex; value?: bigint }[] = []
      fallbackCalls.push({
        to: creatorToken,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [batcherAddress, depositAmount],
        }),
      })
      fallbackCalls.push({
        to: batcherAddress,
        data: encodeFunctionData({
          abi: CREATOR_VAULT_BATCHER_ABI,
          functionName: 'deployAndLaunch',
          args: [
            creatorToken,
            owner,
            owner,
            payoutForDeploy,
            vaultName,
            vaultSymbol,
            shareName,
            shareSymbol,
            deploymentVersion,
            depositAmount,
            DEFAULT_AUCTION_PERCENT,
            DEFAULT_REQUIRED_RAISE_WEI,
            DEFAULT_FLOOR_PRICE_Q96_ALIGNED,
            auctionSteps,
            codeIds,
          ],
        }),
      })

      try {
        const res = await sendCallsAsync({
          calls: fallbackCalls.map((c) => ({ to: c.to, data: c.data, value: c.value ?? 0n })),
          account: connected,
          chainId: base.id,
          forceAtomic: true,
          capabilities: capabilities as any,
        })
        setTxId(res.id)
        onSuccess(expected)
        return
      } catch {
        // sequential fallback
      }

      for (const c of fallbackCalls) {
        const hash = await walletClient.sendTransaction({
          account: (walletClient as any).account,
          chain: base as any,
          to: c.to,
          data: c.data,
          value: c.value ?? 0n,
        })
        await publicClient.waitForTransactionReceipt({ hash })
        setTxId(hash)
      }
      onSuccess(expected)
    } catch (e: any) {
      setError(e?.message || 'Deployment failed')
    } finally {
      setBusy(false)
    }
  }

  const executeBatchFunding = useMemo(() => {
    if (!isExecuteBatchPath) {
      return { ready: true, needsPermit2Approval: false, shortfall: 0n as bigint }
    }

    if (typeof executeBatchShortfall !== 'bigint') {
      return { ready: false, needsPermit2Approval: false, shortfall: null as bigint | null }
    }

    if (executeBatchShortfall === 0n) {
      return { ready: true, needsPermit2Approval: false, shortfall: 0n as bigint }
    }

    // needs top-up
    if (typeof connectedTokenBalanceForTopUp !== 'bigint') {
      return { ready: false, needsPermit2Approval: false, shortfall: executeBatchShortfall }
    }
    if (connectedTokenBalanceForTopUp < executeBatchShortfall) {
      return { ready: false, needsPermit2Approval: false, shortfall: executeBatchShortfall }
    }
    if (!permit2Address) {
      return { ready: false, needsPermit2Approval: false, shortfall: executeBatchShortfall }
    }
    if (typeof connectedPermit2Allowance !== 'bigint') {
      return { ready: false, needsPermit2Approval: false, shortfall: executeBatchShortfall }
    }
    if (connectedPermit2Allowance < executeBatchShortfall) {
      return { ready: false, needsPermit2Approval: true, shortfall: executeBatchShortfall }
    }
    return { ready: true, needsPermit2Approval: false, shortfall: executeBatchShortfall }
  }, [connectedPermit2Allowance, connectedTokenBalanceForTopUp, executeBatchShortfall, isExecuteBatchPath, permit2Address])

  const approvePermit2 = async () => {
    setApproveError(null)
    setApproveTxId(null)

    try {
      if (!walletClient) throw new Error('Wallet not ready')
      if (!publicClient) throw new Error('Network client not ready')
      if (!connectedWalletAddress) throw new Error('Wallet not ready')
      if (!permit2Address) throw new Error('Permit2 is not configured')
      if (typeof executeBatchFunding.shortfall !== 'bigint' || executeBatchFunding.shortfall <= 0n) {
        throw new Error('No Permit2 approval is required right now.')
      }

      setApproveBusy(true)

      const currentAllowance = (await publicClient.readContract({
        address: creatorToken,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [connectedWalletAddress, permit2Address],
      })) as bigint

      if (currentAllowance >= executeBatchFunding.shortfall) {
        await refetchConnectedPermit2Allowance()
        return
      }

      // Some ERC20s require setting allowance to 0 before raising it.
      if (currentAllowance !== 0n) {
        const hash0 = await walletClient.sendTransaction({
          account: (walletClient as any).account,
          chain: base as any,
          to: creatorToken,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [permit2Address, 0n],
          }),
          value: 0n,
        })
        await publicClient.waitForTransactionReceipt({ hash: hash0 })
      }

      const hash = await walletClient.sendTransaction({
        account: (walletClient as any).account,
        chain: base as any,
        to: creatorToken,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [permit2Address, executeBatchFunding.shortfall],
        }),
        value: 0n,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      setApproveTxId(hash)
      await refetchConnectedPermit2Allowance()
    } catch (e: any) {
      setApproveError(e?.message || 'Permit2 approval failed')
    } finally {
      setApproveBusy(false)
    }
  }

  const canAutoUpdatePayoutRecipient = !payoutMismatch || isExecuteBatchPath || connectedLc === ownerLc

  const disabled =
    busy ||
    expectedQuery.isLoading ||
    !expected ||
    !canAutoUpdatePayoutRecipient ||
    (isExecuteBatchPath && !executeBatchFunding.ready)

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

      {isExecuteBatchPath ? (
        <div className="rounded-lg border border-white/5 bg-black/20 p-4 space-y-2">
          <div className="text-[11px] text-zinc-400">
            You’re an onchain owner of the creator smart wallet{' '}
            <span className="font-mono text-zinc-200">{shortAddress(owner)}</span>. Deploy will execute through it.
          </div>

          {typeof smartWalletTokenBalance === 'bigint' ? (
            <div className="text-[11px] text-zinc-500">
              Smart wallet balance: <span className="text-zinc-200 font-mono">{formatDeposit(smartWalletTokenBalance)}</span> {depositSymbol}
            </div>
          ) : (
            <div className="text-[11px] text-zinc-600">Checking smart wallet balance…</div>
          )}

          {typeof executeBatchShortfall === 'bigint' && executeBatchShortfall > 0n ? (
            <>
              <div className="text-[11px] text-zinc-500">
                Shortfall: <span className="text-zinc-200 font-mono">{formatDeposit(executeBatchShortfall)}</span> {depositSymbol} (will be pulled
                from your wallet via Permit2)
              </div>
              {typeof connectedTokenBalanceForTopUp === 'bigint' ? (
                <div className="text-[11px] text-zinc-500">
                  Your balance: <span className="text-zinc-200 font-mono">{formatDeposit(connectedTokenBalanceForTopUp)}</span> {depositSymbol}
                </div>
              ) : (
                <div className="text-[11px] text-zinc-600">Checking your balance…</div>
              )}
            </>
          ) : null}

          {executeBatchFunding.needsPermit2Approval ? (
            <div className="pt-2 space-y-2">
              <div className="text-[11px] text-amber-300/80">One-time step: approve Permit2 so we can top up the smart wallet.</div>
              <button type="button" onClick={() => void approvePermit2()} disabled={approveBusy} className="btn-accent w-full">
                {approveBusy ? 'Approving…' : 'Approve Permit2'}
              </button>
              {approveError ? <div className="text-[11px] text-red-400/90">{approveError}</div> : null}
              {approveTxId ? (
                <div className="text-[11px] text-zinc-500">
                  Approved: <span className="font-mono text-zinc-300 break-all">{approveTxId}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <button type="button" onClick={() => void submit()} disabled={disabled} className="btn-accent w-full rounded-lg">
        {busy
          ? 'Deploying…'
          : isExecuteBatchPath
            ? 'Deploy via Smart Wallet'
            : connectedLc.length > 0 && connectedLc !== ownerLc
              ? 'Deploy as Operator'
              : '1‑Click Deploy (AA)'}
      </button>

      {error ? <div className="text-[11px] text-red-400/90">{error}</div> : null}
      {txId ? (
        <div className="text-[11px] text-zinc-500">
          Submitted: <span className="font-mono text-zinc-300 break-all">{txId}</span>
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
  const paymasterStatus = useMemo(() => {
    const paymasterUrl = onchainKitConfig?.paymaster ?? null
    if (!paymasterUrl || typeof paymasterUrl !== 'string') {
      return { ok: false, hint: 'missing' }
    }
    try {
      const url = new URL(paymasterUrl)
      return { ok: true, hint: url.host }
    } catch {
      return { ok: true, hint: 'configured' }
    }
  }, [onchainKitConfig?.paymaster])

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

  const { data: connectedTokenBalance } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [(connectedWalletAddress ?? ZERO_ADDRESS) as `0x${string}`],
    query: { enabled: tokenIsValid && !!connectedWalletAddress },
  })

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
    const s = formatUnits(raw, 18)
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

  // If the coin was created from a smart wallet (Privy/Coinbase Smart Wallet), prefer using that
  // as the execution account for deployment + the 50M initial deposit.
  //
  // - `coinSmartWallet`: smart wallet address that matches the coin's creator or payoutRecipient.
  // - Fallback to the connected wallet when we cannot confidently identify a smart wallet.
  const selectedOwnerWallet = useMemo(() => {
    return (coinSmartWallet ?? connectedWalletAddress) as Address | null
  }, [coinSmartWallet, connectedWalletAddress])

  const { data: selectedOwnerTokenBalance } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [((selectedOwnerWallet ?? ZERO_ADDRESS) as Address) as `0x${string}`],
    query: { enabled: tokenIsValid && !!selectedOwnerWallet },
  })

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

  const selectedOwnerAddress = selectedOwnerWallet

  void selectedOwnerAddress // reserved for future “deploy as smart wallet” UX
  void selectedOwnerTokenBalance // reserved for future funding UX


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

  const walletHasMinDeposit =
    typeof connectedTokenBalance === 'bigint' && connectedTokenBalance >= MIN_FIRST_DEPOSIT

  const batcherConfigured = isAddress(String((CONTRACTS as any).creatorVaultBatcher ?? ''))
  const operatorModeEligible = useMemo(() => {
    return operatorModeForIdentity && canonicalIdentityIsContract
  }, [canonicalIdentityIsContract, operatorModeForIdentity])

  const operatorMode = operatorModeForIdentity
  const operatorDeployStatus = useMemo(() => {
    if (!operatorMode) return { operatorMode: false, eligible: false, loading: false, message: null as string | null }
    if (canonicalIdentityBytecodeQuery.isFetching) {
      return { operatorMode: true, eligible: false, loading: true, message: 'Checking identity wallet…' }
    }
    if (!canonicalIdentityIsContract) {
      return {
        operatorMode: true,
        eligible: false,
        loading: false,
        message: 'Canonical identity is an EOA (not a contract wallet). Connect the canonical identity wallet to deploy.',
      }
    }
    return { operatorMode: true, eligible: true, loading: false, message: null as string | null }
  }, [canonicalIdentityBytecodeQuery.isFetching, canonicalIdentityIsContract, operatorMode])

  const isAuthorizedDeployerOrOperator = isAuthorizedDeployer || executeBatchEligible || operatorModeEligible

  const funderHasMinDeposit = walletHasMinDeposit

  const fundingGateOk = executeBatchEligible || funderHasMinDeposit

  const canDeploy =
    tokenIsValid &&
    !!zoraCoin &&
    isCreatorCoin &&
    isAuthorizedDeployerOrOperator &&
    creatorAllowlistQuery.isSuccess &&
    passesCreatorAllowlist &&
    !!derivedShareSymbol &&
    !!derivedShareName &&
    !!derivedVaultName &&
    !!derivedVaultSymbol &&
    !!connectedWalletAddress &&
    fundingGateOk &&
    batcherConfigured &&
    (!identity.blockingReason || executeBatchEligible || operatorModeEligible)

  const vrfConsumerAddress = (CONTRACTS.vrfConsumer ?? null) as Address | null
  const creatorVaultBatcherAddress = (CONTRACTS.creatorVaultBatcher ?? null) as Address | null
  const vrfConsumerConfigured = isAddress(String(vrfConsumerAddress ?? ''))
  const creatorVaultBatcherConfigured = isAddress(String(creatorVaultBatcherAddress ?? ''))
  const allowlistReady = allowlistMode === 'disabled' ? true : isAllowlistedCreator
  const creatorCoinReady = tokenIsValid && !!zoraCoin && isCreatorCoin
  const fundingReady = fundingGateOk
  const authReady = isAuthorizedDeployerOrOperator

  const firstLaunchChecklist = [
    {
      label: 'CreatorVaultBatcher configured',
      ok: creatorVaultBatcherConfigured,
      hint: creatorVaultBatcherConfigured && creatorVaultBatcherAddress ? shortAddress(creatorVaultBatcherAddress) : 'missing',
    },
    {
      label: 'Smart wallet batching enabled',
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
      label: 'Authorized + funded',
      ok: authReady && fundingReady,
      hint: authReady
        ? fundingReady
          ? 'ready'
          : `needs 50,000,000 ${underlyingSymbolUpper || 'TOKENS'}`
        : 'not authorized',
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
                      ? `Needs 50,000,000 ${underlyingSymbolUpper || 'TOKENS'} to deploy.`
                      : identity.blockingReason && !executeBatchEligible && !operatorModeEligible
                        ? identity.blockingReason
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
                <div className="text-[11px] uppercase tracking-wide text-amber-200">Launch checklist (admin)</div>
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
                            <span className="text-white font-medium">50,000,000 {underlyingSymbolUpper || 'TOKENS'}</span> deposit.
                          </>
                        )}
                      </div>

                      {tokenIsValid ? (
                        <div className="flex items-center justify-between text-sm p-3 bg-black/40 border border-zinc-800 rounded-lg">
                          <span className="text-zinc-500">Current balance:</span>
                          <span className={walletHasMinDeposit ? 'text-emerald-400 font-medium' : 'text-amber-300/90 font-medium'}>
                            {formatToken18(typeof connectedTokenBalance === 'bigint' ? connectedTokenBalance : undefined)}{' '}
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
                      {connectedWalletAddress.toLowerCase() === canonicalIdentityAddress.toLowerCase()
                        ? 'Direct (identity wallet)'
                        : executeBatchEligible
                          ? 'Smart Wallet (executeBatch)'
                          : operatorModeEligible
                            ? 'Operator (EIP-1271)'
                            : '—'}
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-700">
                    Vault ownership will be set to the canonical identity. Your connected wallet only executes the transaction.
                  </div>
                </div>
              ) : null}

              {isConnected && showAdvanced && !isSignedIn ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                  <div className="text-amber-300/90 text-sm font-medium">Optional sign-in (admin tools)</div>
                  <div className="text-amber-300/70 text-xs leading-relaxed">
                    Sign in to unlock admin-only deployment modes and diagnostics. Deployment itself is executed onchain.
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
              ) : tokenIsValid && zoraCoin && identity.blockingReason && !executeBatchEligible && !operatorModeEligible ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                  <div className="text-amber-300/90 text-sm font-medium">Identity mismatch</div>
                  <div className="text-amber-300/70 text-xs leading-relaxed">{identity.blockingReason}</div>
                  <div className="pt-2 space-y-2">
                    {operatorDeployStatus.loading ? (
                      <div className="text-[11px] text-amber-300/70">Checking canonical identity wallet type…</div>
                    ) : operatorDeployStatus.message ? (
                      <div className="text-[11px] text-amber-300/70">{operatorDeployStatus.message}</div>
                    ) : (
                      <div className="text-[11px] text-amber-300/70">Connect the canonical identity wallet to continue.</div>
                    )}
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
              ) : tokenIsValid && zoraCoin && !batcherConfigured ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Deployment is not configured (missing CreatorVaultBatcher address)
                </button>
              ) : tokenIsValid && zoraCoin && !funderHasMinDeposit && !executeBatchEligible ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  {`Your wallet needs 50,000,000 ${underlyingSymbolUpper || 'TOKENS'} to deploy & launch`}
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
                    owner={identity.canonicalIdentity.address as Address}
                    connectedWalletAddress={connectedWalletAddress}
                    executeBatchEligible={executeBatchEligible}
                    depositSymbol={underlyingSymbolUpper || 'TOKENS'}
                    shareSymbol={derivedShareSymbol}
                    shareName={derivedShareName}
                    vaultSymbol={derivedVaultSymbol}
                    vaultName={derivedVaultName}
                    deploymentVersion={deploymentVersion}
                    currentPayoutRecipient={payoutRecipient}
                    onSuccess={() => {}}
                  />
                </>
              ) : (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Enter token address to continue
                </button>
              )}

              {!canDeploy && deployBlocker ? (
                <div className="text-xs text-amber-300/80">{deployBlocker}</div>
              ) : null}

              <div className="text-xs text-zinc-600">
                Requires a 50,000,000 {underlyingSymbolUpper || 'TOKENS'} deposit. Some wallets may prompt multiple confirmations.
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
                  note="Wrapped vault shares token (wsToken) used for routing fees."
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
                  note="Wraps/unlocks vault shares into the wsToken."
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
