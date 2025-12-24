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

### From Uniswap V3 Pool (Recommended)

If there's an existing Uniswap V3 pool for your token pair, use its current tick:

```bash
# 1. Get the pool address
POOL=$(cast call $UNISWAP_V3_FACTORY \
  "getPool(address,address,uint24)" \
  $TOKEN0 \
  $TOKEN1 \
  3000)  # Fee tier (3000 = 0.3%)

# 2. Get current tick from slot0
SLOT0=$(cast call $POOL "slot0()(uint160,int24,uint16,uint16,uint16,uint8,bool)")
TICK=$(echo $SLOT0 | cut -d',' -f2)

# 3. Calculate Ajna bucket (approximation)
BUCKET_OFFSET=$(($TICK / 100))
BUCKET=$((3696 + $BUCKET_OFFSET))

# 4. Clamp to valid range
if [ $BUCKET -lt 0 ]; then BUCKET=0; fi
if [ $BUCKET -gt 7387 ]; then BUCKET=7387; fi

echo "Suggested bucket: $BUCKET"
```

### Example: AKITA/ZORA

```bash
# AKITA/ZORA pool on Base
AKITA="0x5b674196812451b7cec024fe9d22d2c0b172fa75"
ZORA="0x4200000000000000000000000000000000000777"
FACTORY="0x33128a8fC17869897dcE68Ed026d694621f6FDfD"

# Get pool
POOL=$(cast call $FACTORY "getPool(address,address,uint24)" $AKITA $ZORA 3000)

# Get tick
SLOT0=$(cast call $POOL "slot0()(uint160,int24,uint16,uint16,uint16,uint8,bool)")
TICK=$(echo $SLOT0 | cut -d',' -f2)

# Current tick: e.g., -50000
# Bucket offset: -50000 / 100 = -500
# Suggested bucket: 3696 + (-500) = 3196
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

## Uniswap V3 Tick to Price

For Uniswap V3, the price formula is:

```
price = 1.0001^tick
```

### Converting Tick to Bucket (Approximation)

Since Ajna uses `1.005` and Uniswap uses `1.0001`:

```python
# Rough approximation
bucket_offset = tick / 100
bucket = 3696 + bucket_offset

# More accurate conversion (if needed)
import math
uniswap_price = 1.0001 ** tick
ajna_bucket = math.log(uniswap_price) / math.log(1.005) + 3696
```

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
- [Uniswap V3 Price Formula](https://docs.uniswap.org/concepts/protocol/concentrated-liquidity)

---

## Quick Reference

```bash
# Get current market price from Uniswap pool
TICK=$(cast call $POOL "slot0()(uint160,int24,...)" | cut -d',' -f2)

# Calculate bucket
BUCKET=$((3696 + ($TICK / 100)))

# Clamp to range
if [ $BUCKET -lt 0 ]; then BUCKET=0; fi
if [ $BUCKET -gt 7387 ]; then BUCKET=7387; fi

# Deploy with this bucket in mind
# (Set after deployment via setBucketIndex)
```

---

## Summary

✅ **Use current market price** to calculate optimal bucket
✅ **Start conservative** (near middle bucket 3696)
✅ **Monitor utilization** and adjust if needed
✅ **Rebalance** when market moves significantly
✅ **Higher bucket** = higher yield potential, higher risk

For AKITA, the deployment script automatically handles this! 🚀

