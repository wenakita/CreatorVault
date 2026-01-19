import { useMemo, useState } from 'react'
import { useAccount, usePublicClient, useReadContract, useWalletClient } from 'wagmi'
import { useSendCalls } from 'wagmi/experimental'
import { base } from 'wagmi/chains'
import { encodeFunctionData, erc20Abi, getContractAddress, isAddress, parseUnits, type Address, type Hex } from 'viem'
import { CONTRACTS } from '@/config/contracts'
import { logger } from '@/lib/logger'

interface DeployStrategiesProps {
  vaultAddress: `0x${string}`
  tokenAddress: `0x${string}`
}

const STRATEGY_BATCHER_ABI = [
  {
    type: 'function',
    name: 'batchDeployStrategies',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'underlyingToken', type: 'address' },
      { name: 'quoteToken', type: 'address' },
      { name: 'creatorVault', type: 'address' },
      { name: '_ajnaFactory', type: 'address' },
      { name: 'v3FeeTier', type: 'uint24' },
      { name: 'initialSqrtPriceX96', type: 'uint160' },
      { name: 'owner', type: 'address' },
      { name: 'vaultName', type: 'string' },
      { name: 'vaultSymbol', type: 'string' },
    ],
    outputs: [
      {
        name: 'result',
        type: 'tuple',
        components: [
          { name: 'charmVault', type: 'address' },
          { name: 'charmStrategy', type: 'address' },
          { name: 'creatorCharmStrategy', type: 'address' },
          { name: 'ajnaStrategy', type: 'address' },
          { name: 'v3Pool', type: 'address' },
        ],
      },
    ],
  },
] as const

const VAULT_MGMT_ABI = [
  { type: 'function', name: 'management', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'getStrategyCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'addStrategy', stateMutability: 'nonpayable', inputs: [{ name: 'strategy', type: 'address' }, { name: 'weight', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'setMinimumTotalIdle', stateMutability: 'nonpayable', inputs: [{ name: '_minimumTotalIdle', type: 'uint256' }], outputs: [] },
] as const

export function DeployStrategies({ vaultAddress, tokenAddress }: DeployStrategiesProps) {
  const { address, connector } = useAccount()
  const publicClient = usePublicClient({ chainId: base.id })
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const { sendCallsAsync } = useSendCalls()

  const { data: tokenDecimalsRaw } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'decimals',
  })
  const tokenDecimals = typeof tokenDecimalsRaw === 'number' ? tokenDecimalsRaw : 18

  const isSmartWallet = connector?.id === 'coinbaseWalletSDK'

  const [batcherAddress, setBatcherAddress] = useState<string>(CONTRACTS.strategyDeploymentBatcher ?? '')
  const [quoteToken, setQuoteToken] = useState<string>(CONTRACTS.usdc)
  const [ajnaFactory, setAjnaFactory] = useState<string>(CONTRACTS.ajnaErc20Factory)
  const [v3FeeTier, setV3FeeTier] = useState<number>(3000)

  // Default: Q96 (price = 1 in raw token1/token0 terms). Only used if pool doesn't exist yet.
  const [initialSqrtPriceX96, setInitialSqrtPriceX96] = useState<string>('79228162514264337593543950336')
  const [charmVaultName, setCharmVaultName] = useState<string>('CreatorVault: creator/USDC')
  const [charmVaultSymbol, setCharmVaultSymbol] = useState<string>('CV-creator-USDC')

  // Allocation weights are basis points (relative). Idle reserve is controlled by `minimumTotalIdle`.
  const [charmWeightBps, setCharmWeightBps] = useState<number>(6900)
  const [ajnaWeightBps, setAjnaWeightBps] = useState<number>(2139)
  // AKITA default (temporary): 9.61% idle of 5,000,000 = 480,500
  const [minimumIdle, setMinimumIdle] = useState<string>('480500')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bundleId, setBundleId] = useState<string | null>(null)
  const [predicted, setPredicted] = useState<{
    nonce: bigint
    charmVault: Address
    creatorCharmStrategy: Address
    ajnaStrategy: Address
  } | null>(null)

  const baseBatcher = useMemo(() => {
    const v = batcherAddress.trim()
    return (isAddress(v) ? (v as Address) : null)
  }, [batcherAddress])

  const canSubmit = !!address && !!publicClient && !!walletClient && !!baseBatcher

  async function computePredicted() {
    if (!publicClient) throw new Error('Network client not ready')
    if (!baseBatcher) throw new Error('Invalid StrategyDeploymentBatcher address')

    // viem returns nonce as a JS number; convert so we can do safe +1n/+2n math and satisfy viem typings.
    const nonce = BigInt(await publicClient.getTransactionCount({ address: baseBatcher }))
    const charmVault = getContractAddress({ from: baseBatcher, nonce })
    const creatorCharmStrategy = getContractAddress({ from: baseBatcher, nonce: nonce + 1n })
    const ajnaStrategy = getContractAddress({ from: baseBatcher, nonce: nonce + 2n })
    return { nonce, charmVault, creatorCharmStrategy, ajnaStrategy }
  }

  async function deployAndConfigure() {
    if (!address || !publicClient || !walletClient) return
    setError(null)
    setBundleId(null)
    setIsSubmitting(true)

    try {
      if (!baseBatcher) throw new Error('StrategyDeploymentBatcher not configured')

      const quote = quoteToken.trim()
      const ajna = ajnaFactory.trim()
      if (!isAddress(quote)) throw new Error('Invalid quote token address')
      if (!isAddress(ajna)) throw new Error('Invalid Ajna factory address')

      const charmW = Number(charmWeightBps)
      const ajnaW = Number(ajnaWeightBps)
      if (!Number.isFinite(charmW) || charmW < 0 || charmW > 10_000) throw new Error('Invalid Charm weight (bps)')
      if (!Number.isFinite(ajnaW) || ajnaW < 0 || ajnaW > 10_000) throw new Error('Invalid Ajna weight (bps)')
      if (charmW + ajnaW > 10_000) throw new Error('Weights must sum to <= 10,000 bps')

      const sqrt = BigInt(initialSqrtPriceX96.trim())
      if (sqrt <= 0n) throw new Error('initialSqrtPriceX96 must be > 0')

      const minIdle = parseUnits(minimumIdle.trim(), tokenDecimals)

      const next = await computePredicted()
      setPredicted(next)

      const calls: { to: Address; data: Hex; value: bigint }[] = []

      // 1) Deploy strategies (creates V3 pool if needed, deploys Charm vault + strategies, deploys Ajna strategy)
      calls.push({
        to: baseBatcher,
        data: encodeFunctionData({
          abi: STRATEGY_BATCHER_ABI,
          functionName: 'batchDeployStrategies',
          args: [
            tokenAddress,
            quote as Address,
            vaultAddress,
            ajna as Address,
            v3FeeTier,
            sqrt,
            address as Address,
            charmVaultName,
            charmVaultSymbol,
          ],
        }),
        value: 0n,
      })

      // 2) Configure vault allocations
      if (charmW > 0) {
        calls.push({
          to: vaultAddress,
          data: encodeFunctionData({
            abi: VAULT_MGMT_ABI,
            functionName: 'addStrategy',
            args: [next.creatorCharmStrategy, BigInt(charmW)],
          }),
          value: 0n,
        })
      }
      if (ajnaW > 0) {
        calls.push({
          to: vaultAddress,
          data: encodeFunctionData({
            abi: VAULT_MGMT_ABI,
            functionName: 'addStrategy',
            args: [next.ajnaStrategy, BigInt(ajnaW)],
          }),
          value: 0n,
        })
      }

      // 3) Set vault min idle buffer (keep liquidity available for redemptions)
      calls.push({
        to: vaultAddress,
        data: encodeFunctionData({
          abi: VAULT_MGMT_ABI,
          functionName: 'setMinimumTotalIdle',
          args: [minIdle],
        }),
        value: 0n,
      })

      // Preferred: atomic sendCalls (Smart Wallets)
      try {
        const res = await sendCallsAsync({
          calls,
          account: address as Address,
          chainId: base.id,
          forceAtomic: true,
        })
        setBundleId(res.id)
        return
      } catch (e) {
        logger.warn('[DeployStrategies] wallet_sendCalls failed; falling back to sequential txs', e)
      }

      // Fallback: sequential transactions
      for (const c of calls) {
        const txHash = await walletClient.sendTransaction({
          account: address as any,
          chain: base as any,
          to: c.to,
          data: c.data,
          value: c.value,
        })
        setBundleId(String(txHash))
        await publicClient.waitForTransactionReceipt({ hash: txHash as any })
      }
    } catch (e: any) {
      logger.error('[DeployStrategies] failed', e)
      setError(String(e?.shortMessage || e?.message || e))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-2">Deploy Yield Strategies</h3>
        <p className="text-sm text-gray-400">
          Deploys Charm + Ajna strategies and configures vault allocations (requires vault management permissions).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900/60 border border-white/10 rounded-lg p-4 space-y-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider">Contracts</div>
          <div className="space-y-2 text-sm">
            <div>
              <div className="text-gray-400">StrategyDeploymentBatcher</div>
              <input
                value={batcherAddress}
                onChange={(e) => setBatcherAddress(e.target.value)}
                placeholder="0x..."
                className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 font-mono text-xs"
              />
              {!CONTRACTS.strategyDeploymentBatcher && (
                <div className="mt-1 text-xs text-amber-400">
                  Missing `VITE_STRATEGY_DEPLOYMENT_BATCHER`. Set it in Vercel envs for production.
                </div>
              )}
            </div>
            <div>
              <div className="text-gray-400">Quote token (default USDC)</div>
              <input
                value={quoteToken}
                onChange={(e) => setQuoteToken(e.target.value)}
                className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 font-mono text-xs"
              />
            </div>
            <div>
              <div className="text-gray-400">Ajna ERC20 factory</div>
              <input
                value={ajnaFactory}
                onChange={(e) => setAjnaFactory(e.target.value)}
                className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-900/60 border border-white/10 rounded-lg p-4 space-y-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider">Parameters</div>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-gray-400">Charm weight (bps)</div>
                <input
                  value={charmWeightBps}
                  onChange={(e) => setCharmWeightBps(Number(e.target.value))}
                  className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <div className="text-gray-400">Ajna weight (bps)</div>
                <input
                  value={ajnaWeightBps}
                  onChange={(e) => setAjnaWeightBps(Number(e.target.value))}
                  className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <div className="text-gray-400">Minimum idle (underlying tokens)</div>
              <input
                value={minimumIdle}
                onChange={(e) => setMinimumIdle(e.target.value)}
                className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 font-mono text-xs"
              />
              <div className="mt-1 text-xs text-gray-500">Parsed with {tokenDecimals} decimals.</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-gray-400">V3 fee tier</div>
                <input
                  value={v3FeeTier}
                  onChange={(e) => setV3FeeTier(Number(e.target.value))}
                  className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <div className="text-gray-400">initialSqrtPriceX96</div>
                <input
                  value={initialSqrtPriceX96}
                  onChange={(e) => setInitialSqrtPriceX96(e.target.value)}
                  className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-gray-400">Charm vault name</div>
                <input
                  value={charmVaultName}
                  onChange={(e) => setCharmVaultName(e.target.value)}
                  className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs"
                />
              </div>
              <div>
                <div className="text-gray-400">Charm vault symbol</div>
                <input
                  value={charmVaultSymbol}
                  onChange={(e) => setCharmVaultSymbol(e.target.value)}
                  className="mt-1 w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {predicted && (
        <div className="bg-gray-900/60 border border-white/10 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Predicted addresses (next deployment)</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 font-mono text-xs">
            <div>
              <div className="text-gray-400">Charm vault</div>
              <div className="break-all">{predicted.charmVault}</div>
            </div>
            <div>
              <div className="text-gray-400">Charm strategy</div>
              <div className="break-all">{predicted.creatorCharmStrategy}</div>
            </div>
            <div>
              <div className="text-gray-400">Ajna strategy</div>
              <div className="break-all">{predicted.ajnaStrategy}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">Batcher nonce used: {predicted.nonce.toString()}</div>
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded p-3 text-sm">{error}</div>}

      <button
        onClick={deployAndConfigure}
        disabled={!canSubmit || isSubmitting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
      >
        {isSubmitting ? 'Submitting…' : 'Deploy + Configure Strategies'}
      </button>

      {bundleId && (
        <div className="text-xs text-gray-400">
          Bundle/tx id: <span className="font-mono break-all">{bundleId}</span>
        </div>
      )}

      <div className="text-xs text-gray-500 space-y-1">
        <p>• If your wallet supports EIP-5792 atomic batching, this can run as a single atomic bundle.</p>
        <p>• If batching is unavailable, it will fall back to sequential transactions.</p>
        {isSmartWallet ? <p>• Coinbase Smart Wallet detected.</p> : null}
      </div>
    </div>
  )
}
