# Multi-Strategy Vault Allocation

## Overview

CreatorVault activation now deploys the underlying AKITA tokens into **4 equal parts (12.5M each)**:

1. **12.5M → AKITA/WETH 1% LP** (Uniswap V3 concentrated liquidity)
2. **12.5M → AKITA/USDC 1% LP** (Uniswap V3 concentrated liquidity)  
3. **12.5M → Ajna Lending** (Ajna protocol lending pool)
4. **12.5M → Idle in Vault** (For future use/flexibility)

---

## How It Works

### The Math

```
Total Deposit: 50M AKITA
Vault minimumTotalIdle: 12.5M

Deployable = 50M - 12.5M = 37.5M

Strategy Weights (equal):
- AKITA/WETH: 100
- AKITA/USDC: 100
- Ajna: 100
Total: 300

Each strategy allocation:
37.5M * (100 / 300) = 12.5M ✓
```

### The Flow (7 Steps in 1 TX)

```
User clicks "Launch Auction" → Smart Wallet executes:

1. Approve 50M AKITA to vault
2. Deposit 50M AKITA to vault
   ↓
3. Deploy to strategies:
   - forceDeployToStrategies() called
   - Vault keeps 12.5M idle (minimumTotalIdle)
   - Distributes 37.5M to 3 strategies:
     * 12.5M → AKITA/WETH strategy
     * 12.5M → AKITA/USDC strategy
     * 12.5M → Ajna strategy
   ↓
4. Approve vault shares to wrapper
5. Wrap shares → 50M wsAKITA
6. Approve 25M wsAKITA to CCA
7. Launch CCA auction (25M wsAKITA)

Result:
- 50M AKITA deployed across 4 destinations
- 25M wsAKITA in CCA auction
- 25M wsAKITA in user wallet
```

---

## Prerequisites

### 1. Deploy Strategy Contracts

#### AKITA/WETH 1% Strategy
```bash
# Deploy Uniswap V3 concentrated liquidity strategy
forge create CreatorCharmStrategy \
  --rpc-url base \
  --private-key $PRIVATE_KEY \
  --constructor-args \
    $AKITA_TOKEN \
    $WETH \
    $AKITA_VAULT \
    1 \ # 1% fee tier
    ...
```

#### AKITA/USDC 1% Strategy
```bash
# Deploy Uniswap V3 concentrated liquidity strategy
forge create CreatorCharmStrategy \
  --rpc-url base \
  --private-key $PRIVATE_KEY \
  --constructor-args \
    $AKITA_TOKEN \
    $USDC \
    $AKITA_VAULT \
    1 \ # 1% fee tier
    ...
```

#### Ajna Lending Strategy
```bash
# Deploy Ajna lending strategy (TODO: implement)
forge create AjnaLendingStrategy \
  --rpc-url base \
  --private-key $PRIVATE_KEY \
  --constructor-args \
    $AKITA_TOKEN \
    $AJNA_POOL \
    $AKITA_VAULT \
    ...
```

### 2. Configure Vault

```solidity
// Add strategies with equal weights
vault.addStrategy(akitaWethStrategy, 100); // weight = 100
vault.addStrategy(akitaUsdcStrategy, 100); // weight = 100
vault.addStrategy(ajnaStrategy, 100);      // weight = 100
// Total weight = 300

// Set minimum idle to keep 12.5M in vault
vault.setMinimumTotalIdle(12_500_000 * 10**18); // 12.5M AKITA

// Verify configuration
require(vault.totalStrategyWeight() == 300, "Wrong weights");
require(vault.minimumTotalIdle() == 12_500_000 * 10**18, "Wrong idle");
```

### 3. Update Frontend Config

```typescript
// frontend/src/config/contracts.ts
export const AKITA = {
  ...
  strategies: {
    akitaWethLP: '0x...' as const, // Deployed AKITA/WETH strategy
    akitaUsdcLP: '0x...' as const, // Deployed AKITA/USDC strategy
    ajna: '0x...' as const,         // Deployed Ajna strategy
  },
}
```

---

## Strategy Details

### 1. AKITA/WETH 1% Strategy

**Type:** Uniswap V3 Concentrated Liquidity (via Charm Finance)

**Benefits:**
- Concentrated liquidity = Higher capital efficiency
- 1% fee tier = Higher fees for volatile pairs
- Charm auto-rebalances to stay in range
- Proven, audited infrastructure

**Expected APY:** 20-40% (depends on volume)

### 2. AKITA/USDC 1% Strategy

**Type:** Uniswap V3 Concentrated Liquidity (via Charm Finance)

**Benefits:**
- Stablecoin pair = Less impermanent loss
- 1% fee tier = Good for medium volatility
- Charm auto-rebalances
- Diversified liquidity

**Expected APY:** 15-30% (depends on volume)

### 3. Ajna Lending Strategy

**Type:** Ajna Protocol Lending Pool

**Benefits:**
- No liquidations (novel design)
- Permissionless pool creation
- Flexible interest rates
- No oracles needed

**Expected APY:** 5-15% (variable interest)

**Status:** 🚧 Strategy not yet implemented

### 4. Idle in Vault (12.5M)

**Purpose:**
- Emergency reserves
- Future strategy deployment
- Immediate withdrawal liquidity
- Flexibility for adjustments

---

## Activation UI

### Updated Flow Display

```
┌─────────────────────────────────────────┐
│  🚀 Launch AKITA Auction                │
│                                         │
│  ⚡ What Happens in One Transaction:    │
│                                         │
│  1. Deposit 50M AKITA                   │
│                                         │
│  2. Deploy to Strategies:               │
│     ┌─────────────┬─────────────┐      │
│     │ 12.5M →     │ 12.5M →     │      │
│     │ AKITA/WETH  │ AKITA/USDC  │      │
│     │ 1%          │ 1%          │      │
│     ├─────────────┼─────────────┤      │
│     │ 12.5M →     │ 12.5M →     │      │
│     │ Ajna        │ Keep idle   │      │
│     │ lending     │             │      │
│     └─────────────┴─────────────┘      │
│                                         │
│  3. Wrap to wsAKITA (50M shares)        │
│                                         │
│  4. Launch CCA (25M wsAKITA auction)    │
│                                         │
│  [ ⚡ Launch Auction (1-Click) ]        │
└─────────────────────────────────────────┘
```

### Success Screen

```
✓ Auction Launched Successfully!

Auction: 25M wsAKITA (7 days)
Your Holdings: 25M wsAKITA

Vault AKITA Allocation:
- AKITA/WETH 1%: 12.5M
- AKITA/USDC 1%: 12.5M
- Ajna Lending:  12.5M
- Idle in Vault: 12.5M
```

---

## Deployment Checklist

### Phase 1: Strategy Development
- [ ] Implement AKITA/WETH 1% strategy
- [ ] Implement AKITA/USDC 1% strategy
- [ ] Implement Ajna lending strategy
- [ ] Test strategies on Base testnet
- [ ] Audit strategies (if needed)

### Phase 2: Deployment
- [ ] Deploy AKITA/WETH strategy to Base
- [ ] Deploy AKITA/USDC strategy to Base
- [ ] Deploy Ajna strategy to Base
- [ ] Verify contracts on Basescan

### Phase 3: Vault Configuration
- [ ] Add strategies to vault
- [ ] Set equal weights (100 each)
- [ ] Set minimumTotalIdle to 12.5M
- [ ] Test with small amount first

### Phase 4: Frontend Update
- [ ] Update AKITA.strategies config
- [ ] Test activation flow
- [ ] Deploy to Vercel

### Phase 5: Launch
- [ ] Announce multi-strategy approach
- [ ] Monitor first activation
- [ ] Track strategy performance
- [ ] Adjust weights if needed

---

## Strategy Management

### Rebalancing

Strategies are rebalanced automatically:
- **Charm strategies**: Keepers rebalance when price moves
- **Ajna strategy**: Interest rates adjust automatically
- **Vault**: Can manually rebalance between strategies via `updateDebtRatio()`

### Monitoring

Key metrics to track:
```
1. Strategy APY:
   - AKITA/WETH LP fees
   - AKITA/USDC LP fees
   - Ajna lending interest

2. Impermanent Loss:
   - Track AKITA price vs ETH/USDC
   - Compare to holding

3. Utilization:
   - How much of each strategy is deployed
   - Idle balance over time

4. Total Returns:
   - Combined yield from all strategies
   - Compare to alternatives
```

### Emergency Actions

If a strategy performs poorly:
```solidity
// 1. Remove strategy from queue
vault.removeStrategyFromQueue(badStrategy);

// 2. Withdraw all funds
vault.withdrawFromStrategy(badStrategy, type(uint256).max);

// 3. Add new strategy
vault.addStrategy(newStrategy, 100);

// 4. Redeploy funds
vault.forceDeployToStrategies();
```

---

## Benefits of Multi-Strategy

### Diversification
- ✅ Not dependent on single liquidity source
- ✅ Spread risk across 4 destinations
- ✅ Different yield mechanisms

### Yield Optimization
- ✅ Capture fees from 2 trading pairs
- ✅ Earn lending interest from Ajna
- ✅ Keep reserves for opportunities

### Flexibility
- ✅ 12.5M idle = Quick withdrawals
- ✅ Can adjust strategy weights
- ✅ Can add/remove strategies

### Capital Efficiency
- ✅ 75% deployed (37.5M / 50M)
- ✅ 25% idle for flexibility
- ✅ Optimal balance

---

## FAQ

### Q: Why 1% fee tier for LP?
**A:** 1% is optimal for volatile assets like creator coins. Higher fees compensate for impermanent loss.

### Q: Why keep 12.5M idle?
**A:** For immediate withdrawals, emergency reserves, and future strategy deployment flexibility.

### Q: Can we adjust the allocation later?
**A:** Yes! Vault owner can update strategy weights anytime via `updateStrategyWeight()`.

### Q: What if Ajna strategy isn't ready?
**A:** Deploy with 2 strategies temporarily. Add Ajna later and rebalance.

### Q: Who manages the strategies?
**A:** Charm strategies are managed by Charm keepers. Ajna adjusts rates automatically. Vault owner can rebalance manually.

### Q: What are the risks?
**A:**
- **Impermanent Loss**: AKITA price changes vs ETH/USDC
- **Smart Contract Risk**: Strategy contract bugs
- **Oracle Risk**: (Minimal - Charm uses TWAP, Ajna is oracle-less)

---

## Resources

- [Charm Finance Docs](https://docs.charm.fi/)
- [Ajna Protocol Docs](https://docs.ajna.finance/)
- [Uniswap V3 Concentrated Liquidity](https://docs.uniswap.org/concepts/protocol/concentrated-liquidity)
- [Yearn V3 Strategy Pattern](https://docs.yearn.fi/developers/v3/overview)

---

## Summary

✅ **4-way split**: 12.5M each to 4 destinations
✅ **Automated allocation**: One function call deploys all
✅ **Diversified yield**: LP fees + lending interest
✅ **Flexible**: 12.5M idle for adjustments
✅ **Account abstraction**: All in 1 gasless transaction

**Result: Optimal capital efficiency with diversified risk!** 🚀

