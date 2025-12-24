# Ajna Bucket Index Calculator

## Understanding Ajna Buckets

Ajna uses a **bucket-based lending system** with **7,388 price buckets** (indexed 0-7387).

Each bucket represents a different price point at which you're willing to lend. The bucket index determines:
- **Lower buckets (0-2000)**: Lend at lower prices (safer, lower yield)
- **Middle buckets (3000-4000)**: Balanced risk/reward
- **Higher buckets (5000-7387)**: Lend at higher prices (riskier, higher yield)

**Default**: Bucket **3696** is the middle bucket (~1:1 price ratio)

---

## Why Market Price Matters

If you set your bucket too far from the current market price:
- **Too low**: Your funds won't be utilized (no borrowers at that price)
- **Too high**: Higher yield potential, but riskier if price drops

**Optimal**: Set bucket **near current market price** for best capital efficiency.

---

## How to Calculate the Right Bucket

### From Token Contract (Easiest - Recommended for AKITA)

Many tokens store their Uniswap V4 pool configuration directly in the contract:

```bash
# Query token contract for pool key
TOKEN="0x5b674196812451b7cec024fe9d22d2c0b172fa75"  # AKITA
POOL_KEY_RESULT=$(cast call $TOKEN \
  "getPoolKey()(address,address,uint24,int24,address)")

# Parse the result
CURRENCY0=$(echo $POOL_KEY_RESULT | awk '{print $1}')
CURRENCY1=$(echo $POOL_KEY_RESULT | awk '{print $2}')
FEE=$(echo $POOL_KEY_RESULT | awk '{print $3}')
TICK_SPACING=$(echo $POOL_KEY_RESULT | awk '{print $4}')
HOOKS=$(echo $POOL_KEY_RESULT | awk '{print $5}')

# Calculate PoolId
POOL_KEY=$(cast abi-encode "f(address,address,uint24,int24,address)" \
  $CURRENCY0 $CURRENCY1 $FEE $TICK_SPACING $HOOKS)
POOL_ID=$(cast keccak $POOL_KEY)

# Get current tick from PoolManager
POOL_MANAGER="0x498581fF718922c3f8e6A244956aF099B2652b2b"
SLOT0=$(cast call $POOL_MANAGER "getSlot0(bytes32)(uint160,int24,uint24,uint24)" $POOL_ID)
TICK=$(echo $SLOT0 | awk '{print $2}')

# Invert if needed (if token is currency1)
if [[ "$CURRENCY1" == "$TOKEN" ]]; then
  TICK=$((-1 * TICK))
fi

# Calculate Ajna bucket
BUCKET=$((3696 + ($TICK / 100)))

# Clamp to valid range
if [ $BUCKET -lt 0 ]; then BUCKET=0; fi
if [ $BUCKET -gt 7387 ]; then BUCKET=7387; fi

echo "Suggested bucket: $BUCKET"
```

### From Uniswap V4 Pool (Manual Method)

If the token doesn't have `getPoolKey()`, you need to manually construct it:

```bash
# 1. Sort tokens (currency0 < currency1)
if [[ "$TOKEN0" < "$TOKEN1" ]]; then
  CURRENCY0=$TOKEN0
  CURRENCY1=$TOKEN1
else
  CURRENCY0=$TOKEN1
  CURRENCY1=$TOKEN0
fi

# 2. Build PoolKey (currency0, currency1, fee, tickSpacing, hooks)
FEE=30000  # 3% (common for ZORA pools)
TICK_SPACING=200
HOOKS="0x0000000000000000000000000000000000000000"

# 3. Calculate PoolId
POOL_KEY=$(cast abi-encode "f(address,address,uint24,int24,address)" \
  $CURRENCY0 $CURRENCY1 $FEE $TICK_SPACING $HOOKS)
POOL_ID=$(cast keccak $POOL_KEY)

# 4. Get current tick from PoolManager
POOL_MANAGER="0x498581fF718922c3f8e6A244956aF099B2652b2b"
SLOT0=$(cast call $POOL_MANAGER "getSlot0(bytes32)(uint160,int24,uint24,uint24)" $POOL_ID)
TICK=$(echo $SLOT0 | awk '{print $2}')

# 5. Calculate Ajna bucket
BUCKET=$((3696 + ($TICK / 100)))

# 6. Clamp to valid range
if [ $BUCKET -lt 0 ]; then BUCKET=0; fi
if [ $BUCKET -gt 7387 ]; then BUCKET=7387; fi

echo "Suggested bucket: $BUCKET"
```

### Example: AKITA Token (from Contract)

```bash
# AKITA token has getPoolKey() built-in!
AKITA="0x5b674196812451b7cec024fe9d22d2c0b172fa75"

# Query pool key directly
POOL_KEY_RESULT=$(cast call $AKITA \
  "getPoolKey()(address,address,uint24,int24,address)")

# Returns (actual values from AKITA contract):
# currency0:    0x1111111111166b7FE7bd91427724B487980aFc69
# currency1:    0x5b674196812451B7cEC024FE9d22D2c0b172fa75 (AKITA)
# fee:          30000 (3%)
# tickSpacing:  200
# hooks:        0xd61A675F8a0c67A73DC3B54FB7318B4D91409040

# Calculate PoolId
CURRENCY0="0x1111111111166b7FE7bd91427724B487980aFc69"
CURRENCY1="0x5b674196812451B7cEC024FE9d22D2c0b172fa75"
FEE=30000
TICK_SPACING=200
HOOKS="0xd61A675F8a0c67A73DC3B54FB7318B4D91409040"

POOL_KEY=$(cast abi-encode "f(address,address,uint24,int24,address)" \
  $CURRENCY0 $CURRENCY1 $FEE $TICK_SPACING $HOOKS)
POOL_ID=$(cast keccak $POOL_KEY)

# Get current tick
POOL_MANAGER="0x498581fF718922c3f8e6A244956aF099B2652b2b"
SLOT0=$(cast call $POOL_MANAGER "getSlot0(bytes32)(uint160,int24,uint24,uint24)" $POOL_ID)
TICK=$(echo $SLOT0 | awk '{print $2}')

# AKITA is currency1, so invert tick
TICK=$((-1 * TICK))

# Calculate bucket
# If tick = -50000: bucket = 3696 + (-500) = 3196
BUCKET=$((3696 + ($TICK / 100)))
```

### From Uniswap V3 Pool (Alternative)

For V3 pools:

```bash
# Get pool from factory
POOL=$(cast call $UNISWAP_V3_FACTORY \
  "getPool(address,address,uint24)" \
  $TOKEN0 $TOKEN1 3000)

# Get tick from slot0
SLOT0=$(cast call $POOL "slot0()(uint160,int24,...)")
TICK=$(echo $SLOT0 | cut -d',' -f2)

# Calculate bucket
BUCKET=$((3696 + ($TICK / 100)))
```

---

## Ajna Price Formula

Ajna uses **inverse pricing**:

```
price = 1.005^(bucket_index - 3696)
```

Where:
- `bucket_index = 3696` → price = 1.0 (1:1 ratio)
- `bucket_index = 4000` → price ≈ 1.35
- `bucket_index = 3000` → price ≈ 0.30

### Examples

```
Bucket 0    → price = 1.005^(-3696) ≈ 0 (almost free)
Bucket 3696 → price = 1.005^0 = 1 (1:1 ratio)
Bucket 7387 → price = 1.005^3691 ≈ ∞ (very expensive)
```

---

## Uniswap V3/V4 Tick to Price

Both Uniswap V3 and V4 use the same price formula:

```
price = 1.0001^tick
```

**Key Differences:**
- **V3**: Pools are separate contracts with `slot0()` function
- **V4**: Pools are managed by PoolManager with `getSlot0(poolId)` function
- **V4**: Requires calculating PoolId from PoolKey (currency0, currency1, fee, tickSpacing, hooks)

### Converting Tick to Bucket (Approximation)

Since Ajna uses `1.005` and Uniswap uses `1.0001`:

```python
# Rough approximation (used in deployment script)
bucket_offset = tick / 100
bucket = 3696 + bucket_offset

# More accurate conversion (if needed)
import math
uniswap_price = 1.0001 ** tick
ajna_bucket = math.log(uniswap_price) / math.log(1.005) + 3696
```

### Uniswap V4 PoolId Calculation

```solidity
// PoolKey struct
struct PoolKey {
    Currency currency0;  // Lower address token
    Currency currency1;  // Higher address token
    uint24 fee;          // Fee tier (3000 = 0.3%)
    int24 tickSpacing;   // Tick spacing (60 for 0.3%, 200 for 1%)
    IHooks hooks;        // Hook contract (0x0 for no hooks)
}

// PoolId = keccak256(abi.encode(poolKey))
bytes32 poolId = keccak256(abi.encode(poolKey));
```

### Common V4 Fee Tiers

```
Fee: 30000 (3.0%) → tickSpacing: 200  ← AKITA/ZORA uses 3% with tickSpacing 200!
Fee: 10000 (1.0%) → tickSpacing: 200
Fee:  3000 (0.3%) → tickSpacing: 60
Fee:   500 (0.05%)→ tickSpacing: 10
```

**Note**: The AKITA token's V4 pool uses the **3% fee tier with tickSpacing 200** (confirmed from contract).

**Important**: Some tokens may use custom tick spacings. Always check the token contract's `getPoolKey()` function if available!

---

## Deployment Script Integration

The `DEPLOY_AKITA_AJNA.sh` script automatically:

1. ✅ Finds AKITA/ZORA pool
2. ✅ Reads current tick
3. ✅ Calculates suggested bucket
4. ✅ Prompts for confirmation
5. ✅ Sets bucket after deployment

### Manual Override

If you want to manually set the bucket:

```bash
# After deployment
cast send $STRATEGY_ADDRESS \
  "setBucketIndex(uint256)" \
  3500 \
  --rpc-url base \
  --private-key $PRIVATE_KEY
```

---

## Bucket Selection Strategies

### Conservative (Lower Risk, Lower Yield)
```
Current market price: 1 AKITA = 0.001 WETH
Set bucket: 3696 - 500 = 3196
→ Willing to lend at 30% lower price
→ Safer, but lower utilization
```

### Balanced (Recommended)
```
Current market price: 1 AKITA = 0.001 WETH
Set bucket: 3696 (close to current price)
→ Good capital efficiency
→ Moderate risk/reward
```

### Aggressive (Higher Risk, Higher Yield)
```
Current market price: 1 AKITA = 0.001 WETH
Set bucket: 3696 + 500 = 4196
→ Willing to lend at 35% higher price
→ Higher yield potential
→ Higher liquidation risk if price drops
```

---

## Rebalancing

If market conditions change, you can move to a different bucket:

```bash
# Move all funds to new bucket
cast send $STRATEGY_ADDRESS \
  "moveToBucket(uint256,uint256)" \
  3800 \    # New bucket
  0 \       # 0 = move all LP
  --rpc-url base \
  --private-key $PRIVATE_KEY
```

---

## Monitoring

### Check Current Bucket
```bash
cast call $STRATEGY_ADDRESS "bucketIndex()(uint256)"
```

### Check LP Balance
```bash
cast call $STRATEGY_ADDRESS "totalAjnaLP()(uint256)"
```

### Check Total Assets (Including Interest)
```bash
cast call $STRATEGY_ADDRESS "getTotalAssets()(uint256)"
```

### Check Pool Stats
```bash
# Pool utilization
cast call $AJNA_POOL "poolUtilization()(uint256)"

# Interest rate
cast call $AJNA_POOL "interestRate()(uint256)"

# Your position in specific bucket
cast call $AJNA_POOL \
  "lenderInfo(uint256,address)(uint256,uint256)" \
  3696 \
  $STRATEGY_ADDRESS
```

---

## Resources

- [Ajna Price Buckets Explained](https://faqs.ajna.finance/concepts/choosing-a-price-bucket)
- [Ajna Inverse Pricing](https://faqs.ajna.finance/concepts/inverse-pricing)
- [Uniswap V4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [Uniswap V3 Price Formula](https://docs.uniswap.org/concepts/protocol/concentrated-liquidity)

---

## Quick Reference

### Uniswap V4 (AKITA/ZORA)

```bash
# Sort tokens
if [[ "$AKITA" < "$ZORA" ]]; then C0=$AKITA; C1=$ZORA; else C0=$ZORA; C1=$AKITA; fi

# Calculate PoolId (0.3% fee, tickSpacing 60)
POOL_KEY=$(cast abi-encode "f(address,address,uint24,int24,address)" $C0 $C1 3000 60 0x0)
POOL_ID=$(cast keccak $POOL_KEY)

# Get tick from PoolManager
POOL_MANAGER="0x498581fF718922c3f8e6A244956aF099B2652b2b"
SLOT0=$(cast call $POOL_MANAGER "getSlot0(bytes32)(uint160,int24,uint24,uint24)" $POOL_ID)
TICK=$(echo $SLOT0 | awk '{print $2}')

# Invert if needed
if [[ "$C0" == "$ZORA" ]]; then TICK=$((-1 * TICK)); fi

# Calculate bucket
BUCKET=$((3696 + ($TICK / 100)))

# Clamp to range
if [ $BUCKET -lt 0 ]; then BUCKET=0; fi
if [ $BUCKET -gt 7387 ]; then BUCKET=7387; fi

echo "Suggested bucket: $BUCKET"
```

### Uniswap V3 (Alternative)

```bash
# Get pool from factory
POOL=$(cast call $FACTORY "getPool(address,address,uint24)" $TOKEN0 $TOKEN1 3000)

# Get tick from slot0
TICK=$(cast call $POOL "slot0()(uint160,int24,...)" | cut -d',' -f2)

# Calculate bucket
BUCKET=$((3696 + ($TICK / 100)))

# Clamp to range
if [ $BUCKET -lt 0 ]; then BUCKET=0; fi
if [ $BUCKET -gt 7387 ]; then BUCKET=7387; fi
```

---

## Summary

✅ **Use current market price** to calculate optimal bucket
✅ **Start conservative** (near middle bucket 3696)
✅ **Monitor utilization** and adjust if needed
✅ **Rebalance** when market moves significantly
✅ **Higher bucket** = higher yield potential, higher risk

For AKITA, the deployment script automatically handles this! 🚀

