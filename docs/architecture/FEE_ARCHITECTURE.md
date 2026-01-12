# CreatorVault Fee Architecture

## Overview

CreatorVault uses a **dual-phase token launch system** with **two fee capture mechanisms**:

### Phase 1: Fair Launch via CCA (Continuous Clearing Auction)
- Official Uniswap mechanism - no custom hook approval needed!
- Fair price discovery over 1-4 weeks
- No sniping, no timing games, early bidders rewarded
- Automatically graduates to V4 pool

### Phase 2: Ongoing Trading
- **Uniswap V4**: Uses existing Tax Hook for 6.9% fees!
- **Other DEXes**: ShareOFT-based fee detection (fallback)

## ⚡ V4 Tax Hook Integration (NEW!)

We leverage an **existing, approved Tax Hook** on Base for the ■AKITA/ETH pool:

**Tax Hook Address**: [`0xca975B9dAF772C71161f3648437c3616E5Be0088`](https://basescan.org/address/0xca975B9dAF772C71161f3648437c3616E5Be0088)

### Why Use Existing Hook?

| Feature | Custom Hook | Existing Tax Hook ✅ |
|---------|-------------|---------------------|
| Approval | ❌ Needs allowlist | ✅ Already deployed |
| Risk | ❌ Unaudited | ✅ Battle-tested |
| Cost | ❌ Deploy & verify | ✅ Just configure |
| Fees | Custom | ✅ 6.9% configurable |

### Tax Hook Fee Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│              ■AKITA/ETH V4 POOL (with Tax Hook)                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User swaps ETH → ■AKITA                                       │
│                    │                                                │
│                    ▼                                                │
│           Tax Hook extracts 6.9%                                   │
│                    │                                                │
│                    ▼ (WETH)                                        │
│          CreatorGaugeController                                    │
│                    │                                                │
│   ┌────────────────┼────────────────┐                              │
│   │                │                │                              │
│   ▼                ▼                ▼                              │
│  69%            21.39%           9.61%                             │
│LOTTERY          BURN        VOTERS/PROTOCOL                         │
│   │               │               │                                │
│   ▼               ▼               ▼                                │
│ Reserve        PPS ↑        Rewards / Treasury                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### WETH Fee Processing

The Tax Hook sends **WETH** (not ■AKITA). The GaugeController automatically:

1. **Receives WETH** from Tax Hook
2. **Swaps WETH → akita** (Creator Coin) via Uniswap
3. **Deposits akita → vault** → receives vault shares
4. **Distributes vault shares (defaults)**: 69% lottery, 21.39% burn, 9.61% voters/protocol

```solidity
// Tax Hook configuration
TaxHookConfigurator.configureCreatorPool(
    shareOFT,          // ■AKITA (ShareOFT token)
    gaugeController,      // Fee recipient (receives WETH)
    690,                  // 6.9% fee in basis points
    10                    // Tick spacing
);
```

## CCA Launch Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1: FAIR LAUNCH (CCA)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Creator deposits akita → gets ■AKITA                   │
│                                                                 │
│  2. Creator sends ■AKITA to CCALaunchStrategy              │
│                                                                 │
│  3. CCA Auction runs:                                          │
│     ┌───────────────────────────────────────────────────────┐  │
│     │  WEEK 1: 20% supply released (slow)                   │  │
│     │  WEEK 2: 30% supply released (medium)                 │  │
│     │  WEEK 3-4: 50% supply released (fast)                 │  │
│     │                                                       │  │
│     │  ✓ Bids spread over time (no concentration)          │  │
│     │  ✓ Early bidders get lower average price             │  │
│     │  ✓ Clearing price discovered fairly                  │  │
│     │  ✓ No sniping possible                               │  │
│     └───────────────────────────────────────────────────────┘  │
│                                                                 │
│  4. Auction graduates (requires minimum ETH raised)            │
│                                                                 │
│  5. V4 pool initialized at fair clearing price                 │
│                                                                 │
│  6. Raised ETH → Vault/Creator treasury                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

CCA Factory: 0x0000ccaDF55C911a2FbC0BB9d2942Aa77c6FAa1D
Networks: Base, Mainnet, Unichain, Sepolia
```

## Fee Structure

### Phase 2: Ongoing Trading (Post-CCA)

After CCA graduation, trading continues with **TWO fee capture mechanisms**:

#### Method 1: V4 Tax Hook (PRIMARY - ■AKITA/ETH Pool)

```
┌─────────────────────────────────────────────────────────────────────┐
│       ■AKITA/ETH V4 POOL (with Tax Hook 0xca975B9d...)         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  POOL SWAP FEE: ~0% (set low, fees via hook instead)               │
│                                                                     │
│  TAX HOOK FEE: 6.9% (configured via setTaxConfig)                  │
│  └── 100% → GaugeController (as WETH)                              │
│              └── Swap WETH → akita → deposit → vault shares        │
│                  └── Split: 69% lottery, 21.39% burn, 9.61% voters/protocol │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  TOTAL BUY COST: 6.9% (tax hook fee)                               │
│  TOTAL SELL COST: 6.9% (tax hook fee - configurable)               │
└─────────────────────────────────────────────────────────────────────┘
```

#### Method 2: ShareOFT Detection (FALLBACK - Other DEXes)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OTHER DEX POOLS (V2/V3/etc)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  POOL SWAP FEE: Standard (0.3% - 1% depending on pool)             │
│  └── 100% → Liquidity Providers                                    │
│                                                                     │
│  BUY FEE: 6.9% (detected by ShareOFT on transfer)                  │
│  └── 100% → GaugeController (as ■AKITA)                        │
│              └── Unwrap → vault shares                             │
│                  └── Split: 69% lottery, 21.39% burn, 9.61% voters/protocol │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  TOTAL BUY COST: ~7.2% (0.3% swap + 6.9% fee)                      │
│  TOTAL SELL COST: ~0.3% (pool fee only)                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Fee Distribution (Both Methods)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    GaugeController Distribution                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Incoming: WETH (from Tax Hook) OR ■AKITA (from ShareOFT)       │
│                                                                     │
│  Processing:                                                        │
│  ├── WETH path: WETH → swap → akita → deposit → vault shares      │
│  └── OFT path: ■AKITA → unwrap → vault shares                   │
│                                                                     │
│  Distribution (vault shares):                                       │
│  ├── 69% → Lottery Reserve (jackpot)                               │
│  ├── 21.39% → Burn (PPS ↑)                                         │
│  └── 9.61% → Voter Rewards / Protocol                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### We Use EXISTING Infrastructure!

Instead of building custom hooks (which need allowlist approval), we use:

| Need | Our Solution | Address |
|------|--------------|---------|
| **Fair Launch** | Uniswap CCA | `0x0000ccaDF55C911a2FbC0BB9d2942Aa77c6FAa1D` |
| **6.9% Swap Fee** | Existing Tax Hook | `0xca975B9dAF772C71161f3648437c3616E5Be0088` |
| **Fallback Fees** | ShareOFT detection | N/A (built into ShareOFT) |

### Benefits of This Approach:
1. ✅ **No approval process needed** - all contracts already deployed
2. ✅ **Battle-tested** - production code with real volume
3. ✅ **No audit required** - using official/existing mechanisms
4. ✅ **Faster to market** - just configure, don't deploy
5. ✅ **Trusted by users** - not custom third-party code

## Token Naming Convention

| Token Type | Name Format | Symbol Format | Example |
|------------|-------------|---------------|---------|
| **Creator Coin** | (original) | (original) | akita |
| **Vault Token (ERC-4626)** | `{COIN} Vault Token` | `▢{COIN}` | Akita Vault Token / ▢AKITA |
| **Share Token (LayerZero OFT)** | `{COIN} Share Token` | `■{COIN}` | Akita Share Token / ■AKITA |

### Token Flow
```
akita (Creator Coin)
    │
    ▼ deposit
▢AKITA (Vault Token) ← Stays on-chain, earns yield via strategies
    │
    ▼ wrap
■AKITA (Share Token) ← Cross-chain via LayerZero, trades on DEXes
```

### Why This Convention?
- **v** = vault share (standard DeFi: vETH, vUSD, vCRV)
- **ws** = wrapped share (vault share wrapped for cross-chain)

## Token Pairings

| Token | Paired With | DEX | Fee Tier | Notes |
|-------|-------------|-----|----------|-------|
| akita (Creator Coin) | ZORA | Uniswap V4 | 3% | Original creator coin pool |
| ■AKITA (ShareOFT) | ETH | CCA → V4 | 6.9% (Tax Hook) | Launched via CCA, trades on V4 |
| ■AKITA (ShareOFT) | USDC | Uniswap V3 | 1% | Stablecoin pair, fallback |

## Complete Launch & Trading Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CREATOR LAUNCHES                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Factory deploys all contracts:                                 │
│     - CreatorOVault (▢AKITA)                                        │
│     - CreatorOVaultWrapper (user-facing: deposit/withdraw)         │
│     - CreatorShareOFT (■AKITA)                                 │
│     - CreatorGaugeController                                       │
│     - CCALaunchStrategy  ← Fair launch mechanism                   │
│                                                                     │
│  2. Creator deposits akita via Wrapper → gets ■AKITA           │
│                                                                     │
│  3. Creator transfers ■AKITA to CCALaunchStrategy              │
│                                                                     │
│  4. Launch CCA auction (1-4 weeks):                                │
│     strategy.launchAuction(amount, floorPrice, minRaise, steps)    │
│                                                                     │
│  5. Users bid in auction - fair price discovery                    │
│                                                                     │
│  6. Auction graduates → V4 pool auto-initialized                   │
│                                                                     │
│  7. Ongoing trading with ShareOFT fee detection                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Fee Flow Diagram (Post-Launch)

```
                                 USER BUYS ■AKITA
                                         │
                           Any DEX (V4, V3, V2, Aggregator)
                                         │
                              CreatorShareOFT detects BUY
                                         │
                                   6.9% buy fee
                                         │
                            CreatorGaugeController
                                         │
          ┌──────────────────────────────┼──────────────────────────────┐
          │                              │                              │
         69%                          21.39%                         9.61%
       LOTTERY                         BURN                    VOTERS/PROTOCOL
          │                              │                              │
          ▼                              ▼                              ▼
   Jackpot Reserve                   PPS ↑                    Rewards / Treasury
   (Swap-to-Win!)
          ▼
   Next Winner Gets!
```

## Using CCA Launch Strategy

```solidity
// 1. Get the deployed strategy
CCALaunchStrategy strategy = CCALaunchStrategy(info.ccaStrategy);

// 2. Approve ■AKITA transfer
shareOFT.approve(address(strategy), amount);

// 3. Launch simple auction (linear distribution)
strategy.launchAuctionSimple(
    1_000_000e18,  // 1M tokens to sell
    100 ether      // Minimum ETH to raise for graduation
);

// 4. Or launch with custom steps (rewards early bidders more)
bytes memory steps = abi.encodePacked(
    // Phase 1: 20% over first half (slow)
    // Phase 2: 30% over third quarter (medium)  
    // Phase 3: 50% over last quarter (fast)
);
strategy.launchAuction(amount, floorPrice, minRaise, steps);

// 5. After graduation, sweep funds
strategy.sweepCurrency();  // ETH to vault
strategy.sweepUnsoldTokens();  // Remaining tokens to creator
```

## Security Considerations

1. **Official Mechanism**: CCA is official Uniswap - no custom code risk
2. **Fair Launch**: No sniping, timing games, or MEV attacks during auction
3. **Fee Caps**: Buy fee capped at 6.9% with minimum burn share (20%)
4. **Slippage Protection**: Users should set appropriate slippage for buy fee
5. **CCA Graduation**: Requires minimum ETH raised before pool initialization

## Contract Addresses

### External (Already Deployed)

| Contract | Address | Network |
|----------|---------|---------|
| **V4 Tax Hook** | `0xca975B9dAF772C71161f3648437c3616E5Be0088` | Base |
| **CCA Factory** | `0x0000ccaDF55C911a2FbC0BB9d2942Aa77c6FAa1D` | Base/Mainnet/Unichain |
| V4 Pool Manager | `0x498581fF718922c3f8e6A244956aF099B2652b2b` | Base |
| WETH | `0x4200000000000000000000000000000000000006` | Base |
| Uniswap V3 Router | `0x2626664c2603336E57B271c5C0b26F421741e481` | Base |

### Creator Tokens

| Contract | Address | Network |
|----------|---------|---------|
| akita (Creator Coin) | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` | Base |
| ■AKITA (ShareOFT) | TBD (via Factory) | Base |
| CreatorOVault (▢AKITA) | TBD (via Factory) | Base |
| CreatorOVaultWrapper | TBD (via Factory) | Base |
| CCALaunchStrategy | TBD (via Factory) | Base |
| CreatorGaugeController | TBD (via Factory) | Base |
| TaxHookConfigurator | TBD (to deploy) | Base |

## Why This Design?

### For Users (Depositors/Holders)
- **Fair entry**: CCA ensures fair price discovery
- **Passive yield**: Every buy increases your PPS
- **No action needed**: Just hold ■AKITA
- **Compounding**: Gains compound as more people trade

### For Early Participants (CCA Bidders)
- **Better prices**: Early bidders naturally get lower average prices
- **No sniping risk**: Can't be front-run or outbid last-second
- **Time to decide**: Spread bids over weeks, not seconds

### For Traders (Post-Launch)
- **Low sell fees**: Only ~0.3% on sells
- **Lottery chance**: Every buy = lottery entry
- **Standard pools**: Trade on any DEX

### For Creators
- **Revenue**: Creator fee share is configurable (default 0%)
- **Fair launch**: No accusations of insider trading
- **Funds upfront**: CCA raises ETH before trading starts
- **Community trust**: Official mechanism builds credibility

### For LPs
- **Fair initial price**: CCA discovers fair value
- **No IL from manipulation**: Price established fairly
- **Standard pools**: No custom hook complexity

