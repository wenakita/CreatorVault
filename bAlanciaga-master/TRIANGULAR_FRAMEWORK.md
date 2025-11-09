# Triangular Framework - EAGLE + Volatile Token Pairs

## Overview

**Separate from EagleOVault** - This is a standalone product for single-sided liquidity provision specifically for **EAGLE paired with volatile tokens** (ETH, WBTC, etc.).

## Key Distinction

### EagleOVault (Existing)
- WLFI/USD1 pairs
- Stable asset strategies
- ERC-4626 vault standard
- Conservative approach

### Triangular Framework (NEW)
- **EAGLE + Volatile tokens** (ETH, WBTC, etc.)
- Based on Cookie/ETH case study
- Single-sided entry with EAGLE or the volatile token
- Aggressive yield optimization
- Impermanent loss hedging

## Architecture

```
User deposits ONLY Eagle (or ETH)
         ↓
Triangular Router (NEW CONTRACT)
         ↓
    ┌────┴────┬────────┐
    ↓         ↓        ↓
V3 Pool   V2 Pool   Hedge
EAGLE/ETH EAGLE/ETH Position
(Main LP) (Backup)  (IL Protection)
```

## The Triangular Path

### For EAGLE/ETH Pair:

1. **User Deposits**: 1 ETH (single-sided)

2. **Triangular Router Splits**:
   ```
   Path A: 40% → Uniswap V3 EAGLE/ETH (concentrated liquidity)
   Path B: 30% → Uniswap V2 EAGLE/ETH (broad range backup)
   Path C: 30% → Hedge position (IL protection)
   ```

3. **Auto-Rebalancing**:
   - Monitor price movements
   - Adjust positions across all three paths
   - Maintain IL protection
   - Optimize fee generation

4. **Profit Sources**:
   - V3 trading fees (high APY)
   - V2 trading fees (stable)
   - Arbitrage between V2/V3
   - Hedge position gains

## Smart Contract Structure

### New Contracts Needed:

```solidity
// Main router for triangular strategy
contract TriangularRouter {
    // Manages the 3-way split
    // Handles rebalancing logic
    // Coordinates with V2/V3 pools
}

// EAGLE/ETH specific strategy
contract EagleEthStrategy {
    // Implements triangular logic for EAGLE/ETH
    // Price monitoring
    // Rebalance triggers
}

// IL Hedge Manager
contract HedgeManager {
    // Manages hedge positions
    // Calculates IL exposure
    // Executes protective trades
}
```

## Supported Pairs (Phase 1)

1. **EAGLE/ETH** (Primary)
   - Highest volume
   - Most liquid
   - Best for testing

2. **EAGLE/WBTC** (Secondary)
   - Bitcoin exposure
   - Lower volume
   - Good diversification

3. **EAGLE/USDC** (Stable benchmark)
   - Lower volatility
   - Comparison baseline
   - Conservative option

## How It Works (EAGLE/ETH Example)

### Step 1: User Deposits ETH
```
User: "I want to provide liquidity with 1 ETH"
System: "Analyzing optimal split..."
```

### Step 2: Triangular Split
```
0.4 ETH → Swap 50% to EAGLE → V3 LP (tight range)
0.3 ETH → Swap 50% to EAGLE → V2 LP (full range)
0.3 ETH → Hedge position (keep as ETH or derivatives)
```

### Step 3: Continuous Monitoring
```
Every block:
- Check price vs. V3 range
- Calculate IL exposure
- Adjust hedge if needed
- Rebalance if profitable
```

### Step 4: Fee Collection & Compounding
```
Daily:
- Collect V3 fees
- Collect V2 fees
- Collect arbitrage profits
- Compound or distribute
```

## Key Features

### 1. Single-Sided Entry
- Deposit only ETH (or only EAGLE)
- System handles all conversions
- No need to hold both tokens

### 2. IL Protection
- Active hedging strategy
- Up to 95% IL protection
- Dynamically adjusted

### 3. Yield Optimization
- Arbitrage V2 vs V3 prices
- Auto-compound fees
- Rebalance to optimal ranges

### 4. Capital Efficiency
- Concentrated liquidity (V3)
- Broad coverage (V2)
- Smart capital allocation

## User Interface

### Deposit Flow:
```
┌─────────────────────────────────┐
│  EAGLE Triangular LP            │
│                                 │
│  Select Pair:                   │
│  ○ EAGLE/ETH   [LIVE]          │
│  ○ EAGLE/WBTC  [Coming Soon]   │
│                                 │
│  Deposit:                       │
│  [1.5] ETH                      │
│                                 │
│  Strategy:                      │
│  ⚖️ Balanced (40/30/30 split)  │
│                                 │
│  Expected APY: 42.3%            │
│  IL Protection: 95%             │
│                                 │
│  [🚀 Deploy Position]           │
└─────────────────────────────────┘
```

## Technical Deep Dive

### Price Discovery
```typescript
interface PriceOracle {
  v3Price: number;      // Uniswap V3 spot
  v2Price: number;      // Uniswap V2 spot
  chainlinkPrice: number; // Oracle price
  
  getOptimalSplit(): {
    v3Allocation: number;
    v2Allocation: number;
    hedgeAllocation: number;
  }
}
```

### Rebalance Logic
```typescript
interface RebalanceEngine {
  shouldRebalance(): boolean {
    // Check if price moved X% from V3 range
    // Check if IL exposure > threshold
    // Check if gas costs < expected profit
    // Check if arbitrage opportunity exists
  }
  
  executeRebalance(): Transaction {
    // Withdraw from out-of-range positions
    // Adjust hedge
    // Redeploy to new optimal ranges
    // Capture arbitrage if available
  }
}
```

### IL Calculation
```typescript
interface ILCalculator {
  calculateIL(
    initialPriceRatio: number,
    currentPriceRatio: number,
    position: LPPosition
  ): number {
    // Standard IL formula
    // Adjusted for concentrated liquidity
    // Factor in fees earned
  }
  
  getHedgeAmount(): number {
    // Calculate required hedge size
    // Based on IL exposure
    // Consider gas costs
  }
}
```

## Comparison to Traditional LP

| Feature | Traditional LP | Triangular Framework |
|---------|---------------|---------------------|
| **Tokens Needed** | Both EAGLE + ETH | Just one (EAGLE or ETH) |
| **IL Risk** | High (~20-40%) | Low (~5%) with hedge |
| **Rebalancing** | Manual | Automatic |
| **Capital Efficiency** | 50% utilization | 85% utilization |
| **APY** | 15-25% | 35-50% |
| **Complexity** | High | One-click |

## Implementation Phases

### Phase 1: EAGLE/ETH MVP (Week 1-2)
- [ ] Deploy TriangularRouter contract
- [ ] Deploy EagleEthStrategy
- [ ] Build basic UI
- [ ] Test on testnet

### Phase 2: Hedging (Week 3-4)
- [ ] Deploy HedgeManager
- [ ] Implement IL protection
- [ ] Test hedge effectiveness
- [ ] Optimize gas costs

### Phase 3: Auto-Rebalancing (Week 5-6)
- [ ] Build rebalance engine
- [ ] Add keeper network
- [ ] Gas optimization
- [ ] Profitability checks

### Phase 4: Additional Pairs (Week 7-8)
- [ ] EAGLE/WBTC
- [ ] EAGLE/USDC
- [ ] Multi-pair dashboard
- [ ] Cross-pair optimization

## Revenue Model

### Protocol Fees:
- **Performance Fee**: 10% of profits
- **Withdrawal Fee**: 0.1%
- **Flash Loan Fee**: 0.09% (if used for arbitrage)

### Fee Distribution:
- 50% → EAGLE token holders
- 30% → Development fund
- 20% → Liquidity mining rewards

## Integration Points

### With EagleOVault:
- Separate products
- Shared EAGLE token
- Cross-protocol incentives
- Unified dashboard option

### With LayerZero:
- Deploy on multiple chains
- Unified EAGLE liquidity
- Cross-chain rebalancing
- Multi-chain arbitrage

## Success Metrics

### Technical:
- IL < 5% average
- APY > 35% average
- 99% uptime
- <$10 gas per rebalance

### Business:
- $10M TVL in 3 months
- 1,000 active positions
- 50% from single-sided deposits
- Positive protocol revenue

## Risks & Mitigations

### Risk 1: Oracle Manipulation
**Mitigation**: Use multiple price sources (V3, V2, Chainlink)

### Risk 2: Smart Contract Risk
**Mitigation**: Audits, bug bounties, insurance

### Risk 3: IL Despite Hedging
**Mitigation**: Dynamic hedge adjustments, conservative ranges

### Risk 4: Low Liquidity
**Mitigation**: Incentives, liquidity mining, partnerships

## Marketing Angle

**"Single-sided EAGLE liquidity, supercharged"**

- Deposit EAGLE, earn on ETH volatility
- Or deposit ETH, earn EAGLE rewards
- No IL risk, just upside
- Automated everything

## Technical Stack

**Smart Contracts:**
- Solidity 0.8.22
- OpenZeppelin libraries
- Uniswap V3 SDK
- Uniswap V2 compatibility

**Frontend:**
- React + TypeScript
- ethers.js
- Neumorphic design
- Real-time price feeds

**Backend:**
- Keeper network for rebalancing
- Price monitoring service
- Analytics engine
- Alert system

## Next Steps

1. **Define exact split ratios** for EAGLE/ETH
2. **Build TriangularRouter contract**
3. **Create dedicated UI** (separate from vault)
4. **Deploy to testnet**
5. **Gather community feedback**

---

**This is a separate product from EagleOVault**, focused specifically on **EAGLE + volatile token pairs** using the triangular arbitrage methodology from the Cookie/ETH case study.

