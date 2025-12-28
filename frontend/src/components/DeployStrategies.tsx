import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useSendCalls } from 'wagmi/experimental';
import { parseUnits, encodeFunctionData, keccak256, encodePacked } from 'viem';
import { base } from 'wagmi/chains';
import { CONTRACTS } from '@/config/contracts';

interface DeployStrategiesProps {
  vaultAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  onSuccess?: (strategies: {
    ajna: string;
    charmWeth: string;
    charmUsdc: string;
  }) => void;
}

export function DeployStrategies({ vaultAddress, tokenAddress, onSuccess }: DeployStrategiesProps) {
  const { address, connector } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { sendCalls } = useSendCalls();
  const [isCalculating, setIsCalculating] = useState(false);

  // Check if user has smart wallet (Coinbase)
  const isSmartWallet = connector?.id === 'coinbaseWalletSDK';

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId: base.id,
  });

  // Get pool key from token
  const { data: poolKey } = useReadContract({
    address: tokenAddress,
    abi: [{
      name: 'getPoolKey',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [
        { name: 'currency0', type: 'address' },
        { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hooks', type: 'address' }
      ]
    }],
    functionName: 'getPoolKey',
  });

  const calculateBucketIndex = async (): Promise<number> => {
    if (!poolKey) {
      throw new Error('Pool key not available');
    }

    // poolKey is a tuple: [currency0, currency1, fee, tickSpacing, hooks]
    const [currency0, currency1, fee, tickSpacing, hooks] = poolKey;

    // Calculate PoolId
    const poolId = keccak256(
      encodePacked(
        ['address', 'address', 'uint24', 'int24', 'address'],
        [
          currency0 as `0x${string}`,
          currency1 as `0x${string}`,
          fee,
          tickSpacing,
          hooks as `0x${string}`
        ]
      )
    );

    // Get current tick from PoolManager
    const slot0 = await fetch(`https://mainnet.base.org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{
          to: CONTRACTS.poolManager,
          data: `0x24b73cc4${poolId.slice(2)}`  // getSlot0(bytes32)
        }, 'latest']
      })
    }).then(r => r.json());

    if (!slot0.result || slot0.result === '0x') {
      console.warn('No V4 pool found, using default bucket 4156');
      return 4156;
    }

    // Parse tick (second value in slot0)
    const tickHex = '0x' + slot0.result.slice(66, 130);
    let tick = parseInt(tickHex, 16);
    
    // Handle negative tick (two's complement)
    if (tick > 0x7FFFFFFF) {
      tick = tick - 0x100000000;
    }

    // Invert tick if creator token is currency1
    if (currency1.toLowerCase() === tokenAddress.toLowerCase()) {
      tick = -tick;
    }

    // Calculate Ajna bucket (approx):
    // - 50 Uniswap ticks ≈ 0.5% (≈ Ajna 1.005 step)
    // - Ajna index ≈ 4156 - (tick / 50)
    const bucket = 4156 - Math.floor(tick / 50);

    // Clamp to valid Ajna range (1..7388). Note: index 0 is invalid on Ajna pools.
    return Math.max(1, Math.min(7388, bucket));
  };

  const deployAllStrategies = async () => {
    if (!address) return;

    setIsCalculating(true);
    try {
      // Step 1: Calculate optimal Ajna bucket from ZORA V4 pool
      const ajnaBucketIndex = await calculateBucketIndex();
      console.log('Calculated Ajna bucket:', ajnaBucketIndex);

      // Step 2: Prepare deployment params
      const params = {
        vault: vaultAddress,
        creatorToken: tokenAddress,
        ajnaFactory: CONTRACTS.ajnaErc20Factory,
        charmVault: CONTRACTS.charmAlphaVault || '0x0000000000000000000000000000000000000000', // TODO: Update
        weth: CONTRACTS.weth,
        usdc: CONTRACTS.usdc,
        zora: CONTRACTS.zora,
        uniswapV3Factory: CONTRACTS.uniswapV3Factory,
        ajnaBucketIndex: BigInt(ajnaBucketIndex),
        wethFee: 10000,  // 1%
        usdcFee: 10000,  // 1%
        ajnaWeight: 100n,
        charmWethWeight: 100n,
        charmUsdcWeight: 100n,
        minimumIdle: parseUnits('12500000', 18), // 12.5M tokens
      };

      setIsCalculating(false);

      // Step 3: Deploy (different methods for smart wallet vs regular wallet)
      if (isSmartWallet) {
        // Smart Wallet: Use sendCalls for AA batching
        const result = await sendCalls({
          calls: [{
            to: CONTRACTS.strategyDeploymentBatcher || '0x0000000000000000000000000000000000000000',
            data: encodeFunctionData({
              abi: StrategyDeploymentBatcherABI,
              functionName: 'deployAllStrategies',
              args: [params]
            })
          }]
        });
        
        console.log('Strategies deployed via AA:', result);
        
        if (onSuccess) {
          // TODO: Parse return values from transaction receipt
          onSuccess({
            ajna: '0x...',
            charmWeth: '0x...',
            charmUsdc: '0x...'
          });
        }
      } else {
        // Regular Wallet: Single contract call to batcher
        await writeContract({
          address: CONTRACTS.strategyDeploymentBatcher as `0x${string}` || '0x0000000000000000000000000000000000000000',
          abi: StrategyDeploymentBatcherABI,
          functionName: 'deployAllStrategies',
          args: [params],
          gas: 6_000_000n, // Set high gas limit
        });
      }
    } catch (error) {
      console.error('Deployment failed:', error);
      setIsCalculating(false);
    }
  };

  const isLoading = isPending || isConfirming || isCalculating;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-2">Deploy Yield Strategies</h3>
        <p className="text-sm text-gray-400">
          Deploy all 3 strategies (Ajna, Charm WETH, Charm USDC) in one transaction
        </p>
      </div>

      {/* Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">Strategy 1</div>
          <div className="font-bold">Ajna Lending</div>
          <div className="text-sm text-gray-400">CREATOR/WETH</div>
          <div className="mt-2 text-xs text-gray-500">
            Permissionless lending, 5-15% APY
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">Strategy 2</div>
          <div className="font-bold">Charm LP #1</div>
          <div className="text-sm text-gray-400">CREATOR/WETH</div>
          <div className="mt-2 text-xs text-gray-500">
            Automated V3 LP, 10-50% APY
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">Strategy 3</div>
          <div className="font-bold">Charm LP #2</div>
          <div className="text-sm text-gray-400">CREATOR/USDC</div>
          <div className="mt-2 text-xs text-gray-500">
            Stable pair LP, 5-20% APY
          </div>
        </div>
      </div>

      {/* Allocation Display */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-sm text-gray-400 mb-3">Vault Allocation</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Ajna Lending</span>
            <span className="font-mono">25%</span>
          </div>
          <div className="flex justify-between">
            <span>Charm WETH LP</span>
            <span className="font-mono">25%</span>
          </div>
          <div className="flex justify-between">
            <span>Charm USDC LP</span>
            <span className="font-mono">25%</span>
          </div>
          <div className="flex justify-between">
            <span>Idle (Liquidity)</span>
            <span className="font-mono">25%</span>
          </div>
        </div>
      </div>

      {/* Deploy Button */}
      <button
        onClick={deployAllStrategies}
        disabled={isLoading || !address}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors"
      >
        {isCalculating && '⏳ Calculating optimal parameters...'}
        {isPending && '📝 Waiting for wallet approval...'}
        {isConfirming && '⏳ Deploying strategies...'}
        {!isLoading && '🚀 Deploy All Strategies (1-Click)'}
      </button>

      {/* AA Badge */}
      {isSmartWallet && (
        <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 p-3 rounded-lg">
          <span>✅</span>
          <span>Smart Wallet detected - using Account Abstraction for optimized deployment</span>
        </div>
      )}

      {/* Success Message */}
      {isSuccess && (
        <div className="bg-green-600/20 border border-green-600 text-green-400 p-4 rounded-lg text-sm">
          <div className="font-bold mb-1">✅ Strategies Deployed Successfully!</div>
          <div>All 3 strategies are now active and earning yield.</div>
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-gray-500">
        <p>• One transaction deploys and configures all strategies</p>
        <p>• Optimal Ajna bucket calculated from CREATOR/ZORA V4 pool</p>
        <p>• Estimated gas: ~5.5M units (~$15-30 on Base)</p>
      </div>
    </div>
  );
}

// ABI for StrategyDeploymentBatcher
const StrategyDeploymentBatcherABI = [
  {
    name: 'deployAllStrategies',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{
      name: 'params',
      type: 'tuple',
      components: [
        { name: 'vault', type: 'address' },
        { name: 'creatorToken', type: 'address' },
        { name: 'ajnaFactory', type: 'address' },
        { name: 'charmVault', type: 'address' },
        { name: 'weth', type: 'address' },
        { name: 'usdc', type: 'address' },
        { name: 'zora', type: 'address' },
        { name: 'uniswapV3Factory', type: 'address' },
        { name: 'ajnaBucketIndex', type: 'uint256' },
        { name: 'wethFee', type: 'uint24' },
        { name: 'usdcFee', type: 'uint24' },
        { name: 'ajnaWeight', type: 'uint256' },
        { name: 'charmWethWeight', type: 'uint256' },
        { name: 'charmUsdcWeight', type: 'uint256' },
        { name: 'minimumIdle', type: 'uint256' },
      ]
    }],
    outputs: [
      { name: 'ajnaStrategy', type: 'address' },
      { name: 'charmWethStrategy', type: 'address' },
      { name: 'charmUsdcStrategy', type: 'address' }
    ]
  }
] as const;
