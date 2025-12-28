/**
 * Phase 2 (AA): Full vault deployment in ONE signature.
 *
 * Implementation:
 * - Uses a small on-chain CREATE2 deployer (Create2Deployer) to deploy contracts from calldata.
 * - Uses EIP-5792 batching (wagmi `useSendCalls`) so the user signs once.
 */

import { useMemo, useState } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { useSendCalls } from 'wagmi/experimental'
import { base } from 'wagmi/chains'
import {
  type Address,
  type Hex,
  concatHex,
  createWalletClient,
  custom,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getCreate2Address,
  isAddress,
  keccak256,
  parseAbiParameters,
} from 'viem'
import { waitForCallsStatus } from 'viem/actions'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Loader, Rocket } from 'lucide-react'
import { CONTRACTS } from '@/config/contracts'
import { DEPLOY_BYTECODE } from '@/deploy/bytecode.generated'

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

const VAULT_ADMIN_ABI = [
  { type: 'function', name: 'setGaugeController', stateMutability: 'nonpayable', inputs: [{ name: '_gaugeController', type: 'address' }], outputs: [] },
  { type: 'function', name: 'setWhitelist', stateMutability: 'nonpayable', inputs: [{ name: '_account', type: 'address' }, { name: '_status', type: 'bool' }], outputs: [] },
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
] as const

const WRAPPER_VIEW_ABI = [
  { type: 'function', name: 'shareOFT', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const VAULT_VIEW_ABI = [
  { type: 'function', name: 'gaugeController', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'whitelist', stateMutability: 'view', inputs: [{ name: '_account', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const

const SHAREOFT_VIEW_ABI = [
  { type: 'function', name: 'vault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'gaugeController', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'isMinter', stateMutability: 'view', inputs: [{ name: 'minter', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const

const CCA_VIEW_ABI = [
  { type: 'function', name: 'approvedLaunchers', stateMutability: 'view', inputs: [{ name: 'launcher', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const

const REGISTRY_LZ_VIEW_ABI = [
  { type: 'function', name: 'getLayerZeroEndpoint', stateMutability: 'view', inputs: [{ name: '_chainId', type: 'uint16' }], outputs: [{ type: 'address' }] },
] as const

const OFT_BOOTSTRAP_ABI = [
  { type: 'function', name: 'setLayerZeroEndpoint', stateMutability: 'nonpayable', inputs: [{ name: 'chainId', type: 'uint16' }, { name: 'endpoint', type: 'address' }], outputs: [] },
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

type DeploymentAddresses = {
  vault: Address
  wrapper: Address
  shareOFT: Address
  gaugeController: Address
  ccaStrategy: Address
  oracle?: Address
}

interface DeployVaultAAProps {
  creatorToken: Address
  /** ShareOFT symbol, e.g. "wsAKITA" */
  symbol: string
  /** ShareOFT name, e.g. "Wrapped AKITA Share" */
  name: string
  /** Creator treasury for GaugeController (defaults to connected address) */
  creatorTreasury?: Address
  /**
   * Optional: execute deployment *as* this account (e.g. a Coinbase Smart Wallet contract),
   * while signing the outer transaction with the connected wallet if it is an owner.
   */
  executeAs?: Address
  /** Whether to deploy and wire the oracle (larger calldata, more gas) */
  includeOracle?: boolean
  onSuccess?: (addresses: DeploymentAddresses) => void
}

function makeInitCode(bytecode: Hex, types: string, values: readonly unknown[]): Hex {
  const encoded = encodeAbiParameters(parseAbiParameters(types), values as any)
  return concatHex([bytecode, encoded])
}

function deriveSalts(params: { creatorToken: Address; owner: Address; chainId: number }) {
  const { creatorToken, owner, chainId } = params
  const baseSalt = keccak256(encodePacked(['address', 'address', 'uint256'], [creatorToken, owner, BigInt(chainId)]))
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
function deriveShareOftUniversalSalt(params: { owner: Address; shareSymbol: string }) {
  const base = keccak256(encodePacked(['address', 'string'], [params.owner, params.shareSymbol.toLowerCase()]))
  return keccak256(encodePacked(['bytes32', 'string'], [base, 'CreatorShareOFT:v1']))
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

export function DeployVaultAA({
  creatorToken,
  symbol,
  name,
  creatorTreasury,
  executeAs,
  includeOracle = true,
  onSuccess,
}: DeployVaultAAProps) {
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: base.id })
  const { sendCallsAsync } = useSendCalls()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [callBundleId, setCallBundleId] = useState<string | null>(null)
  const [callBundleType, setCallBundleType] = useState<'tx' | 'bundle' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string | null>(null)
  const [addresses, setAddresses] = useState<DeploymentAddresses | null>(null)
  const [step, setStep] = useState(0)
  const [success, setSuccess] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const steps = useMemo(() => {
    return ['Preparing', 'Confirm in wallet', 'Deploying', 'Verifying', 'Complete']
  }, [])

  async function deploy() {
    setError(null)
    setErrorDetails(null)
    setCallBundleId(null)
    setCallBundleType(null)
    setAddresses(null)
    setSuccess(false)
    setShowDetails(false)
    setStep(0)

    if (!address) {
      setError('Connect your wallet to deploy.')
      return
    }
    if (!publicClient) {
      setError('Network client not ready. Please try again.')
      return
    }
    if (!window.ethereum) {
      setError('No wallet detected. Please use Coinbase Wallet / Smart Wallet.')
      return
    }
    if (!isAddress(creatorToken)) {
      setError('Invalid creator coin address.')
      return
    }

    const fail = (message: string, details?: string): never => {
      const err: any = new Error(message)
      if (details) err.details = details
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

    setIsSubmitting(true)
    try {

      // Preflight:
      // - If executing as a Coinbase Smart Wallet contract (owner != signer), require signer to be an owner,
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
            fail('Connected wallet is not an owner of the selected smart wallet.')
          }
        } catch {
          fail('Selected owner wallet is not a supported Coinbase Smart Wallet.')
        }
      }

      // Dependency preflight: fail early if critical protocol addresses are misconfigured.
      // (If these are wrong, constructors like CreatorShareOFT/Oracle will revert mid-batch.)
      try {
        const requiredAddrs: Address[] = [create2Factory, create2Deployer, registry, vaultActivationBatcher]
        if (includeOracle) requiredAddrs.push(poolManager, taxHook, chainlinkEthUsd)

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

    // Naming
    const underlyingSymbol = symbol.startsWith('ws') ? symbol.slice(2) : symbol
    const vaultName = `CreatorVault: ${underlyingSymbol}`
    const vaultSymbol = `s${underlyingSymbol}`

    // Salts
    const salts = deriveSalts({ creatorToken, owner, chainId: base.id })

    // Cross-chain deterministic ShareOFT:
    // - Deployed via the universal CREATE2 factory (0x4e59…)
    // - Salt does NOT include chainId or local creatorToken
    // - Constructor arg `_registry` is a deterministic bootstrap contract address (same on all chains),
    //   and is immediately replaced via `setRegistry(registry)` after deployment.
    const oftBootstrapSalt = deriveOftBootstrapSalt()
    const oftBootstrapInitCode = DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex
    const oftBootstrapRegistry = predictCreate2Address(create2Factory, oftBootstrapSalt, oftBootstrapInitCode)

    const shareOftSalt = deriveShareOftUniversalSalt({ owner, shareSymbol: symbol })

    // Init codes (constructor args appended)
    const vaultInitCode = makeInitCode(
      DEPLOY_BYTECODE.CreatorOVault as Hex,
      'address,address,string,string',
      [creatorToken, owner, vaultName, vaultSymbol],
    )
    const vaultAddress = predictCreate2Address(create2Deployer, salts.vaultSalt, vaultInitCode)

    const wrapperInitCode = makeInitCode(
      DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex,
      'address,address,address',
      [creatorToken, vaultAddress, owner],
    )
    const wrapperAddress = predictCreate2Address(create2Deployer, salts.wrapperSalt, wrapperInitCode)

    const shareOftInitCode = makeInitCode(
      DEPLOY_BYTECODE.CreatorShareOFT as Hex,
      'string,string,address,address',
      [name, symbol, oftBootstrapRegistry, owner],
    )
    const shareOftAddress = predictCreate2Address(create2Factory, shareOftSalt, shareOftInitCode)

    const gaugeInitCode = makeInitCode(
      DEPLOY_BYTECODE.CreatorGaugeController as Hex,
      'address,address,address,address',
      [shareOftAddress, treasury, protocolTreasury, owner],
    )
    const gaugeAddress = predictCreate2Address(create2Deployer, salts.gaugeSalt, gaugeInitCode)

    const ccaInitCode = makeInitCode(
      DEPLOY_BYTECODE.CCALaunchStrategy as Hex,
      'address,address,address,address,address',
      [shareOftAddress, '0x0000000000000000000000000000000000000000', vaultAddress, vaultAddress, owner],
    )
    const ccaAddress = predictCreate2Address(create2Deployer, salts.ccaSalt, ccaInitCode)

    const oracleInitCode = includeOracle
      ? makeInitCode(
          DEPLOY_BYTECODE.CreatorOracle as Hex,
          'address,address,string,address',
          [registry, chainlinkEthUsd, symbol, owner],
        )
      : undefined
    const oracleAddress = includeOracle && oracleInitCode
      ? predictCreate2Address(create2Deployer, salts.oracleSalt, oracleInitCode)
      : undefined

    const predicted: DeploymentAddresses = {
      vault: vaultAddress,
      wrapper: wrapperAddress,
      shareOFT: shareOftAddress,
      gaugeController: gaugeAddress,
      ccaStrategy: ccaAddress,
      ...(oracleAddress ? { oracle: oracleAddress } : {}),
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
      ...(oracleAddress ? [publicClient.getBytecode({ address: oracleAddress })] : []),
    ])
    if (existingBytecodes.some((x) => x && x !== '0x')) {
      fail('A vault already exists for this coin + owner wallet.')
    }

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

    // Build call batch
    const calls: { to: Address; data: Hex; value?: bigint }[] = []

    // Deploy contracts
    calls.push({
      to: create2Deployer,
      data: encodeFunctionData({ abi: CREATE2_DEPLOYER_ABI, functionName: 'deploy', args: [salts.vaultSalt, vaultInitCode] }),
    })
    calls.push({
      to: create2Deployer,
      data: encodeFunctionData({ abi: CREATE2_DEPLOYER_ABI, functionName: 'deploy', args: [salts.wrapperSalt, wrapperInitCode] }),
    })

    // Universal CREATE2 factory deployments for cross-chain IDENTICAL ShareOFT.
    if (!bootstrapExists) {
      calls.push({
        to: create2Factory,
        data: encodeCreate2FactoryDeployData(oftBootstrapSalt, oftBootstrapInitCode),
      })
    }
    calls.push({
      to: oftBootstrapRegistry,
      data: encodeFunctionData({ abi: OFT_BOOTSTRAP_ABI, functionName: 'setLayerZeroEndpoint', args: [base.id, resolvedLzEndpoint] }),
    })
    calls.push({
      to: create2Factory,
      data: encodeCreate2FactoryDeployData(shareOftSalt, shareOftInitCode),
    })
    calls.push({
      to: create2Deployer,
      data: encodeFunctionData({ abi: CREATE2_DEPLOYER_ABI, functionName: 'deploy', args: [salts.gaugeSalt, gaugeInitCode] }),
    })
    calls.push({
      to: create2Deployer,
      data: encodeFunctionData({ abi: CREATE2_DEPLOYER_ABI, functionName: 'deploy', args: [salts.ccaSalt, ccaInitCode] }),
    })
    if (includeOracle && oracleInitCode) {
      calls.push({
        to: create2Deployer,
        data: encodeFunctionData({ abi: CREATE2_DEPLOYER_ABI, functionName: 'deploy', args: [salts.oracleSalt, oracleInitCode] }),
      })
    }

    // Wiring / configuration
    calls.push({ to: wrapperAddress, data: encodeFunctionData({ abi: WRAPPER_ADMIN_ABI, functionName: 'setShareOFT', args: [shareOftAddress] }) })
    calls.push({ to: shareOftAddress, data: encodeFunctionData({ abi: SHAREOFT_ADMIN_ABI, functionName: 'setRegistry', args: [registry] }) })
    calls.push({ to: shareOftAddress, data: encodeFunctionData({ abi: SHAREOFT_ADMIN_ABI, functionName: 'setVault', args: [vaultAddress] }) })
    calls.push({ to: shareOftAddress, data: encodeFunctionData({ abi: SHAREOFT_ADMIN_ABI, functionName: 'setMinter', args: [wrapperAddress, true] }) })
    calls.push({ to: shareOftAddress, data: encodeFunctionData({ abi: SHAREOFT_ADMIN_ABI, functionName: 'setGaugeController', args: [gaugeAddress] }) })

    calls.push({ to: gaugeAddress, data: encodeFunctionData({ abi: GAUGE_ADMIN_ABI, functionName: 'setVault', args: [vaultAddress] }) })
    calls.push({ to: gaugeAddress, data: encodeFunctionData({ abi: GAUGE_ADMIN_ABI, functionName: 'setWrapper', args: [wrapperAddress] }) })
    calls.push({ to: gaugeAddress, data: encodeFunctionData({ abi: GAUGE_ADMIN_ABI, functionName: 'setCreatorCoin', args: [creatorToken] }) })
    if (lotteryManager !== '0x0000000000000000000000000000000000000000') {
      calls.push({ to: gaugeAddress, data: encodeFunctionData({ abi: GAUGE_ADMIN_ABI, functionName: 'setLotteryManager', args: [lotteryManager] }) })
    }
    if (includeOracle && oracleAddress) {
      calls.push({ to: gaugeAddress, data: encodeFunctionData({ abi: GAUGE_ADMIN_ABI, functionName: 'setOracle', args: [oracleAddress] }) })
    }

    calls.push({ to: vaultAddress, data: encodeFunctionData({ abi: VAULT_ADMIN_ABI, functionName: 'setGaugeController', args: [gaugeAddress] }) })
    calls.push({ to: vaultAddress, data: encodeFunctionData({ abi: VAULT_ADMIN_ABI, functionName: 'setWhitelist', args: [wrapperAddress, true] }) })

    // CCA: allow VaultActivationBatcher to launch auctions (critical)
    calls.push({ to: ccaAddress, data: encodeFunctionData({ abi: CCA_ADMIN_ABI, functionName: 'setApprovedLauncher', args: [vaultActivationBatcher, true] }) })

    // CCA: oracle config for V4 graduation path
    if (includeOracle && oracleAddress) {
      calls.push({
        to: ccaAddress,
        data: encodeFunctionData({
          abi: CCA_ADMIN_ABI,
          functionName: 'setOracleConfig',
          args: [oracleAddress, poolManager, taxHook, gaugeAddress],
        }),
      })
    }

      // Step 1: wallet confirmation
      setStep(1)
      if (isDelegatedSmartWallet) {
        const walletClient = createWalletClient({
          chain: base as any,
          transport: custom(window.ethereum),
        })

        const batchedCalls = calls.map((c) => ({ target: c.to, value: 0n, data: c.data }))
        const txHash = await walletClient.writeContract({
          account: signer,
          chain: base as any,
          address: owner,
          abi: COINBASE_SMART_WALLET_ABI,
          functionName: 'executeBatch',
          args: [batchedCalls],
        })

        setCallBundleType('tx')
        setCallBundleId(String(txHash))
        setStep(2)
        await publicClient.waitForTransactionReceipt({ hash: txHash as any, timeout: 120_000 })
      } else {
        let result: any
        try {
          result = await sendCallsAsync({
            calls,
            account: owner,
            chainId: base.id,
            forceAtomic: true,
          })
        } catch (e: any) {
          const msg = String(e?.shortMessage || e?.message || '')
          if (/wallet_sendCalls|sendCalls|5792|capabilit/i.test(msg)) {
            fail(
              'This wallet can’t batch deploy. Use Coinbase Smart Wallet (recommended), or deploy from an owner EOA.',
              msg,
            )
          }
          throw e
        }

        setCallBundleType('bundle')
        setCallBundleId(result.id)
        setStep(2)

        // Wait for wallet_getCallsStatus if supported
        const walletClient = createWalletClient({
          chain: base as any,
          transport: custom(window.ethereum),
        })

        // Prefer EIP-5792 status (best signal). If unsupported, we fall back to bytecode polling below.
        try {
          await waitForCallsStatus(walletClient, { id: result.id, timeout: 120_000, throwOnFailure: true })
        } catch {
          // ignore
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
          ...(oracleAddress ? [publicClient.getBytecode({ address: oracleAddress })] : []),
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
      } catch (e: any) {
        fail(
          'Deployment completed, but verification failed. Please check the addresses.',
          String(e?.message || 'Unknown verification error'),
        )
      }

      setStep(4)
      setSuccess(true)
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

  const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`

  return (
    <div className="space-y-4">
      <motion.button
        onClick={deploy}
        disabled={disabled}
        whileHover={{ scale: disabled ? 1 : 1.01 }}
        whileTap={{ scale: disabled ? 1 : 0.99 }}
        className="btn-accent w-full rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="relative flex items-center justify-center gap-2">
          <Rocket className="w-4 h-4" />
          <span className="text-sm">{isSubmitting ? 'Deploying…' : 'Deploy vault'}</span>
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
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-200 text-sm">
          Vault deployed successfully.
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm space-y-2">
          <div>{error}</div>
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
            <div className="label">Details</div>
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

                {addresses ? (
                  <div className="space-y-2">
                    <div className="label">Addresses</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <a
                        className="flex items-center justify-between gap-3 bg-black/20 border border-zinc-900/60 rounded-lg px-3 py-2 hover:border-zinc-800/80 transition-colors"
                        href={`https://basescan.org/address/${addresses.vault}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="text-zinc-500">Vault</span>
                        <span className="font-mono text-zinc-200">{short(addresses.vault)}</span>
                      </a>
                      <a
                        className="flex items-center justify-between gap-3 bg-black/20 border border-zinc-900/60 rounded-lg px-3 py-2 hover:border-zinc-800/80 transition-colors"
                        href={`https://basescan.org/address/${addresses.wrapper}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="text-zinc-500">Wrapper</span>
                        <span className="font-mono text-zinc-200">{short(addresses.wrapper)}</span>
                      </a>
                      <a
                        className="flex items-center justify-between gap-3 bg-black/20 border border-zinc-900/60 rounded-lg px-3 py-2 hover:border-zinc-800/80 transition-colors"
                        href={`https://basescan.org/address/${addresses.shareOFT}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="text-zinc-500">Share token</span>
                        <span className="font-mono text-zinc-200">{short(addresses.shareOFT)}</span>
                      </a>
                      <a
                        className="flex items-center justify-between gap-3 bg-black/20 border border-zinc-900/60 rounded-lg px-3 py-2 hover:border-zinc-800/80 transition-colors"
                        href={`https://basescan.org/address/${addresses.gaugeController}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="text-zinc-500">Controller</span>
                        <span className="font-mono text-zinc-200">{short(addresses.gaugeController)}</span>
                      </a>
                      <a
                        className="flex items-center justify-between gap-3 bg-black/20 border border-zinc-900/60 rounded-lg px-3 py-2 hover:border-zinc-800/80 transition-colors"
                        href={`https://basescan.org/address/${addresses.ccaStrategy}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="text-zinc-500">Strategy</span>
                        <span className="font-mono text-zinc-200">{short(addresses.ccaStrategy)}</span>
                      </a>
                      {addresses.oracle ? (
                        <a
                          className="flex items-center justify-between gap-3 bg-black/20 border border-zinc-900/60 rounded-lg px-3 py-2 hover:border-zinc-800/80 transition-colors"
                          href={`https://basescan.org/address/${addresses.oracle}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span className="text-zinc-500">Oracle</span>
                          <span className="font-mono text-zinc-200">{short(addresses.oracle)}</span>
                        </a>
                      ) : null}
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
