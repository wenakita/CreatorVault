# Creator Ajna Strategy Deployment Guide

## Overview

AjnaStrategy lets a CreatorVault lend the **creator coin** as the Ajna **quote token**. Borrowers post collateral (typically **USDC** or **WETH**) and borrow the creator token, generating interest for the vault.

AjnaStrategy is production-ready and **auto-creates the Ajna pool** in its constructor if one does not exist.

---

## ✅ Prerequisites

### For Creators
1. **Deployed Creator Vault** on Base
2. **Creator Token** contract address
3. **Collateral token** (default is USDC)

### For Protocol (Base defaults)
- Ajna ERC20 Factory: `0x214f62B5836D83f3D6c4f71F174209097B1A779C`
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- WETH: `0x4200000000000000000000000000000000000006`

---

## 🚀 Recommended: StrategyDeploymentBatcher

The frontend `/status` flow calls `StrategyDeploymentBatcher.batchDeployStrategies(...)` and deploys AjnaStrategy with the correct constructor args.

**Batcher call signature:**
```solidity
batchDeployStrategies(
    address underlyingToken, // creator token
    address quoteToken,      // collateral token (default USDC)
    address creatorVault,
    address ajnaFactory,
    uint24 v3FeeTier,
    uint160 initialSqrtPriceX96,
    address owner,
    string vaultName,
    string vaultSymbol
)
```

The batcher deploys:
- CharmAlphaVault + CreatorCharmStrategy (Uniswap V3)
- AjnaStrategy (if `ajnaFactory != address(0)`)

---

## 🛠️ Manual Deployment (Advanced)

### 1) Deploy AjnaStrategy
```bash
forge create contracts/vault/strategies/AjnaStrategy.sol:AjnaStrategy \
  --rpc-url base \
  --private-key $PK \
  --constructor-args \
    $VAULT_ADDRESS \
    $CREATOR_TOKEN \
    0x214f62B5836D83f3D6c4f71F174209097B1A779C \
    0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
    $OWNER
```

> The constructor automatically finds or deploys the Ajna pool with the default 5% rate.

### 2) Configure Strategy (Optional)
```bash
# Initialize approvals (required before deposits)
cast send $STRATEGY "initializeApprovals()" --rpc-url base --private-key $PK

# Adjust bucket index (default = 4156)
cast send $STRATEGY "setBucketIndex(uint256)" 4156 --rpc-url base --private-key $PK

# Move existing liquidity to a new bucket
cast send $STRATEGY "moveToBucket(uint256,uint256)" 3500 0 --rpc-url base --private-key $PK

# Set idle buffer (basis points; default 1000 = 10%)
cast send $STRATEGY "setIdleBufferBps(uint256)" 1000 --rpc-url base --private-key $PK
```

### 3) Add to Vault
```bash
cast send $VAULT "addStrategy(address,uint256)" $STRATEGY 100 --rpc-url base --private-key $PK
```

---

## ⚙️ Configuration Fields (AjnaStrategy)

| Field | Purpose | Default |
|---|---|---|
| `bucketIndex` | Ajna price bucket for lending | `4156` (price ≈ 1.0) |
| `idleBufferBps` | % idle balance kept in strategy | `1000` (10%) |
| `interestRateWad` | Pool rate used on create | `5e16` (5%) |

Owner-only configuration functions:
- `setBucketIndex(uint256)`
- `moveToBucket(uint256 newIndex, uint256 lpAmount)`
- `setIdleBufferBps(uint256)`
- `initializeApprovals()`
- `setAjnaPool(address)` (only if you want to override the auto-created pool)

---

## 📌 Notes

- Ajna uses **7,388 buckets** (1..7388). Bucket **0 is invalid**.
- Lower index → higher price; higher index → lower price.
- Price mapping: `price = 1.005^(4156 - index)` (quote per collateral, WAD).
