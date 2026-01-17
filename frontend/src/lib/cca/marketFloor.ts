import type { Address } from 'viem'
import { encodeAbiParameters, isAddress, keccak256, parseAbiParameters, toHex } from 'viem'
import { erc20Abi } from 'viem'

import { CONTRACTS } from '@/config/contracts'
import { BASE_DEFAULTS } from '@/config/contracts.defaults'
import { currencyPerTokenBaseUnitsToQ96 } from '@/lib/cca/q96'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

// Uniswap V4 PoolManager state reads use `extsload` (see v4-core StateLibrary).
const V4_EXTSLOAD_ABI = [
  {
    type: 'function',
    name: 'extsload',
    stateMutability: 'view',
    inputs: [{ name: 'slot', type: 'bytes32' }],
    outputs: [{ name: 'value', type: 'bytes32' }],
  },
] as const

// v4-core StateLibrary constants (PoolManager storage layout)
const V4_POOLS_SLOT =
  '0x0000000000000000000000000000000000000000000000000000000000000006' as const
const V4_LIQUIDITY_OFFSET = 3n

// Zora creator coin pool key (many Zora coins expose this)
const ZORA_COIN_POOL_KEY_ABI = [
  {
    type: 'function',
    name: 'getPoolKey',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' },
    ],
  },
] as const

// Uniswap V3 pool oracle reads (TWAP via observe)
const UNISWAP_V3_POOL_ORACLE_ABI = [
  { type: 'function', name: 'token0', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token1', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function',
    name: 'observe',
    stateMutability: 'view',
    inputs: [{ name: 'secondsAgos', type: 'uint32[]' }],
    outputs: [
      { name: 'tickCumulatives', type: 'int56[]' },
      { name: 'secondsPerLiquidityCumulativeX128s', type: 'uint160[]' },
    ],
  },
] as const

// Chainlink (ETH/USD)
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

export type MarketFloorQuote = {
  // What we actually pass into `deployAndLaunch`
  floorPriceQ96Aligned: bigint

  // Supporting values
  tickSpacingQ96: bigint
  floorPriceQ96: bigint
  weiPerToken: bigint

  // Diagnostics (for UI/debug)
  creatorZora: {
    durationSec: number
    poolId: `0x${string}`
    currency0: Address
    currency1: Address
    /** Spot tick at `toBlock` (latest state) */
    spotTick: number
    /** Time-weighted mean tick over the window */
    meanTick: number
    fromBlock: bigint
    toBlock: bigint
    sampleCount: number
    liquidity: bigint
    creatorPerZora: number
  }
  zoraEth: {
    durationSec: number
    ethPerZoraWethTwap?: number
    ethPerZoraUsdcTwap?: number
    ethPerZoraConservative: number
    discountBps: number
  }
}

// IMPORTANT: Wagmi may provide a PublicClient type from a different viem instance.
// Avoid importing viem's `PublicClient` type directly to prevent “two different types with this name exist” errors.
export interface ReadonlyPublicClient {
  // Use method signatures (bivariant in TS) to stay compatible with wagmi/viem clients.
  readContract(args: any): Promise<any>
  multicall(args: any): Promise<any>
  getBlockNumber(args?: any): Promise<bigint>
  getBlock(args: any): Promise<any>
  getLogs(args: any): Promise<any[]>
}

function approxToken1PerToken0FromTick(tick: number, decimals0: number, decimals1: number): number {
  const priceRaw = Math.pow(1.0001, tick)
  const decAdj = Math.pow(10, decimals0 - decimals1)
  return priceRaw * decAdj
}

function addSlot(slot: `0x${string}`, offset: bigint): `0x${string}` {
  return toHex(BigInt(slot) + offset, { size: 32 }) as `0x${string}`
}

function getV4PoolStateSlot(poolId: `0x${string}`): `0x${string}` {
  // stateSlot = keccak256(abi.encodePacked(poolId, POOLS_SLOT))
  // For fixed-size bytes32 values, abi.encodePacked == abi.encode.
  return keccak256(
    encodeAbiParameters(parseAbiParameters('bytes32,bytes32'), [poolId, V4_POOLS_SLOT]),
  ) as `0x${string}`
}

function decodeV4Slot0Word(word: `0x${string}`): { sqrtPriceX96: bigint; tick: number; protocolFee: number; lpFee: number } {
  const data = BigInt(word)
  const sqrtMask = (1n << 160n) - 1n
  const sqrtPriceX96 = data & sqrtMask

  // tick is next 24 bits (signed int24)
  const tickRaw = (data >> 160n) & ((1n << 24n) - 1n)
  const tickSigned = tickRaw >= (1n << 23n) ? tickRaw - (1n << 24n) : tickRaw
  const tick = Number(tickSigned)

  const protocolFee = Number((data >> 184n) & ((1n << 24n) - 1n))
  const lpFee = Number((data >> 208n) & ((1n << 24n) - 1n))

  if (!Number.isFinite(tick)) throw new Error('Invalid v4 tick')
  return { sqrtPriceX96, tick, protocolFee, lpFee }
}

function floorDiv(a: bigint, b: bigint): bigint {
  // floor division toward -infinity (matches Uniswap V3 mean tick rounding)
  let q = a / b
  const r = a % b
  if (a < 0n && r !== 0n) q -= 1n
  return q
}

async function getV3TwapTick(params: { publicClient: ReadonlyPublicClient; pool: Address; durationSec: number }): Promise<number> {
  const { publicClient, pool, durationSec } = params
  if (durationSec <= 0) throw new Error('Invalid TWAP duration')

  const secondsAgos: readonly number[] = [durationSec, 0]
  const res = await publicClient.readContract({
    address: pool,
    abi: UNISWAP_V3_POOL_ORACLE_ABI,
    functionName: 'observe',
    args: [secondsAgos],
  })
  const tickCumulatives = (res as any)?.[0] as readonly bigint[] | undefined
  if (!tickCumulatives || tickCumulatives.length < 2) throw new Error('V3 observe returned no tick cumulatives')

  const tickDelta = tickCumulatives[1] - tickCumulatives[0]
  const timeDelta = BigInt(durationSec)
  const meanTick = floorDiv(tickDelta, timeDelta)
  const n = Number(meanTick)
  if (!Number.isFinite(n)) throw new Error('Invalid TWAP tick (non-finite)')
  return n
}

function isV3ObserveOldError(e: any): boolean {
  const msg = String((e as any)?.shortMessage ?? (e as any)?.message ?? '')
  if (!msg) return false
  // Uniswap v3 oracle uses `require(target >= oldest, 'OLD')`
  return /\bOLD\b/.test(msg)
}

async function getZoraReferenceV3Ticks(params: {
  publicClient: ReadonlyPublicClient
  zoraWethV3Pool: Address
  zoraUsdcV3Pool: Address
  desiredDurationSec: number
}): Promise<{ durationSec: number; wethTick: number; usdcTick: number }> {
  const { publicClient, zoraWethV3Pool, zoraUsdcV3Pool } = params
  const desired = Math.floor(params.desiredDurationSec)
  if (desired <= 0) throw new Error('Invalid v3 TWAP duration')

  // Try progressively shorter windows if the pool cannot serve the requested lookback (observe() reverts with `OLD`).
  const candidatesRaw = [desired, 3600, 1800, 900, 300].filter((d) => Number.isFinite(d) && d > 0 && d <= desired)
  const candidates = Array.from(new Set(candidatesRaw)).sort((a, b) => b - a)

  let lastOldErr: any = null
  for (const d of candidates) {
    try {
      const [wethTick, usdcTick] = await Promise.all([
        getV3TwapTick({ publicClient, pool: zoraWethV3Pool, durationSec: d }),
        getV3TwapTick({ publicClient, pool: zoraUsdcV3Pool, durationSec: d }),
      ])
      return { durationSec: d, wethTick, usdcTick }
    } catch (e: any) {
      if (isV3ObserveOldError(e)) {
        lastOldErr = e
        continue
      }
      throw e
    }
  }

  // Preserve the signal while keeping the user-facing message clean.
  void lastOldErr
  throw new Error('ZORA reference pools do not have enough oracle history for the requested TWAP window')
}

function getBlockTimestampSec(block: any): bigint {
  const ts = (block as any)?.timestamp
  if (typeof ts === 'bigint') return ts
  if (typeof ts === 'number') return BigInt(ts)
  if (typeof ts === 'string') {
    try {
      return BigInt(ts)
    } catch {
      return 0n
    }
  }
  return 0n
}

function toNumberSafe(value: bigint, label: string): number {
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error(`Invalid ${label}`)
  return n
}

async function estimateV4BlockRange(params: {
  publicClient: ReadonlyPublicClient
  durationSec: number
}): Promise<{ fromBlock: bigint; toBlock: bigint; avgBlockTimeSec: number }> {
  const { publicClient, durationSec } = params
  if (durationSec <= 0) throw new Error('Invalid TWAP duration')

  const toBlock = await publicClient.getBlockNumber()
  const latestBlock = await publicClient.getBlock({ blockNumber: toBlock })
  const latestTs = getBlockTimestampSec(latestBlock)
  if (latestTs <= 0n) throw new Error('Could not read latest block timestamp')

  // Estimate avg block time using a recent probe (Base is ~2s, but estimate to avoid hardcoding).
  const probeDeltaBlocks = 1_200n // ~40 minutes on Base; enough for a stable estimate
  let avgBlockTimeSec = 2
  if (toBlock > probeDeltaBlocks) {
    try {
      const probeBlockNumber = toBlock - probeDeltaBlocks
      const probeBlock = await publicClient.getBlock({ blockNumber: probeBlockNumber })
      const probeTs = getBlockTimestampSec(probeBlock)
      const dt = latestTs - probeTs
      const dtSec = toNumberSafe(dt, 'block time delta')
      const dBlocks = toNumberSafe(probeDeltaBlocks, 'probeDeltaBlocks')
      const est = dtSec / dBlocks
      if (Number.isFinite(est) && est > 0.1 && est < 60) avgBlockTimeSec = est
    } catch {
      // keep default
    }
  }

  const blocksBack = BigInt(Math.ceil(durationSec / avgBlockTimeSec))
  const fromBlock = toBlock > blocksBack ? toBlock - blocksBack : 0n
  return { fromBlock, toBlock, avgBlockTimeSec }
}

async function getV4Slot0AtBlock(params: {
  publicClient: ReadonlyPublicClient
  poolManager: Address
  poolId: `0x${string}`
  blockNumber: bigint
}): Promise<{ sqrtPriceX96: bigint; tick: number; protocolFee: number; lpFee: number }> {
  const { publicClient, poolManager, poolId, blockNumber } = params
  const stateSlot = getV4PoolStateSlot(poolId)
  const word = (await publicClient.readContract({
    address: poolManager,
    abi: V4_EXTSLOAD_ABI,
    functionName: 'extsload',
    args: [stateSlot],
    blockNumber,
  })) as `0x${string}`

  const decoded = decodeV4Slot0Word(word)
  if (decoded.sqrtPriceX96 <= 0n) throw new Error('V4 pool not initialized (sqrtPriceX96=0)')
  return decoded
}

async function getV4LiquidityAtBlock(params: {
  publicClient: ReadonlyPublicClient
  poolManager: Address
  poolId: `0x${string}`
  blockNumber: bigint
}): Promise<bigint> {
  const { publicClient, poolManager, poolId, blockNumber } = params
  const stateSlot = getV4PoolStateSlot(poolId)
  const liquiditySlot = addSlot(stateSlot, V4_LIQUIDITY_OFFSET)
  const word = (await publicClient.readContract({
    address: poolManager,
    abi: V4_EXTSLOAD_ABI,
    functionName: 'extsload',
    args: [liquiditySlot],
    blockNumber,
  })) as `0x${string}`
  const v = BigInt(word)
  const liq = v & ((1n << 128n) - 1n)
  return liq
}

async function getV4SampledMeanTick(params: {
  publicClient: ReadonlyPublicClient
  poolManager: Address
  poolId: `0x${string}`
  fromBlock: bigint
  toBlock: bigint
  sampleCount: number
}): Promise<{ meanTick: number; spotTick: number; sampleCount: number }> {
  const { publicClient, poolManager, poolId } = params
  const fromBlock = params.fromBlock
  const toBlock = params.toBlock
  const n = Math.max(2, Math.min(24, Math.floor(params.sampleCount)))
  if (toBlock < fromBlock) throw new Error('Invalid block range')

  const span = toBlock - fromBlock
  const stepRaw = span / BigInt(n - 1)
  const step = stepRaw > 0n ? stepRaw : 1n

  const blocks: bigint[] = []
  for (let i = 0; i < n; i++) {
    blocks.push(fromBlock + BigInt(i) * step)
  }
  blocks[0] = fromBlock
  blocks[blocks.length - 1] = toBlock

  const samples = await Promise.all(
    blocks.map(async (bn) => {
      const [block, tick] = await Promise.all([
        publicClient.getBlock({ blockNumber: bn }),
        getV4Slot0AtBlock({ publicClient, poolManager, poolId, blockNumber: bn }).then((s) => s.tick),
      ])
      const ts = getBlockTimestampSec(block)
      if (ts <= 0n) throw new Error('Invalid sampled block timestamp')
      return { timestamp: ts, tick }
    }),
  )

  samples.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0))

  let weighted = 0n
  let total = 0n
  for (let i = 0; i < samples.length - 1; i++) {
    const dt = samples[i + 1]!.timestamp - samples[i]!.timestamp
    if (dt <= 0n) continue
    weighted += BigInt(samples[i]!.tick) * dt
    total += dt
  }
  if (total <= 0n) throw new Error('Insufficient time delta to compute TWAP')

  const meanTickBig = floorDiv(weighted, total)
  const meanTick = Number(meanTickBig)
  if (!Number.isFinite(meanTick)) throw new Error('Invalid mean tick')

  const spotTick = samples[samples.length - 1]!.tick
  return { meanTick, spotTick, sampleCount: n }
}

function clampFinite(n: number, label: string): number {
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid ${label}`)
  return n
}

function toWeiFromEthFloat(eth: number): bigint {
  // Convert an ETH-denominated float to wei, conservatively (floor).
  const n = clampFinite(eth, 'ETH amount')
  const wei = Math.floor(n * 1e18)
  if (!Number.isFinite(wei) || wei <= 0) throw new Error('Computed wei is invalid')
  return BigInt(wei)
}

export async function computeMarketFloorQuote(params: {
  publicClient: ReadonlyPublicClient
  creatorCoin: Address
  /** Lookback window for sampling the CREATOR/ZORA v4 pool tick. */
  twapDurationSec?: number
  /** TWAP window used for ZORA reference pricing from Uniswap v3 pools. */
  zoraEthTwapDurationSec?: number
  discountBps?: number
}): Promise<MarketFloorQuote> {
  const { publicClient, creatorCoin } = params
  // Default lookback: 2 hours (meaningful smoothing for low-liquidity creator coins).
  const twapDurationSec = params.twapDurationSec ?? 7200
  // Uniswap v3 `observe()` frequently cannot serve very long windows unless the pool has
  // sufficient observation history. Keep this shorter and separate from the v4 sampling window.
  const zoraEthTwapDurationSec = params.zoraEthTwapDurationSec ?? 1800
  const discountBps = params.discountBps ?? 8000

  if (!isAddress(creatorCoin) || creatorCoin === ZERO_ADDRESS) throw new Error('Invalid creator coin address')
  if (discountBps <= 0 || discountBps > 10_000) throw new Error('Invalid discountBps')

  // Defensive: env vars can be set to non-address strings ("undefined"/"null") and override fallbacks.
  // Prefer configured values when valid, otherwise fall back to Base defaults.
  const poolManager = (isAddress((CONTRACTS as any).poolManager) ? (CONTRACTS as any).poolManager : BASE_DEFAULTS.poolManager) as Address
  const zoraUsdcV3Pool = (isAddress((CONTRACTS as any).zoraUsdcV3Pool) ? (CONTRACTS as any).zoraUsdcV3Pool : BASE_DEFAULTS.zoraUsdcV3Pool) as
    | Address
    | undefined
  const zoraWethV3Pool = (isAddress((CONTRACTS as any).zoraWethV3Pool) ? (CONTRACTS as any).zoraWethV3Pool : BASE_DEFAULTS.zoraWethV3Pool) as
    | Address
    | undefined
  const chainlinkEthUsd = (isAddress((CONTRACTS as any).chainlinkEthUsd) ? (CONTRACTS as any).chainlinkEthUsd : BASE_DEFAULTS.chainlinkEthUsd) as Address
  const weth = (isAddress((CONTRACTS as any).weth) ? (CONTRACTS as any).weth : BASE_DEFAULTS.weth) as Address
  const usdc = (isAddress((CONTRACTS as any).usdc) ? (CONTRACTS as any).usdc : BASE_DEFAULTS.usdc) as Address

  if (!isAddress(poolManager)) throw new Error('Missing V4 PoolManager address')
  if (!isAddress(zoraUsdcV3Pool as any)) throw new Error('Missing ZORA/USDC v3 pool address')
  if (!isAddress(zoraWethV3Pool as any)) throw new Error('Missing ZORA/WETH v3 pool address')
  if (!isAddress(chainlinkEthUsd)) throw new Error('Missing Chainlink ETH/USD feed address')
  if (!isAddress(weth)) throw new Error('Missing WETH address')
  if (!isAddress(usdc)) throw new Error('Missing USDC address')

  // 1) Identify ZORA token address from the reference pools
  const [wethPoolTokens, usdcPoolTokens] = await Promise.all([
    publicClient.multicall({
      contracts: [
        { address: zoraWethV3Pool as Address, abi: UNISWAP_V3_POOL_ORACLE_ABI, functionName: 'token0' },
        { address: zoraWethV3Pool as Address, abi: UNISWAP_V3_POOL_ORACLE_ABI, functionName: 'token1' },
      ],
      allowFailure: true,
    }),
    publicClient.multicall({
      contracts: [
        { address: zoraUsdcV3Pool as Address, abi: UNISWAP_V3_POOL_ORACLE_ABI, functionName: 'token0' },
        { address: zoraUsdcV3Pool as Address, abi: UNISWAP_V3_POOL_ORACLE_ABI, functionName: 'token1' },
      ],
      allowFailure: true,
    }),
  ])

  const wethT0 = String((wethPoolTokens as any)?.[0]?.status === 'success' ? (wethPoolTokens as any)?.[0]?.result : '')
  const wethT1 = String((wethPoolTokens as any)?.[1]?.status === 'success' ? (wethPoolTokens as any)?.[1]?.result : '')
  const usdcT0 = String((usdcPoolTokens as any)?.[0]?.status === 'success' ? (usdcPoolTokens as any)?.[0]?.result : '')
  const usdcT1 = String((usdcPoolTokens as any)?.[1]?.status === 'success' ? (usdcPoolTokens as any)?.[1]?.result : '')

  if (!isAddress(wethT0) || !isAddress(wethT1)) throw new Error('Invalid ZORA/WETH pool tokens')
  if (!isAddress(usdcT0) || !isAddress(usdcT1)) throw new Error('Invalid ZORA/USDC pool tokens')

  const zoraFromWethPool = wethT0.toLowerCase() === weth.toLowerCase() ? (wethT1 as Address) : (wethT0 as Address)
  if (zoraFromWethPool.toLowerCase() === weth.toLowerCase()) throw new Error('ZORA/WETH pool does not include ZORA')

  const zoraFromUsdcPool = usdcT0.toLowerCase() === usdc.toLowerCase() ? (usdcT1 as Address) : (usdcT0 as Address)
  if (zoraFromUsdcPool.toLowerCase() === usdc.toLowerCase()) throw new Error('ZORA/USDC pool does not include ZORA')

  if (zoraFromWethPool.toLowerCase() !== zoraFromUsdcPool.toLowerCase()) {
    throw new Error('ZORA reference pools disagree on ZORA token address')
  }
  const zora = zoraFromWethPool

  // 2) Read ZORA→ETH using Uniswap v3 TWAPs (both sources; pick conservative min)
  const { durationSec: v3DurationSecUsed, wethTick, usdcTick } = await getZoraReferenceV3Ticks({
    publicClient,
    zoraWethV3Pool: zoraWethV3Pool as Address,
    zoraUsdcV3Pool: zoraUsdcV3Pool as Address,
    desiredDurationSec: zoraEthTwapDurationSec,
  })

  const [wethDec, usdcDec, zoraDec, chainlinkDec, chainlinkRound] = await Promise.all([
    publicClient.readContract({ address: weth, abi: erc20Abi, functionName: 'decimals' }) as Promise<number>,
    publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: 'decimals' }) as Promise<number>,
    publicClient.readContract({ address: zora, abi: erc20Abi, functionName: 'decimals' }) as Promise<number>,
    publicClient.readContract({ address: chainlinkEthUsd, abi: CHAINLINK_AGGREGATOR_ABI, functionName: 'decimals' }) as Promise<number>,
    publicClient.readContract({ address: chainlinkEthUsd, abi: CHAINLINK_AGGREGATOR_ABI, functionName: 'latestRoundData' }),
  ])

  // ZORA/WETH TWAP → ETH per ZORA
  const wethToken0 = wethT0 as Address
  const wethToken1 = wethT1 as Address
  const wethToken1PerToken0 = approxToken1PerToken0FromTick(wethTick, zoraDec, wethDec) // uses real decimals below via tokens
  // NOTE: We passed (zoraDec,wethDec) above, but must handle orientation:
  // - if token0=ZORA, token1=WETH => token1/token0 = WETH/ZORA (ETH per ZORA)
  // - if token0=WETH, token1=ZORA => token1/token0 = ZORA/WETH (invert)
  let ethPerZoraWethTwap: number | undefined
  if (wethToken0.toLowerCase() === zora.toLowerCase() && wethToken1.toLowerCase() === weth.toLowerCase()) {
    ethPerZoraWethTwap = clampFinite(approxToken1PerToken0FromTick(wethTick, zoraDec, wethDec), 'ethPerZoraWethTwap')
  } else if (wethToken0.toLowerCase() === weth.toLowerCase() && wethToken1.toLowerCase() === zora.toLowerCase()) {
    const zoraPerEth = clampFinite(approxToken1PerToken0FromTick(wethTick, wethDec, zoraDec), 'zoraPerEth (weth pool)')
    ethPerZoraWethTwap = clampFinite(1 / zoraPerEth, 'ethPerZoraWethTwap')
  } else {
    throw new Error('ZORA/WETH pool token ordering is unexpected')
  }
  void wethToken1PerToken0 // keep variable for debugging if needed later

  // ZORA/USDC TWAP → USD per ZORA (assume USDC≈USD) → ETH per ZORA using Chainlink ETH/USD
  const usdcToken0 = usdcT0 as Address
  const usdcToken1 = usdcT1 as Address
  let usdPerZora: number
  if (usdcToken0.toLowerCase() === zora.toLowerCase() && usdcToken1.toLowerCase() === usdc.toLowerCase()) {
    usdPerZora = clampFinite(approxToken1PerToken0FromTick(usdcTick, zoraDec, usdcDec), 'usdPerZora')
  } else if (usdcToken0.toLowerCase() === usdc.toLowerCase() && usdcToken1.toLowerCase() === zora.toLowerCase()) {
    const zoraPerUsd = clampFinite(approxToken1PerToken0FromTick(usdcTick, usdcDec, zoraDec), 'zoraPerUsd')
    usdPerZora = clampFinite(1 / zoraPerUsd, 'usdPerZora')
  } else {
    throw new Error('ZORA/USDC pool token ordering is unexpected')
  }

  const answer = BigInt((chainlinkRound as any)?.[1] ?? 0n)
  if (answer <= 0n) throw new Error('Chainlink ETH/USD returned non-positive answer')
  const ethUsd = Number(answer) / Math.pow(10, chainlinkDec)
  const ethPerZoraUsdcTwap = clampFinite(usdPerZora / ethUsd, 'ethPerZoraUsdcTwap')

  const ethPerZoraConservative = clampFinite(Math.min(ethPerZoraWethTwap, ethPerZoraUsdcTwap), 'ethPerZoraConservative')

  // 3) Read CREATOR/ZORA spot from V4 pool (creator coin contract tells us its pool key)
  const poolKey = await publicClient.readContract({
    address: creatorCoin,
    abi: ZORA_COIN_POOL_KEY_ABI,
    functionName: 'getPoolKey',
  })
  const currency0 = String((poolKey as any)?.[0] ?? '') as Address
  const currency1 = String((poolKey as any)?.[1] ?? '') as Address
  const fee = (poolKey as any)?.[2] as number
  const tickSpacing = (poolKey as any)?.[3] as number
  const hooks = String((poolKey as any)?.[4] ?? '') as Address

  if (!isAddress(currency0) || !isAddress(currency1) || !isAddress(hooks)) throw new Error('Invalid getPoolKey() response')
  if (!Number.isFinite(fee) || fee <= 0) throw new Error('Invalid getPoolKey fee')
  if (!Number.isFinite(tickSpacing) || tickSpacing === 0) throw new Error('Invalid getPoolKey tickSpacing')

  const c0 = currency0 as Address
  const c1 = currency1 as Address
  if (c0.toLowerCase() !== zora.toLowerCase() && c1.toLowerCase() !== zora.toLowerCase()) {
    throw new Error('Creator coin pool is not paired with ZORA (cannot auto-price)')
  }
  if (c0.toLowerCase() !== creatorCoin.toLowerCase() && c1.toLowerCase() !== creatorCoin.toLowerCase()) {
    throw new Error('Creator coin getPoolKey does not include the creator coin address')
  }

  const poolKeyEncoded = encodeAbiParameters(parseAbiParameters('address,address,uint24,int24,address'), [
    c0,
    c1,
    fee,
    tickSpacing,
    hooks,
  ])
  const poolId = keccak256(poolKeyEncoded) as `0x${string}`

  // v4 does not expose a built-in TWAP oracle like v3, so we approximate by sampling
  // `slot0.tick` across the lookback window and computing a time-weighted mean tick.
  const { fromBlock, toBlock } = await estimateV4BlockRange({ publicClient, durationSec: twapDurationSec })
  // Fixed sample count to keep RPC usage predictable and simple.
  const sampleCount = 10
  const { meanTick, spotTick, sampleCount: sampleCountUsed } = await getV4SampledMeanTick({
    publicClient,
    poolManager,
    poolId,
    fromBlock,
    toBlock,
    sampleCount,
  })

  const [liquidityRaw, c0Dec, c1Dec] = await Promise.all([
    getV4LiquidityAtBlock({ publicClient, poolManager, poolId, blockNumber: toBlock }),
    publicClient.readContract({ address: c0, abi: erc20Abi, functionName: 'decimals' }) as Promise<number>,
    publicClient.readContract({ address: c1, abi: erc20Abi, functionName: 'decimals' }) as Promise<number>,
  ])

  const liquidity = BigInt(liquidityRaw as any)
  if (liquidity <= 0n) throw new Error('Creator coin pool has zero liquidity')

  // token1/token0 in human units
  const token1PerToken0 = approxToken1PerToken0FromTick(meanTick, c0Dec, c1Dec)

  // Convert to creatorPerZora
  let creatorPerZora: number
  if (c0.toLowerCase() === zora.toLowerCase()) {
    // token0=ZORA; token1 should be CREATOR
    if (c1.toLowerCase() !== creatorCoin.toLowerCase()) throw new Error('Creator/ZORA pool key mismatch (expected creator as currency1)')
    creatorPerZora = clampFinite(token1PerToken0, 'creatorPerZora')
  } else {
    // token0=CREATOR; token1=ZORA
    if (c0.toLowerCase() !== creatorCoin.toLowerCase()) throw new Error('Creator/ZORA pool key mismatch (expected creator as currency0)')
    creatorPerZora = clampFinite(1 / token1PerToken0, 'creatorPerZora')
  }

  const zoraPerCreator = clampFinite(1 / creatorPerZora, 'zoraPerCreator')
  const ethPerCreator = clampFinite(ethPerZoraConservative * zoraPerCreator, 'ethPerCreator')
  const ethPerCreatorDiscounted = clampFinite((ethPerCreator * discountBps) / 10_000, 'ethPerCreatorDiscounted')

  const weiPerToken = toWeiFromEthFloat(ethPerCreatorDiscounted)

  // Auction token is ShareOFT (■CREATOR) which is 18 decimals (OFT/ERC20 default).
  const floorPriceQ96 = currencyPerTokenBaseUnitsToQ96(weiPerToken, 18)

  // Tick spacing = 1% of floor price (min 2), and align floor down to spacing.
  const tickSpacingQ96Raw = floorPriceQ96 / 100n
  const tickSpacingQ96 = tickSpacingQ96Raw > 1n ? tickSpacingQ96Raw : 2n
  const floorPriceQ96Aligned = (floorPriceQ96 / tickSpacingQ96) * tickSpacingQ96

  return {
    floorPriceQ96Aligned,
    tickSpacingQ96,
    floorPriceQ96,
    weiPerToken,
    creatorZora: {
      durationSec: twapDurationSec,
      poolId,
      currency0: c0,
      currency1: c1,
      spotTick,
      meanTick,
      fromBlock,
      toBlock,
      sampleCount: sampleCountUsed,
      liquidity,
      creatorPerZora,
    },
    zoraEth: {
      durationSec: v3DurationSecUsed,
      ethPerZoraWethTwap,
      ethPerZoraUsdcTwap,
      ethPerZoraConservative,
      discountBps,
    },
  }
}

