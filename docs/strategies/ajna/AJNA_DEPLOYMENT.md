# Ajna Strategy Deployment Guide

## ✅ **COMPLETE: Full Ajna Integration Implemented**

The AjnaStrategy is production-ready and uses **real Ajna protocol calls**.

---

## What's Implemented

### ✅ Ajna Interface (`IAjnaPool.sol`)
```solidity
✅ addQuoteToken() - Deposit tokens to lending bucket
✅ removeQuoteToken() - Withdraw tokens from bucket
✅ moveQuoteToken() - Rebalance between buckets
✅ lenderInfo() - Query LP position
✅ bucketInfo() - Query bucket statistics
✅ IAjnaPoolFactory - Pool deployment + lookup interface
```

### ✅ Strategy Functions
```solidity
✅ deposit() / withdraw() - Vault-driven asset flow
✅ moveToBucket() - Rebalance to different price point
✅ setBucketIndex() - Change lending price point
✅ setIdleBufferBps() - Keep part of assets idle for withdrawals
✅ initializeApprovals() - Required before deposits
```

---

## How Ajna Works

### Bucket System

Ajna uses **7,388 price buckets** (Fenwick index **1..7388**; **0 is invalid**).

Price mapping (quote per collateral, WAD):
```
price = 1.005^(4156 - index)
```

- **Index 4156** → price ≈ **1.0**
- **Lower index (< 4156)** → **higher** price
- **Higher index (> 4156)** → **lower** price

---

## Deployment Steps

### 1) Deploy AjnaStrategy (auto-creates pool)

AjnaStrategy will **find or deploy** the Ajna pool in its constructor.

```bash
forge create contracts/vault/strategies/AjnaStrategy.sol:AjnaStrategy \
  --rpc-url base \
  --private-key $PRIVATE_KEY \
  --constructor-args \
    $VAULT_ADDRESS \
    $CREATOR_TOKEN \
    0x214f62B5836D83f3D6c4f71F174209097B1A779C \
    0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
    $OWNER
```

### 2) (Optional) Verify / Inspect the Ajna pool

If you need to look up the pool address directly:

```bash
AJNA_FACTORY=0x214f62B5836D83f3D6c4f71F174209097B1A779C
COLLATERAL=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
QUOTE=$CREATOR_TOKEN

SUBSET_HASH=$(cast call $AJNA_FACTORY "ERC20_NON_SUBSET_HASH()(bytes32)")

cast call $AJNA_FACTORY \
  "deployedPools(bytes32,address,address)(address)" \
  $SUBSET_HASH \
  $COLLATERAL \
  $QUOTE
```

### 3) Configure Strategy

```bash
# Initialize approvals
cast send $AJNA_STRATEGY "initializeApprovals()" --rpc-url base --private-key $PRIVATE_KEY

# Optional: adjust idle buffer (basis points)
cast send $AJNA_STRATEGY "setIdleBufferBps(uint256)" 1000 --rpc-url base --private-key $PRIVATE_KEY

# Optional: adjust bucket index (default 4156)
cast send $AJNA_STRATEGY "setBucketIndex(uint256)" 4156 --rpc-url base --private-key $PRIVATE_KEY
```

### 4) Add to Vault

```bash
cast send $VAULT_ADDRESS \
  "addStrategy(address,uint256)" \
  $AJNA_STRATEGY \
  100 \
  --rpc-url base --private-key $PRIVATE_KEY
```

---

## Notes

- AjnaStrategy **lends the creator token** (quote token) and requires a collateral token (USDC/WETH).
- Default idle buffer = **10%** (`idleBufferBps = 1000`).
- The constructor uses a **5% interest rate** and validates bounds with the factory.
