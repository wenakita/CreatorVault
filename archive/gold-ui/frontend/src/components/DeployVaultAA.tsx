/**
 * Phase 2 (AA): Full vault deployment in ONE signature.
 *
 * Implementation:
 * - Uses a small on-chain CREATE2 deployer (Create2Deployer) to deploy contracts from calldata.
 * - Uses EIP-5792 batching (wagmi `useSendCalls`) so the user signs once.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { useSendCalls } from 'wagmi/experimental'
import { base } from 'wagmi/chains'
import { useOnchainKit } from '@coinbase/onchainkit'
import {
  createPublicClient,
  type Address,
  type Hex,
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  formatUnits,
  getCreate2Address,
  isAddress,
  http,
  keccak256,
  parseAbiParameters,
} from 'viem'
import { waitForCallsStatus } from 'viem/actions'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart3, CheckCircle, Copy, ExternalLink, Layers, Loader, Lock, Rocket, ShieldCheck } from 'lucide-react'
import { CONTRACTS } from '@/config/contracts'
import { DerivedTokenIcon } from '@/components/DerivedTokenIcon'
import { DEPLOY_BYTECODE } from '@/deploy/bytecode.generated'

const MIN_FIRST_DEPOSIT = 50_000_000n * 10n ** 18n
const DEFAULT_AUCTION_PERCENT = 50 // 50%
const DEFAULT_REQUIRED_RAISE_WEI = 100_000_000_000_000_000n // 0.1 ETH
// Uniswap CCA uses Q96 fixed-point prices for `floorPrice` and `tickSpacing`.
const Q96 = 2n ** 96n
const DEFAULT_FLOOR_PRICE_ETH_WEI_PER_TOKEN = 1_000_000_000_000_000n // 0.001 ETH / token (human-friendly)
const DEFAULT_FLOOR_PRICE_Q96 = (DEFAULT_FLOOR_PRICE_ETH_WEI_PER_TOKEN * Q96) / 10n ** 18n
// Use ~1% tick spacing, and snap floor price onto a tick boundary (floorPrice % tickSpacing == 0).
const DEFAULT_TICK_SPACING_Q96_RAW = DEFAULT_FLOOR_PRICE_Q96 / 100n
const DEFAULT_TICK_SPACING_Q96 = DEFAULT_TICK_SPACING_Q96_RAW > 1n ? DEFAULT_TICK_SPACING_Q96_RAW : 2n
const DEFAULT_FLOOR_PRICE_Q96_ALIGNED = (DEFAULT_FLOOR_PRICE_Q96 / DEFAULT_TICK_SPACING_Q96) * DEFAULT_TICK_SPACING_Q96
const DEFAULT_CCA_DURATION_BLOCKS = 302_400n // ~7 days on Base at ~2s blocks (must match CCALaunchStrategy defaultDuration)

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

const CCA_ADMIN_ABI = [
  { type: 'function', name: 'setApprovedLauncher', stateMutability: 'nonpayable', inputs: [{ name: 'launcher', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [] },
  { type: 'function', name: 'setOracleConfig', stateMutability: 'nonpayable', inputs: [{ name: '_oracle', type: 'address' }, { name: '_poolManager', type: 'address' }, { name: '_taxHook', type: 'address' }, { name: '_feeRecipient', type: 'address' }], outputs: [] },
  { type: 'function', name: 'setDefaultTickSpacing', stateMutability: 'nonpayable', inputs: [{ name: '_spacing', type: 'uint256' }], outputs: [] },
] as const

const WRAPPER_VIEW_ABI = [
  { type: 'function', name: 'shareOFT', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const VAULT_VIEW_ABI = [
  { type: 'function', name: 'gaugeController', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'whitelist', stateMutability: 'view', inputs: [{ name: '_account', type: 'address' }], outputs: [{ type: 'bool' }] },
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

const VAULT_OWNER_ABI = [
  { type: 'function', name: 'setGaugeController', stateMutability: 'nonpayable', inputs: [{ name: '_gaugeController', type: 'address' }], outputs: [] },
  { type: 'function', name: 'setWhitelist', stateMutability: 'nonpayable', inputs: [{ name: '_account', type: 'address' }, { name: '_status', type: 'bool' }], outputs: [] },
] as const

const SHAREOFT_VIEW_ABI = [
  { type: 'function', name: 'vault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'gaugeController', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'isMinter', stateMutability: 'view', inputs: [{ name: 'minter', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const

const CCA_VIEW_ABI = [
  { type: 'function', name: 'approvedLaunchers', stateMutability: 'view', inputs: [{ name: 'launcher', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const

const GAUGE_ORACLE_VIEW_ABI = [
  { type: 'function', name: 'oracle', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const CCA_ORACLE_CONFIG_VIEW_ABI = [
  { type: 'function', name: 'oracle', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'poolManager', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'taxHook', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'feeRecipient', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const ORACLE_VIEW_ABI = [
  { type: 'function', name: 'chainlinkFeed', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'creatorSymbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const

const REGISTRY_LZ_VIEW_ABI = [
  { type: 'function', name: 'getLayerZeroEndpoint', stateMutability: 'view', inputs: [{ name: '_chainId', type: 'uint16' }], outputs: [{ type: 'address' }] },
] as const

const OFT_BOOTSTRAP_ABI = [
  { type: 'function', name: 'setLayerZeroEndpoint', stateMutability: 'nonpayable', inputs: [{ name: 'chainId', type: 'uint16' }, { name: 'endpoint', type: 'address' }], outputs: [] },
] as const

const BYTECODE_STORE_VIEW_ABI = [
  { type: 'function', name: 'pointers', stateMutability: 'view', inputs: [{ name: 'codeId', type: 'bytes32' }], outputs: [{ type: 'address' }] },
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

const ERC20_APPROVE_ABI = [
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
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

const COINBASE_SMART_WALLET_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
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

const OWNABLE_ABI = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'transferOwnership', stateMutability: 'nonpayable', inputs: [{ name: 'newOwner', type: 'address' }], outputs: [] },
] as const

type DeploymentAddresses = {
  vault: Address
  wrapper: Address
  shareOFT: Address
  gaugeController: Address
  ccaStrategy: Address
  oracle: Address
}

type DeploymentVersion = 'v1' | 'v2' | 'v3'

interface DeployVaultAAProps {
  creatorToken: Address
  /** ShareOFT symbol, e.g. "wsAKITA" */
  symbol: string
  /** ShareOFT name, e.g. "Wrapped AKITA Share" */
  name: string
  /**
   * Optional: deploy a "fresh" stack for the same coin + owner by changing the CREATE2 salts.
   * - v1: legacy deterministic addresses
   * - v2: upgrade path (new deterministic addresses)
   * - v3: latest deterministic addresses (fresh namespace; avoids collisions with earlier test deploys)
   */
  deploymentVersion?: DeploymentVersion
  /** Creator treasury for GaugeController (defaults to connected address) */
  creatorTreasury?: Address
  /**
   * Optional: execute deployment *as* this account (e.g. a smart wallet contract),
   * while signing the outer transaction with the connected wallet if it is an owner.
   */
  executeAs?: Address
  onSuccess?: (addresses: DeploymentAddresses) => void
}

function deriveSalts(params: { creatorToken: Address; owner: Address; chainId: number; version: DeploymentVersion }) {
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

// Chain-agnostic salts for cross-chain IDENTICAL ShareOFT deployments.
function deriveShareOftUniversalSalt(params: { owner: Address; shareSymbol: string; version: DeploymentVersion }) {
  const base = keccak256(encodePacked(['address', 'string'], [params.owner, params.shareSymbol.toLowerCase()]))
  return keccak256(encodePacked(['bytes32', 'string'], [base, `CreatorShareOFT:${params.version}`]))
}

function deriveOftBootstrapSalt() {
  return keccak256(encodePacked(['string'], ['CreatorVault:OFTBootstrapRegistry:v1']))
}

function encodeCreate2FactoryDeployData(salt: Hex, initCode: Hex): Hex {
  // Universal factory expects: bytes32 salt || initCode
  return concatHex([salt, initCode])
}

function predictCreate2Address(create2Deployer: Address, salt: Hex, initCode: Hex): Address {
  const bytecodeHash = keccak256(initCode)
  return getCreate2Address({ from: create2Deployer, salt, bytecodeHash })
}

function encodeUniswapCcaLinearSteps(durationBlocks: bigint): Hex {
  // Uniswap CCA expects `auctionStepsData` as packed bytes8 steps:
  // step = uint24(mps) || uint40(blockDelta)  (total: 8 bytes)
  // and requires sum(mps * blockDelta) == 10_000_000 (1e7, "MPS" = 100%).
  const MPS = 10_000_000n
  if (durationBlocks <= 0n) return '0x'

  const mpsLow = MPS / durationBlocks
  const remainder = MPS - mpsLow * durationBlocks // number of blocks that need +1 mps to hit exactly 1e7
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

const OVERSIZED_DATA_RE = /oversized data|data too large|payload too large|request too large|too large/i
const FAILED_TO_CREATE_RE = /fail(?:ed)? to create|unknown error|internal error/i
const USER_REJECTED_RE = /user rejected|rejected the request|action_rejected|denied|cancel(?:led)?/i

function extractErrorText(e: any): string {
  if (!e) return ''
  if (typeof e === 'string') return e
  if (typeof e === 'number' || typeof e === 'boolean') return String(e)

  const parts = [
    e?.shortMessage,
    e?.message,
    e?.details,
    e?.cause?.shortMessage,
    e?.cause?.message,
    e?.cause?.details,
  ].filter(Boolean)

  const joined = parts.map(String).join(' ')
  if (joined.trim().length > 0) return joined

  // Last resort: try to serialize unknown error shapes.
  try {
    const s = JSON.stringify(e)
    return s === '{}' ? String(e) : s
  } catch {
    return String(e)
  }
}

function isUserRejectedError(e: any): boolean {
  return USER_REJECTED_RE.test(extractErrorText(e))
}

export function DeployVaultAA({
  creatorToken,
  symbol,
  name,
  deploymentVersion: deploymentVersionProp,
  creatorTreasury,
  executeAs,
  onSuccess,
}: DeployVaultAAProps) {
  const { address, connector } = useAccount()
  const publicClient = usePublicClient({ chainId: base.id })
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const { sendCallsAsync } = useSendCalls()
  const { config: onchainKitConfig } = useOnchainKit()

  const [deploymentVersion, setDeploymentVersion] = useState<DeploymentVersion>(deploymentVersionProp ?? 'v3')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [callBundleId, setCallBundleId] = useState<string | null>(null)
  const [callBundleType, setCallBundleType] = useState<'tx' | 'bundle' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [addresses, setAddresses] = useState<DeploymentAddresses | null>(null)
  const [copiedAddress, setCopiedAddress] = useState<Address | null>(null)
  const [step, setStep] = useState(0)
  const [success, setSuccess] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [wasGasSponsored, setWasGasSponsored] = useState(false)
  const [compatibilityNotice, setCompatibilityNotice] = useState<string | null>(null)
  const [sponsorshipDebug, setSponsorshipDebug] = useState<string | null>(null)
  const [allowCompatibilityMode, setAllowCompatibilityMode] = useState(false)

  const steps = useMemo(() => {
    return ['Preparing', 'Confirm in wallet', 'Deploying', 'Verifying', 'Complete']
  }, [])

  const paymasterUrlForUi = useMemo(() => {
    const v = onchainKitConfig?.paymaster ?? null
    return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
  }, [onchainKitConfig])

  const isPaymasterConfigured = useMemo(() => {
    return !!paymasterUrlForUi
  }, [paymasterUrlForUi])

  async function deploy(versionOverride?: DeploymentVersion) {
    setError(null)
    setErrorDetails(null)
    setCallBundleId(null)
    setCallBundleType(null)
    setAddresses(null)
    setSuccess(false)
    setShowDetails(false)
    setStep(0)
    setWasGasSponsored(false)
    setCompatibilityNotice(null)
    setSponsorshipDebug(null)

    const version = versionOverride ?? deploymentVersion
    if (versionOverride && versionOverride !== deploymentVersion) setDeploymentVersion(versionOverride)

    if (!address) {
      setError('Connect your wallet to deploy.')
      return
    }
    if (!publicClient) {
      setError('Network client not ready. Please try again.')
      return
    }
    if (!walletClient) {
      setError('Wallet not ready. Please reconnect and try again.')
      return
    }
    if (!isAddress(creatorToken)) {
      setError('Invalid creator coin address.')
      return
    }

    const fail = (message: string, details?: string): never => {
      const err: any = new Error(message)
      err.isUserFacing = true
      if (details) err.details = details
      throw err
    }

    const failUserRejected = (details?: string): never => {
      const err: any = new Error('User rejected the request.')
      err.isUserFacing = true
      if (details) err.details = details
      throw err
    }

    const failNeedsCompatibility = (details?: string): never => {
      const err: any = new Error('Gas-free 1-click deployment is not available in this wallet session.')
      err.isUserFacing = true
      err.details =
        details && details.trim().length > 0
          ? `${details}\n\nTip: reconnect using Coinbase Smart Wallet, or enable “Compatibility mode” to allow multi-tx fallback.`
          : 'Tip: reconnect using Coinbase Smart Wallet, or enable “Compatibility mode” to allow multi-tx fallback.'
      throw err
    }

    const signer = address as Address
    const owner = (executeAs ?? signer) as Address
    const treasury = (creatorTreasury ?? owner) as Address

    const create2Factory = CONTRACTS.create2Factory as Address
    const create2Deployer = CONTRACTS.create2Deployer as Address
    const protocolTreasury = CONTRACTS.protocolTreasury as Address
    const registry = CONTRACTS.registry as Address

    const lotteryManager = (CONTRACTS.lotteryManager ?? '0x0000000000000000000000000000000000000000') as Address
    const poolManager = CONTRACTS.poolManager as Address
    const taxHook = CONTRACTS.taxHook as Address
    const chainlinkEthUsd = CONTRACTS.chainlinkEthUsd as Address
    const vaultActivationBatcher = CONTRACTS.vaultActivationBatcher as Address

    const isDelegatedSmartWallet = owner.toLowerCase() !== signer.toLowerCase()

    // wagmi will route `useSendCalls()` through the active connector.
    // If the connector doesn't know about the Smart Wallet account, it fails with:
    // "Account <smartWallet> not found for connector <X>".
    // We preflight this so we can give a clear action to the user.
    const connectorId = String((connector as any)?.id ?? '')
    const connectorName = String((connector as any)?.name ?? (connectorId || 'Unknown connector'))
    const connectorSupportsSmartWalletAccount =
      connectorId === 'coinbaseWalletSDK' ||
      connectorId === 'farcaster' ||
      connectorId === 'privy' ||
      connectorName.toLowerCase().includes('privy')
    const forceCompatibilityMode = isDelegatedSmartWallet && !connectorSupportsSmartWalletAccount
    const compatibilityEnabled = allowCompatibilityMode || forceCompatibilityMode

    if (forceCompatibilityMode) {
      setCompatibilityNotice(
        `Connected via ${connectorName}. Using your EOA to execute Smart Wallet batch (gas fees apply). Connect Coinbase Smart Wallet for gas-free 1-click.`,
      )
      setAllowCompatibilityMode(true)
    }

    // Paymaster sponsorship (Coinbase CDP via OnchainKitProvider) when available.
    // Note: Only smart wallets support paymaster-backed batching. EOAs will ignore this.
    const sponsoredCapabilities =
      paymasterUrlForUi
        ? ({ paymasterService: { url: paymasterUrlForUi } } as const)
        : undefined

    setIsSubmitting(true)
    try {

      // Preflight:
      // - If executing as a smart wallet contract (owner != signer), require signer to be an owner,
      //   then we can call executeBatch (EOA pays the outer tx gas; smart wallet is msg.sender for inner calls).
      if (isDelegatedSmartWallet) {
        // Preflight: "deploy as" must be a deployed contract, and signer must be an owner.
        try {
          const code = await publicClient.getBytecode({ address: owner })
          if (!code || code === '0x') {
            fail('The selected owner wallet is not deployed on Base.')
          }
        } catch {
          fail('Failed to verify the selected owner wallet on Base.')
        }

        try {
          const ok = await publicClient.readContract({
            address: owner,
            abi: COINBASE_SMART_WALLET_ABI,
            functionName: 'isOwnerAddress',
            args: [signer],
          })
          if (!ok) {
            fail('Connected wallet is not an on-chain owner of the selected owner wallet.')
          }
        } catch {
          fail('Selected owner wallet is not supported for batched execution.')
        }
      }

      // Dependency preflight: fail early if critical protocol addresses are misconfigured.
      // (If these are wrong, constructors like CreatorShareOFT/Oracle will revert mid-batch.)
      try {
        const requiredAddrs: Address[] = [create2Factory, create2Deployer, registry, vaultActivationBatcher]
        requiredAddrs.push(poolManager, taxHook, chainlinkEthUsd)

        const codes = await Promise.all(requiredAddrs.map((a) => publicClient.getBytecode({ address: a })))
        const missing = requiredAddrs.filter((_, i) => !codes[i] || codes[i] === '0x')
        if (missing.length) {
          fail(
            'Deployment is temporarily unavailable. Please try again later.',
            `Missing bytecode for: ${missing.join(', ')}`,
          )
        }
      } catch {
        fail('Failed to verify deployment dependencies. Please try again.')
      }

      // Naming (used for user-facing errors and on-chain metadata)
      const underlyingSymbol = symbol.startsWith('ws') ? symbol.slice(2) : symbol
      const vaultName = `${underlyingSymbol} Vault Share`
      const vaultSymbol = `s${underlyingSymbol}`

      // Require creator to have the minimum deposit up-front (we will deposit+launch at the end of this flow).
      // This prevents "deploy without launch" states that confuse users and creates a consistent minimum liquidity baseline.
      try {
        let bal = (await publicClient.readContract({
          address: creatorToken,
          abi: ERC20_APPROVE_ABI,
          functionName: 'balanceOf',
          args: [owner],
        })) as unknown as bigint
        if (typeof bal !== 'bigint') fail('Failed to check your token balance.')

        // Reliability: wagmi's fallback transport can sometimes route to lagging public RPCs.
        // If we *think* the user is below the minimum, do a second opinion read against a
        // deterministic RPC (VITE_BASE_RPC -> mainnet.base.org) before blocking the deploy.
        if (bal < MIN_FIRST_DEPOSIT) {
          const candidateUrls = [
            (import.meta.env.VITE_BASE_RPC as string | undefined)?.trim(),
            'https://mainnet.base.org',
          ].filter((u): u is string => !!u && u.length > 0)

          const seen = new Set<string>()
          for (const url of candidateUrls) {
            if (seen.has(url)) continue
            seen.add(url)
            try {
              const strictClient = createPublicClient({
                chain: base,
                transport: http(url, { timeout: 10_000, retryCount: 1, retryDelay: 250 }),
              })
              const alt = (await strictClient.readContract({
                address: creatorToken,
                abi: ERC20_APPROVE_ABI,
                functionName: 'balanceOf',
                args: [owner],
              })) as unknown as bigint
              if (typeof alt === 'bigint' && alt > bal) bal = alt
              if (bal >= MIN_FIRST_DEPOSIT) break
            } catch {
              // ignore and try next
            }
          }
        }

        if (bal < MIN_FIRST_DEPOSIT) {
          const human = Number(formatUnits(bal, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })
          fail(
            `You need at least 50,000,000 ${underlyingSymbol.toUpperCase()} to deploy & launch.`,
            `Owner wallet ${owner} balance: ${human} ${underlyingSymbol.toUpperCase()}`,
          )
        }
      } catch (e: any) {
        // Preserve our own user-facing errors (e.g. "need 50M") instead of wrapping them.
        if (e?.isUserFacing) throw e
        // If the token doesn't behave like an ERC20, bubble up a useful error.
        fail('Failed to verify your token balance.', String(e?.shortMessage || e?.message || 'balanceOf failed'))
      }

    // Salts
    const salts = deriveSalts({ creatorToken, owner, chainId: base.id, version })

    // Cross-chain deterministic ShareOFT:
    // - v1: deployed via the universal CREATE2 factory (0x4e59…)
    // - v2+: prefer deploying via the universal bytecode store (small calldata; Smart Wallet friendly),
    //        when the infra is deployed + seeded.
    //
    // Salt does NOT include chainId or local creatorToken.
    const oftBootstrapSalt = deriveOftBootstrapSalt()
    const oftBootstrapInitCode = DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex
    const shareOftSalt = deriveShareOftUniversalSalt({ owner, shareSymbol: symbol, version })

    const universalBytecodeStore = (CONTRACTS as any).universalBytecodeStore as Address | undefined
    const universalCreate2FromStore = (CONTRACTS as any).universalCreate2DeployerFromStore as Address | undefined

    const ZERO = '0x0000000000000000000000000000000000000000'
    const bootstrapCodeId = keccak256(oftBootstrapInitCode)
    const shareOftCodeId = keccak256(DEPLOY_BYTECODE.CreatorShareOFT as Hex)

    // Optional AA optimization: deploy *all* contracts from the universal bytecode store when available.
    // This keeps `wallet_sendCalls` payloads small enough for true 1-click deployment.
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
          publicClient.getBytecode({ address: universalBytecodeStore }),
          publicClient.getBytecode({ address: universalCreate2FromStore }),
        ])
        if (storeCode && storeCode !== '0x' && deployerCode && deployerCode !== '0x') {
          const codeIds = [bootstrapCodeId, shareOftCodeId, vaultCodeId, wrapperCodeId, gaugeCodeId, ccaCodeId, oracleCodeId] as const
          const ptrs = await Promise.all(
            codeIds.map((codeId) =>
              publicClient.readContract({
                address: universalBytecodeStore,
                abi: BYTECODE_STORE_VIEW_ABI,
                functionName: 'pointers',
                args: [codeId],
              }),
            ),
          )
          const has = (i: number) => (ptrs[i] as Address).toLowerCase() !== ZERO
          useUniversalOftStore = has(0) && has(1)
          useUniversalFullStore = useUniversalOftStore && has(2) && has(3) && has(4) && has(5) && has(6)
        }
      } catch {
        useUniversalOftStore = false
        useUniversalFullStore = false
      }
    }

    const localCreate2Deployer = useUniversalFullStore ? universalCreate2FromStore! : create2Deployer

    // Init codes (constructor args appended)
    const vaultConstructorArgs = encodeAbiParameters(parseAbiParameters('address,address,string,string'), [
      creatorToken,
      owner,
      vaultName,
      vaultSymbol,
    ])
    const vaultInitCode = concatHex([DEPLOY_BYTECODE.CreatorOVault as Hex, vaultConstructorArgs])
    const vaultAddress = predictCreate2Address(localCreate2Deployer, salts.vaultSalt, vaultInitCode)

    const wrapperConstructorArgs = encodeAbiParameters(parseAbiParameters('address,address,address'), [
      creatorToken,
      vaultAddress,
      owner,
    ])
    const wrapperInitCode = concatHex([DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex, wrapperConstructorArgs])
    const wrapperAddress = predictCreate2Address(localCreate2Deployer, salts.wrapperSalt, wrapperInitCode)

    const oftBootstrapRegistry = predictCreate2Address(
      useUniversalOftStore ? universalCreate2FromStore! : create2Factory,
      oftBootstrapSalt,
      oftBootstrapInitCode,
    )

    const shareOftConstructorArgs = encodeAbiParameters(parseAbiParameters('string,string,address,address'), [
      name,
      symbol,
      oftBootstrapRegistry,
      owner,
    ])
    const shareOftInitCode = concatHex([DEPLOY_BYTECODE.CreatorShareOFT as Hex, shareOftConstructorArgs])
    const shareOftAddress = predictCreate2Address(
      useUniversalOftStore ? universalCreate2FromStore! : create2Factory,
      shareOftSalt,
      shareOftInitCode,
    )

    const gaugeConstructorArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address'), [
      shareOftAddress,
      treasury,
      protocolTreasury,
      owner,
    ])
    const gaugeInitCode = concatHex([DEPLOY_BYTECODE.CreatorGaugeController as Hex, gaugeConstructorArgs])
    const gaugeAddress = predictCreate2Address(localCreate2Deployer, salts.gaugeSalt, gaugeInitCode)

    const ccaConstructorArgs = encodeAbiParameters(parseAbiParameters('address,address,address,address,address'), [
      shareOftAddress,
      '0x0000000000000000000000000000000000000000',
      vaultAddress,
      vaultAddress,
      owner,
    ])
    const ccaInitCode = concatHex([DEPLOY_BYTECODE.CCALaunchStrategy as Hex, ccaConstructorArgs])
    const ccaAddress = predictCreate2Address(localCreate2Deployer, salts.ccaSalt, ccaInitCode)

    const oracleConstructorArgs = encodeAbiParameters(parseAbiParameters('address,address,string,address'), [
      registry,
      chainlinkEthUsd,
      symbol,
      owner,
    ])
    const oracleInitCode = concatHex([DEPLOY_BYTECODE.CreatorOracle as Hex, oracleConstructorArgs])
    const oracleAddress = predictCreate2Address(localCreate2Deployer, salts.oracleSalt, oracleInitCode)

    const predicted: DeploymentAddresses = {
      vault: vaultAddress,
      wrapper: wrapperAddress,
      shareOFT: shareOftAddress,
      gaugeController: gaugeAddress,
      ccaStrategy: ccaAddress,
      oracle: oracleAddress,
    }
    setAddresses(predicted)

    // Pre-flight: ensure addresses are free
    if (!publicClient) {
      fail('Network client not ready. Please try again.')
    }
    const existingBytecodes = await Promise.all([
      publicClient.getBytecode({ address: vaultAddress }),
      publicClient.getBytecode({ address: wrapperAddress }),
      publicClient.getBytecode({ address: shareOftAddress }),
      publicClient.getBytecode({ address: gaugeAddress }),
      publicClient.getBytecode({ address: ccaAddress }),
      publicClient.getBytecode({ address: oracleAddress }),
    ])
    const vaultExists = !!existingBytecodes[0] && existingBytecodes[0] !== '0x'
    const wrapperExists = !!existingBytecodes[1] && existingBytecodes[1] !== '0x'
    const shareOftExists = !!existingBytecodes[2] && existingBytecodes[2] !== '0x'
    const gaugeExists = !!existingBytecodes[3] && existingBytecodes[3] !== '0x'
    const ccaExists = !!existingBytecodes[4] && existingBytecodes[4] !== '0x'
    const oracleExists = !!existingBytecodes[5] && existingBytecodes[5] !== '0x'

    // ShareOFT bootstrap (cross-chain deterministic):
    // - Deploy deterministic `OFTBootstrapRegistry` on the universal factory (0x4e59…) if missing
    // - Set this chain's LayerZero endpoint on it
    // - Deploy ShareOFT via the universal factory with a chain-agnostic salt
    const bootstrapCode = await publicClient.getBytecode({ address: oftBootstrapRegistry })
    const bootstrapExists = !!bootstrapCode && bootstrapCode !== '0x'

    // Resolve LayerZero endpoint for this chain (required for ShareOFT bootstrap).
    // Initialize to a dummy address so TS can prove assignment; any failure throws via `fail()`.
    let resolvedLzEndpoint = '0x0000000000000000000000000000000000000000' as Address
    try {
      resolvedLzEndpoint = (await publicClient.readContract({
        address: registry,
        abi: REGISTRY_LZ_VIEW_ABI,
        functionName: 'getLayerZeroEndpoint',
        args: [base.id],
      })) as Address
    } catch {
      fail('Failed to resolve LayerZero endpoint from registry.')
    }

    // Build call batch.
    // NOTE: Some wallets (including Coinbase Wallet) can reject very large transaction calldata with
    // "oversized data" when we try to submit everything as a single Smart Wallet executeBatch().
    // To support that case, we keep the deployment initcode-heavy calls separate from the
    // owner-only wiring/launch calls so we can fall back to a multi-tx flow when needed.
    const deployCalls: { to: Address; data: Hex; value?: bigint }[] = []
    const wiringCalls: { to: Address; data: Hex; value?: bigint }[] = []
    const launchCalls: { to: Address; data: Hex; value?: bigint }[] = []

    // Deploy contracts
    if (!vaultExists) {
      deployCalls.push(
        useUniversalFullStore
          ? {
              to: universalCreate2FromStore!,
              data: encodeFunctionData({
                abi: UNIVERSAL_CREATE2_FROM_STORE_ABI,
                functionName: 'deploy',
                args: [salts.vaultSalt, vaultCodeId, vaultConstructorArgs],
              }),
            }
          : {
              to: create2Deployer,
              data: encodeFunctionData({
                abi: CREATE2_DEPLOYER_ABI,
                functionName: 'deploy',
                args: [salts.vaultSalt, vaultInitCode],
              }),
            },
      )
    }
    if (!wrapperExists) {
      deployCalls.push(
        useUniversalFullStore
          ? {
              to: universalCreate2FromStore!,
              data: encodeFunctionData({
                abi: UNIVERSAL_CREATE2_FROM_STORE_ABI,
                functionName: 'deploy',
                args: [salts.wrapperSalt, wrapperCodeId, wrapperConstructorArgs],
              }),
            }
          : {
              to: create2Deployer,
              data: encodeFunctionData({
                abi: CREATE2_DEPLOYER_ABI,
                functionName: 'deploy',
                args: [salts.wrapperSalt, wrapperInitCode],
              }),
            },
      )
    }

    // Cross-chain ShareOFT bootstrap + deployment
    // - v1: universal CREATE2 factory (salt || initCode)
    // - v2+: prefer universal bytecode store deployer (small calldata) when available
    if (!bootstrapExists) {
      if (useUniversalOftStore) {
        deployCalls.push({
          to: universalCreate2FromStore!,
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
    deployCalls.push({
      to: oftBootstrapRegistry,
      data: encodeFunctionData({ abi: OFT_BOOTSTRAP_ABI, functionName: 'setLayerZeroEndpoint', args: [base.id, resolvedLzEndpoint] }),
    })
    if (!shareOftExists) {
      if (useUniversalOftStore) {
        deployCalls.push({
          to: universalCreate2FromStore!,
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
    if (!gaugeExists) {
      deployCalls.push(
        useUniversalFullStore
          ? {
              to: universalCreate2FromStore!,
              data: encodeFunctionData({
                abi: UNIVERSAL_CREATE2_FROM_STORE_ABI,
                functionName: 'deploy',
                args: [salts.gaugeSalt, gaugeCodeId, gaugeConstructorArgs],
              }),
            }
          : {
              to: create2Deployer,
              data: encodeFunctionData({
                abi: CREATE2_DEPLOYER_ABI,
                functionName: 'deploy',
                args: [salts.gaugeSalt, gaugeInitCode],
              }),
            },
      )
    }
    if (!ccaExists) {
      deployCalls.push(
        useUniversalFullStore
          ? {
              to: universalCreate2FromStore!,
              data: encodeFunctionData({
                abi: UNIVERSAL_CREATE2_FROM_STORE_ABI,
                functionName: 'deploy',
                args: [salts.ccaSalt, ccaCodeId, ccaConstructorArgs],
              }),
            }
          : {
              to: create2Deployer,
              data: encodeFunctionData({
                abi: CREATE2_DEPLOYER_ABI,
                functionName: 'deploy',
                args: [salts.ccaSalt, ccaInitCode],
              }),
            },
      )
    }
    if (!oracleExists) {
      deployCalls.push(
        useUniversalFullStore
          ? {
              to: universalCreate2FromStore!,
              data: encodeFunctionData({
                abi: UNIVERSAL_CREATE2_FROM_STORE_ABI,
                functionName: 'deploy',
                args: [salts.oracleSalt, oracleCodeId, oracleConstructorArgs],
              }),
            }
          : {
              to: create2Deployer,
              data: encodeFunctionData({
                abi: CREATE2_DEPLOYER_ABI,
                functionName: 'deploy',
                args: [salts.oracleSalt, oracleInitCode],
              }),
            },
      )
    }

    // Wiring / configuration
    wiringCalls.push({ to: wrapperAddress, data: encodeFunctionData({ abi: WRAPPER_ADMIN_ABI, functionName: 'setShareOFT', args: [shareOftAddress] }) })
    wiringCalls.push({ to: shareOftAddress, data: encodeFunctionData({ abi: SHAREOFT_ADMIN_ABI, functionName: 'setRegistry', args: [registry] }) })
    wiringCalls.push({ to: shareOftAddress, data: encodeFunctionData({ abi: SHAREOFT_ADMIN_ABI, functionName: 'setVault', args: [vaultAddress] }) })
    wiringCalls.push({ to: shareOftAddress, data: encodeFunctionData({ abi: SHAREOFT_ADMIN_ABI, functionName: 'setMinter', args: [wrapperAddress, true] }) })
    wiringCalls.push({ to: shareOftAddress, data: encodeFunctionData({ abi: SHAREOFT_ADMIN_ABI, functionName: 'setGaugeController', args: [gaugeAddress] }) })

    wiringCalls.push({ to: gaugeAddress, data: encodeFunctionData({ abi: GAUGE_ADMIN_ABI, functionName: 'setVault', args: [vaultAddress] }) })
    wiringCalls.push({ to: gaugeAddress, data: encodeFunctionData({ abi: GAUGE_ADMIN_ABI, functionName: 'setWrapper', args: [wrapperAddress] }) })
    wiringCalls.push({ to: gaugeAddress, data: encodeFunctionData({ abi: GAUGE_ADMIN_ABI, functionName: 'setCreatorCoin', args: [creatorToken] }) })
    if (lotteryManager !== '0x0000000000000000000000000000000000000000') {
      wiringCalls.push({ to: gaugeAddress, data: encodeFunctionData({ abi: GAUGE_ADMIN_ABI, functionName: 'setLotteryManager', args: [lotteryManager] }) })
    }
    wiringCalls.push({ to: gaugeAddress, data: encodeFunctionData({ abi: GAUGE_ADMIN_ABI, functionName: 'setOracle', args: [oracleAddress] }) })

    // Vault wiring (owner-only)
    wiringCalls.push({ to: vaultAddress, data: encodeFunctionData({ abi: VAULT_OWNER_ABI, functionName: 'setGaugeController', args: [gaugeAddress] }) })
    wiringCalls.push({ to: vaultAddress, data: encodeFunctionData({ abi: VAULT_OWNER_ABI, functionName: 'setWhitelist', args: [wrapperAddress, true] }) })
    // Defensive: if whitelistEnabled is toggled on later, ensure the activation batcher can still launch (it calls vault.deposit).
    wiringCalls.push({ to: vaultAddress, data: encodeFunctionData({ abi: VAULT_OWNER_ABI, functionName: 'setWhitelist', args: [vaultActivationBatcher, true] }) })

    // CCA: allow VaultActivationBatcher to launch auctions (critical)
    wiringCalls.push({ to: ccaAddress, data: encodeFunctionData({ abi: CCA_ADMIN_ABI, functionName: 'setApprovedLauncher', args: [vaultActivationBatcher, true] }) })

    // CCA: oracle config for V4 graduation path
    wiringCalls.push({
      to: ccaAddress,
      data: encodeFunctionData({
        abi: CCA_ADMIN_ABI,
        functionName: 'setOracleConfig',
        args: [oracleAddress, poolManager, taxHook, gaugeAddress],
      }),
    })

    // CCA config: Uniswap CCA enforces `floorPrice % tickSpacing == 0` and validates the step schedule.
    // We set a sane tick spacing (~1% of floor) before launching.
    wiringCalls.push({
      to: ccaAddress,
      data: encodeFunctionData({
        abi: CCA_ADMIN_ABI,
        functionName: 'setDefaultTickSpacing',
        args: [DEFAULT_TICK_SPACING_Q96],
      }),
    })

    // Launch CCA (required) in one atomic bundle:
    // 1) Approve Wrapper to pull 50M creator tokens
    // 2) Wrapper.deposit(50M) -> mints wsTokens to the owner (normalized 1:1 UX)
    // 3) Approve CCA strategy to pull the auction allocation (default: 50% = 25M)
    // 4) CCA strategy launches auction with Uniswap-compatible step encoding
    const auctionAmount = (MIN_FIRST_DEPOSIT * BigInt(DEFAULT_AUCTION_PERCENT)) / 100n
    const auctionSteps = encodeUniswapCcaLinearSteps(DEFAULT_CCA_DURATION_BLOCKS)

    launchCalls.push({
      to: creatorToken,
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

    // Finalize ownership (security):
    // After the stack is deployed + launched, transfer admin ownership to the protocol multisig.
    // This prevents creators from rerouting fee recipients post-launch.
    const finalizeCalls: { to: Address; data: Hex; value?: bigint }[] = []
    const finalOwner = protocolTreasury
    if (finalOwner.toLowerCase() !== owner.toLowerCase()) {
      const targets: Array<{ addr: Address; exists: boolean; label: string }> = [
        { addr: vaultAddress, exists: vaultExists, label: 'Vault' },
        { addr: wrapperAddress, exists: wrapperExists, label: 'Wrapper' },
        { addr: shareOftAddress, exists: shareOftExists, label: 'Share token' },
        { addr: gaugeAddress, exists: gaugeExists, label: 'Gauge controller' },
        { addr: ccaAddress, exists: ccaExists, label: 'Launch strategy' },
        { addr: oracleAddress, exists: oracleExists, label: 'Oracle' },
      ]

      for (const t of targets) {
        if (!t.exists) {
          finalizeCalls.push({
            to: t.addr,
            data: encodeFunctionData({ abi: OWNABLE_ABI, functionName: 'transferOwnership', args: [finalOwner] }),
          })
          continue
        }

        let currentOwner: Address | null = null
        try {
          currentOwner = (await publicClient.readContract({
            address: t.addr,
            abi: OWNABLE_ABI,
            functionName: 'owner',
          })) as Address
        } catch {
          fail('Failed to verify existing deployment owner.', `${t.label} ${t.addr}`)
        }
        const curLc = String(currentOwner).toLowerCase()
        if (curLc === finalOwner.toLowerCase()) continue
        if (curLc !== owner.toLowerCase()) {
          fail(
            'This deployment is already owned by a different address. Please contact support.',
            `${t.label} owner is ${String(currentOwner)} (expected ${owner} or ${finalOwner})`,
          )
        }
        finalizeCalls.push({
          to: t.addr,
          data: encodeFunctionData({ abi: OWNABLE_ABI, functionName: 'transferOwnership', args: [finalOwner] }),
        })
      }
    }

    const calls = [...deployCalls, ...wiringCalls, ...launchCalls, ...finalizeCalls]

      // Step 1: wallet confirmation
      setStep(1)
      if (isDelegatedSmartWallet) {
        const wc = walletClient

        let usedSponsoredBatching = false
        let lastSponsoredError: string | null = null

        // Preferred: true smart-wallet batching (wallet_sendCalls) so we can use paymaster sponsorship.
        // Fallback: direct EOA tx to Smart Wallet executeBatch (not sponsored).
        const sendBundle = async (bundleCalls: { to: Address; data: Hex; value?: bigint }[]) => {
          let res
          try {
            res = await sendCallsAsync({
            calls: bundleCalls,
            account: owner,
            chainId: base.id,
            forceAtomic: true,
            capabilities: sponsoredCapabilities as any,
            })
          } catch (e: any) {
            if (isUserRejectedError(e)) failUserRejected(extractErrorText(e))
            throw e
          }
          setCallBundleType('bundle')
          setCallBundleId(res.id)
          setStep(2)
          try {
            await waitForCallsStatus(wc, { id: res.id, timeout: 120_000, throwOnFailure: true })
          } catch (e: any) {
            // If the wallet doesn't support status polling, don't treat it as a failure.
            // Otherwise, surface the real failure reason and trigger fallback.
            const msg = extractErrorText(e)
            if (/wallet_getCallsStatus|method not found|unsupported/i.test(msg)) {
              // ignore
            } else {
              if (isUserRejectedError(e)) failUserRejected(msg)
              throw e
            }
          }
          return res
        }

        const tryExecuteBatch = async (batch: { target: Address; value: bigint; data: Hex }[]) => {
          return await wc.writeContract({
            account: signer,
            chain: base as any,
            address: owner,
            abi: COINBASE_SMART_WALLET_ABI,
            functionName: 'executeBatch',
            args: [batch],
          })
        }

        const waitTx = async (hash: Hex) => {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as any, timeout: 120_000 })
          const status = (receipt as any)?.status
          if (status === 'reverted' || status === 0 || status === '0x0') {
            throw new Error('Batched transaction reverted.')
          }
          return receipt
        }

        const runSplitFlow = async (options?: { skipSponsored?: boolean }) => {
          const skipSponsored = options?.skipSponsored === true
          // Try the sponsored smart-wallet path first (preferred).
          // NOTE: This may still require multiple confirmations, but should remain gas-sponsored
          // as long as the paymaster is configured.
          if (!skipSponsored) {
            try {
              // Step 1a: deploy initcode-heavy calls in small bundles (keeps payload size sane)
              for (const c of deployCalls) {
                await sendBundle([c])
              }
              // Step 1b: wiring (small bundle)
              await sendBundle(wiringCalls)
              // Step 1c: launch + finalize ownership (small bundle)
              await sendBundle([...launchCalls, ...finalizeCalls])

              // If we got here, we successfully executed via sponsored sendCalls.
              setWasGasSponsored(true)
              return
            } catch (e: any) {
              lastSponsoredError = extractErrorText(e)
              // Fall through to legacy direct executeBatch() path.
            }
          } else {
            lastSponsoredError = `Connector "${connectorName}" does not support Smart Wallet batching.`
          }

          // If the user hasn't opted in to legacy multi-tx, stop here.
          if (!compatibilityEnabled) {
            setSponsorshipDebug(lastSponsoredError)
            failNeedsCompatibility(lastSponsoredError ?? undefined)
          }

          setCompatibilityNotice(
            'Your wallet could not complete the deployment via sponsored smart-wallet calls. Falling back to a legacy batch/multi-tx flow (may require multiple confirmations and may cost gas).',
          )
          if (lastSponsoredError) {
            setSponsorshipDebug(lastSponsoredError)
          }

          // Compatibility fallback:
          // Some wallets refuse to submit the large executeBatch() payload (initcode-heavy).
          // We split the flow:
          // 1) Deploy contracts directly from the connected EOA (permissionless deployers)
          // 2) Run owner-only wiring via Smart Wallet executeBatch (small calldata)
          // 3) Launch via Smart Wallet executeBatch (small calldata)
          //
          // This requires multiple confirmations, but avoids wallet-side size ceilings.
          setCallBundleType('tx')
          setCallBundleId(null)

          for (const c of deployCalls) {
            const txHash = await wc.sendTransaction({
              account: signer,
              chain: base as any,
              to: c.to,
              data: c.data,
              value: c.value ?? 0n,
            })
            setCallBundleId(String(txHash))
            await waitTx(txHash as any)
          }

          // Wiring tx (do NOT include launch; if launch fails we still want wiring to persist)
          const wiringBatch = wiringCalls.map((c) => ({ target: c.to, value: 0n, data: c.data }))
          const wiringHash = await tryExecuteBatch(wiringBatch)
          setCallBundleId(String(wiringHash))
          setStep(2)
          await waitTx(wiringHash as any)

          // Launch tx (approve + deposit + launch + finalize ownership)
          const launchBatch = [...launchCalls, ...finalizeCalls].map((c) => ({ target: c.to, value: 0n, data: c.data }))
          const launchHash = await tryExecuteBatch(launchBatch)
          setCallBundleId(String(launchHash))
          setStep(2)
          await waitTx(launchHash as any)
        }

        try {
          // First attempt: sponsored smart-wallet batching for the full flow.
          // If the wallet does not support wallet_sendCalls for `account: owner`,
          // or if the payload is too large, we fall back to split execution.
          if (!forceCompatibilityMode) {
            try {
              await sendBundle(calls)
              usedSponsoredBatching = true
              setWasGasSponsored(true)
            } catch (e: any) {
              usedSponsoredBatching = false
              lastSponsoredError = extractErrorText(e)
              if (isUserRejectedError(e)) {
                setSponsorshipDebug(lastSponsoredError)
                failUserRejected(lastSponsoredError)
              }
            }
          } else {
            usedSponsoredBatching = false
            lastSponsoredError = `Connector "${connectorName}" does not support Smart Wallet batching.`
          }

          // If the sponsored path worked, skip the legacy direct executeBatch path entirely.
          if (usedSponsoredBatching) {
            // bytecode polling + post-deploy checks will run below
            // eslint-disable-next-line no-empty
          } else {
            // If we couldn't do the single 1-click bundle, try a sponsored split flow next.
            // Only after that fails do we fall back to legacy executeBatch (gas-paid).
            if (!compatibilityEnabled) {
              setSponsorshipDebug(lastSponsoredError)
              failNeedsCompatibility(lastSponsoredError ?? undefined)
            }

            setCompatibilityNotice(
              'Your wallet could not submit the full deployment as a sponsored 1-click bundle. Trying smaller sponsored bundles (may require multiple confirmations)…',
            )
            if (lastSponsoredError) setSponsorshipDebug(lastSponsoredError)
            await runSplitFlow({ skipSponsored: forceCompatibilityMode })
          }
        } catch (e: any) {
          if (isUserRejectedError(e)) {
            const msg = extractErrorText(e)
            setSponsorshipDebug(msg)
            failUserRejected(msg)
          }
          const msg = extractErrorText(e)
          if (!OVERSIZED_DATA_RE.test(msg) && !FAILED_TO_CREATE_RE.test(msg) && !/revert/i.test(msg)) {
            throw e
          }
          // Retry using split flow.
          setCompatibilityNotice(
            'Your wallet rejected the 1-click deployment payload (likely size or EIP-5792 support). Falling back to split execution (multiple confirmations).',
          )
          setSponsorshipDebug(msg)
          await runSplitFlow({ skipSponsored: forceCompatibilityMode })
        }
      } else {
        const wc = walletClient

        const waitTx = async (hash: Hex) => {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as any, timeout: 120_000 })
          const status = (receipt as any)?.status
          if (status === 'reverted' || status === 0 || status === '0x0') {
            throw new Error('Transaction reverted.')
          }
          return receipt
        }

        const sendTx = async (c: { to: Address; data: Hex; value?: bigint }) => {
          const txHash = await wc.sendTransaction({
            account: owner,
            chain: base as any,
            to: c.to,
            data: c.data,
            value: c.value ?? 0n,
          })
          setCallBundleType('tx')
          setCallBundleId(String(txHash))
          setStep(2)
          await waitTx(txHash as any)
          return txHash
        }

        const runMultiTxFlow = async () => {
          // Compatibility fallback:
          // If the connected wallet does not support EIP-5792 (wallet_sendCalls), fall back to
          // sequential normal transactions (multiple confirmations).
          setCallBundleType('tx')
          setCallBundleId(null)
          setStep(1)

          for (const c of deployCalls) await sendTx(c)
          for (const c of wiringCalls) await sendTx(c)
          for (const c of [...launchCalls, ...finalizeCalls]) await sendTx(c)
        }

        const sendBundle = async (bundleCalls: { to: Address; data: Hex; value?: bigint }[]) => {
          let res
          try {
            res = await sendCallsAsync({
            calls: bundleCalls,
            account: owner,
            chainId: base.id,
            forceAtomic: true,
            capabilities: sponsoredCapabilities as any,
            })
          } catch (e: any) {
            if (isUserRejectedError(e)) failUserRejected(extractErrorText(e))
            throw e
          }
          setCallBundleType('bundle')
          setCallBundleId(res.id)
          setStep(2)
          // Prefer EIP-5792 status (best signal). If unsupported, we fall back to bytecode polling below.
          try {
            await waitForCallsStatus(wc, { id: res.id, timeout: 120_000, throwOnFailure: true })
          } catch (e: any) {
            const msg = extractErrorText(e)
            if (/wallet_getCallsStatus|method not found|unsupported/i.test(msg)) {
              // ignore
            } else {
              if (isUserRejectedError(e)) failUserRejected(msg)
              throw e
            }
          }
          return res
        }

        try {
          await sendBundle(calls)
        } catch (e: any) {
          if (isUserRejectedError(e)) {
            const msg = extractErrorText(e)
            setSponsorshipDebug(msg)
            failUserRejected(msg)
          }
          const msg = extractErrorText(e)
          if (/wallet_sendCalls|sendCalls|5792|capabilit/i.test(msg)) {
            if (!allowCompatibilityMode) {
              setSponsorshipDebug(msg)
              failNeedsCompatibility(msg)
            }

            setCompatibilityNotice(
              'This wallet does not support EIP-5792 batching (wallet_sendCalls). Falling back to multiple transactions (multiple confirmations).',
            )
            await runMultiTxFlow()
          } else if (!OVERSIZED_DATA_RE.test(msg)) {
            throw e
          } else {
            if (!allowCompatibilityMode) {
              setSponsorshipDebug(msg)
              failNeedsCompatibility(msg)
            }

            setCompatibilityNotice(
              'This wallet rejected the 1-click bundle as “too large”. Falling back to multiple smaller bundles (multiple confirmations).',
            )
            // Compatibility fallback:
            // Some wallets refuse to submit a single large `wallet_sendCalls` payload.
            // We split into multiple smaller call bundles (multiple confirmations).
            setCallBundleType('bundle')
            setCallBundleId(null)

            // Step 1a: deploy initcode-heavy calls in small bundles
            for (const c of deployCalls) {
              await sendBundle([c])
            }
            // Step 1b: wiring (small bundle)
            await sendBundle(wiringCalls)
            // Step 1c: launch + finalize ownership (small bundle)
            await sendBundle([...launchCalls, ...finalizeCalls])
          }
        }
      }

      // Bytecode presence polling (works for both sendCalls and executeBatch).
      setStep(2)
      const start = Date.now()
      const timeoutMs = 120_000
      while (true) {
        const codes = await Promise.all([
          publicClient.getBytecode({ address: vaultAddress }),
          publicClient.getBytecode({ address: wrapperAddress }),
          publicClient.getBytecode({ address: shareOftAddress }),
          publicClient.getBytecode({ address: gaugeAddress }),
          publicClient.getBytecode({ address: ccaAddress }),
          publicClient.getBytecode({ address: oracleAddress }),
        ])
        if (codes.every((c) => c && c !== '0x')) break
        if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for deployed bytecode.')
        await new Promise((r) => setTimeout(r, 2000))
      }

      // Post-deploy verification (read-only): confirm wiring + launcher approval.
      setStep(3)
      try {
        const wrapperShare = await publicClient.readContract({
          address: wrapperAddress,
          abi: WRAPPER_VIEW_ABI,
          functionName: 'shareOFT',
        })
        if ((wrapperShare as Address).toLowerCase() !== shareOftAddress.toLowerCase()) {
          throw new Error('Wrapper not wired to ShareOFT.')
        }

        const oftVault = await publicClient.readContract({
          address: shareOftAddress,
          abi: SHAREOFT_VIEW_ABI,
          functionName: 'vault',
        })
        if ((oftVault as Address).toLowerCase() !== vaultAddress.toLowerCase()) {
          throw new Error('ShareOFT not wired to Vault.')
        }

        const isMinter = await publicClient.readContract({
          address: shareOftAddress,
          abi: SHAREOFT_VIEW_ABI,
          functionName: 'isMinter',
          args: [wrapperAddress],
        })
        if (!isMinter) throw new Error('Wrapper is not set as ShareOFT minter.')

        const vaultGauge = await publicClient.readContract({
          address: vaultAddress,
          abi: VAULT_VIEW_ABI,
          functionName: 'gaugeController',
        })
        if ((vaultGauge as Address).toLowerCase() !== gaugeAddress.toLowerCase()) {
          throw new Error('Vault gaugeController not set.')
        }

        const wrapperWhitelisted = await publicClient.readContract({
          address: vaultAddress,
          abi: VAULT_VIEW_ABI,
          functionName: 'whitelist',
          args: [wrapperAddress],
        })
        if (!wrapperWhitelisted) throw new Error('Wrapper is not whitelisted on Vault.')

        const launcherOk = await publicClient.readContract({
          address: ccaAddress,
          abi: CCA_VIEW_ABI,
          functionName: 'approvedLaunchers',
          args: [vaultActivationBatcher],
        })
        if (!launcherOk) throw new Error('CCA did not approve VaultActivationBatcher as launcher.')

        // Confirm the auction was actually launched (deploy flow now includes activation + launch).
        const auctionStatus = (await publicClient.readContract({
          address: ccaAddress,
          abi: CCA_STATUS_VIEW_ABI,
          functionName: 'getAuctionStatus',
        })) as unknown as readonly [Address, boolean, boolean, bigint, bigint]
        const auctionAddr = auctionStatus?.[0]
        const auctionActive = auctionStatus?.[1]
        const ZERO = '0x0000000000000000000000000000000000000000'
        if (!auctionAddr || auctionAddr.toLowerCase() === ZERO) {
          throw new Error('CCA auction was not launched.')
        }
        if (!auctionActive) {
          throw new Error('CCA auction is not active.')
        }

        // Oracle wiring: gauge + CCA should both point to the deployed oracle, and CCA config should match protocol contracts.
        const gaugeOracle = (await publicClient.readContract({
          address: gaugeAddress,
          abi: GAUGE_ORACLE_VIEW_ABI,
          functionName: 'oracle',
        })) as Address
        if (!gaugeOracle || gaugeOracle.toLowerCase() !== oracleAddress.toLowerCase()) {
          throw new Error('Gauge oracle is not set correctly.')
        }

        const [ccaOracle, ccaPoolManager, ccaTaxHook, ccaFeeRecipient] = (await publicClient.multicall({
          contracts: [
            { address: ccaAddress, abi: CCA_ORACLE_CONFIG_VIEW_ABI, functionName: 'oracle' },
            { address: ccaAddress, abi: CCA_ORACLE_CONFIG_VIEW_ABI, functionName: 'poolManager' },
            { address: ccaAddress, abi: CCA_ORACLE_CONFIG_VIEW_ABI, functionName: 'taxHook' },
            { address: ccaAddress, abi: CCA_ORACLE_CONFIG_VIEW_ABI, functionName: 'feeRecipient' },
          ],
          allowFailure: true,
        })) as any

        const ccaOracleAddr = ccaOracle?.status === 'success' ? (ccaOracle.result as Address) : null
        const ccaPmAddr = ccaPoolManager?.status === 'success' ? (ccaPoolManager.result as Address) : null
        const ccaTaxAddr = ccaTaxHook?.status === 'success' ? (ccaTaxHook.result as Address) : null
        const ccaFeeAddr = ccaFeeRecipient?.status === 'success' ? (ccaFeeRecipient.result as Address) : null

        if (!ccaOracleAddr || ccaOracleAddr.toLowerCase() !== oracleAddress.toLowerCase()) {
          throw new Error('CCA oracle config is not set correctly.')
        }
        if (!ccaPmAddr || ccaPmAddr.toLowerCase() !== poolManager.toLowerCase()) {
          throw new Error('CCA poolManager is not set correctly.')
        }
        if (!ccaTaxAddr || ccaTaxAddr.toLowerCase() !== taxHook.toLowerCase()) {
          throw new Error('CCA tax hook is not set correctly.')
        }
        if (!ccaFeeAddr || ccaFeeAddr.toLowerCase() !== gaugeAddress.toLowerCase()) {
          throw new Error('CCA fee recipient is not set correctly.')
        }

        const [oracleFeedRes, oracleSymbolRes] = await publicClient.multicall({
          contracts: [
            { address: oracleAddress, abi: ORACLE_VIEW_ABI, functionName: 'chainlinkFeed' },
            { address: oracleAddress, abi: ORACLE_VIEW_ABI, functionName: 'creatorSymbol' },
          ],
          allowFailure: true,
        })
        const oracleFeed = oracleFeedRes?.status === 'success' ? (oracleFeedRes.result as Address) : null
        const oracleSymbol = oracleSymbolRes?.status === 'success' ? String(oracleSymbolRes.result) : null
        if (!oracleFeed || oracleFeed.toLowerCase() !== chainlinkEthUsd.toLowerCase()) {
          throw new Error('Oracle Chainlink feed is not set correctly.')
        }
        if (!oracleSymbol || oracleSymbol.toLowerCase() !== symbol.toLowerCase()) {
          throw new Error('Oracle symbol is not set correctly.')
        }
      } catch (e: any) {
        fail(
          'Deployment completed, but verification failed. Please check the addresses.',
          String(e?.message || 'Unknown verification error'),
        )
      }

      setStep(4)
      setSuccess(true)
      // Make the “Contracts deployed” summary visible by default (better for demos / screen recordings).
      setShowDetails(true)
      onSuccess?.(predicted)
    } catch (e: any) {
      setError(String(e?.shortMessage || e?.message || 'Deployment failed.'))
      const details = (e as any)?.details
      if (typeof details === 'string' && details.trim().length > 0) setErrorDetails(details)
    } finally {
      setIsSubmitting(false)
    }
  }

  const disabled = isSubmitting || !address
  const canOfferV2 = !!error && /already exists/i.test(error) && deploymentVersion === 'v1'
  const canOfferV3 = !!error && /already exists/i.test(error) && deploymentVersion === 'v2'

  const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`
  const basescanAddressHref = (addr: string) => `https://basescan.org/address/${addr}`
  const vaultSymbol = symbol.startsWith('ws') ? `s${symbol.slice(2)}` : `s${symbol}`
  const vaultName = symbol.startsWith('ws') ? `${symbol.slice(2)} Vault Share` : `${symbol} Vault Share`
  const underlyingSymbolUpper = (symbol.startsWith('ws') ? symbol.slice(2) : symbol).toUpperCase()

  async function copyAddress(addr: Address) {
    try {
      await navigator.clipboard.writeText(addr)
      setCopiedAddress(addr)
      window.setTimeout(() => setCopiedAddress(null), 1200)
    } catch {
      // ignore
    }
  }

  function ContractRow({
    icon,
    label,
    title,
    contractName,
    addr,
    note,
    metaLine,
  }: {
    icon?: ReactNode
    label: string
    title: ReactNode
    contractName: string
    addr: Address
    note?: string
    metaLine?: ReactNode
  }) {
    return (
      <div className="px-4 py-3 grid grid-cols-[56px_minmax(0,1fr)_auto] gap-x-4 items-start hover:bg-white/[0.02] transition-colors">
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
          {note ? (
            <div className="text-[11px] text-zinc-600 leading-relaxed mt-2">{note}</div>
          ) : null}
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <div className="pt-[3px] text-[10px] leading-4 uppercase tracking-[0.34em] text-zinc-500/90 font-medium whitespace-nowrap text-right">
            {label}
          </div>
          <a
            className="font-mono text-xs text-zinc-200 hover:text-white transition-colors inline-flex items-center rounded-md bg-black/20 border border-white/5 px-2 py-1 hover:border-white/10"
            href={basescanAddressHref(addr)}
            target="_blank"
            rel="noreferrer"
            title="View on Basescan"
          >
            {short(addr)}
          </a>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void copyAddress(addr)}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors"
              title="Copy address"
            >
              <Copy className="w-3 h-3" />
              {copiedAddress?.toLowerCase() === addr.toLowerCase() ? 'Copied' : 'Copy'}
            </button>
            <a
              className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors"
              href={basescanAddressHref(addr)}
              target="_blank"
              rel="noreferrer"
              title="Open in new tab"
            >
              <ExternalLink className="w-3 h-3" />
              Basescan
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Gas sponsorship status notice */}
      {isPaymasterConfigured ? (
        <div className="flex items-center gap-2 text-xs text-zinc-500 px-3 py-2 bg-uniswap/5 border border-uniswap/10 rounded-lg">
          <ShieldCheck className="w-3.5 h-3.5 text-uniswap" />
          <span>Gas-free deployment enabled (sponsored by Coinbase CDP)</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-zinc-500 px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg">
          <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" />
          <span>Standard gas fees apply (paymaster not configured)</span>
        </div>
      )}

      {compatibilityNotice ? (
        <div className="flex items-start gap-2 text-xs text-amber-300/80 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-300 mt-0.5" />
          <span className="leading-relaxed">{compatibilityNotice}</span>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-xs text-zinc-500 px-1">
        <input
          type="checkbox"
          checked={allowCompatibilityMode}
          onChange={(e) => setAllowCompatibilityMode(e.target.checked)}
        />
        <span>Compatibility mode (allow multi-tx fallback if gas-free 1-click isn’t available)</span>
      </label>

      <motion.button
        onClick={() => deploy()}
        disabled={disabled}
        whileHover={{ scale: disabled ? 1 : 1.01 }}
        whileTap={{ scale: disabled ? 1 : 0.99 }}
        className="btn-accent w-full rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="relative flex items-center justify-center gap-2">
          <Rocket className="w-4 h-4" />
          <span className="text-sm">{isSubmitting ? 'Deploying & launching…' : 'Deploy + Launch'}</span>
          {isPaymasterConfigured && !disabled && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-uniswap rounded-full text-[9px] text-white font-medium uppercase tracking-wide">
              Gas-Free
            </span>
          )}
        </div>
      </motion.button>

      <AnimatePresence>
        {isSubmitting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden bg-black/30 border border-zinc-900/50 rounded-lg p-4"
          >
            <div className="label">Status</div>
            {steps.map((label, i) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                {i < step ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : i === step ? (
                  <Loader className="w-5 h-5 text-cyan-400 animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-zinc-700" />
                )}
                <span className={i <= step ? 'text-zinc-200' : 'text-zinc-500'}>{label}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {success && !isSubmitting && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-2">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-emerald-200 text-sm font-medium">
                Vault deployed and fair launch started successfully!
              </div>
              {wasGasSponsored && (
                <div className="text-emerald-300/70 text-xs mt-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Gas-free deployment powered by Coinbase CDP paymaster
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm space-y-2">
          <div>{error}</div>
          {canOfferV2 ? (
            <button
              type="button"
              onClick={() => void deploy('v2')}
              className="text-xs text-red-200/90 hover:text-red-100 underline underline-offset-2"
              title="Deploys a one-time v2 stack using new CREATE2 salts (new addresses)"
            >
              Deploy v2 instead
            </button>
          ) : null}
          {canOfferV3 ? (
            <button
              type="button"
              onClick={() => void deploy('v3')}
              className="text-xs text-red-200/90 hover:text-red-100 underline underline-offset-2"
              title="Deploys a fresh v3 stack using a new CREATE2 salt namespace (new addresses)"
            >
              Deploy v3 instead
            </button>
          ) : null}
          {errorDetails ? (
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="text-[10px] text-red-200/80 hover:text-red-100 underline underline-offset-2"
            >
              View details
            </button>
          ) : null}
        </div>
      )}

      {(callBundleId || addresses || errorDetails) && (
        <div className="bg-black/30 border border-zinc-900/50 rounded-lg">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <div className="label">Deployment details</div>
            <div className="text-[10px] text-zinc-600">{showDetails ? 'Hide' : 'Show'}</div>
          </button>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 pb-4 space-y-4 overflow-hidden"
              >
                {callBundleId && (
                  <div className="space-y-1">
                    <div className="label">
                      {callBundleType === 'tx' ? 'Transaction' : 'Deployment ID'}
                    </div>
                    <div className="font-mono text-xs text-zinc-200 break-all">{callBundleId}</div>
                    {callBundleType === 'tx' ? (
                      <a
                        className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
                        href={`https://basescan.org/tx/${callBundleId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View on Basescan
                      </a>
                    ) : null}
                  </div>
                )}

                {errorDetails ? (
                  <div className="space-y-1">
                    <div className="label">Error details</div>
                    <div className="font-mono text-xs text-zinc-400 break-words">{errorDetails}</div>
                  </div>
                ) : null}

                {isPaymasterConfigured ? (
                  <div className="space-y-1">
                    <div className="label">Sponsorship</div>
                    <div className="text-[11px] text-zinc-500 leading-relaxed">
                      Paymaster: <span className="font-mono text-zinc-400 break-all">{String(paymasterUrlForUi ?? 'none')}</span>
                    </div>
                  </div>
                ) : null}

                {sponsorshipDebug ? (
                  <div className="space-y-1">
                    <div className="label">Sponsorship debug</div>
                    <div className="font-mono text-xs text-zinc-400 break-words">{sponsorshipDebug}</div>
                    <div className="text-[11px] text-zinc-600 leading-relaxed">
                      If this mentions <span className="font-mono">origin</span> or <span className="font-mono">unauthorized</span>, double-check the CDP key Domain allowlist.
                    </div>
                  </div>
                ) : null}

                {addresses ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="label">{success ? 'Contracts deployed' : 'Deployment addresses'}</div>
                      <div className="text-[10px] text-zinc-600">
                        {success
                          ? 'Designed for one confirmation.'
                          : callBundleId
                            ? 'Deterministic addresses for this deployment.'
                            : 'Deterministic addresses (not deployed yet).'}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-[#080808]/60 backdrop-blur-2xl overflow-hidden divide-y divide-white/5">
                      <div className="px-4 py-2 text-[10px] uppercase tracking-wide text-zinc-500 bg-white/[0.02]">
                        Core stack
                      </div>
                      <ContractRow
                        label="Vault token"
                        title={`${vaultName} (${vaultSymbol})`}
                        contractName="CreatorOVault"
                        addr={addresses.vault}
                        note="Core vault that holds creator coin deposits and mints shares."
                        icon={
                          <div className="w-14 h-14 rounded-full bg-black/30 border border-white/5 shadow-[inset_0_0_24px_rgba(0,0,0,0.9)] flex items-center justify-center text-zinc-500">
                            <Lock className="w-5 h-5" />
                          </div>
                        }
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
                      <ContractRow
                        label="Share token"
                        title={`Wrapped ${vaultName} (${symbol})`}
                        contractName="CreatorShareOFT"
                        addr={addresses.shareOFT}
                        note="Wrapped vault shares token (wsToken) used for routing fees."
                        icon={
                          <DerivedTokenIcon
                            tokenAddress={creatorToken}
                            symbol={underlyingSymbolUpper || 'TOKEN'}
                            variant="share"
                            size="lg"
                          />
                        }
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
                      <ContractRow
                        label="Wrapper"
                        title="Vault Wrapper"
                        contractName="CreatorOVaultWrapper"
                        addr={addresses.wrapper}
                        note="Wraps/unlocks vault shares into the wsToken."
                        icon={
                          <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                            <Layers className="w-4 h-4" />
                          </div>
                        }
                      />
                      <ContractRow
                        label="Gauge controller"
                        title="Fees & incentives"
                        contractName="CreatorGaugeController"
                        addr={addresses.gaugeController}
                        note="Routes fees (burn / lottery / voters) and manages gauges."
                        icon={
                          <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                            <BarChart3 className="w-4 h-4" />
                          </div>
                        }
                      />
                      <ContractRow
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
                        addr={addresses.ccaStrategy}
                        note="Runs Uniswap’s Continuous Clearing Auction (CCA) for fair price discovery."
                        icon={
                          <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                            <Rocket className="w-4 h-4" />
                          </div>
                        }
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
                      {addresses.oracle ? (
                        <ContractRow
                          label="Oracle"
                          title="Price oracle"
                          contractName="CreatorOracle"
                          addr={addresses.oracle}
                          note="Price oracle used by the auction and strategies."
                          icon={
                            <div className="w-8 h-8 flex items-center justify-center text-zinc-600">
                              <ShieldCheck className="w-4 h-4" />
                            </div>
                          }
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
                      ) : null}

                      <div className="px-4 py-3 text-[12px] text-zinc-500">
                        Yield strategies are deployed after launch (post-auction) to keep the initial deployment deterministic and compatible with
                        wallet simulation.
                      </div>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
