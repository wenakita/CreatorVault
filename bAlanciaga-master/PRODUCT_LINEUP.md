# Eagle Protocol - Product Lineup

## Two Separate Products

### 1. 🏦 EagleOVault (Existing)
**Stable Asset Vault**

- **Pairs**: WLFI/USD1
- **Type**: ERC-4626 vault
- **Strategy**: Conservative, stable pairs
- **Contract**: `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`
- **Use Case**: Stable yield farming
- **APY**: 10-15%
- **Risk**: Low
- **Status**: ✅ **Live on Ethereum**

**Access**: `/traditional` or `/view`

---

### 2. 🔺 Triangular Framework (NEW)
**EAGLE + Volatile Token Pairs**

- **Pairs**: EAGLE/ETH, EAGLE/WBTC, etc.
- **Type**: Triangular arbitrage strategy
- **Strategy**: Aggressive, single-sided volatile pairs
- **Contracts**: TriangularRouter (to be deployed)
- **Use Case**: Maximum yield with IL protection
- **APY**: 35-50%
- **Risk**: Medium (hedged)
- **Status**: 🚧 **In Development**

**Access**: `/simplified` (when ready)

---

## Key Differences

| Feature | EagleOVault | Triangular Framework |
|---------|-------------|---------------------|
| **Purpose** | Stable yield | Aggressive yield |
| **Pairs** | WLFI/USD1 | EAGLE/ETH, EAGLE/WBTC |
| **Volatility** | Low | High |
| **Strategy** | Single vault | V2/V3 + Hedge |
| **IL Risk** | Minimal | Protected via hedge |
| **Complexity** | Standard ERC-4626 | Triangular arbitrage |
| **APY** | 10-15% | 35-50% |
| **Rebalancing** | Passive | Active |

---

## Triangular Framework - The Focus

Based on the Medium article: **"Cookie/ETH Case Study"**

### How It Works:

```
User deposits EAGLE (or ETH) - single sided
         ↓
Triangular Router splits:
         ↓
    ┌────┴────┬────────┐
    ↓         ↓        ↓
V3 Pool   V2 Pool   Hedge
40%       30%       30%
```

### Three Paths:

1. **Path A**: Uniswap V3 EAGLE/ETH
   - Concentrated liquidity
   - High fee generation
   - Tight price ranges
   - Main profit source

2. **Path B**: Uniswap V2 EAGLE/ETH
   - Broad range backup
   - Stable liquidity
   - Arbitrage opportunities
   - Fallback position

3. **Path C**: Hedge Position
   - IL protection
   - Risk management
   - Dynamic adjustment
   - Safety net

### Why Separate from Vault?

1. **Different Risk Profiles**
   - Vault: Conservative, stable
   - Triangular: Aggressive, volatile

2. **Different Mechanisms**
   - Vault: Standard ERC-4626
   - Triangular: Custom routing logic

3. **Different Users**
   - Vault: Risk-averse, passive
   - Triangular: Yield-focused, active

4. **Different Tokens**
   - Vault: WLFI/USD1
   - Triangular: EAGLE + volatiles

---

## Implementation Priority

### Phase 1: Triangular Framework Core (Weeks 1-4)
Focus on building the triangular framework for **EAGLE/ETH**:

- [ ] TriangularRouter contract
- [ ] EagleEthStrategy contract
- [ ] HedgeManager contract
- [ ] Price oracle integration
- [ ] Basic UI at `/simplified`

### Phase 2: IL Protection (Weeks 5-6)
- [ ] Implement hedging logic
- [ ] Test IL protection
- [ ] Optimize capital efficiency
- [ ] Gas optimization

### Phase 3: Auto-Rebalancing (Weeks 7-8)
- [ ] Rebalance engine
- [ ] Keeper network
- [ ] Profit optimization
- [ ] Multi-pair support

### Phase 4: Integration (Weeks 9-12)
- [ ] Unified dashboard
- [ ] Cross-product incentives
- [ ] LayerZero cross-chain
- [ ] Advanced analytics

---

## User Journey

### For EagleOVault Users:
```
1. Go to /traditional
2. Connect wallet
3. Deposit WLFI or USD1
4. Earn stable yield
```

### For Triangular Framework Users:
```
1. Go to /simplified
2. Connect wallet  
3. Choose EAGLE/ETH pair
4. Deposit EAGLE or ETH (single-sided)
5. Earn aggressive yield with IL protection
```

---

## Navigation Structure

```
/ (Homepage)
├── /traditional     → EagleOVault interface
├── /simplified      → Triangular Framework (EAGLE/ETH, etc.)
├── /view           → View all positions
├── /vault/:address → Specific vault details
└── /agent          → AI features
```

---

## Marketing Position

### EagleOVault:
"Stable, reliable yield on WLFI/USD1 pairs"

### Triangular Framework:
"Single-sided EAGLE liquidity, supercharged with volatile pairs"

---

## Technical Architecture

```
Eagle Protocol
├── EagleOVault (Deployed)
│   ├── ERC-4626 standard
│   ├── CharmStrategyUSD1
│   ├── WLFI/USD1 pairs
│   └── LayerZero OFT
│
└── Triangular Framework (New)
    ├── TriangularRouter
    ├── EagleEthStrategy
    ├── HedgeManager
    ├── V3 Position Manager
    └── V2 Liquidity Provider
```

---

## Next Immediate Steps

### Focus: Build Triangular Framework

1. **Design TriangularRouter contract**
   ```solidity
   contract TriangularRouter {
       function depositSingleSided(
           address token,
           uint256 amount,
           uint8 strategyId
       ) external;
       
       function withdraw(uint256 shares) external;
       
       function rebalance() external;
   }
   ```

2. **Create pair-specific strategies**
   - EAGLE/ETH first (highest priority)
   - EAGLE/WBTC second
   - EAGLE/USDC third

3. **Build dedicated UI**
   - Pair selection
   - Single-sided deposit
   - Real-time IL tracking
   - Position analytics

4. **Deploy to testnet**
   - Test with small amounts
   - Verify IL protection
   - Check gas costs
   - Gather feedback

---

## Summary

**EagleOVault** = Existing stable yield product (WLFI/USD1)  
**Triangular Framework** = NEW aggressive yield product (EAGLE + volatiles)

Both use EAGLE token, but serve different purposes and user segments.

**Current Priority**: Build the Triangular Framework from scratch!

---

See `TRIANGULAR_FRAMEWORK.md` for detailed technical specifications.

