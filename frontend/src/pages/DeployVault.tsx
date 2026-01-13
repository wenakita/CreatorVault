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
  isAddress,
  keccak256,
  parseAbiParameters,
  toBytes,
} from 'viem'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { coinABI } from '@zoralabs/protocol-deployments'
import { BarChart3, Layers, Lock, Rocket, ShieldCheck } from 'lucide-react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useSetActiveWallet } from '@privy-io/wagmi'
import { ConnectButton } from '@/components/ConnectButton'
import { DerivedTokenIcon } from '@/components/DerivedTokenIcon'
import { RequestCreatorAccess } from '@/components/RequestCreatorAccess'
import { CONTRACTS } from '@/config/contracts'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useCreatorAllowlist, useFarcasterAuth, useMiniAppContext } from '@/hooks'
import { useZoraCoin, useZoraProfile } from '@/lib/zora/hooks'
import { fetchCoinMarketRewardsByCoinFromApi } from '@/lib/onchain/coinMarketRewardsByCoin'
import { getFarcasterUserByFid } from '@/lib/neynar-api'
import { resolveCreatorIdentity } from '@/lib/identity/creatorIdentity'
import { DEPLOY_BYTECODE } from '@/deploy/bytecode.generated'
import {
  normalizeUnderlyingSymbol,
  toShareName,
  toShareSymbol,
  toVaultName,
  toVaultSymbol,
  underlyingSymbolUpper as deriveUnderlyingUpper,
} from '@/lib/tokenSymbols'

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

function computeDeployParamsHash(params: {
  creatorToken: Address
  owner: Address
  creatorTreasury: Address
  payoutRecipient: Address
  vaultName: string
  vaultSymbol: string
  shareName: string
  shareSymbol: string
  version: string
  depositAmount: bigint
  auctionPercent: number
  requiredRaise: bigint
  floorPriceQ96: bigint
  auctionSteps: Hex
  codeIds: {
    vault: Hex
    wrapper: Hex
    shareOFT: Hex
    gauge: Hex
    cca: Hex
    oracle: Hex
    oftBootstrap: Hex
  }
  leftoverRecipient: Address
  fundingModel: 0 | 1
}): Hex {
  const vaultNameHash = keccak256(toBytes(params.vaultName))
  const vaultSymbolHash = keccak256(toBytes(params.vaultSymbol))
  const shareNameHash = keccak256(toBytes(params.shareName))
  const shareSymbolHash = keccak256(toBytes(params.shareSymbol))
  const versionHash = keccak256(toBytes(params.version))
  const auctionStepsHash = keccak256(params.auctionSteps)

  const encoded = encodeAbiParameters(
    parseAbiParameters(
      'address, address, address, address, bytes32, bytes32, bytes32, bytes32, bytes32, uint256, uint8, uint128, uint256, bytes32, bytes32, bytes32, bytes32, bytes32, bytes32, bytes32, bytes32, address, uint8',
    ),
    [
      params.creatorToken,
      params.owner,
      params.creatorTreasury,
      params.payoutRecipient,
      vaultNameHash,
      vaultSymbolHash,
      shareNameHash,
      shareSymbolHash,
      versionHash,
      params.depositAmount,
      params.auctionPercent,
      params.requiredRaise,
      params.floorPriceQ96,
      auctionStepsHash,
      params.codeIds.vault,
      params.codeIds.wrapper,
      params.codeIds.shareOFT,
      params.codeIds.gauge,
      params.codeIds.cca,
      params.codeIds.oracle,
      params.codeIds.oftBootstrap,
      params.leftoverRecipient,
      params.fundingModel,
    ],
  )

  return keccak256(encoded)
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

type Permit2PermitTransferFrom = {
  permitted: { token: Address; amount: bigint }
  nonce: bigint
  deadline: bigint
}

type OperatorDeployPackage = {
  auth: DeployAuthorization
  authSig: Hex
  // For identity-funded flow, include an identity-signed Permit2 permit.
  permit2?: { permit: Permit2PermitTransferFrom; signature: Hex }
}

type OperatorDeployPackageParseResult =
  | { ok: true; value: OperatorDeployPackage }
  | { ok: false; error: string }

function isHexString(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]*$/.test(value)
}

function isBytes32(value: unknown): value is Hex {
  return isHexString(value) && value.length === 66
}

function asBigInt(value: unknown): bigint | null {
  try {
    if (typeof value === 'bigint') return value
    if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value))
    if (typeof value === 'string' && value.trim() !== '') return BigInt(value)
  } catch {
    // ignore
  }
  return null
}

function parseOperatorDeployPackage(raw: string): OperatorDeployPackageParseResult {
  if (!raw.trim()) return { ok: false, error: 'Paste a JSON authorization package.' }

  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Invalid JSON.' }
  }

  const auth = parsed?.auth
  const authSig = parsed?.authSig

  const owner = isAddress(auth?.owner) ? (auth.owner as Address) : null
  const operator = isAddress(auth?.operator) ? (auth.operator as Address) : null
  const leftoverRecipient = isAddress(auth?.leftoverRecipient) ? (auth.leftoverRecipient as Address) : null
  const fundingModelRaw = auth?.fundingModel
  const fundingModel: 0 | 1 | null = fundingModelRaw === 0 || fundingModelRaw === 1 ? fundingModelRaw : null
  const paramsHash = isBytes32(auth?.paramsHash) ? (auth.paramsHash as Hex) : null
  const nonce = asBigInt(auth?.nonce)
  const deadline = asBigInt(auth?.deadline)
  const authSigHex = isHexString(authSig) ? (authSig as Hex) : null

  if (!owner) return { ok: false, error: 'auth.owner must be an address.' }
  if (!operator) return { ok: false, error: 'auth.operator must be an address.' }
  if (!leftoverRecipient) return { ok: false, error: 'auth.leftoverRecipient must be an address.' }
  if (fundingModel === null) return { ok: false, error: 'auth.fundingModel must be 0 (identity) or 1 (operator).' }
  if (!paramsHash) return { ok: false, error: 'auth.paramsHash must be a bytes32 hex string.' }
  if (nonce === null) return { ok: false, error: 'auth.nonce must be an integer (string/number).' }
  if (deadline === null) return { ok: false, error: 'auth.deadline must be an integer timestamp (string/number).' }
  if (!authSigHex) return { ok: false, error: 'authSig must be a hex string.' }

  const permit2 = parsed?.permit2
  let permit2Parsed: OperatorDeployPackage['permit2'] | undefined
  if (permit2) {
    const p = permit2?.permit
    const sig = permit2?.signature
    const token = isAddress(p?.permitted?.token) ? (p.permitted.token as Address) : null
    const amount = asBigInt(p?.permitted?.amount)
    const pNonce = asBigInt(p?.nonce)
    const pDeadline = asBigInt(p?.deadline)
    const sigHex = isHexString(sig) ? (sig as Hex) : null
    if (!token || amount === null || pNonce === null || pDeadline === null || !sigHex) {
      return { ok: false, error: 'permit2 must include { permit: { permitted: { token, amount }, nonce, deadline }, signature }.' }
    }
    permit2Parsed = { permit: { permitted: { token, amount }, nonce: pNonce, deadline: pDeadline }, signature: sigHex }
  }

  return {
    ok: true,
    value: {
      auth: { owner, operator, leftoverRecipient, fundingModel, paramsHash, nonce, deadline },
      authSig: authSigHex,
      permit2: permit2Parsed,
    },
  }
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

const CREATOR_COIN_ADMIN_ABI = [
  {
    type: 'function',
    name: 'setPayoutRecipient',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'recipient', type: 'address' }],
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

function PrivySmartWalletConnect({ target }: { target: Address }) {
  const { ready, authenticated, login } = usePrivy()
  const { wallets } = useWallets()
  const { setActiveWallet } = useSetActiveWallet()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targetLc = target.toLowerCase()
  const matchingWallet = useMemo(() => {
    return wallets.find((w) => String((w as any)?.address ?? '').toLowerCase() === targetLc)
  }, [targetLc, wallets])

  useEffect(() => {
    if (!matchingWallet) return
    let cancelled = false
    ;(async () => {
      try {
        await setActiveWallet(matchingWallet as any)
        if (!cancelled) {
          setBusy(false)
          setError(null)
        }
      } catch {
        if (!cancelled) {
          setBusy(false)
          setError('Failed to activate Privy smart wallet. Please try again.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [matchingWallet, setActiveWallet])

  const onConnect = () => {
    setError(null)
    setBusy(true)
    login()
  }

  const statusLine = matchingWallet
    ? 'Privy smart wallet connected.'
    : authenticated
      ? `Signed in to Privy, but no wallet matches ${shortAddress(target)}.`
      : 'Sign in to Privy to use the smart wallet.'

  return (
    <div className="space-y-2">
      <button type="button" onClick={onConnect} disabled={!ready || busy} className="btn-accent w-full">
        {busy ? 'Opening Privy…' : 'Connect Privy Smart Wallet'}
      </button>
      <div className="text-xs text-zinc-500">{statusLine}</div>
      {error ? <div className="text-[11px] text-red-400/90">{error}</div> : null}
    </div>
  )
}

function DeployVaultBatcher({
  creatorToken,
  owner,
  shareSymbol,
  shareName,
  vaultSymbol,
  vaultName,
  deploymentVersion,
  currentPayoutRecipient,
  operatorPackage,
  onSuccess,
}: {
  creatorToken: Address
  owner: Address
  shareSymbol: string
  shareName: string
  vaultSymbol: string
  vaultName: string
  deploymentVersion: 'v1' | 'v2' | 'v3'
  currentPayoutRecipient: Address | null
  operatorPackage?: OperatorDeployPackage | null
  onSuccess: (addresses: ServerDeployResponse['addresses']) => void
}) {
  const publicClient = usePublicClient({ chainId: base.id })
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const { sendCallsAsync } = useSendCalls()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txId, setTxId] = useState<string | null>(null)

  const batcherAddress = (CONTRACTS.creatorVaultBatcher ?? null) as Address | null

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

      // Ensure Permit2 address matches the batcher config (defensive).
      const permit2 = (await publicClient.readContract({
        address: batcherAddress,
        abi: CREATOR_VAULT_BATCHER_ABI,
        functionName: 'permit2',
      })) as Address

      const isOperatorSubmit = connected.toLowerCase() !== owner.toLowerCase()

      // =================================
      // Operator-submit flow (requires an identity-signed DeployAuthorization)
      // =================================
      if (isOperatorSubmit) {
        if (payoutMismatch) {
          throw new Error(
            `Payout recipient mismatch. The identity wallet must set payoutRecipient to ${expectedGauge} before an operator can deploy.`,
          )
        }
        if (!operatorPackage) {
          throw new Error('Missing deploy authorization package (identity-signed).')
        }
        if (operatorPackage.auth.owner.toLowerCase() !== owner.toLowerCase()) {
          throw new Error('Authorization owner does not match the canonical identity for this deploy.')
        }
        if (operatorPackage.auth.operator.toLowerCase() !== connected.toLowerCase()) {
          throw new Error('Authorization operator does not match your connected wallet.')
        }
        if (operatorPackage.auth.leftoverRecipient.toLowerCase() !== owner.toLowerCase()) {
          throw new Error('Authorization leftoverRecipient must be the canonical identity wallet.')
        }

        const fundingModel = operatorPackage.auth.fundingModel
        const expectedParamsHash = computeDeployParamsHash({
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

        if (operatorPackage.auth.paramsHash.toLowerCase() !== expectedParamsHash.toLowerCase()) {
          throw new Error('Authorization paramsHash does not match the current deploy parameters.')
        }

        const calls: { to: Address; data: Hex; value?: bigint }[] = []

        if (fundingModel === 0) {
          // Identity-funded: require identity-signed Permit2 payload to be provided.
          if (!operatorPackage.permit2) {
            throw new Error('Identity-funded deploy requires permit2 payload in the authorization package.')
          }
          calls.push({
            to: batcherAddress,
            data: encodeFunctionData({
              abi: CREATOR_VAULT_BATCHER_ABI,
              functionName: 'deployAndLaunchWithPermit2AsOperatorIdentityFunded',
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
                operatorPackage.auth,
                operatorPackage.authSig,
                {
                  permitted: {
                    token: operatorPackage.permit2.permit.permitted.token,
                    amount: operatorPackage.permit2.permit.permitted.amount,
                  },
                  nonce: operatorPackage.permit2.permit.nonce,
                  deadline: operatorPackage.permit2.permit.deadline,
                },
                operatorPackage.permit2.signature,
              ],
            }),
          })
        } else {
          // Operator-funded: operator signs Permit2 now (or could provide it in the package).
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

          const nonce = (0n << 8n) | BigInt(bitPos)
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20)

          const permitSig = (await walletClient.signTypedData({
            account: (walletClient as any).account,
            domain: { name: 'Permit2', chainId: base.id, verifyingContract: permit2 },
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
          })) as Hex

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
                operatorPackage.auth,
                operatorPackage.authSig,
                { permitted: { token: creatorToken, amount: depositAmount }, nonce, deadline },
                permitSig,
              ],
            }),
          })
        }

        try {
          const res = await sendCallsAsync({
            calls: calls.map((c) => ({ to: c.to, data: c.data, value: c.value ?? 0n })),
            account: connected,
            chainId: base.id,
            forceAtomic: true,
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

      const calls: { to: Address; data: Hex; value?: bigint }[] = []

      if (payoutMismatch) {
        calls.push({
          to: creatorToken,
          data: encodeFunctionData({
            abi: CREATOR_COIN_ADMIN_ABI,
            functionName: 'setPayoutRecipient',
            args: [expectedGauge],
          }),
        })
      }

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

        const signature = (await walletClient.signTypedData({
          account: (walletClient as any).account,
          domain: { name: 'Permit2', chainId: base.id, verifyingContract: permit2 },
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
        })) as Hex

        calls.push({
          to: batcherAddress,
          data: encodeFunctionData({
            abi: CREATOR_VAULT_BATCHER_ABI,
            functionName: 'deployAndLaunchWithPermit2',
            args: [
              creatorToken,
              owner,
              owner, // creatorTreasury
              ZERO_ADDRESS, // payoutRecipient is set by the wallet call above (when needed)
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
      if (payoutMismatch) {
        fallbackCalls.push({
          to: creatorToken,
          data: encodeFunctionData({
            abi: CREATOR_COIN_ADMIN_ABI,
            functionName: 'setPayoutRecipient',
            args: [expectedGauge],
          }),
        })
      }
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
          ],
        }),
      })

      try {
        const res = await sendCallsAsync({
          calls: fallbackCalls.map((c) => ({ to: c.to, data: c.data, value: c.value ?? 0n })),
          account: connected,
          chainId: base.id,
          forceAtomic: true,
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

  const disabled = busy || expectedQuery.isLoading || !expected

  return (
    <div className="space-y-3">
      {payoutMismatch ? (
        <div className="text-[11px] text-amber-300/80">
          Payout recipient is not set to the expected gauge controller. Deploy will update it to{' '}
          <span className="font-mono text-amber-200">{shortAddress(expectedGauge!)}</span>.
        </div>
      ) : null}

      <button type="button" onClick={() => void submit()} disabled={disabled} className="btn-accent w-full rounded-lg">
        {busy ? 'Deploying…' : '1‑Click Deploy (AA)'}
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
  const [creatorToken, setCreatorToken] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [deploymentVersion, setDeploymentVersion] = useState<'v1' | 'v2' | 'v3'>('v3')
  const [lastDeployedVault, setLastDeployedVault] = useState<Address | null>(null)
  const [operatorDeployPackageJson, setOperatorDeployPackageJson] = useState('')
  const privyEnabled = Boolean((import.meta.env.VITE_PRIVY_APP_ID as string | undefined)?.trim())

  const [searchParams] = useSearchParams()
  const prefillToken = useMemo(() => searchParams.get('token') ?? '', [searchParams])

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

  const detectedSmartWalletContract = useMemo(() => {
    const code = smartWalletBytecodeQuery.data
    if (!detectedSmartWallet) return null
    if (!code || code === '0x') return null
    return detectedSmartWallet
  }, [detectedSmartWallet, smartWalletBytecodeQuery.data])

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
    isFetching: zoraFetching,
    dataUpdatedAt: zoraUpdatedAt,
    refetch: refetchZoraCoin,
  } = useZoraCoin(
    tokenIsValid ? (creatorToken as Address) : undefined,
  )
  const { data: zoraCreatorProfile } = useZoraProfile(zoraCoin?.creatorAddress)

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

  function formatUsdWhole(n: number): string {
    return Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  }

  function parseIsoToSeconds(iso?: string): number | undefined {
    if (!iso) return undefined
    const ms = Date.parse(iso)
    if (!Number.isFinite(ms)) return undefined
    return Math.floor(ms / 1000)
  }

  const createdAtSeconds = useMemo(() => parseIsoToSeconds(zoraCoin?.createdAt), [zoraCoin?.createdAt])

  const marketCapDisplay = useMemo(() => {
    const raw = zoraCoin?.marketCap
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? formatUsdWhole(n) : '—'
  }, [zoraCoin?.marketCap])

  const volume24hDisplay = useMemo(() => {
    const raw = zoraCoin?.volume24h
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? formatUsdWhole(n) : '—'
  }, [zoraCoin?.volume24h])

  const totalVolumeDisplay = useMemo(() => {
    const raw = zoraCoin?.totalVolume
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? formatUsdWhole(n) : '—'
  }, [zoraCoin?.totalVolume])

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

  const { data: identityTokenBalance } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [((canonicalIdentityAddress ?? ZERO_ADDRESS) as Address) as `0x${string}`],
    query: { enabled: tokenIsValid && !!canonicalIdentityAddress },
  })

  const { data: identityPermit2Allowance } = useReadContract({
    address: tokenIsValid ? (creatorToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [((canonicalIdentityAddress ?? ZERO_ADDRESS) as Address) as `0x${string}`, (CONTRACTS.permit2 as Address) as `0x${string}`],
    query: { enabled: tokenIsValid && !!canonicalIdentityAddress && isAddress(String(CONTRACTS.permit2 ?? '')) },
  })

  const creatorAllowlistQuery = useCreatorAllowlist(tokenIsValid ? { coin: creatorToken } : undefined)
  const allowlistMode = creatorAllowlistQuery.data?.mode
  const allowlistEnforced = allowlistMode === 'enforced'
  const isAllowlistedCreator = creatorAllowlistQuery.data?.allowed === true
  const passesCreatorAllowlist = allowlistMode === 'disabled' ? true : isAllowlistedCreator

  const selectedOwnerAddress = selectedOwnerWallet

  void selectedOwnerAddress // reserved for future “deploy as smart wallet” UX
  void selectedOwnerTokenBalance // reserved for future funding UX


  // NOTE: We previously supported an optional “fund owner wallet” helper flow, but it’s not wired into
  // the current UX. Keeping the deploy path deterministic + minimal for now.

  const poolCurrencyAddress = useMemo(() => {
    const c = zoraCoin?.poolCurrencyToken?.address ? String(zoraCoin.poolCurrencyToken.address) : ''
    return isAddress(c) ? (c as Address) : null
  }, [zoraCoin?.poolCurrencyToken?.address])

  const coinAddress = useMemo(() => {
    const c = zoraCoin?.address ? String(zoraCoin.address) : ''
    return isAddress(c) ? (c as Address) : null
  }, [zoraCoin?.address])

  const poolCurrencyDecimals = useMemo(() => {
    const d = zoraCoin?.poolCurrencyToken?.decimals
    return typeof d === 'number' && Number.isFinite(d) ? d : 18
  }, [zoraCoin?.poolCurrencyToken?.decimals])

  const creatorEarningsQuery = useQuery({
    queryKey: [
      'onchain',
      'coinMarketRewardsByCoin',
      payoutRecipient ?? 'missing',
      poolCurrencyAddress ?? 'missing',
      coinAddress ?? 'missing',
      createdAtSeconds ?? 0,
    ],
    queryFn: async () => {
      if (!payoutRecipient || !poolCurrencyAddress || !coinAddress) return {}
      return await fetchCoinMarketRewardsByCoinFromApi({
        recipient: payoutRecipient,
        currency: poolCurrencyAddress,
        coin: coinAddress,
        createdAtSeconds,
      })
    },
    enabled: false, // user-triggered (can be slow on first run)
    staleTime: 1000 * 60 * 10,
  })

  const creatorEarningsDisplay = useMemo(() => {
    const map = creatorEarningsQuery.data
    if (!map || !coinAddress) return '—'
    const raw = map[coinAddress.toLowerCase()]
    if (raw === undefined) return '—'

    // Convert currency amount to decimal.
    const amountCurrency = Number(formatUnits(raw, poolCurrencyDecimals))
    if (!Number.isFinite(amountCurrency)) return '—'

    // If pool currency is already USD (USDC), show 1:1.
    const poolName = zoraCoin?.poolCurrencyToken?.name ? String(zoraCoin.poolCurrencyToken.name).toUpperCase() : ''
    if (poolName.includes('USDC') || poolName.includes('USD')) return formatUsdWhole(amountCurrency)

    // Otherwise estimate USD using Zora-provided pricing:
    // poolTokenPriceInUsdc ~= coinPriceInUsdc / coinPriceInPoolToken
    const priceInUsdc = zoraCoin?.tokenPrice?.priceInUsdc ? Number(zoraCoin.tokenPrice.priceInUsdc) : NaN
    const priceInPoolToken = zoraCoin?.tokenPrice?.priceInPoolToken ? Number(zoraCoin.tokenPrice.priceInPoolToken) : NaN
    const poolTokenPriceInUsdc =
      Number.isFinite(priceInUsdc) && Number.isFinite(priceInPoolToken) && priceInPoolToken > 0
        ? priceInUsdc / priceInPoolToken
        : NaN

    const usd = Number.isFinite(poolTokenPriceInUsdc) ? amountCurrency * poolTokenPriceInUsdc : NaN
    return Number.isFinite(usd) ? formatUsdWhole(usd) : '—'
  }, [
    creatorEarningsQuery.data,
    coinAddress,
    poolCurrencyDecimals,
    zoraCoin?.poolCurrencyToken?.name,
    zoraCoin?.tokenPrice?.priceInUsdc,
    zoraCoin?.tokenPrice?.priceInPoolToken,
  ])

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

  const operatorPackageParse = useMemo(() => parseOperatorDeployPackage(operatorDeployPackageJson), [operatorDeployPackageJson])
  const operatorPackage: OperatorDeployPackage | null = operatorPackageParse.ok ? operatorPackageParse.value : null

  const deployCodeIds = useMemo(() => {
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

  const operatorPackageValidation = useMemo(() => {
    if (!connectedWalletAddress || !canonicalIdentityAddress) {
      return { operatorMode: false, valid: false, error: null as string | null, fundingModel: null as 0 | 1 | null }
    }

    const operatorMode = connectedWalletAddress.toLowerCase() !== canonicalIdentityAddress.toLowerCase()
    if (!operatorMode) {
      return { operatorMode, valid: false, error: null as string | null, fundingModel: null as 0 | 1 | null }
    }

    if (!operatorPackageParse.ok) {
      return { operatorMode, valid: false, error: operatorPackageParse.error, fundingModel: null as 0 | 1 | null }
    }

    if (!tokenIsValid) return { operatorMode, valid: false, error: 'Enter a valid token address.', fundingModel: null as 0 | 1 | null }
    if (!derivedShareSymbol || !derivedShareName || !derivedVaultName || !derivedVaultSymbol) {
      return { operatorMode, valid: false, error: 'Missing derived token metadata.', fundingModel: null as 0 | 1 | null }
    }

    const pkg = operatorPackageParse.value

    if (pkg.auth.owner.toLowerCase() !== canonicalIdentityAddress.toLowerCase()) {
      return { operatorMode, valid: false, error: 'Authorization owner does not match canonical identity.', fundingModel: null as 0 | 1 | null }
    }
    if (pkg.auth.operator.toLowerCase() !== connectedWalletAddress.toLowerCase()) {
      return { operatorMode, valid: false, error: 'Authorization operator does not match your connected wallet.', fundingModel: null as 0 | 1 | null }
    }
    if (pkg.auth.leftoverRecipient.toLowerCase() !== canonicalIdentityAddress.toLowerCase()) {
      return { operatorMode, valid: false, error: 'leftoverRecipient must be the canonical identity wallet.', fundingModel: null as 0 | 1 | null }
    }

    const now = BigInt(Math.floor(Date.now() / 1000))
    if (pkg.auth.deadline <= now) {
      return { operatorMode, valid: false, error: 'Authorization deadline is expired.', fundingModel: null as 0 | 1 | null }
    }

    const auctionSteps = encodeUniswapCcaLinearSteps(DEFAULT_CCA_DURATION_BLOCKS)
    const expectedParamsHash = computeDeployParamsHash({
      creatorToken: creatorToken as Address,
      owner: canonicalIdentityAddress,
      creatorTreasury: canonicalIdentityAddress,
      payoutRecipient: ZERO_ADDRESS,
      vaultName: derivedVaultName,
      vaultSymbol: derivedVaultSymbol,
      shareName: derivedShareName,
      shareSymbol: derivedShareSymbol,
      version: deploymentVersion,
      depositAmount: MIN_FIRST_DEPOSIT,
      auctionPercent: DEFAULT_AUCTION_PERCENT,
      requiredRaise: DEFAULT_REQUIRED_RAISE_WEI,
      floorPriceQ96: DEFAULT_FLOOR_PRICE_Q96_ALIGNED,
      auctionSteps,
      codeIds: deployCodeIds,
      leftoverRecipient: canonicalIdentityAddress,
      fundingModel: pkg.auth.fundingModel,
    })

    if (pkg.auth.paramsHash.toLowerCase() !== expectedParamsHash.toLowerCase()) {
      return { operatorMode, valid: false, error: 'paramsHash does not match current deploy parameters.', fundingModel: null as 0 | 1 | null }
    }

    if (pkg.auth.fundingModel === 0 && !pkg.permit2) {
      return { operatorMode, valid: false, error: 'Identity-funded deploy requires permit2 payload in the package.', fundingModel: 0 }
    }

    return { operatorMode, valid: true, error: null as string | null, fundingModel: pkg.auth.fundingModel }
  }, [
    canonicalIdentityAddress,
    connectedWalletAddress,
    creatorToken,
    deployCodeIds,
    deploymentVersion,
    derivedShareName,
    derivedShareSymbol,
    derivedVaultName,
    derivedVaultSymbol,
    operatorPackageParse,
    tokenIsValid,
  ])

  const isAuthorizedDeployerOrOperator = isAuthorizedDeployer || operatorPackageValidation.valid

  const funderHasMinDeposit = useMemo(() => {
    if (!operatorPackageValidation.operatorMode) return walletHasMinDeposit
    if (!operatorPackageValidation.valid) return false
    if (operatorPackageValidation.fundingModel === 0) {
      return typeof identityTokenBalance === 'bigint' && identityTokenBalance >= MIN_FIRST_DEPOSIT
    }
    return walletHasMinDeposit
  }, [identityTokenBalance, operatorPackageValidation.fundingModel, operatorPackageValidation.operatorMode, operatorPackageValidation.valid, walletHasMinDeposit])

  const identityHasPermit2Approval = useMemo(() => {
    return typeof identityPermit2Allowance === 'bigint' && identityPermit2Allowance >= MIN_FIRST_DEPOSIT
  }, [identityPermit2Allowance])

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
    funderHasMinDeposit &&
    batcherConfigured &&
    (!identity.blockingReason || operatorPackageValidation.valid) &&
    // Identity-funded operator deploys require the identity to have pre-approved Permit2 for the token.
    (!operatorPackageValidation.operatorMode ||
      operatorPackageValidation.fundingModel !== 0 ||
      identityHasPermit2Approval)

  return (
    <div className="relative">
      <section className="cinematic-section">
        <div className="max-w-3xl mx-auto px-6">
          <div className="space-y-8">
            {/* Header */}
            <div className="space-y-3">
              <span className="label">Deploy</span>
              <h1 className="headline text-4xl sm:text-6xl">Deploy Vault</h1>
              <p className="text-zinc-600 text-sm font-light">
                Deploy a vault for your Creator Coin on Base. Only the creator or current payout recipient can deploy. Deploy is invite-only during
                early launch.
              </p>
            </div>

            {/* Feature Callout: 1-Click Deployment */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-gradient-to-br from-brand-primary/10 to-brand-accent/5 border border-brand-primary/20 p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-brand-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-sm font-medium mb-1">1-Click Deployment</h3>
                  <p className="text-zinc-500 text-xs leading-relaxed mb-3">
                    Powered by <span className="text-white">EIP-4337</span> account abstraction and <span className="text-white">EIP-5792</span>{' '}
                    batching. Gas sponsorship is optional (via a paymaster); otherwise you’ll pay gas.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-400 bg-black/40 border border-white/5 rounded-full px-2.5 py-1">
                      <ShieldCheck className="w-3 h-3 text-brand-primary" />
                      Optional gas sponsorship
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-400 bg-black/40 border border-white/5 rounded-full px-2.5 py-1">
                      <BarChart3 className="w-3 h-3 text-brand-primary" />
                      Atomic batch execution
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-400 bg-black/40 border border-white/5 rounded-full px-2.5 py-1">
                      <Lock className="w-3 h-3 text-brand-primary" />
                      EIP-5792 smart wallet batching
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

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

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${coinTypePillClass}`}>
                          {coinTypeLabel}
                        </span>
                        <Link
                          to={`/coin/${creatorToken}/manage`}
                          className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
                        >
                          Manage
                        </Link>
                      </div>
                    </div>

                    {/* Key rows */}
                    <div className="space-y-0">
                      {zoraCoin?.creatorAddress && (
                        <div className="data-row">
                          <div className="label">Creator</div>
                          <div className="text-xs text-zinc-300">
                            {zoraCreatorProfile?.handle
                              ? `@${zoraCreatorProfile.handle}`
                              : shortAddress(String(zoraCoin.creatorAddress))}
                          </div>
                        </div>
                      )}

                      {payoutRecipient && (
                        <div className="data-row">
                          <div className="label">Payout recipient</div>
                          <div className="text-xs text-zinc-300 font-mono">{shortAddress(payoutRecipient)}</div>
                        </div>
                      )}

                      {zoraCoin?.poolCurrencyToken?.name && (
                        <div className="data-row">
                          <div className="label">Paired token</div>
                          <div className="text-xs text-zinc-300">
                            {String(zoraCoin.poolCurrencyToken.name).toUpperCase()}
                          </div>
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

                    {/* Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-4 bg-black/30 border border-zinc-900/50 rounded-lg">
                        <div className="flex items-center justify-between gap-2">
                          <div className="label">Market cap</div>
                          {zoraCoin ? (
                            <button
                              type="button"
                              onClick={() => refetchZoraCoin()}
                              disabled={zoraLoading || zoraFetching}
                              className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-50"
                              title={zoraUpdatedAt ? `Last updated: ${new Date(zoraUpdatedAt).toLocaleTimeString()}` : 'Refresh'}
                            >
                              {zoraLoading || zoraFetching ? '…' : 'Refresh'}
                            </button>
                          ) : null}
                        </div>
                        <div className="text-sm font-mono text-emerald-400 mt-2">{marketCapDisplay}</div>
                      </div>
                      <div className="p-4 bg-black/30 border border-zinc-900/50 rounded-lg">
                        <div className="label">24h volume</div>
                        <div className="text-sm font-mono text-zinc-200 mt-2">{volume24hDisplay}</div>
                        <div className="text-[10px] text-zinc-700 mt-2">Total: {totalVolumeDisplay}</div>
                      </div>
                      <div className="p-4 bg-black/30 border border-zinc-900/50 rounded-lg">
                        <div className="flex items-center justify-between gap-2">
                          <div className="label">Creator earnings</div>
                          {payoutRecipient && poolCurrencyAddress && coinAddress ? (
                            <button
                              type="button"
                              onClick={() => creatorEarningsQuery.refetch()}
                              disabled={creatorEarningsQuery.isFetching}
                              className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-50"
                              title="Computed from onchain reward events (can take ~30-60s the first time)."
                            >
                              {creatorEarningsQuery.isFetching ? 'Computing…' : creatorEarningsQuery.data ? 'Refresh' : 'Compute'}
                            </button>
                          ) : null}
                        </div>
                        <div className="text-sm font-mono text-zinc-200 mt-2">
                          {creatorEarningsQuery.isFetching ? '…' : creatorEarningsDisplay}
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

            {/* Settings */}
            <div className="card rounded-xl p-6 space-y-6">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-1">
                  <div className="label">Settings</div>
                  <div className="text-xs text-zinc-600">
                    Most creators won’t need to change anything here.
                  </div>
                </div>
                {isConnected ? (
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    {showAdvanced ? 'Hide advanced' : 'Advanced'}
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
                      <div className="text-xs text-zinc-600">Open Advanced if you need to paste a coin address.</div>
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

              {/* Deployment */}
              {isConnected && showAdvanced ? (
                <div className="pt-3 border-t border-zinc-900/50 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="label">Deployment</div>
                    <div className="text-[10px] text-zinc-700">
                      {deploymentVersion === 'v3' ? 'Default (v3)' : deploymentVersion === 'v2' ? 'Alt (v2)' : 'Legacy (v1)'}
                    </div>
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
                    v1 is a legacy fallback and is admin-only.
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
              ) : null}

              {/* Smart Wallet Requirement */}
              {isConnected ? (
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
                        {privyEnabled && coinSmartWallet ? <PrivySmartWalletConnect target={coinSmartWallet} /> : null}
                      </div>
                    ) : null}

                    <div className="text-xs text-zinc-600 space-y-3">
                      <div>
                        Deployment executes onchain from your <span className="text-white">connected wallet</span>. It must hold the first{' '}
                        <span className="text-white font-medium">50,000,000 {underlyingSymbolUpper || 'TOKENS'}</span> deposit.
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

              {isConnected && showAdvanced && !isSignedIn ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                  <div className="text-amber-300/90 text-sm font-medium">Optional sign-in (admin tools)</div>
                  <div className="text-amber-300/70 text-xs leading-relaxed">
                    Sign in to unlock admin-only deployment modes and advanced diagnostics. Deployment itself is executed onchain.
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
                      operatorPackageValidation.operatorMode
                        ? 'Authorized only: paste an identity-signed deploy authorization, or connect the canonical identity wallet.'
                        : 'Authorized only: connect the coin’s creator/payout wallet (or an owner wallet for the coin owner address).'
                    )
                  ) : (
                    operatorPackageValidation.operatorMode
                      ? 'Authorized only: paste an identity-signed deploy authorization, or connect the canonical identity wallet.'
                      : 'Authorized only: connect the coin’s creator or payout recipient wallet to deploy'
                  )}
                </button>
              ) : tokenIsValid && zoraCoin && identity.blockingReason && !operatorPackageValidation.valid ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                  <div className="text-amber-300/90 text-sm font-medium">Identity mismatch</div>
                  <div className="text-amber-300/70 text-xs leading-relaxed">{identity.blockingReason}</div>
                  <div className="pt-2 space-y-2">
                    <div className="text-[11px] text-amber-300/70">
                      If you’re using an execution wallet, paste an identity-signed deploy authorization package that binds identity + operator +
                      deploy params.
                    </div>
                    {farcasterVerifiedEthAddresses.length > 0 ? (
                      <div className="text-[11px] text-amber-300/70">
                        Verified wallets (Farcaster, suggestion-only):{' '}
                        <span className="font-mono text-amber-200">
                          {farcasterVerifiedEthAddresses.map((a) => shortAddress(a)).join(', ')}
                        </span>
                      </div>
                    ) : null}
                    <textarea
                      value={operatorDeployPackageJson}
                      onChange={(e) => setOperatorDeployPackageJson(e.target.value)}
                      placeholder='{"auth":{...},"authSig":"0x...","permit2":{...}}'
                      rows={6}
                      className="w-full bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-[11px] text-zinc-300 placeholder:text-zinc-700 outline-none font-mono"
                    />
                    {operatorPackageValidation.error ? (
                      <div className="text-[11px] text-amber-300/80">{operatorPackageValidation.error}</div>
                    ) : null}
                    {operatorPackageParse.ok && operatorPackageValidation.operatorMode && !operatorPackageValidation.valid ? (
                      <div className="text-[11px] text-amber-300/80">
                        Tip: ensure the authorization was generated for this wallet ({shortAddress(String(connectedWalletAddress))}) and current
                        deploy parameters.
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
              ) : tokenIsValid && zoraCoin && operatorPackageValidation.operatorMode && operatorPackageValidation.fundingModel === 0 && !identityHasPermit2Approval ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  Identity wallet must approve Permit2 for this token before an operator can deploy
                </button>
              ) : tokenIsValid && zoraCoin && !funderHasMinDeposit ? (
                <button
                  disabled
                  className="w-full py-4 bg-black/30 border border-zinc-900/60 rounded-lg text-zinc-600 text-sm cursor-not-allowed"
                >
                  {operatorPackageValidation.operatorMode && operatorPackageValidation.fundingModel === 0
                    ? `Identity wallet needs 50,000,000 ${underlyingSymbolUpper || 'TOKENS'} to deploy & launch`
                    : `Your wallet needs 50,000,000 ${underlyingSymbolUpper || 'TOKENS'} to deploy & launch`}
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
                    shareSymbol={derivedShareSymbol}
                    shareName={derivedShareName}
                    vaultSymbol={derivedVaultSymbol}
                    vaultName={derivedVaultName}
                    deploymentVersion={deploymentVersion}
                    currentPayoutRecipient={payoutRecipient}
                    operatorPackage={operatorPackageValidation.valid ? operatorPackage : null}
                    onSuccess={(a) => setLastDeployedVault(a.vault)}
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

              <div className="text-xs text-zinc-600 space-y-1">
                <p>Designed for one wallet confirmation (some wallets may require multiple confirmations).</p>
                <p>Requires a 50M token deposit to start the fair launch.</p>
                <p>Advanced: v3 is the default. v1 is admin-only.</p>
                <p>For best results, use a smart wallet that supports `wallet_sendCalls` batching.</p>
              </div>
            </div>

            {/* Status */}
            <div className="card rounded-xl p-8 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="label">Status</div>
                <Link
                  to="/status"
                  className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors whitespace-nowrap"
                >
                  Open
                </Link>
              </div>

              <div className="flex items-start justify-between gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-zinc-200 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-300" />
                    Verification checks
                  </div>
                  <div className="text-xs text-zinc-600 max-w-prose">
                    Verify your vault wiring on Base and generate a shareable report. If a fix is available, it requires an owner transaction.
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/status"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-black/30 border border-zinc-900/60 px-5 py-3 text-sm text-zinc-200 hover:text-white hover:border-white/10 transition-colors"
                >
                  Open status checks
                </Link>

                {lastDeployedVault ? (
                  <Link
                    to={`/status?vault=${encodeURIComponent(lastDeployedVault)}`}
                    className="w-full sm:w-auto btn-accent rounded-lg px-5 py-3 text-sm text-center"
                  >
                    Verify this vault
                  </Link>
                ) : null}
              </div>

              {lastDeployedVault ? (
                <div className="text-[10px] text-zinc-700">
                  Vault: <span className="font-mono break-all text-zinc-500">{lastDeployedVault}</span>
                </div>
              ) : (
                <div className="text-[10px] text-zinc-700">Tip: after deploying, use the vault address shown in the Deploy details panel.</div>
              )}
            </div>

            {/* Contracts (details) */}
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
          </div>
        </div>
      </div>
      </section>
    </div>
  )
}
