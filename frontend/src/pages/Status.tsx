import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { base } from 'wagmi/chains'
import { usePublicClient } from 'wagmi'
import {
  type Address,
  type Hex,
  concatHex,
  encodeAbiParameters,
  encodePacked,
  erc20Abi,
  getCreate2Address,
  isAddress,
  keccak256,
  parseAbiParameters,
} from 'viem'
import { CheckCircle, XCircle, AlertTriangle, Loader2, ExternalLink, ShieldCheck } from 'lucide-react'
import { CONTRACTS, AKITA } from '@/config/contracts'
import { DEPLOY_BYTECODE } from '@/deploy/bytecode.generated'
import { DEPLOY_BYTECODE_FULLSTACK } from '@/deploy/bytecode.fullstack'

type CheckStatus = 'pass' | 'fail' | 'warn' | 'info'

type Check = {
  id: string
  label: string
  status: CheckStatus
  details?: string
  href?: string
}

type CheckSection = {
  id: string
  title: string
  description?: string
  checks: Check[]
}

const OWNABLE_VIEW_ABI = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const VAULT_VIEW_ABI = [
  { type: 'function', name: 'CREATOR_COIN', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'gaugeController', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'whitelist', stateMutability: 'view', inputs: [{ name: '_account', type: 'address' }], outputs: [{ type: 'bool' }] },
  {
    type: 'function',
    name: 'getStrategies',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'strategies', type: 'address[]' },
      { name: 'weights', type: 'uint256[]' },
      { name: 'assets', type: 'uint256[]' },
    ],
  },
] as const

const GAUGE_VIEW_ABI = [
  { type: 'function', name: 'shareOFT', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'wrapper', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'vault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'creatorCoin', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'oracle', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'creatorTreasury', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'protocolTreasury', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const WRAPPER_VIEW_ABI = [
  { type: 'function', name: 'creatorCoin', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'vault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'shareOFT', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const SHAREOFT_VIEW_ABI = [
  { type: 'function', name: 'vault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'gaugeController', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'isMinter', stateMutability: 'view', inputs: [{ name: 'minter', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const

const CCA_VIEW_ABI = [
  { type: 'function', name: 'approvedLaunchers', stateMutability: 'view', inputs: [{ name: 'launcher', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const

const CREATOR_CHARM_STRATEGY_VIEW_ABI = [
  { type: 'function', name: 'charmVault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const AJNA_STRATEGY_VIEW_ABI = [
  { type: 'function', name: 'ajnaPool', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'ajnaFactory', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'collateralToken', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const STRATEGY_VIEW_ABI = [
  { type: 'function', name: 'isActive', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'asset', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'getTotalAssets', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

const STRATEGY_BATCHER_EVENTS_ABI = [
  {
    type: 'event',
    name: 'StrategiesDeployed',
    inputs: [
      { name: 'creator', type: 'address', indexed: true },
      { name: 'underlyingToken', type: 'address', indexed: true },
      {
        name: 'result',
        type: 'tuple',
        indexed: false,
        components: [
          { name: 'charmVault', type: 'address' },
          { name: 'charmStrategy', type: 'address' },
          { name: 'creatorCharmStrategy', type: 'address' },
          { name: 'ajnaStrategy', type: 'address' },
          { name: 'v3Pool', type: 'address' },
        ],
      },
    ],
    anonymous: false,
  },
] as const

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
    bootstrapperSalt: saltFor('bootstrapper'),
  }
}

function deriveShareOftUniversalSalt(params: { owner: Address; shareSymbol: string }) {
  const base = keccak256(encodePacked(['address', 'string'], [params.owner, params.shareSymbol.toLowerCase()]))
  return keccak256(encodePacked(['bytes32', 'string'], [base, 'CreatorShareOFT:v1']))
}

function deriveOftBootstrapSalt() {
  return keccak256(encodePacked(['string'], ['CreatorVault:OFTBootstrapRegistry:v1']))
}

function predictCreate2Address(create2Deployer: Address, salt: Hex, initCode: Hex): Address {
  const bytecodeHash = keccak256(initCode)
  return getCreate2Address({ from: create2Deployer, salt, bytecodeHash })
}

function basescanAddressHref(addr: string) {
  return `https://basescan.org/address/${addr}`
}

function summarize(sections: CheckSection[]) {
  let pass = 0
  let fail = 0
  let warn = 0
  let info = 0
  for (const s of sections) {
    for (const c of s.checks) {
      if (c.status === 'pass') pass++
      else if (c.status === 'fail') fail++
      else if (c.status === 'warn') warn++
      else info++
    }
  }
  return { pass, fail, warn, info }
}

function StatusPill({ status }: { status: CheckStatus }) {
  const styles =
    status === 'pass'
      ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20'
      : status === 'fail'
        ? 'bg-red-500/10 text-red-200 border-red-500/20'
        : status === 'warn'
          ? 'bg-amber-500/10 text-amber-200 border-amber-500/20'
          : 'bg-zinc-900/40 text-zinc-300 border-zinc-900/60'
  const label =
    status === 'pass' ? 'Pass' : status === 'fail' ? 'Fail' : status === 'warn' ? 'Warning' : 'Info'

  return <span className={`px-2 py-0.5 rounded-full border text-[10px] ${styles}`}>{label}</span>
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <CheckCircle className="w-4 h-4 text-emerald-300" />
  if (status === 'fail') return <XCircle className="w-4 h-4 text-red-300" />
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-300" />
  return <div className="w-4 h-4 rounded-full border border-zinc-700" />
}

function SectionCard({ section }: { section: CheckSection }) {
  const counts = useMemo(() => summarize([section]), [section])
  const worst: CheckStatus = section.checks.some((c) => c.status === 'fail')
    ? 'fail'
    : section.checks.some((c) => c.status === 'warn')
      ? 'warn'
      : section.checks.some((c) => c.status === 'pass')
        ? 'pass'
        : 'info'

  return (
    <details className="group border border-zinc-900/50 rounded-xl bg-black/20 overflow-hidden" open>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-5 py-4 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-sm text-zinc-200">{section.title}</div>
            <StatusPill status={worst} />
          </div>
          {section.description ? <div className="text-xs text-zinc-600">{section.description}</div> : null}
        </div>
        <div className="text-[10px] text-zinc-600 mt-1 whitespace-nowrap">
          {counts.pass} pass · {counts.warn} warn · {counts.fail} fail
        </div>
      </summary>

      <div className="border-t border-zinc-900/50">
        {section.checks.map((c) => (
          <div key={c.id} className="px-5 py-3 flex items-start justify-between gap-4 border-b border-zinc-900/40 last:border-b-0">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5">
                <StatusIcon status={c.status} />
              </div>
              <div className="min-w-0">
                <div className="text-sm text-zinc-200 truncate">{c.label}</div>
                {c.details ? <div className="text-xs text-zinc-600 break-words mt-0.5">{c.details}</div> : null}
              </div>
            </div>
            {c.href ? (
              <a
                href={c.href}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-500 hover:text-zinc-200 underline underline-offset-2 whitespace-nowrap flex items-center gap-1"
              >
                View <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <StatusPill status={c.status} />
            )}
          </div>
        ))}
      </div>
    </details>
  )
}

async function checkBytecode(publicClient: any, address: Address) {
  try {
    const code = await publicClient.getBytecode({ address })
    return !!code && code !== '0x'
  } catch {
    return false
  }
}

async function runGlobalChecks(publicClient: any): Promise<CheckSection[]> {
  const addrs: Array<{ id: string; label: string; addr: Address }> = [
    { id: 'registry', label: 'Registry', addr: CONTRACTS.registry as Address },
    { id: 'factory', label: 'Factory', addr: CONTRACTS.factory as Address },
    { id: 'create2Factory', label: 'Universal CREATE2 factory', addr: CONTRACTS.create2Factory as Address },
    { id: 'create2Deployer', label: 'AA CREATE2 deployer', addr: CONTRACTS.create2Deployer as Address },
    { id: 'vaultActivationBatcher', label: 'Vault activation batcher', addr: CONTRACTS.vaultActivationBatcher as Address },
    { id: 'poolManager', label: 'Uniswap V4 PoolManager', addr: CONTRACTS.poolManager as Address },
    { id: 'taxHook', label: 'Tax hook', addr: CONTRACTS.taxHook as Address },
    { id: 'chainlinkEthUsd', label: 'Chainlink ETH/USD feed', addr: CONTRACTS.chainlinkEthUsd as Address },
    { id: 'usdc', label: 'USDC', addr: CONTRACTS.usdc as Address },
    { id: 'ajnaErc20Factory', label: 'Ajna ERC20 pool factory', addr: CONTRACTS.ajnaErc20Factory as Address },
  ]

  const checks: Check[] = []
  for (const a of addrs) {
    const ok = await checkBytecode(publicClient, a.addr)
    checks.push({
      id: a.id,
      label: a.label,
      status: ok ? 'pass' : 'fail',
      details: a.addr,
      href: basescanAddressHref(a.addr),
    })
  }

  return [
    {
      id: 'global',
      title: 'Protocol dependencies (Base)',
      description: 'Quick sanity checks that core protocol contracts exist onchain.',
      checks,
    },
  ]
}

async function runVaultChecks(publicClient: any, vaultAddress: Address): Promise<CheckSection[]> {
  const sections: CheckSection[] = []

  const hasVaultCode = await checkBytecode(publicClient, vaultAddress)
  if (!hasVaultCode) {
    return [
      {
        id: 'vault',
        title: 'Vault',
        description: 'Could not verify this vault address.',
        checks: [
          {
            id: 'vault-bytecode',
            label: 'Vault bytecode present',
            status: 'fail',
            details: vaultAddress,
            href: basescanAddressHref(vaultAddress),
          },
        ],
      },
    ]
  }

  const owner = (await publicClient.readContract({
    address: vaultAddress,
    abi: OWNABLE_VIEW_ABI,
    functionName: 'owner',
  })) as Address

  const creatorToken = (await publicClient.readContract({
    address: vaultAddress,
    abi: VAULT_VIEW_ABI,
    functionName: 'CREATOR_COIN',
  })) as Address

  const vaultName = (await publicClient.readContract({
    address: vaultAddress,
    abi: erc20Abi,
    functionName: 'name',
  })) as string

  const vaultSymbol = (await publicClient.readContract({
    address: vaultAddress,
    abi: erc20Abi,
    functionName: 'symbol',
  })) as string

  const creatorSymbol = (await publicClient.readContract({
    address: creatorToken,
    abi: erc20Abi,
    functionName: 'symbol',
  })) as string

  const gaugeAddress = (await publicClient.readContract({
    address: vaultAddress,
    abi: VAULT_VIEW_ABI,
    functionName: 'gaugeController',
  })) as Address

  const gaugeHasCode = isAddress(gaugeAddress) && (await checkBytecode(publicClient, gaugeAddress as Address))

  const shareOFTAddress = gaugeHasCode
    ? ((await publicClient.readContract({
        address: gaugeAddress,
        abi: GAUGE_VIEW_ABI,
        functionName: 'shareOFT',
      })) as Address)
    : ('0x0000000000000000000000000000000000000000' as Address)

  const wrapperAddress = gaugeHasCode
    ? ((await publicClient.readContract({
        address: gaugeAddress,
        abi: GAUGE_VIEW_ABI,
        functionName: 'wrapper',
      })) as Address)
    : ('0x0000000000000000000000000000000000000000' as Address)

  const oracleAddress = gaugeHasCode
    ? ((await publicClient.readContract({
        address: gaugeAddress,
        abi: GAUGE_VIEW_ABI,
        functionName: 'oracle',
      })) as Address)
    : ('0x0000000000000000000000000000000000000000' as Address)

  const coreChecks: Check[] = [
    {
      id: 'vault',
      label: 'Vault',
      status: 'pass',
      details: `${vaultName} (${vaultSymbol})`,
      href: basescanAddressHref(vaultAddress),
    },
    {
      id: 'owner',
      label: 'Vault owner',
      status: 'info',
      details: owner,
      href: basescanAddressHref(owner),
    },
    {
      id: 'creatorToken',
      label: 'Creator coin',
      status: 'info',
      details: `${creatorSymbol} · ${creatorToken}`,
      href: basescanAddressHref(creatorToken),
    },
    {
      id: 'gauge',
      label: 'Gauge controller',
      status: gaugeHasCode ? 'pass' : 'fail',
      details: gaugeAddress,
      href: basescanAddressHref(gaugeAddress),
    },
    {
      id: 'shareOFT',
      label: 'Share token (ShareOFT)',
      status: isAddress(shareOFTAddress) && (await checkBytecode(publicClient, shareOFTAddress)) ? 'pass' : 'fail',
      details: shareOFTAddress,
      href: basescanAddressHref(shareOFTAddress),
    },
    {
      id: 'wrapper',
      label: 'Wrapper',
      status: isAddress(wrapperAddress) && (await checkBytecode(publicClient, wrapperAddress)) ? 'pass' : 'fail',
      details: wrapperAddress,
      href: basescanAddressHref(wrapperAddress),
    },
    {
      id: 'oracle',
      label: 'Oracle',
      status: isAddress(oracleAddress) && (await checkBytecode(publicClient, oracleAddress)) ? 'pass' : 'fail',
      details: oracleAddress,
      href: basescanAddressHref(oracleAddress),
    },
  ]

  sections.push({
    id: 'core',
    title: 'Vault overview',
    description: 'Identity + core contract addresses.',
    checks: coreChecks,
  })

  // Wiring checks
  const wiringChecks: Check[] = []

  // Vault wiring
  const vaultGauge = (await publicClient.readContract({
    address: vaultAddress,
    abi: VAULT_VIEW_ABI,
    functionName: 'gaugeController',
  })) as Address
  wiringChecks.push({
    id: 'vault-gauge',
    label: 'Vault points to gauge controller',
    status: vaultGauge.toLowerCase() === gaugeAddress.toLowerCase() ? 'pass' : 'fail',
    details: `vault.gaugeController = ${vaultGauge}`,
  })

  // Gauge wiring
  if (gaugeHasCode) {
    const gaugeVault = (await publicClient.readContract({
      address: gaugeAddress,
      abi: GAUGE_VIEW_ABI,
      functionName: 'vault',
    })) as Address
    wiringChecks.push({
      id: 'gauge-vault',
      label: 'Gauge points to vault',
      status: gaugeVault.toLowerCase() === vaultAddress.toLowerCase() ? 'pass' : 'fail',
      details: `gauge.vault = ${gaugeVault}`,
    })

    const gaugeCreatorCoin = (await publicClient.readContract({
      address: gaugeAddress,
      abi: GAUGE_VIEW_ABI,
      functionName: 'creatorCoin',
    })) as Address
    wiringChecks.push({
      id: 'gauge-creator',
      label: 'Gauge points to creator coin',
      status: gaugeCreatorCoin.toLowerCase() === creatorToken.toLowerCase() ? 'pass' : 'fail',
      details: `gauge.creatorCoin = ${gaugeCreatorCoin}`,
    })

    wiringChecks.push({
      id: 'gauge-wrapper',
      label: 'Gauge points to wrapper',
      status: isAddress(wrapperAddress) ? 'pass' : 'fail',
      details: `gauge.wrapper = ${wrapperAddress}`,
    })

    wiringChecks.push({
      id: 'gauge-share',
      label: 'Gauge points to share token',
      status: isAddress(shareOFTAddress) ? 'pass' : 'fail',
      details: `gauge.shareOFT = ${shareOFTAddress}`,
    })

    wiringChecks.push({
      id: 'gauge-oracle',
      label: 'Gauge points to oracle',
      status: isAddress(oracleAddress) ? 'pass' : 'fail',
      details: `gauge.oracle = ${oracleAddress}`,
    })
  }

  // Wrapper ↔ ShareOFT ↔ Vault loop
  if (isAddress(wrapperAddress) && (await checkBytecode(publicClient, wrapperAddress))) {
    const wVault = (await publicClient.readContract({
      address: wrapperAddress,
      abi: WRAPPER_VIEW_ABI,
      functionName: 'vault',
    })) as Address
    wiringChecks.push({
      id: 'wrapper-vault',
      label: 'Wrapper points to vault',
      status: wVault.toLowerCase() === vaultAddress.toLowerCase() ? 'pass' : 'fail',
      details: `wrapper.vault = ${wVault}`,
    })

    const wCoin = (await publicClient.readContract({
      address: wrapperAddress,
      abi: WRAPPER_VIEW_ABI,
      functionName: 'creatorCoin',
    })) as Address
    wiringChecks.push({
      id: 'wrapper-coin',
      label: 'Wrapper points to creator coin',
      status: wCoin.toLowerCase() === creatorToken.toLowerCase() ? 'pass' : 'fail',
      details: `wrapper.creatorCoin = ${wCoin}`,
    })

    const wShare = (await publicClient.readContract({
      address: wrapperAddress,
      abi: WRAPPER_VIEW_ABI,
      functionName: 'shareOFT',
    })) as Address
    wiringChecks.push({
      id: 'wrapper-share',
      label: 'Wrapper points to share token',
      status: wShare.toLowerCase() === shareOFTAddress.toLowerCase() ? 'pass' : 'fail',
      details: `wrapper.shareOFT = ${wShare}`,
    })

    const wl = (await publicClient.readContract({
      address: vaultAddress,
      abi: VAULT_VIEW_ABI,
      functionName: 'whitelist',
      args: [wrapperAddress],
    })) as boolean
    wiringChecks.push({
      id: 'vault-whitelist-wrapper',
      label: 'Wrapper is whitelisted on vault',
      status: wl ? 'pass' : 'fail',
      details: wl ? 'whitelist enabled' : 'not whitelisted',
    })
  }

  if (isAddress(shareOFTAddress) && (await checkBytecode(publicClient, shareOFTAddress))) {
    const sVault = (await publicClient.readContract({
      address: shareOFTAddress,
      abi: SHAREOFT_VIEW_ABI,
      functionName: 'vault',
    })) as Address
    wiringChecks.push({
      id: 'share-vault',
      label: 'Share token points to vault',
      status: sVault.toLowerCase() === vaultAddress.toLowerCase() ? 'pass' : 'fail',
      details: `shareOFT.vault = ${sVault}`,
    })

    const sGauge = (await publicClient.readContract({
      address: shareOFTAddress,
      abi: SHAREOFT_VIEW_ABI,
      functionName: 'gaugeController',
    })) as Address
    wiringChecks.push({
      id: 'share-gauge',
      label: 'Share token points to gauge controller',
      status: sGauge.toLowerCase() === gaugeAddress.toLowerCase() ? 'pass' : 'fail',
      details: `shareOFT.gaugeController = ${sGauge}`,
    })

    const isMinter = (await publicClient.readContract({
      address: shareOFTAddress,
      abi: SHAREOFT_VIEW_ABI,
      functionName: 'isMinter',
      args: [wrapperAddress],
    })) as boolean
    wiringChecks.push({
      id: 'share-minter-wrapper',
      label: 'Wrapper is approved minter on share token',
      status: isMinter ? 'pass' : 'fail',
      details: isMinter ? 'isMinter(wrapper)=true' : 'isMinter(wrapper)=false',
    })
  }

  sections.push({
    id: 'wiring',
    title: 'Wiring checks',
    description: 'Read-only checks to confirm contracts are connected correctly.',
    checks: wiringChecks,
  })

  // Deterministic address checks
  const deterministicChecks: Check[] = []
  try {
    const salts = deriveSalts({ creatorToken, owner, chainId: base.id })

    const create2Factory = CONTRACTS.create2Factory as Address
    const create2Deployer = CONTRACTS.create2Deployer as Address

    const bootstrapperInitCode = makeInitCode(
      DEPLOY_BYTECODE_FULLSTACK.VaultStrategyBootstrapper as Hex,
      'address',
      [owner],
    )
    const bootstrapperAddress = predictCreate2Address(create2Deployer, salts.bootstrapperSalt, bootstrapperInitCode)

    const predictedVaultInitCode = makeInitCode(
      DEPLOY_BYTECODE.CreatorOVault as Hex,
      'address,address,string,string',
      [creatorToken, bootstrapperAddress, vaultName, vaultSymbol],
    )
    const predictedVault = predictCreate2Address(create2Deployer, salts.vaultSalt, predictedVaultInitCode)

    const predictedWrapperInitCode = makeInitCode(
      DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex,
      'address,address,address',
      [creatorToken, vaultAddress, owner],
    )
    const predictedWrapper = predictCreate2Address(create2Deployer, salts.wrapperSalt, predictedWrapperInitCode)

    const oftBootstrapSalt = deriveOftBootstrapSalt()
    const oftBootstrapInitCode = DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex
    const oftBootstrapRegistry = predictCreate2Address(create2Factory, oftBootstrapSalt, oftBootstrapInitCode)

    const shareName = (await publicClient.readContract({ address: shareOFTAddress, abi: erc20Abi, functionName: 'name' })) as string
    const shareSymbol = (await publicClient.readContract({ address: shareOFTAddress, abi: erc20Abi, functionName: 'symbol' })) as string
    const shareOftSalt = deriveShareOftUniversalSalt({ owner, shareSymbol })
    const predictedShareInitCode = makeInitCode(
      DEPLOY_BYTECODE.CreatorShareOFT as Hex,
      'string,string,address,address',
      [shareName, shareSymbol, oftBootstrapRegistry, owner],
    )
    const predictedShare = predictCreate2Address(create2Factory, shareOftSalt, predictedShareInitCode)

    const creatorTreasury = (await publicClient.readContract({ address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'creatorTreasury' })) as Address
    const protocolTreasury = (await publicClient.readContract({ address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'protocolTreasury' })) as Address
    const predictedGaugeInitCode = makeInitCode(
      DEPLOY_BYTECODE.CreatorGaugeController as Hex,
      'address,address,address,address',
      [shareOFTAddress, creatorTreasury, protocolTreasury, owner],
    )
    const predictedGauge = predictCreate2Address(create2Deployer, salts.gaugeSalt, predictedGaugeInitCode)

    const predictedOracleInitCode = makeInitCode(
      DEPLOY_BYTECODE.CreatorOracle as Hex,
      'address,address,string,address',
      [CONTRACTS.registry as Address, CONTRACTS.chainlinkEthUsd as Address, shareSymbol, owner],
    )
    const predictedOracle = predictCreate2Address(create2Deployer, salts.oracleSalt, predictedOracleInitCode)

    const predictedCcaInitCode = makeInitCode(
      DEPLOY_BYTECODE.CCALaunchStrategy as Hex,
      'address,address,address,address,address',
      [shareOFTAddress, '0x0000000000000000000000000000000000000000', vaultAddress, vaultAddress, owner],
    )
    const predictedCca = predictCreate2Address(create2Deployer, salts.ccaSalt, predictedCcaInitCode)

    deterministicChecks.push({
      id: 'pred-vault',
      label: 'Vault address matches deterministic CREATE2 prediction',
      status: predictedVault.toLowerCase() === vaultAddress.toLowerCase() ? 'pass' : 'fail',
      details: `predicted = ${predictedVault}`,
    })
    deterministicChecks.push({
      id: 'pred-wrapper',
      label: 'Wrapper address matches deterministic CREATE2 prediction',
      status: predictedWrapper.toLowerCase() === wrapperAddress.toLowerCase() ? 'pass' : 'fail',
      details: `predicted = ${predictedWrapper}`,
    })
    deterministicChecks.push({
      id: 'pred-share',
      label: 'Share token address matches deterministic CREATE2 prediction',
      status: predictedShare.toLowerCase() === shareOFTAddress.toLowerCase() ? 'pass' : 'fail',
      details: `predicted = ${predictedShare}`,
    })
    deterministicChecks.push({
      id: 'pred-gauge',
      label: 'Gauge address matches deterministic CREATE2 prediction',
      status: predictedGauge.toLowerCase() === gaugeAddress.toLowerCase() ? 'pass' : 'fail',
      details: `predicted = ${predictedGauge}`,
    })
    deterministicChecks.push({
      id: 'pred-oracle',
      label: 'Oracle address matches deterministic CREATE2 prediction',
      status: predictedOracle.toLowerCase() === oracleAddress.toLowerCase() ? 'pass' : 'fail',
      details: `predicted = ${predictedOracle}`,
    })
    const ccaHasCode = await checkBytecode(publicClient, predictedCca)
    deterministicChecks.push({
      id: 'pred-cca',
      label: 'Launch strategy deployed at deterministic address',
      status: ccaHasCode ? 'pass' : 'warn',
      details: `predicted = ${predictedCca}`,
      href: basescanAddressHref(predictedCca),
    })

    // Approved launcher check (only if CCA exists)
    if (ccaHasCode) {
      const launcherOk = (await publicClient.readContract({
        address: predictedCca,
        abi: CCA_VIEW_ABI,
        functionName: 'approvedLaunchers',
        args: [CONTRACTS.vaultActivationBatcher as Address],
      })) as boolean
      deterministicChecks.push({
        id: 'cca-launcher',
        label: 'Launch strategy approves VaultActivationBatcher',
        status: launcherOk ? 'pass' : 'fail',
        details: launcherOk ? 'approvedLaunchers=true' : 'approvedLaunchers=false',
      })
    } else {
      deterministicChecks.push({
        id: 'cca-launcher-skip',
        label: 'Launch strategy approval check',
        status: 'info',
        details: 'Skipped (launch strategy not found at predicted address).',
      })
    }
  } catch (e: any) {
    deterministicChecks.push({
      id: 'deterministic-error',
      label: 'Deterministic address verification',
      status: 'warn',
      details: String(e?.message || 'Could not compute deterministic addresses.'),
    })
  }

  sections.push({
    id: 'deterministic',
    title: 'Deterministic deployment checks',
    description: 'Confirms contracts match their expected CREATE2 addresses for this creator coin + owner.',
    checks: deterministicChecks,
  })

  // Strategy checks (from vault)
  const strategyChecks: Check[] = []
  try {
    const [strategies, weights] = (await publicClient.readContract({
      address: vaultAddress,
      abi: VAULT_VIEW_ABI,
      functionName: 'getStrategies',
    })) as readonly [readonly Address[], readonly bigint[], readonly bigint[]]

    if (!strategies.length) {
      strategyChecks.push({
        id: 'no-strategies',
        label: 'Vault has strategies configured',
        status: 'warn',
        details: 'No strategies found.',
      })
    } else {
      strategyChecks.push({
        id: 'strategy-count',
        label: 'Vault has strategies configured',
        status: 'pass',
        details: `${strategies.length} strategies`,
      })
    }

    // Try to recover the “batch deploy” event addresses (best-effort).
    const strategyBatcherAddress = (() => {
      // VaultStrategyBootstrapper uses `new StrategyDeploymentBatcher()` inside `finalize`.
      // We can’t deterministically know the batcher address from here, so event parsing is best-effort
      // and should be considered informational only.
      return null
    })()
    void strategyBatcherAddress

    // Per-strategy verification
    for (let i = 0; i < strategies.length; i++) {
      const s = strategies[i] as Address
      const w = weights[i]
      const hasCode = await checkBytecode(publicClient, s)
      const baseLabel = `${s} · weight ${w.toString()}`
      if (!hasCode) {
        strategyChecks.push({
          id: `strategy-${i}-code`,
          label: `Strategy #${i + 1}`,
          status: 'fail',
          details: baseLabel,
          href: basescanAddressHref(s),
        })
        continue
      }

      // Common strategy checks
      let isActive = false
      let assetOk = false
      let assetAddr: Address | null = null
      try {
        isActive = (await publicClient.readContract({ address: s, abi: STRATEGY_VIEW_ABI, functionName: 'isActive' })) as boolean
      } catch {
        // ignore
      }
      try {
        assetAddr = (await publicClient.readContract({ address: s, abi: STRATEGY_VIEW_ABI, functionName: 'asset' })) as Address
        assetOk = assetAddr.toLowerCase() === creatorToken.toLowerCase()
      } catch {
        // ignore
      }

      // Detect known strategy flavors (best-effort)
      let flavor: string | null = null
      let extra: string | null = null

      try {
        const charmVault = (await publicClient.readContract({ address: s, abi: CREATOR_CHARM_STRATEGY_VIEW_ABI, functionName: 'charmVault' })) as Address
        if (isAddress(charmVault) && charmVault !== '0x0000000000000000000000000000000000000000') {
          flavor = 'Charm LP (CreatorCharmStrategyV2)'
          extra = `charmVault = ${charmVault}`
        }
      } catch {
        // ignore
      }

      if (!flavor) {
        try {
          const ajnaPool = (await publicClient.readContract({ address: s, abi: AJNA_STRATEGY_VIEW_ABI, functionName: 'ajnaPool' })) as Address
          const ajnaFactory = (await publicClient.readContract({ address: s, abi: AJNA_STRATEGY_VIEW_ABI, functionName: 'ajnaFactory' })) as Address
          const collateralToken = (await publicClient.readContract({ address: s, abi: AJNA_STRATEGY_VIEW_ABI, functionName: 'collateralToken' })) as Address
          flavor = 'Ajna lending (AjnaStrategy)'
          extra = `ajnaPool = ${ajnaPool} · collateral = ${collateralToken} · factory = ${ajnaFactory}`
        } catch {
          // ignore
        }
      }

      const status: CheckStatus = !isActive ? 'warn' : !assetOk ? 'fail' : 'pass'
      strategyChecks.push({
        id: `strategy-${i}-ok`,
        label: flavor ? `${flavor}` : `Strategy #${i + 1}`,
        status,
        details: `${baseLabel}${assetAddr ? ` · asset=${assetAddr}` : ''}${extra ? ` · ${extra}` : ''}`,
        href: basescanAddressHref(s),
      })
    }

    // Bonus: if we can find the StrategiesDeployed event in recent logs, show it (best-effort)
    // We’ll search a small recent window around the vault creation block range by looking at the vault’s first tx is expensive,
    // so we instead skip this here; the deploy page already parses logs immediately on deploy.
    void STRATEGY_BATCHER_EVENTS_ABI
  } catch (e: any) {
    strategyChecks.push({
      id: 'strategies-error',
      label: 'Vault strategies',
      status: 'warn',
      details: String(e?.message || 'Could not read strategies.'),
    })
  }

  sections.push({
    id: 'strategies',
    title: 'Yield strategy checks',
    description: 'Verifies the vault’s configured strategies and basic health signals.',
    checks: strategyChecks,
  })

  return sections
}

export function Status() {
  const publicClient = usePublicClient({ chainId: base.id })
  const [searchParams, setSearchParams] = useSearchParams()

  const initialVault = useMemo(() => searchParams.get('vault') ?? '', [searchParams])
  const [vaultInput, setVaultInput] = useState<string>(initialVault)

  const vaultAddress = useMemo(() => {
    const v = String(vaultInput || '').trim()
    return isAddress(v) ? (v as Address) : null
  }, [vaultInput])

  const globalQuery = useQuery({
    queryKey: ['status', 'global'],
    enabled: !!publicClient,
    queryFn: async () => runGlobalChecks(publicClient),
  })

  const vaultQuery = useQuery({
    queryKey: ['status', 'vault', vaultAddress],
    enabled: !!publicClient && !!vaultAddress,
    queryFn: async () => runVaultChecks(publicClient, vaultAddress as Address),
  })

  const globalSections = globalQuery.data ?? []
  const vaultSections = vaultQuery.data ?? []

  const globalSummary = useMemo(() => summarize(globalSections), [globalSections])
  const vaultSummary = useMemo(() => summarize(vaultSections), [vaultSections])

  const onRun = () => {
    const v = String(vaultInput || '').trim()
    const next = new URLSearchParams(searchParams)
    if (isAddress(v)) next.set('vault', v)
    else next.delete('vault')
    setSearchParams(next)
  }

  return (
    <div className="relative">
      <section className="cinematic-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <span className="label">Status</span>
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-2">
                <h1 className="headline text-3xl sm:text-5xl flex items-center gap-3">
                  <ShieldCheck className="w-7 h-7 text-emerald-300" />
                  Verification checks
                </h1>
                <p className="text-sm text-zinc-500 font-light max-w-prose">
                  Live, read-only checks that verify contract deployments and wiring on Base.
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-3 text-xs text-zinc-600">
                <div>{globalSummary.pass} pass</div>
                <div>{globalSummary.warn} warn</div>
                <div>{globalSummary.fail} fail</div>
              </div>
            </div>
          </motion.div>

          {/* Verify a vault */}
          <div className="mt-10 card rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-1">
                <div className="label">Verify a vault</div>
                <div className="text-xs text-zinc-600">
                  Paste a vault address to generate a shareable report.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVaultInput(AKITA.vault)}
                className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                Use AKITA example
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={vaultInput}
                onChange={(e) => setVaultInput(e.target.value)}
                placeholder="Vault address (0x…)"
                className="flex-1 w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none font-mono"
              />
              <button
                type="button"
                onClick={onRun}
                className="btn-accent rounded-lg px-5 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!vaultAddress || vaultQuery.isFetching}
                title={!vaultAddress ? 'Enter a valid vault address' : 'Run checks'}
              >
                <span className="inline-flex items-center gap-2">
                  {vaultQuery.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {vaultQuery.isFetching ? 'Running…' : 'Run checks'}
                </span>
              </button>
            </div>

            {vaultAddress ? (
              <div className="text-xs text-zinc-600 flex items-center justify-between gap-4">
                <div className="font-mono break-all">{vaultAddress}</div>
                <a
                  href={basescanAddressHref(vaultAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-zinc-500 hover:text-zinc-200 underline underline-offset-2 whitespace-nowrap flex items-center gap-1"
                >
                  View on Basescan <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : (
              <div className="text-xs text-zinc-700">
                Tip: after deploying, use the vault address shown in the Deploy details panel.
              </div>
            )}

            {vaultQuery.data && (
              <div className="pt-2 flex items-center gap-4 text-xs text-zinc-500">
                <div className="text-emerald-200">{vaultSummary.pass} pass</div>
                <div className="text-amber-200">{vaultSummary.warn} warn</div>
                <div className="text-red-200">{vaultSummary.fail} fail</div>
              </div>
            )}
          </div>

          {/* Global checks */}
          <div className="mt-8 space-y-4">
            {globalQuery.isFetching ? (
              <div className="text-xs text-zinc-600 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading protocol checks…
              </div>
            ) : null}
            {globalQuery.error ? (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm">
                Could not load protocol checks.
              </div>
            ) : null}
            {globalSections.map((s) => (
              <SectionCard key={s.id} section={s} />
            ))}
          </div>

          {/* Vault report */}
          <div className="mt-8 space-y-4">
            {vaultQuery.isFetching ? (
              <div className="text-xs text-zinc-600 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Running vault checks…
              </div>
            ) : null}
            {vaultQuery.error ? (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm">
                Could not generate this vault report.
              </div>
            ) : null}
            {vaultSections.map((s) => (
              <SectionCard key={s.id} section={s} />
            ))}
          </div>

          <div className="mt-10 text-[10px] text-zinc-700">
            These checks are informational and read-only. They do not make transactions or modify contracts.
          </div>
        </div>
      </section>
    </div>
  )
}


