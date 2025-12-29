import type { VercelRequest, VercelResponse } from '@vercel/node'

declare const process: { env: Record<string, string | undefined> }

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

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 60) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  return false
}

function getReadRpcUrl(): string {
  const read = process.env.BASE_READ_RPC_URL
  if (read && read.length > 0) return read

  const rpc = process.env.BASE_RPC_URL
  if (rpc && rpc.length > 0) return rpc

  return 'https://mainnet.base.org'
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getStringQuery(req: VercelRequest, key: string): string | null {
  const val = req.query?.[key]
  if (typeof val === 'string' && val.trim().length > 0) return val.trim()
  return null
}

function basescanAddressHref(addr: string) {
  return `https://basescan.org/address/${addr}`
}

function errorToMessage(e: unknown): string {
  return String((e as any)?.shortMessage || (e as any)?.message || e || 'Unknown error')
}

function isRateLimitError(message: string): boolean {
  return /429|rate limit|too many requests/i.test(message)
}

async function safeMulticall(client: any, contracts: any[]) {
  return await client.multicall({ contracts, allowFailure: true })
}

function pickResult<T>(r: any): T | null {
  return r?.status === 'success' ? (r.result as T) : null
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

// Some older vault versions used different getter names (or no public getter at all).
const VAULT_WHITELIST_COMPAT_ABI = [
  { type: 'function', name: 'whitelist', stateMutability: 'view', inputs: [{ name: '_account', type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'whitelisted', stateMutability: 'view', inputs: [{ name: '_account', type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'isWhitelisted', stateMutability: 'view', inputs: [{ name: '_account', type: 'address' }], outputs: [{ type: 'bool' }] },
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
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const vault = getStringQuery(req, 'vault')
  if (!vault) return res.status(400).json({ success: false, error: 'vault is required' })
  if (!isAddressLike(vault)) return res.status(400).json({ success: false, error: 'Invalid vault address' })
  const cacheBust = getStringQuery(req, 't')

  const rpcUrl = getReadRpcUrl()

  try {
    const { createPublicClient, http, erc20Abi, isAddress } = await import('viem')
    const { base } = await import('viem/chains')

    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl, { timeout: 20_000 }),
    })

    const ZERO = '0x0000000000000000000000000000000000000000'
    const addrOk = (a: any): a is `0x${string}` => typeof a === 'string' && isAddress(a) && a !== ZERO
    const any429 = (results: any[]) =>
      results.some((r) => r?.status === 'failure' && isRateLimitError(errorToMessage((r as any)?.error)))

    const vaultAddress = vault as `0x${string}`

    const vaultBasics = await safeMulticall(client, [
      { address: vaultAddress, abi: OWNABLE_VIEW_ABI, functionName: 'owner' },
      { address: vaultAddress, abi: VAULT_VIEW_ABI, functionName: 'CREATOR_COIN' },
      { address: vaultAddress, abi: VAULT_VIEW_ABI, functionName: 'gaugeController' },
      { address: vaultAddress, abi: erc20Abi, functionName: 'name' },
      { address: vaultAddress, abi: erc20Abi, functionName: 'symbol' },
    ])
    if (any429(vaultBasics)) {
      return res.status(429).json({ success: false, error: 'Rate limited by RPC' })
    }

    const owner = pickResult<`0x${string}`>(vaultBasics[0])
    const creatorToken = pickResult<`0x${string}`>(vaultBasics[1])
    const gaugeAddress = pickResult<`0x${string}`>(vaultBasics[2])
    const vaultName = pickResult<string>(vaultBasics[3]) ?? 'Vault'
    const vaultSymbol = pickResult<string>(vaultBasics[4]) ?? '—'

    if (!addrOk(owner) || !addrOk(creatorToken)) {
      return res.status(400).json({ success: false, error: 'Vault is not readable (or not a CreatorOVault)' })
    }

    let creatorSymbol = '—'
    try {
      creatorSymbol = (await client.readContract({
        address: creatorToken,
        abi: erc20Abi as any,
        functionName: 'symbol',
      })) as string
    } catch {
      // ignore
    }

    // Gauge derived addresses
    let shareOFTAddress: `0x${string}` | null = null
    let wrapperAddress: `0x${string}` | null = null
    let oracleAddress: `0x${string}` | null = null
    let gaugeVault: `0x${string}` | null = null
    let gaugeCreatorCoin: `0x${string}` | null = null
    let creatorTreasury: `0x${string}` | null = null
    let protocolTreasury: `0x${string}` | null = null

    if (addrOk(gaugeAddress)) {
      const gaugeRes = await safeMulticall(client, [
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'shareOFT' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'wrapper' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'oracle' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'vault' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'creatorCoin' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'creatorTreasury' },
        { address: gaugeAddress, abi: GAUGE_VIEW_ABI, functionName: 'protocolTreasury' },
      ])
      if (any429(gaugeRes)) {
        return res.status(429).json({ success: false, error: 'Rate limited by RPC' })
      }
      shareOFTAddress = pickResult<`0x${string}`>(gaugeRes[0])
      wrapperAddress = pickResult<`0x${string}`>(gaugeRes[1])
      oracleAddress = pickResult<`0x${string}`>(gaugeRes[2])
      gaugeVault = pickResult<`0x${string}`>(gaugeRes[3])
      gaugeCreatorCoin = pickResult<`0x${string}`>(gaugeRes[4])
      creatorTreasury = pickResult<`0x${string}`>(gaugeRes[5])
      protocolTreasury = pickResult<`0x${string}`>(gaugeRes[6])
    }

    // Share token wiring
    let shareName: string | null = null
    let shareSymbol: string | null = null
    let shareOwner: `0x${string}` | null = null
    let shareVault: `0x${string}` | null = null
    let shareGauge: `0x${string}` | null = null
    let shareMinterOk: boolean | null = null
    if (addrOk(shareOFTAddress)) {
      const shareCalls: any[] = [
        { address: shareOFTAddress, abi: OWNABLE_VIEW_ABI, functionName: 'owner' },
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
      const shareRes = await safeMulticall(client, shareCalls)
      if (any429(shareRes)) {
        return res.status(429).json({ success: false, error: 'Rate limited by RPC' })
      }
      shareOwner = pickResult<`0x${string}`>(shareRes[0])
      shareName = pickResult<string>(shareRes[1])
      shareSymbol = pickResult<string>(shareRes[2])
      shareVault = pickResult<`0x${string}`>(shareRes[3])
      shareGauge = pickResult<`0x${string}`>(shareRes[4])
      if (shareRes.length >= 6) shareMinterOk = pickResult<boolean>(shareRes[5])
    }

    // Wrapper wiring
    let wrapperVault: `0x${string}` | null = null
    let wrapperCoin: `0x${string}` | null = null
    let wrapperShare: `0x${string}` | null = null
    let wrapperOwner: `0x${string}` | null = null
    if (addrOk(wrapperAddress)) {
      const wrapRes = await safeMulticall(client, [
        { address: wrapperAddress, abi: OWNABLE_VIEW_ABI, functionName: 'owner' },
        { address: wrapperAddress, abi: WRAPPER_VIEW_ABI, functionName: 'vault' },
        { address: wrapperAddress, abi: WRAPPER_VIEW_ABI, functionName: 'creatorCoin' },
        { address: wrapperAddress, abi: WRAPPER_VIEW_ABI, functionName: 'shareOFT' },
      ])
      if (any429(wrapRes)) {
        return res.status(429).json({ success: false, error: 'Rate limited by RPC' })
      }
      wrapperOwner = pickResult<`0x${string}`>(wrapRes[0])
      wrapperVault = pickResult<`0x${string}`>(wrapRes[1])
      wrapperCoin = pickResult<`0x${string}`>(wrapRes[2])
      wrapperShare = pickResult<`0x${string}`>(wrapRes[3])
    }

    // Vault whitelist + strategies
    let wrapperWhitelisted: boolean | null = null
    let strategies: readonly `0x${string}`[] = []
    let weights: readonly bigint[] = []
    const extraCalls: any[] = []
    if (addrOk(wrapperAddress)) {
      extraCalls.push({ address: vaultAddress, abi: VAULT_WHITELIST_COMPAT_ABI, functionName: 'whitelist', args: [wrapperAddress] })
      extraCalls.push({ address: vaultAddress, abi: VAULT_WHITELIST_COMPAT_ABI, functionName: 'whitelisted', args: [wrapperAddress] })
      extraCalls.push({ address: vaultAddress, abi: VAULT_WHITELIST_COMPAT_ABI, functionName: 'isWhitelisted', args: [wrapperAddress] })
    }
    extraCalls.push({ address: vaultAddress, abi: VAULT_VIEW_ABI, functionName: 'getStrategies' })
    const extraRes = await safeMulticall(client, extraCalls)
    if (any429(extraRes)) {
      return res.status(429).json({ success: false, error: 'Rate limited by RPC' })
    }
    if (addrOk(wrapperAddress)) {
      wrapperWhitelisted =
        pickResult<boolean>(extraRes[0]) ??
        pickResult<boolean>(extraRes[1]) ??
        pickResult<boolean>(extraRes[2]) ??
        null
    }
    const tuple = pickResult<any>(extraRes[addrOk(wrapperAddress) ? 3 : 0])
    if (tuple) {
      strategies = (tuple[0] ?? []) as readonly `0x${string}`[]
      weights = (tuple[1] ?? []) as readonly bigint[]
    }

    // Strategy details (best-effort)
    const strategyChecks: Check[] = []
    if (!strategies.length) {
      strategyChecks.push({
        id: 'no-strategies',
        label: 'Yield strategies configured',
        status: 'warn',
        details: 'No strategies are configured yet. This is optional.',
      })
    } else {
      strategyChecks.push({
        id: 'strategy-count',
        label: 'Yield strategies configured',
        status: 'pass',
        details: `${strategies.length} strategies`,
      })
    }

    const stratCalls: any[] = []
    for (const s of strategies) {
      stratCalls.push({ address: s, abi: STRATEGY_VIEW_ABI, functionName: 'isActive' })
      stratCalls.push({ address: s, abi: STRATEGY_VIEW_ABI, functionName: 'asset' })
      stratCalls.push({ address: s, abi: CREATOR_CHARM_STRATEGY_VIEW_ABI, functionName: 'charmVault' })
      stratCalls.push({ address: s, abi: AJNA_STRATEGY_VIEW_ABI, functionName: 'ajnaPool' })
      stratCalls.push({ address: s, abi: AJNA_STRATEGY_VIEW_ABI, functionName: 'collateralToken' })
      stratCalls.push({ address: s, abi: AJNA_STRATEGY_VIEW_ABI, functionName: 'ajnaFactory' })
    }

    const stratRes = stratCalls.length ? await safeMulticall(client, stratCalls) : []
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
        const base = i * stride

        const isActive = pickResult<boolean>(stratRes[base + 0])
        const asset = pickResult<`0x${string}`>(stratRes[base + 1])
        const charmVault = pickResult<`0x${string}`>(stratRes[base + 2])
        const ajnaPool = pickResult<`0x${string}`>(stratRes[base + 3])
        const collateral = pickResult<`0x${string}`>(stratRes[base + 4])
        const ajnaFactory = pickResult<`0x${string}`>(stratRes[base + 5])

        const flavor = addrOk(charmVault)
          ? 'Charm LP (CreatorCharmStrategyV2)'
          : addrOk(ajnaPool)
            ? 'Ajna lending (AjnaStrategy)'
            : `Strategy #${i + 1}`

        const assetOk = asset && isAddress(asset) ? asset.toLowerCase() === creatorToken.toLowerCase() : null
        const status: CheckStatus =
          isActive === false ? 'warn' : assetOk === false ? 'fail' : typeof isActive !== 'boolean' || assetOk === null ? 'warn' : 'pass'

        const extras: string[] = [`${s} · weight ${w.toString()}`]
        if (asset) extras.push(`asset=${asset}`)
        if (charmVault) extras.push(`charmVault=${charmVault}`)
        if (ajnaPool) extras.push(`ajnaPool=${ajnaPool}`)
        if (collateral) extras.push(`collateral=${collateral}`)
        if (ajnaFactory) extras.push(`factory=${ajnaFactory}`)

        strategyChecks.push({
          id: `strategy-${i}`,
          label: flavor,
          status,
          details: extras.join(' · '),
          href: basescanAddressHref(s),
        })
      }
    }

    // Core and wiring sections
    const coreChecks: Check[] = [
      { id: 'vault', label: 'Vault', status: 'pass', details: `${vaultName} (${vaultSymbol})`, href: basescanAddressHref(vaultAddress) },
      { id: 'owner', label: 'Vault owner', status: 'info', details: owner, href: basescanAddressHref(owner) },
      { id: 'creatorToken', label: 'Creator coin', status: 'info', details: `${creatorSymbol} · ${creatorToken}`, href: basescanAddressHref(creatorToken) },
      { id: 'gauge', label: 'Gauge controller', status: addrOk(gaugeAddress) ? 'pass' : 'fail', details: String(gaugeAddress ?? '—'), href: addrOk(gaugeAddress) ? basescanAddressHref(gaugeAddress) : undefined },
      { id: 'shareOFT', label: 'Share token (ShareOFT)', status: addrOk(shareOFTAddress) ? 'pass' : 'fail', details: String(shareOFTAddress ?? '—'), href: addrOk(shareOFTAddress) ? basescanAddressHref(shareOFTAddress) : undefined },
      { id: 'wrapper', label: 'Wrapper', status: addrOk(wrapperAddress) ? 'pass' : 'fail', details: String(wrapperAddress ?? '—'), href: addrOk(wrapperAddress) ? basescanAddressHref(wrapperAddress) : undefined },
      { id: 'oracle', label: 'Oracle', status: addrOk(oracleAddress) ? 'pass' : 'warn', details: String(oracleAddress ?? '—'), href: addrOk(oracleAddress) ? basescanAddressHref(oracleAddress) : undefined },
    ]

    const wiringChecks: Check[] = []
    const same = (a?: string | null, b?: string | null) => (a && b ? a.toLowerCase() === b.toLowerCase() : null)
    const pushBool = (id: string, label: string, ok: boolean | null, details: string) => {
      wiringChecks.push({ id, label, status: ok === null ? 'warn' : ok ? 'pass' : 'fail', details })
    }
    pushBool('gauge-vault', 'Gauge points to vault', same(gaugeVault, vaultAddress), `gauge.vault = ${String(gaugeVault ?? '—')}`)
    pushBool('gauge-coin', 'Gauge points to creator coin', same(gaugeCreatorCoin, creatorToken), `gauge.creatorCoin = ${String(gaugeCreatorCoin ?? '—')}`)
    // Share token wiring is important for fee routing + accurate conversions, but not required for basic deposit/withdraw.
    // For legacy deployments, these values may be unset; treat as warnings with recommended action instead of hard failures.
    const isZero = (a?: string | null) => !!a && a.toLowerCase() === ZERO
    const shareVaultOk = same(shareVault, vaultAddress)
    if (shareVault == null) {
      wiringChecks.push({
        id: 'share-vault',
        label: 'Share token wired to vault',
        status: 'warn',
        details: 'Could not read shareOFT.vault (may be a legacy token version).',
      })
    } else if (isZero(shareVault)) {
      wiringChecks.push({
        id: 'share-vault',
        label: 'Share token wired to vault',
        status: 'warn',
        details: 'shareOFT.vault is unset. Recommended: set it to the vault address to enable accurate conversions.',
      })
    } else {
      wiringChecks.push({
        id: 'share-vault',
        label: 'Share token wired to vault',
        status: shareVaultOk ? 'pass' : 'fail',
        details: `shareOFT.vault = ${String(shareVault)}`,
      })
    }

    const shareGaugeOk = same(shareGauge, gaugeAddress)
    if (shareGauge == null) {
      wiringChecks.push({
        id: 'share-gauge',
        label: 'Share token wired to gauge',
        status: 'warn',
        details: 'Could not read shareOFT.gaugeController (may be a legacy token version).',
      })
    } else if (isZero(shareGauge)) {
      wiringChecks.push({
        id: 'share-gauge',
        label: 'Share token wired to gauge',
        status: 'warn',
        details: 'shareOFT.gaugeController is unset. Recommended: set it to enable fee routing to the gauge.',
      })
    } else {
      wiringChecks.push({
        id: 'share-gauge',
        label: 'Share token wired to gauge',
        status: shareGaugeOk ? 'pass' : 'fail',
        details: `shareOFT.gaugeController = ${String(shareGauge)}`,
      })
    }
    pushBool('wrapper-vault', 'Wrapper points to vault', same(wrapperVault, vaultAddress), `wrapper.vault = ${String(wrapperVault ?? '—')}`)
    pushBool('wrapper-coin', 'Wrapper points to creator coin', same(wrapperCoin, creatorToken), `wrapper.creatorCoin = ${String(wrapperCoin ?? '—')}`)
    pushBool('wrapper-share', 'Wrapper points to share token', same(wrapperShare, shareOFTAddress), `wrapper.shareOFT = ${String(wrapperShare ?? '—')}`)
    wiringChecks.push({
      id: 'share-minter',
      label: 'Wrapper is approved minter on share token',
      status: shareMinterOk == null ? 'warn' : shareMinterOk ? 'pass' : 'fail',
      details: shareMinterOk == null ? 'Could not read isMinter(wrapper)' : shareMinterOk ? 'isMinter(wrapper)=true' : 'isMinter(wrapper)=false',
    })
    wiringChecks.push({
      id: 'vault-whitelist',
      label: 'Wrapper is whitelisted on vault',
      status: !addrOk(wrapperAddress) ? 'info' : wrapperWhitelisted == null ? 'info' : wrapperWhitelisted ? 'pass' : 'fail',
      details:
        !addrOk(wrapperAddress)
          ? 'No wrapper detected; whitelist check not applicable.'
          : wrapperWhitelisted == null
            ? 'Whitelist status is not readable for this vault version. If deposits fail, whitelist the wrapper as the vault owner.'
          : wrapperWhitelisted
            ? 'whitelist=true'
            : 'whitelist=false',
    })

    const sections: CheckSection[] = [
      { id: 'core', title: 'Vault overview', description: 'Identity + core contract addresses.', checks: coreChecks },
      { id: 'wiring', title: 'Wiring checks', description: 'Read-only checks to confirm contracts are connected correctly.', checks: wiringChecks },
      { id: 'strategies', title: 'Yield strategy checks', description: 'Verifies the vault’s configured strategies and basic health signals.', checks: strategyChecks },
    ]

    if (cacheBust) {
      // Manual runs should be "fresh" and not stored at the edge under a unique key.
      res.setHeader('Cache-Control', 'no-store')
    } else {
      setCache(res, 120)
    }
    return res.status(200).json({
      success: true,
      data: {
        chainId: base.id,
        generatedAt: new Date().toISOString(),
        sections,
        context: {
          vault: vaultAddress,
          owner,
          vaultOwner: owner,
          creatorToken,
          vaultName,
          vaultSymbol,
          creatorSymbol,
          gaugeAddress,
          shareOFTAddress,
          shareOftOwner: shareOwner,
          shareVault,
          shareGaugeController: shareGauge,
          shareMinterOk,
          wrapperAddress,
          wrapperOwner,
          wrapperWhitelisted,
          oracleAddress,
          creatorTreasury,
          protocolTreasury,
          shareName,
          shareSymbol,
        },
      },
    })
  } catch (e: any) {
    const msg = errorToMessage(e)
    const status = isRateLimitError(msg) ? 429 : 500
    return res.status(status).json({ success: false, error: msg || 'Failed to build vault report' })
  }
}


