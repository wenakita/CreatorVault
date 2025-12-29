import { useEffect, useMemo, useState } from 'react'
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

function errorToMessage(e: unknown): string {
  return String((e as any)?.shortMessage || (e as any)?.message || e || 'Unknown error')
}

function isRateLimitError(message: string): boolean {
  return /429|rate limit|too many requests/i.test(message)
}

async function safeMulticall(publicClient: any, contracts: any[]) {
  try {
    return await publicClient.multicall({ contracts, allowFailure: true })
  } catch {
    // Fallback to sequential reads if multicall is unavailable for some reason.
    const out: any[] = []
    for (const c of contracts) {
      try {
        const result = await publicClient.readContract(c)
        out.push({ status: 'success', result })
      } catch (error) {
        out.push({ status: 'failure', error })
      }
    }
    return out
  }
}

function pickResult<T>(r: any): T | null {
  return r?.status === 'success' ? (r.result as T) : null
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
  const ZERO = '0x0000000000000000000000000000000000000000'
  const addrOk = (a: any): a is Address => typeof a === 'string' && isAddress(a) && a !== ZERO

  const any429 = (results: any[]) =>
    results.some((r) => r?.status === 'failure' && isRateLimitError(errorToMessage((r as any)?.error)))

  try {
    const sections: CheckSection[] = []

    const vaultBasics = await safeMulticall(publicClient, [
      { address: vaultAddress, abi: OWNABLE_VIEW_ABI, functionName: 'owner' },
      { address: vaultAddress, abi: VAULT_VIEW_ABI, functionName: 'CREATOR_COIN' },
      { address: vaultAddress, abi: VAULT_VIEW_ABI, functionName: 'gaugeController' },
      { address: vaultAddress, abi: erc20Abi, functionName: 'name' },
      { address: vaultAddress, abi: erc20Abi, functionName: 'symbol' },
    ])
    if (any429(vaultBasics)) {
      return [
        {
          id: 'rate-limit',
          title: 'Vault report',
          description: 'Rate limited by Base RPC. Please try again in a moment.',
          checks: [
            {
              id: 'rate-limit-429',
              label: 'RPC rate limit',
              status: 'warn',
              details: 'The public Base RPC is throttling requests (HTTP 429).',
            },
          ],
        },
      ]
    }

    const owner = pickResult<Address>(vaultBasics[0])
    const creatorToken = pickResult<Address>(vaultBasics[1])
    const gaugeAddress = pickResult<Address>(vaultBasics[2])
    const vaultName = pickResult<string>(vaultBasics[3]) ?? 'Vault'
    const vaultSymbol = pickResult<string>(vaultBasics[4]) ?? '—'

    if (!addrOk(owner) || !addrOk(creatorToken)) {
      return [
        {
          id: 'vault',
          title: 'Vault',
          description: 'Could not read basic vault data.',
          checks: [
            {
              id: 'vault-readable',
              label: 'Vault readable',
              status: 'fail',
              details: vaultAddress,
              href: basescanAddressHref(vaultAddress),
            },
          ],
        },
      ]
    }

    let creatorSymbol = '—'
    try {
      creatorSymbol = (await publicClient.readContract({
        address: creatorToken,
        abi: erc20Abi,
        functionName: 'symbol',
      })) as string
    } catch {
      // ignore
    }

    // Gauge: discover core infra addresses
    let shareOFTAddress: Address | null = null
    let wrapperAddress: Address | null = null
    let oracleAddress: Address | null = null
    let gaugeVault: Address | null = null
    let gaugeCreatorCoin: Address | null = null
    let creatorTreasury: Address | null = null
    let protocolTreasury: Address | null = null

    if (addrOk(gaugeAddress)) {
      const gaugeRes = await safeMulticall(publicClient, [
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'shareOFT' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'wrapper' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'oracle' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'vault' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'creatorCoin' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'creatorTreasury' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'protocolTreasury' },
      ])
      if (any429(gaugeRes)) {
        return [
          {
            id: 'rate-limit',
            title: 'Vault report',
            description: 'Rate limited by Base RPC. Please try again in a moment.',
            checks: [
              {
                id: 'rate-limit-429',
                label: 'RPC rate limit',
                status: 'warn',
                details: 'The public Base RPC is throttling requests (HTTP 429).',
              },
            ],
          },
        ]
      }
      shareOFTAddress = pickResult<Address>(gaugeRes[0])
      wrapperAddress = pickResult<Address>(gaugeRes[1])
      oracleAddress = pickResult<Address>(gaugeRes[2])
      gaugeVault = pickResult<Address>(gaugeRes[3])
      gaugeCreatorCoin = pickResult<Address>(gaugeRes[4])
      creatorTreasury = pickResult<Address>(gaugeRes[5])
      protocolTreasury = pickResult<Address>(gaugeRes[6])
    }

    // ShareOFT details
    let shareName: string | null = null
    let shareSymbol: string | null = null
    let shareVault: Address | null = null
    let shareGauge: Address | null = null
    let shareMinterOk: boolean | null = null

    if (addrOk(shareOFTAddress)) {
      const shareCalls: any[] = [
        { address: shareOFTAddress, abi: erc20Abi, functionName: 'name' },
        { address: shareOFTAddress, abi: erc20Abi, functionName: 'symbol' },
        { address: shareOFTAddress, abi: SHAREOFT_VIEW_ABI, functionName: 'vault' },
        { address: shareOFTAddress, abi: SHAREOFT_VIEW_ABI, functionName: 'gaugeController' },
      ]
      if (addrOk(wrapperAddress)) {
        shareCalls.push({
          address: shareOFTAddress,
          abi: SHAREOFT_VIEW_ABI,
          functionName: 'isMinter',
          args: [wrapperAddress],
        })
      }
      const shareRes = await safeMulticall(publicClient, shareCalls)
      if (any429(shareRes)) {
        return [
          {
            id: 'rate-limit',
            title: 'Vault report',
            description: 'Rate limited by Base RPC. Please try again in a moment.',
            checks: [
              {
                id: 'rate-limit-429',
                label: 'RPC rate limit',
                status: 'warn',
                details: 'The public Base RPC is throttling requests (HTTP 429).',
              },
            ],
          },
        ]
      }
      shareName = pickResult<string>(shareRes[0])
      shareSymbol = pickResult<string>(shareRes[1])
      shareVault = pickResult<Address>(shareRes[2])
      shareGauge = pickResult<Address>(shareRes[3])
      if (shareRes.length >= 5) shareMinterOk = pickResult<boolean>(shareRes[4])
    }

    // Wrapper details
    let wrapperVault: Address | null = null
    let wrapperCoin: Address | null = null
    let wrapperShare: Address | null = null
    if (addrOk(wrapperAddress)) {
      const wrapRes = await safeMulticall(publicClient, [
        { address: wrapperAddress, abi: WRAPPER_VIEW_ABI, functionName: 'vault' },
        { address: wrapperAddress, abi: WRAPPER_VIEW_ABI, functionName: 'creatorCoin' },
        { address: wrapperAddress, abi: WRAPPER_VIEW_ABI, functionName: 'shareOFT' },
      ])
      if (any429(wrapRes)) {
        return [
          {
            id: 'rate-limit',
            title: 'Vault report',
            description: 'Rate limited by Base RPC. Please try again in a moment.',
            checks: [
              {
                id: 'rate-limit-429',
                label: 'RPC rate limit',
                status: 'warn',
                details: 'The public Base RPC is throttling requests (HTTP 429).',
              },
            ],
          },
        ]
      }
      wrapperVault = pickResult<Address>(wrapRes[0])
      wrapperCoin = pickResult<Address>(wrapRes[1])
      wrapperShare = pickResult<Address>(wrapRes[2])
    }

    // Vault extras: whitelist + strategies
    let wrapperWhitelisted: boolean | null = null
    let strategies: readonly Address[] = []
    let weights: readonly bigint[] = []

    const extraCalls: any[] = []
    if (addrOk(wrapperAddress)) {
      extraCalls.push({ address: vaultAddress, abi: VAULT_VIEW_ABI, functionName: 'whitelist', args: [wrapperAddress] })
    }
    extraCalls.push({ address: vaultAddress, abi: VAULT_VIEW_ABI, functionName: 'getStrategies' })
    const extraRes = await safeMulticall(publicClient, extraCalls)
    if (any429(extraRes)) {
      return [
        {
          id: 'rate-limit',
          title: 'Vault report',
          description: 'Rate limited by Base RPC. Please try again in a moment.',
          checks: [
            {
              id: 'rate-limit-429',
              label: 'RPC rate limit',
              status: 'warn',
              details: 'The public Base RPC is throttling requests (HTTP 429).',
            },
          ],
        },
      ]
    }
    const stratTuple = pickResult<any>(extraRes[addrOk(wrapperAddress) ? 1 : 0])
    if (addrOk(wrapperAddress)) wrapperWhitelisted = pickResult<boolean>(extraRes[0])
    if (stratTuple) {
      strategies = (stratTuple[0] ?? []) as readonly Address[]
      weights = (stratTuple[1] ?? []) as readonly bigint[]
    }

    const coreChecks: Check[] = [
      {
        id: 'vault',
        label: 'Vault',
        status: 'pass',
        details: `${vaultName} (${vaultSymbol})`,
        href: basescanAddressHref(vaultAddress),
      },
      { id: 'owner', label: 'Vault owner', status: 'info', details: owner, href: basescanAddressHref(owner) },
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
        status: addrOk(gaugeAddress) ? 'pass' : 'fail',
        details: String(gaugeAddress ?? '—'),
        href: addrOk(gaugeAddress) ? basescanAddressHref(gaugeAddress) : undefined,
      },
      {
        id: 'shareOFT',
        label: 'Share token (ShareOFT)',
        status: addrOk(shareOFTAddress) ? 'pass' : 'fail',
        details: String(shareOFTAddress ?? '—'),
        href: addrOk(shareOFTAddress) ? basescanAddressHref(shareOFTAddress) : undefined,
      },
      {
        id: 'wrapper',
        label: 'Wrapper',
        status: addrOk(wrapperAddress) ? 'pass' : 'fail',
        details: String(wrapperAddress ?? '—'),
        href: addrOk(wrapperAddress) ? basescanAddressHref(wrapperAddress) : undefined,
      },
      {
        id: 'oracle',
        label: 'Oracle',
        status: addrOk(oracleAddress) ? 'pass' : 'warn',
        details: String(oracleAddress ?? '—'),
        href: addrOk(oracleAddress) ? basescanAddressHref(oracleAddress) : undefined,
      },
    ]
    sections.push({
      id: 'core',
      title: 'Vault overview',
      description: 'Identity + core contract addresses.',
      checks: coreChecks,
    })

    const wiringChecks: Check[] = []
    const same = (a?: Address | null, b?: Address | null) =>
      a && b && isAddress(a) && isAddress(b) ? a.toLowerCase() === b.toLowerCase() : null
    const pushBool = (id: string, label: string, ok: boolean | null, details: string) => {
      wiringChecks.push({ id, label, status: ok === null ? 'warn' : ok ? 'pass' : 'fail', details })
    }

    pushBool('gauge-vault', 'Gauge points to vault', same(gaugeVault, vaultAddress), `gauge.vault = ${String(gaugeVault ?? '—')}`)
    pushBool('gauge-coin', 'Gauge points to creator coin', same(gaugeCreatorCoin, creatorToken), `gauge.creatorCoin = ${String(gaugeCreatorCoin ?? '—')}`)
    pushBool('share-vault', 'Share token points to vault', same(shareVault, vaultAddress), `shareOFT.vault = ${String(shareVault ?? '—')}`)
    pushBool('share-gauge', 'Share token points to gauge', same(shareGauge, gaugeAddress ?? null), `shareOFT.gaugeController = ${String(shareGauge ?? '—')}`)
    pushBool('wrapper-vault', 'Wrapper points to vault', same(wrapperVault, vaultAddress), `wrapper.vault = ${String(wrapperVault ?? '—')}`)
    pushBool('wrapper-coin', 'Wrapper points to creator coin', same(wrapperCoin, creatorToken), `wrapper.creatorCoin = ${String(wrapperCoin ?? '—')}`)
    pushBool('wrapper-share', 'Wrapper points to share token', same(wrapperShare, shareOFTAddress ?? null), `wrapper.shareOFT = ${String(wrapperShare ?? '—')}`)

    wiringChecks.push({
      id: 'share-minter',
      label: 'Wrapper is approved minter on share token',
      status: shareMinterOk == null ? 'warn' : shareMinterOk ? 'pass' : 'fail',
      details: shareMinterOk == null ? 'Could not read isMinter(wrapper)' : shareMinterOk ? 'isMinter(wrapper)=true' : 'isMinter(wrapper)=false',
    })

    wiringChecks.push({
      id: 'vault-whitelist',
      label: 'Wrapper is whitelisted on vault',
      status: wrapperWhitelisted == null ? 'warn' : wrapperWhitelisted ? 'pass' : 'fail',
      details: wrapperWhitelisted == null ? 'Could not read vault.whitelist(wrapper)' : wrapperWhitelisted ? 'whitelist=true' : 'whitelist=false',
    })

    sections.push({
      id: 'wiring',
      title: 'Wiring checks',
      description: 'Read-only checks to confirm contracts are connected correctly.',
      checks: wiringChecks,
    })

    // Deterministic address checks (minimal calls; no eth_getCode spam)
    const deterministicChecks: Check[] = []
    try {
      if (!shareName || !shareSymbol || !addrOk(gaugeAddress) || !addrOk(shareOFTAddress) || !addrOk(wrapperAddress)) {
        deterministicChecks.push({
          id: 'deterministic-skip',
          label: 'Deterministic address verification',
          status: 'warn',
          details: 'Missing required data (share name/symbol or core addresses).',
        })
      } else if (!addrOk(creatorTreasury) || !addrOk(protocolTreasury)) {
        deterministicChecks.push({
          id: 'deterministic-skip-treasury',
          label: 'Deterministic address verification',
          status: 'warn',
          details: 'Missing gauge treasury values.',
        })
      } else {
        const salts = deriveSalts({ creatorToken, owner, chainId: base.id })
        const create2Factory = CONTRACTS.create2Factory as Address
        const create2Deployer = CONTRACTS.create2Deployer as Address

        const bootstrapperInitCode = makeInitCode(DEPLOY_BYTECODE_FULLSTACK.VaultStrategyBootstrapper as Hex, 'address', [owner])
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
        const oftBootstrapRegistry = predictCreate2Address(create2Factory, oftBootstrapSalt, DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex)
        const shareOftSalt = deriveShareOftUniversalSalt({ owner, shareSymbol })
        const predictedShareInitCode = makeInitCode(
          DEPLOY_BYTECODE.CreatorShareOFT as Hex,
          'string,string,address,address',
          [shareName, shareSymbol, oftBootstrapRegistry, owner],
        )
        const predictedShare = predictCreate2Address(create2Factory, shareOftSalt, predictedShareInitCode)

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
          [shareOFTAddress, ZERO, vaultAddress, vaultAddress, owner],
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
          status: addrOk(oracleAddress) ? (predictedOracle.toLowerCase() === oracleAddress.toLowerCase() ? 'pass' : 'fail') : 'warn',
          details: `predicted = ${predictedOracle}`,
        })

        // Best-effort launcher approval check (does not require eth_getCode)
        try {
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
            details: `${predictedCca}`,
            href: basescanAddressHref(predictedCca),
          })
        } catch (e: any) {
          const msg = errorToMessage(e)
          deterministicChecks.push({
            id: 'cca-launcher',
            label: 'Launch strategy approval check',
            status: isRateLimitError(msg) ? 'warn' : 'info',
            details: isRateLimitError(msg) ? 'Rate limited while checking. Try again.' : `Not found or not readable at ${predictedCca}`,
            href: basescanAddressHref(predictedCca),
          })
        }
      }
    } catch (e: any) {
      deterministicChecks.push({
        id: 'deterministic-error',
        label: 'Deterministic address verification',
        status: 'warn',
        details: errorToMessage(e),
      })
    }

    sections.push({
      id: 'deterministic',
      title: 'Deterministic deployment checks',
      description: 'Confirms contracts match their expected CREATE2 addresses for this creator coin + owner.',
      checks: deterministicChecks,
    })

    // Strategy checks
    const strategyChecks: Check[] = []
    if (!strategies.length) {
      strategyChecks.push({ id: 'no-strategies', label: 'Vault has strategies configured', status: 'warn', details: 'No strategies found.' })
    } else {
      strategyChecks.push({ id: 'strategy-count', label: 'Vault has strategies configured', status: 'pass', details: `${strategies.length} strategies` })
    }

    const calls: any[] = []
    for (const s of strategies) {
      calls.push({ address: s, abi: STRATEGY_VIEW_ABI, functionName: 'isActive' })
      calls.push({ address: s, abi: STRATEGY_VIEW_ABI, functionName: 'asset' })
      calls.push({ address: s, abi: CREATOR_CHARM_STRATEGY_VIEW_ABI, functionName: 'charmVault' })
      calls.push({ address: s, abi: AJNA_STRATEGY_VIEW_ABI, functionName: 'ajnaPool' })
      calls.push({ address: s, abi: AJNA_STRATEGY_VIEW_ABI, functionName: 'collateralToken' })
      calls.push({ address: s, abi: AJNA_STRATEGY_VIEW_ABI, functionName: 'ajnaFactory' })
    }

    const stratRes = calls.length ? await safeMulticall(publicClient, calls) : []
    if (any429(stratRes)) {
      strategyChecks.push({
        id: 'strategies-rate',
        label: 'Strategy checks',
        status: 'warn',
        details: 'Rate limited while reading strategy details. Try again.',
      })
    } else {
      const stride = 6
      for (let i = 0; i < strategies.length; i++) {
        const s = strategies[i]
        const w = weights[i] ?? 0n
        const baseLabel = `${s} · weight ${w.toString()}`

        const base = i * stride
        const isActive = pickResult<boolean>(stratRes[base + 0])
        const asset = pickResult<Address>(stratRes[base + 1])
        const charmVault = pickResult<Address>(stratRes[base + 2])
        const ajnaPool = pickResult<Address>(stratRes[base + 3])
        const collateral = pickResult<Address>(stratRes[base + 4])
        const ajnaFactory = pickResult<Address>(stratRes[base + 5])

        const assetOk = asset && isAddress(asset) ? asset.toLowerCase() === creatorToken.toLowerCase() : null
        const activeOk = typeof isActive === 'boolean' ? isActive : null

        const flavor =
          addrOk(charmVault) ? 'Charm LP (CreatorCharmStrategyV2)' : addrOk(ajnaPool) ? 'Ajna lending (AjnaStrategy)' : 'Strategy'
        const extraParts: string[] = []
        if (asset) extraParts.push(`asset=${asset}`)
        if (addrOk(charmVault)) extraParts.push(`charmVault=${charmVault}`)
        if (addrOk(ajnaPool)) extraParts.push(`ajnaPool=${ajnaPool}`)
        if (collateral) extraParts.push(`collateral=${collateral}`)
        if (ajnaFactory) extraParts.push(`factory=${ajnaFactory}`)

        const status: CheckStatus =
          activeOk === false ? 'warn' : assetOk === false ? 'fail' : activeOk === null || assetOk === null ? 'warn' : 'pass'

        strategyChecks.push({
          id: `strategy-${i}`,
          label: flavor,
          status,
          details: `${baseLabel}${extraParts.length ? ` · ${extraParts.join(' · ')}` : ''}`,
          href: basescanAddressHref(s),
        })
      }
    }

    sections.push({
      id: 'strategies',
      title: 'Yield strategy checks',
      description: 'Verifies the vault’s configured strategies and basic health signals.',
      checks: strategyChecks,
    })

    return sections
  } catch (e: any) {
    const msg = errorToMessage(e)
    return [
      {
        id: 'vault-error',
        title: 'Vault report',
        description: 'Could not generate this vault report.',
        checks: [
          {
            id: 'vault-error-details',
            label: isRateLimitError(msg) ? 'RPC rate limit' : 'Unexpected error',
            status: 'warn',
            details: isRateLimitError(msg) ? 'Rate limited by Base RPC. Please try again in a moment.' : msg,
          },
        ],
      },
    ]
  }
}

export function Status() {
  const publicClient = usePublicClient({ chainId: base.id })
  const [searchParams, setSearchParams] = useSearchParams()

  const vaultParam = useMemo(() => searchParams.get('vault') ?? '', [searchParams])
  const [vaultInput, setVaultInput] = useState<string>(vaultParam)

  useEffect(() => {
    setVaultInput(vaultParam)
  }, [vaultParam])

  const vaultParamAddress = useMemo(() => {
    const v = String(vaultParam || '').trim()
    return isAddress(v) ? (v as Address) : null
  }, [vaultParam])

  const vaultInputAddress = useMemo(() => {
    const v = String(vaultInput || '').trim()
    return isAddress(v) ? (v as Address) : null
  }, [vaultInput])

  const globalQuery = useQuery({
    queryKey: ['status', 'global'],
    enabled: !!publicClient,
    queryFn: async () => runGlobalChecks(publicClient),
  })

  const vaultQuery = useQuery({
    queryKey: ['status', 'vault', vaultParamAddress],
    enabled: !!publicClient && !!vaultParamAddress,
    queryFn: async () => runVaultChecks(publicClient, vaultParamAddress as Address),
  })

  const globalSections = globalQuery.data ?? []
  const vaultSections = vaultQuery.data ?? []

  const globalSummary = useMemo(() => summarize(globalSections), [globalSections])
  const vaultSummary = useMemo(() => summarize(vaultSections), [vaultSections])

  const onRun = () => {
    const next = new URLSearchParams(searchParams)
    if (vaultInputAddress) next.set('vault', vaultInputAddress)
    else next.delete('vault')
    setSearchParams(next)
  }

  // SEO safety: this is a diagnostic/reporting page with many possible query variants.
  // Default to noindex and canonicalize to the hub URL.
  useEffect(() => {
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)

    const canonical = document.createElement('link')
    canonical.rel = 'canonical'
    canonical.href = 'https://creatorvault.fun/status'
    document.head.appendChild(canonical)

    return () => {
      robots.remove()
      canonical.remove()
    }
  }, [])

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
                onClick={() => {
                  setVaultInput(AKITA.vault)
                  const next = new URLSearchParams(searchParams)
                  next.set('vault', AKITA.vault)
                  setSearchParams(next)
                }}
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
                disabled={!vaultInputAddress || vaultQuery.isFetching}
                title={!vaultInputAddress ? 'Enter a valid vault address' : 'Run checks'}
              >
                <span className="inline-flex items-center gap-2">
                  {vaultQuery.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {vaultQuery.isFetching ? 'Running…' : 'Run checks'}
                </span>
              </button>
            </div>

            {vaultParamAddress || vaultInputAddress ? (
              <div className="text-xs text-zinc-600 flex items-center justify-between gap-4">
                <div className="font-mono break-all">{vaultParamAddress ?? vaultInputAddress}</div>
                <a
                  href={basescanAddressHref(String(vaultParamAddress ?? vaultInputAddress))}
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


