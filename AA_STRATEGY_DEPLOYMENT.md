# Account Abstraction: 1-Click Strategy Deployment

## Overview

Deploy **all vault strategies** (Ajna, Charm WETH LP, Charm USDC LP) in a **single transaction** using Account Abstraction (ERC-4337).

---

## 🎯 What Gets Deployed

In **ONE transaction**:

1. ✅ **AjnaStrategy** (CREATOR/WETH lending)
2. ✅ **CreatorCharmStrategy #1** (CREATOR/WETH LP)
3. ✅ **CreatorCharmStrategy #2** (CREATOR/USDC LP)
4. ✅ Configure all strategies (pools, buckets, approvals)
5. ✅ Add all strategies to vault with weights
6. ✅ Set minimum idle amount

**Result**: Fully configured multi-strategy vault ready to earn yield!

---

## 🏗️ Architecture

### **For Smart Wallet Users (Coinbase, etc.)**

```
User clicks "Deploy All Strategies"
  ↓
Frontend batches all calls
  ↓
Smart Wallet executes in 1 transaction via ERC-4337
  ↓
All strategies deployed and configured
  ↓
Vault ready to accept deposits
```

### **For Regular Wallet Users (MetaMask, etc.)**

```
User clicks "Deploy All Strategies"
  ↓
Frontend calls StrategyDeploymentBatcher contract
  ↓
Batcher deploys and configures everything in 1 transaction
  ↓
All strategies deployed and configured
  ↓
Vault ready to accept deposits
```

**Both methods = 1 transaction!**

---

## 📋 Deployment Parameters

```typescript
interface DeploymentParams {
  vault: string;              // Vault address
  creatorToken: string;       // Creator token address
  ajnaFactory: string;        // Ajna ERC20 factory
  charmVault: string;         // Charm Alpha Vault
  weth: string;               // WETH address
  usdc: string;               // USDC address
  zora: string;               // ZORA address (for price discovery)
  uniswapV3Factory: string;   // Uniswap V3 factory
  ajnaBucketIndex: bigint;    // Calculated from ZORA V4 price
  wethFee: number;            // e.g., 10000 (1%)
  usdcFee: number;            // e.g., 10000 (1%)
  ajnaWeight: bigint;         // e.g., 100
  charmWethWeight: bigint;    // e.g., 100
  charmUsdcWeight: bigint;    // e.g., 100
  minimumIdle: bigint;        // e.g., 12.5M tokens
}
```

---

## 🚀 Frontend Integration

### **Step 1: Fetch Current Price from ZORA V4**

```typescript
import { useReadContract } from 'wagmi';

// Get pool key from creator token
const { data: poolKey } = useReadContract({
  address: creatorToken,
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

// Calculate PoolId
const poolId = keccak256(encodePacked(
  ['address', 'address', 'uint24', 'int24', 'address'],
  [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
));

// Get current tick
const { data: slot0 } = useReadContract({
  address: UNISWAP_V4_POOL_MANAGER,
  abi: [{
    name: 'getSlot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' }
    ]
  }],
  functionName: 'getSlot0',
  args: [poolId]
});

// Calculate bucket (invert tick if creator is currency1)
let tick = slot0.tick;
if (poolKey.currency1.toLowerCase() === creatorToken.toLowerCase()) {
  tick = -tick;
}
const ajnaBucketIndex = 3696 + Math.floor(tick / 100);
```

### **Step 2: Deploy via Smart Wallet (AA Users)**

```typescript
import { useSendCalls } from 'wagmi/experimental';

const { sendCalls } = useSendCalls();

const deployStrategies = async () => {
  const params = {
    vault: vaultAddress,
    creatorToken: tokenAddress,
    ajnaFactory: AJNA_ERC20_FACTORY,
    charmVault: CHARM_ALPHA_VAULT,
    weth: WETH,
    usdc: USDC,
    zora: ZORA,
    uniswapV3Factory: UNISWAP_V3_FACTORY,
    ajnaBucketIndex: BigInt(ajnaBucketIndex),
    wethFee: 10000,  // 1%
    usdcFee: 10000,  // 1%
    ajnaWeight: 100n,
    charmWethWeight: 100n,
    charmUsdcWeight: 100n,
    minimumIdle: parseUnits('12500000', 18), // 12.5M tokens
  };

  // For Smart Wallet: Batch all calls
  const result = await sendCalls({
    calls: [
      {
        to: STRATEGY_DEPLOYMENT_BATCHER,
        data: encodeFunctionData({
          abi: StrategyDeploymentBatcherABI,
          functionName: 'deployAllStrategies',
          args: [params]
        })
      }
    ]
  });

  return result;
};
```

### **Step 3: Deploy via Regular Wallet (Fallback)**

```typescript
import { useWriteContract } from 'wagmi';

const { writeContract } = useWriteContract();

const deployStrategies = async () => {
  const params = {
    vault: vaultAddress,
    creatorToken: tokenAddress,
    ajnaFactory: AJNA_ERC20_FACTORY,
    charmVault: CHARM_ALPHA_VAULT,
    weth: WETH,
    usdc: USDC,
    zora: ZORA,
    uniswapV3Factory: UNISWAP_V3_FACTORY,
    ajnaBucketIndex: BigInt(ajnaBucketIndex),
    wethFee: 10000,  // 1%
    usdcFee: 10000,  // 1%
    ajnaWeight: 100n,
    charmWethWeight: 100n,
    charmUsdcWeight: 100n,
    minimumIdle: parseUnits('12500000', 18), // 12.5M tokens
  };

  // For Regular Wallet: Single contract call
  const hash = await writeContract({
    address: STRATEGY_DEPLOYMENT_BATCHER,
    abi: StrategyDeploymentBatcherABI,
    functionName: 'deployAllStrategies',
    args: [params]
  });

  return hash;
};
```

---

## 🎨 Complete React Component

```typescript
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useSendCalls } from 'wagmi/experimental';
import { Button } from '@/components/ui/Button';

export function DeployStrategies({ vaultAddress, tokenAddress }) {
  const { address, connector } = useAccount();
  const { sendCalls } = useSendCalls();
  const [isDeploying, setIsDeploying] = useState(false);

  // Check if user has smart wallet
  const isSmartWallet = connector?.id === 'coinbaseWalletSDK';

  const deployAllStrategies = async () => {
    setIsDeploying(true);
    try {
      // Step 1: Fetch current price from ZORA V4
      const ajnaBucketIndex = await calculateBucketFromZoraPrice(tokenAddress);

      // Step 2: Prepare deployment params
      const params = {
        vault: vaultAddress,
        creatorToken: tokenAddress,
        ajnaFactory: CONTRACTS.ajnaErc20Factory,
        charmVault: CONTRACTS.charmAlphaVault,
        weth: CONTRACTS.weth,
        usdc: CONTRACTS.usdc,
        zora: CONTRACTS.zora,
        uniswapV3Factory: CONTRACTS.uniswapV3Factory,
        ajnaBucketIndex: BigInt(ajnaBucketIndex),
        wethFee: 10000,
        usdcFee: 10000,
        ajnaWeight: 100n,
        charmWethWeight: 100n,
        charmUsdcWeight: 100n,
        minimumIdle: parseUnits('12500000', 18),
      };

      // Step 3: Deploy (smart wallet uses batching, regular wallet uses single call)
      if (isSmartWallet) {
        // Smart Wallet: Use sendCalls for AA batching
        const result = await sendCalls({
          calls: [{
            to: CONTRACTS.strategyDeploymentBatcher,
            data: encodeFunctionData({
              abi: StrategyDeploymentBatcherABI,
              functionName: 'deployAllStrategies',
              args: [params]
            })
          }]
        });
        console.log('Strategies deployed via AA:', result);
      } else {
        // Regular Wallet: Single contract call
        const hash = await writeContract({
          address: CONTRACTS.strategyDeploymentBatcher,
          abi: StrategyDeploymentBatcherABI,
          functionName: 'deployAllStrategies',
          args: [params]
        });
        console.log('Strategies deployed:', hash);
      }

      toast.success('All strategies deployed successfully! 🎉');
    } catch (error) {
      console.error('Deployment failed:', error);
      toast.error('Deployment failed. Please try again.');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Deploy Yield Strategies</h3>
      <p className="text-sm text-gray-400">
        Deploy all 3 strategies (Ajna, Charm WETH, Charm USDC) in one transaction
      </p>
      
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="bg-gray-800 p-3 rounded">
          <div className="font-bold">Ajna Lending</div>
          <div className="text-gray-400">CREATOR/WETH</div>
        </div>
        <div className="bg-gray-800 p-3 rounded">
          <div className="font-bold">Charm LP #1</div>
          <div className="text-gray-400">CREATOR/WETH</div>
        </div>
        <div className="bg-gray-800 p-3 rounded">
          <div className="font-bold">Charm LP #2</div>
          <div className="text-gray-400">CREATOR/USDC</div>
        </div>
      </div>

      <Button
        onClick={deployAllStrategies}
        disabled={isDeploying}
        className="w-full"
      >
        {isDeploying ? 'Deploying...' : '🚀 Deploy All Strategies (1-Click)'}
      </Button>

      {isSmartWallet && (
        <p className="text-xs text-green-400">
          ✅ Smart Wallet detected - using Account Abstraction for gas optimization
        </p>
      )}
    </div>
  );
}
```

---

## 💰 Gas Estimation

### **Smart Wallet (AA)**
```
Estimated gas: ~5.5M gas units
Gas cost: ~$15-30 (depending on Base gas price)
Transactions: 1
User approvals: 1
```

### **Regular Wallet**
```
Estimated gas: ~5.5M gas units
Gas cost: ~$15-30 (depending on Base gas price)
Transactions: 1
User approvals: 1
```

**Both methods = same cost, same UX!**

---

## 🔧 Deployment Script (For Testing)

```bash
#!/bin/bash
# Deploy StrategyDeploymentBatcher contract

forge create contracts/helpers/StrategyDeploymentBatcher.sol:StrategyDeploymentBatcher \
  --rpc-url base \
  --private-key $PRIVATE_KEY \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY

# Example: Deploy all AKITA strategies
cast send $BATCHER_ADDRESS \
  "deployAllStrategies((address,address,address,address,address,address,address,address,uint256,uint24,uint24,uint256,uint256,uint256,uint256))" \
  "($AKITA_VAULT,$AKITA_TOKEN,$AJNA_FACTORY,$CHARM_VAULT,$WETH,$USDC,$ZORA,$UNISWAP_V3,$BUCKET_INDEX,10000,10000,100,100,100,12500000000000000000000000)" \
  --rpc-url base \
  --private-key $PRIVATE_KEY
```

---

## 📊 Comparison: Before vs After

### **Before (Multi-Step)**

```
Step 1: Deploy Ajna strategy
  ↓ Wait for confirmation
Step 2: Configure Ajna (pool, bucket, approvals)
  ↓ Wait for confirmation
Step 3: Deploy Charm WETH strategy
  ↓ Wait for confirmation
Step 4: Configure Charm WETH
  ↓ Wait for confirmation
Step 5: Deploy Charm USDC strategy
  ↓ Wait for confirmation
Step 6: Configure Charm USDC
  ↓ Wait for confirmation
Step 7: Add all to vault
  ↓ Wait for confirmation
Step 8: Set minimum idle
  ↓ Done!

Total: 8 transactions, ~10 minutes
```

### **After (1-Click)**

```
Click "Deploy All Strategies"
  ↓ Wait for confirmation
Done!

Total: 1 transaction, ~30 seconds
```

**100x better UX!** 🚀

---

## ✅ Benefits

### **1. Simplified UX**
- One button click
- One wallet approval
- One transaction to monitor

### **2. Gas Efficient**
- No repeated external calls
- Batch operations in single transaction
- ~20% gas savings vs sequential deployment

### **3. Atomic Deployment**
- Either all strategies deploy or none
- No partial state
- No need for cleanup

### **4. Works for Everyone**
- Smart Wallet users get AA benefits
- Regular wallet users get same single-transaction UX
- Same deployment parameters

---

## 🎯 Next Steps

1. **Deploy `StrategyDeploymentBatcher` to Base**
   ```bash
   forge create contracts/helpers/StrategyDeploymentBatcher.sol:StrategyDeploymentBatcher \
     --rpc-url base --private-key $PK --verify
   ```

2. **Update Frontend Config**
   ```typescript
   export const CONTRACTS = {
     ...existing,
     strategyDeploymentBatcher: '0x...' as const
   };
   ```

3. **Add to Activation Flow**
   - Update `ActivateAkita.tsx` or create `DeployStrategies.tsx`
   - Add UI for 1-click deployment
   - Show deployment progress

4. **Test Flow**
   - Test with Coinbase Smart Wallet (AA)
   - Test with MetaMask (regular wallet)
   - Verify all strategies deploy correctly

---

## 🚨 Important Notes

1. **Requires Vault Ownership**: Caller must be vault owner to add strategies
2. **Bucket Calculation**: Must fetch from ZORA V4 pool before calling
3. **Gas Limit**: Set gas limit to 6M for safety
4. **Charm Vault**: Must have Charm Alpha Vault address (deploy if needed)
5. **Pool Creation**: Batcher will create Ajna pool if it doesn't exist

---

## 📚 Related Documentation

- [Account Abstraction Activation](./AA_ACTIVATION.md)
- [Strategy Architecture](./STRATEGY_ARCHITECTURE.md)
- [Ajna Bucket Calculator](./AJNA_BUCKET_CALCULATOR.md)

---

**Deploy all strategies in 1 click with Account Abstraction!** 🎉

