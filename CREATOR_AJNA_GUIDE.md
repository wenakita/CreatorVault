# Creator Ajna Strategy Deployment Guide

## Overview

Any creator coin can deploy an Ajna lending strategy to earn yield on their token reserves. This guide covers both **manual** and **programmatic** deployment methods.

---

## ✅ Prerequisites

### For Creators:

1. **Deployed Creator Vault** on Base
2. **Creator Token** contract address
3. **(Optional) Uniswap V4 Pool** with price data
4. **ZORA** as quote token (standard for all creator coins)

### For Protocol:

- Ajna ERC20 Factory: `0x214f62B5836D83f3D6c4f71F174209097B1A779C`
- Uniswap V4 PoolManager: `0x498581fF718922c3f8e6A244956aF099B2652b2b`
- ZORA Token: `0x4200000000000000000000000000000000000777`

---

## 🚀 Quick Deployment (Any Creator Coin)

### Method 1: Automated Script

```bash
# Export your private key
export PRIVATE_KEY=your_private_key

# Run deployment script
./DEPLOY_CREATOR_AJNA.sh <TOKEN_ADDRESS> <VAULT_ADDRESS>

# Example for AKITA:
./DEPLOY_CREATOR_AJNA.sh \
  0x5b674196812451b7cec024fe9d22d2c0b172fa75 \
  0xA015954E2606d08967Aee3787456bB3A86a46A42
```

**What it does:**
1. ✅ Fetches token name & symbol
2. ✅ Queries token for V4 pool configuration (if available)
3. ✅ Calculates optimal Ajna bucket from market price
4. ✅ Checks for existing Ajna pool or deploys new one
5. ✅ Deploys AjnaStrategy contract
6. ✅ Configures pool address and bucket index
7. ✅ Adds strategy to vault

---

## 📊 Automatic Price Discovery

### If Token Has `getPoolKey()`

The script automatically queries the token contract:

```solidity
// Token must implement:
function getPoolKey() external view returns (
    address currency0,
    address currency1,
    uint24 fee,
    int24 tickSpacing,
    address hooks
);
```

**Example: AKITA**
```bash
# Returns:
currency0:    0x1111111111166b7FE7bd91427724B487980aFc69
currency1:    0x5b674196812451B7cEC024FE9d22D2c0b172fa75  # AKITA
fee:          30000  # 3%
tickSpacing:  200
hooks:        0xd61A675F8a0c67A73DC3B54FB7318B4D91409040
```

### If Token Doesn't Have `getPoolKey()`

The script uses default bucket **3696** (middle/balanced).

You can adjust later:
```bash
cast send $STRATEGY_ADDRESS \
  "setBucketIndex(uint256)" \
  3500 \
  --rpc-url base --private-key $PK
```

---

## 🎯 Bucket Selection Logic

The script calculates the optimal bucket based on current market price:

```bash
# 1. Get current tick from Uniswap V4
TICK=$(cast call $POOL_MANAGER "getSlot0(bytes32)" $POOL_ID | awk '{print $2}')

# 2. Invert if token is currency1
if [[ "$CURRENCY1" == "$TOKEN" ]]; then
  TICK=$((-1 * TICK))
fi

# 3. Calculate Ajna bucket
BUCKET=$((3696 + ($TICK / 100)))

# 4. Clamp to valid range (0-7387)
if [ $BUCKET -lt 0 ]; then BUCKET=0; fi
if [ $BUCKET -gt 7387 ]; then BUCKET=7387; fi
```

**Result**: Lending price aligns with current market conditions for optimal capital efficiency.

---

## 📝 Manual Deployment (Step-by-Step)

### Step 1: Check for Ajna Pool

```bash
TOKEN="0x..."
ZORA="0x4200000000000000000000000000000000000777"  # All creator coins paired to ZORA
AJNA_FACTORY="0x214f62B5836D83f3D6c4f71F174209097B1A779C"

# Check if pool exists
cast call $AJNA_FACTORY \
  "deployedPools(bytes32,address)(address)" \
  $(cast keccak $(cast abi-encode "f(address,address,uint256)" $TOKEN $ZORA 50000000000000000)) \
  $AJNA_FACTORY
```

### Step 2: Deploy Pool (if needed)

```bash
cast send $AJNA_FACTORY \
  "deployPool(address,address,uint256)(address)" \
  $TOKEN \
  $ZORA \
  50000000000000000 \  # 5% interest rate
  --rpc-url base --private-key $PK
```

### Step 3: Deploy AjnaStrategy

```bash
forge create contracts/strategies/AjnaStrategy.sol:AjnaStrategy \
  --rpc-url base \
  --private-key $PK \
  --constructor-args \
    $VAULT_ADDRESS \
    $TOKEN_ADDRESS \
    $AJNA_FACTORY \
    $ZORA \
    $YOUR_ADDRESS
```

### Step 4: Configure Strategy

```bash
STRATEGY="0x..."
POOL="0x..."

# Set pool
cast send $STRATEGY "setAjnaPool(address)" $POOL \
  --rpc-url base --private-key $PK

# Set bucket (optional, default is 3696)
cast send $STRATEGY "setBucketIndex(uint256)" 3500 \
  --rpc-url base --private-key $PK

# Initialize approvals
cast send $STRATEGY "initializeApprovals()" \
  --rpc-url base --private-key $PK
```

### Step 5: Add to Vault

```bash
cast send $VAULT_ADDRESS \
  "addStrategy(address,uint256)" \
  $STRATEGY \
  100 \  # Weight (relative to other strategies)
  --rpc-url base --private-key $PK
```

---

## 🔧 Advanced: Programmatic Deployment

### Via Registry Pattern

If you want fully automated deployment for multiple creators:

```solidity
// In CreatorRegistry or factory contract:
mapping(address => AjnaStrategyConfig) public ajnaConfigs;

struct AjnaStrategyConfig {
    address strategy;
    address ajnaPool;
    uint256 bucketIndex;
    bool isDeployed;
}

function deployAjnaStrategy(
    address creatorToken,
    address vault,
    uint256 bucketIndex
) external returns (address strategy) {
    // Deploy strategy
    strategy = new AjnaStrategy(
        vault,
        creatorToken,
        AJNA_FACTORY,
        ZORA,  // All creator coins paired to ZORA
        msg.sender
    );
    
    // Find or deploy Ajna pool
    address pool = _getOrDeployAjnaPool(creatorToken, ZORA);
    
    // Configure
    AjnaStrategy(strategy).setAjnaPool(pool);
    AjnaStrategy(strategy).setBucketIndex(bucketIndex);
    AjnaStrategy(strategy).initializeApprovals();
    
    // Store config
    ajnaConfigs[creatorToken] = AjnaStrategyConfig({
        strategy: strategy,
        ajnaPool: pool,
        bucketIndex: bucketIndex,
        isDeployed: true
    });
    
    // Add to vault
    IVault(vault).addStrategy(strategy, 100);
    
    return strategy;
}
```

---

## 📊 Token Requirements

### Required (Minimal):

```solidity
interface IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}
```

### Optional (Recommended):

```solidity
// For automatic price discovery
function getPoolKey() external view returns (
    address currency0,
    address currency1,
    uint24 fee,
    int24 tickSpacing,
    address hooks
);

// For pool configuration
function getPoolConfiguration() external view returns (
    PoolConfiguration memory
);
```

---

## 🎨 Creator Coin Integration Patterns

### Pattern 1: Token with Built-in Pool Key (AKITA Style)

```solidity
contract CreatorToken is ERC20 {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }
    
    PoolKey public poolKey;
    
    function getPoolKey() external view returns (
        address, address, uint24, int24, address
    ) {
        return (
            poolKey.currency0,
            poolKey.currency1,
            poolKey.fee,
            poolKey.tickSpacing,
            poolKey.hooks
        );
    }
}
```

**Benefits:**
- ✅ Automatic price discovery
- ✅ No manual configuration needed
- ✅ Correct fee tier and tick spacing
- ✅ Handles custom hooks

### Pattern 2: Registry-based Configuration

```solidity
// In CreatorRegistry
mapping(address => PoolKey) public poolKeys;

function setPoolKey(
    address token,
    address currency0,
    address currency1,
    uint24 fee,
    int24 tickSpacing,
    address hooks
) external onlyOwner {
    poolKeys[token] = PoolKey(...);
}
```

**Benefits:**
- ✅ Centralized configuration
- ✅ Works for any token
- ✅ Can be updated by governance

### Pattern 3: Manual Configuration (Fallback)

```bash
# Creator provides pool details manually
./DEPLOY_CREATOR_AJNA.sh $TOKEN $VAULT
# Then manually set bucket if needed
```

---

## 🔄 Multi-Strategy Allocation

For diversified yield:

```bash
# Deploy multiple strategies
./DEPLOY_CREATOR_AJNA.sh $TOKEN $VAULT  # Ajna lending

# Deploy LP strategies
# ... AKITA/ZORA LP (Charm)
# ... Other strategies as needed

# Set weights
cast send $VAULT "addStrategy(address,uint256)" $AJNA_STRATEGY 100
cast send $VAULT "addStrategy(address,uint256)" $LP_STRATEGY_1 100
cast send $VAULT "addStrategy(address,uint256)" $LP_STRATEGY_2 100

# Set minimum idle (e.g., 25% stays idle)
cast send $VAULT "setMinimumTotalIdle(uint256)" 25000000000000000000000000
```

**Result:**
- 25% idle
- 25% Ajna lending (ZORA pair)
- 25% ZORA LP
- 25% Other strategies

---

## 📈 Monitoring & Management

### Check Strategy Status

```bash
# Total assets deployed
cast call $STRATEGY "getTotalAssets()(uint256)"

# Pending yield
cast call $STRATEGY "pendingYield()(uint256)"

# Current bucket
cast call $STRATEGY "bucketIndex()(uint256)"

# Is active
cast call $STRATEGY "isActive()(bool)"
```

### Adjust Bucket

```bash
# Move to new bucket based on market conditions
cast send $STRATEGY \
  "moveToBucket(uint256,uint256)" \
  3800 \  # New bucket
  0 \     # 0 = move all
  --rpc-url base --private-key $PK
```

### Emergency Procedures

```bash
# Pause strategy
cast send $STRATEGY "setActive(bool)" false --rpc-url base --private-key $PK

# Emergency withdraw
cast send $STRATEGY "emergencyWithdraw()" --from $VAULT --rpc-url base --private-key $PK

# Remove from vault
cast send $VAULT "removeStrategy(address)" $STRATEGY --rpc-url base --private-key $PK
```

---

## 🚀 Deployment Checklist

### For Each Creator Coin:

- [ ] Creator vault deployed
- [ ] Token contract address confirmed
- [ ] Private key exported
- [ ] Run `./DEPLOY_CREATOR_AJNA.sh <TOKEN> <VAULT>`
- [ ] Verify strategy address
- [ ] Update frontend config
- [ ] Test deposit/withdrawal
- [ ] Monitor yield accrual

### Optional Enhancements:

- [ ] Deploy multiple strategies (Ajna + LPs)
- [ ] Set minimum idle amount
- [ ] Configure strategy weights
- [ ] Set up monitoring/alerts
- [ ] Document in creator dashboard

---

## 💡 Tips & Best Practices

### 1. Bucket Selection

```
Conservative:  bucket = market_price - 500  (safer, lower yield)
Balanced:      bucket = market_price        (recommended)
Aggressive:    bucket = market_price + 500  (higher yield, more risk)
```

### 2. Quote Token (Standard: ZORA)

```
ZORA:  Standard for all creator coins in CreatorVault ecosystem
       - Unified liquidity across all creators
       - Simplified price discovery
       - Consistent valuation base
```

**Note**: All creator coins use ZORA as the quote token for Ajna lending pools.

### 3. Pool Interest Rates

```
5%:   Conservative (default)
10%:  Moderate
15%:  Aggressive
```

### 4. Strategy Weights

```
Equal weights (100 each):  Balanced diversification
Higher Ajna (200):         More conservative
Higher LP (200):           More aggressive
```

---

## 📚 Resources

- [Ajna Protocol Documentation](https://docs.ajna.finance/)
- [Deployment Addresses (Base)](https://faqs.ajna.finance/info/deployment-addresses-and-bridges)
- [Bucket Selection Guide](https://faqs.ajna.finance/concepts/choosing-a-price-bucket)
- [Inverse Pricing](https://faqs.ajna.finance/concepts/inverse-pricing)

---

## 🎯 Summary

✅ **Automated Deployment**: One command for any creator coin
✅ **Price Discovery**: Automatic bucket calculation from V4 pools
✅ **Flexible**: Works with or without token pool data
✅ **Scalable**: Same script for all creators
✅ **Safe**: Default fallbacks for missing data
✅ **Monitored**: Easy to track and manage

**Deploy Ajna strategies for any creator coin in minutes!** 🚀

