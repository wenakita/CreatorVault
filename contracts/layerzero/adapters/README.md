# LayerZero Adapters

**Purpose:** Enable cross-chain bridging of native WLFI/USD1 tokens  
**Use Case:** Bridge tokens from chains where they already exist (Ethereum, BNB Chain)

---

## 📁 Directory Structure

```
adapters/
├── WLFIAdapter.sol                    # Standard WLFI adapter (deploy first)
├── USD1Adapter.sol                    # Standard USD1 adapter (deploy first)
├── productive/                        # Capital-efficient versions (deploy later)
│   ├── ProductiveWLFIAdapter.sol     # Earns yield on idle WLFI
│   ├── ProductiveUSD1Adapter.sol     # Earns yield on idle USD1
│   └── README.md                      # Full deployment guide
└── README.md                          # This file
```

---

## 🎯 When to Use Adapters

| Chain Type | Token Status | Contract Type | Example |
|------------|--------------|---------------|---------|
| **Hub (Native)** | Token already exists | **Adapter** | Ethereum, BNB Chain |
| **Spoke (Synthetic)** | Token doesn't exist | **OFT** | Base, Arbitrum, Optimism |

---

## 📋 Standard Adapters (Deploy First)

### **WLFIAdapter.sol**
- Wraps native WLFI for LayerZero bridging
- Locks WLFI when sending cross-chain
- Unlocks WLFI when receiving cross-chain
- ⚠️ Requires pre-funding with WLFI liquidity

### **USD1Adapter.sol**
- Wraps native USD1 for LayerZero bridging
- Locks USD1 when sending cross-chain
- Unlocks USD1 when receiving cross-chain
- ⚠️ Requires pre-funding with USD1 liquidity

**Deployment:**
```bash
# Ethereum
forge script script/adapters/DeployWLFIAdapter.s.sol --rpc-url ethereum
forge script script/adapters/DeployUSD1Adapter.s.sol --rpc-url ethereum

# BNB Chain
forge script script/adapters/DeployWLFIAdapter.s.sol --rpc-url bsc
forge script script/adapters/DeployUSD1Adapter.s.sol --rpc-url bsc
```

**Pre-Funding:**
```bash
# Transfer liquidity to adapters
cast send $WLFI "transfer(address,uint256)" $WLFI_ADAPTER 50000e18
cast send $USD1 "transfer(address,uint256)" $USD1_ADAPTER 50000e18
```

---

## 🚀 Productive Adapters (Deploy Later)

### **Purpose:** Earn yield on adapter liquidity instead of leaving it idle

**Capital Efficiency Comparison:**
```
Standard Adapter:
  - 50,000 WLFI idle
  - Earning: $0/year (0% APY)
  
Productive Adapter:
  - 50,000 WLFI in vault
  - Earning: $5,000/year (10% APY)
```

**Extra Revenue:** $20,000/year across all adapters! 💰

**When to Deploy:**
- ✅ After standard adapters proven in production (2-4 weeks)
- ✅ When vault has sufficient liquidity
- ✅ When you have monitoring/keeper setup

**How It Works:**
1. Deposits 90% of liquidity to EagleOVault (earns yield)
2. Keeps 10% liquid buffer (instant unlocks)
3. Auto-redeems from vault when buffer depletes
4. Periodic rebalancing maintains optimal ratio

**See:** `productive/README.md` for full documentation

---

## 🏗️ Architecture

### **Cross-Chain Flow Example:**

```
User on BNB Chain wants to deposit WLFI into Ethereum vault:

┌─────────────────────────────────────┐
│         BNB CHAIN                   │
│                                     │
│  1. User has 100 WLFI              │
│  2. WLFIAdapter locks 100 WLFI     │
│  3. LayerZero message →            │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│         ETHEREUM                    │
│                                     │
│  4. WLFIAdapter unlocks 100 WLFI   │
│  5. Composer deposits into vault    │
│  6. User receives EAGLE tokens      │
└─────────────────────────────────────┘
```

---

## ⚙️ Configuration

### **LayerZero Peers (Required)**

After deployment, configure peers so adapters can communicate:

```bash
# Ethereum WLFIAdapter ↔ BNB WLFIAdapter
cast send $WLFI_ADAPTER_ETH "setPeer(uint32,bytes32)" \
  $BNB_EID $(cast --to-bytes32 $WLFI_ADAPTER_BNB) \
  --rpc-url ethereum

cast send $WLFI_ADAPTER_BNB "setPeer(uint32,bytes32)" \
  $ETH_EID $(cast --to-bytes32 $WLFI_ADAPTER_ETH) \
  --rpc-url bsc
```

### **Registry Integration**

Both standard and productive adapters use EagleRegistry for endpoint lookup:

```solidity
constructor(
    address _token,
    address _registry,  // ← EagleRegistry address
    address _delegate
) {
    // Gets LayerZero endpoint from registry
    address endpoint = IChainRegistry(_registry)
        .getLayerZeroEndpoint(chainId);
}
```

---

## 📊 Deployment Checklist

### **Phase 1: Standard Adapters (Launch)**

- [ ] Deploy WLFIAdapter on Ethereum
- [ ] Deploy USD1Adapter on Ethereum
- [ ] Deploy WLFIAdapter on BNB Chain
- [ ] Deploy USD1Adapter on BNB Chain
- [ ] Pre-fund all adapters with liquidity
- [ ] Configure LayerZero peers
- [ ] Test cross-chain flows
- [ ] Monitor for 2-4 weeks

### **Phase 2: Productive Adapters (Optimization)**

- [ ] Standard adapters proven stable
- [ ] Vault has sufficient TVL
- [ ] Deploy ProductiveWLFIAdapter on Ethereum
- [ ] Deploy ProductiveUSD1Adapter on Ethereum
- [ ] Deploy ProductiveWLFIAdapter on BNB Chain
- [ ] Deploy ProductiveUSD1Adapter on BNB Chain
- [ ] Migrate liquidity to productive adapters
- [ ] Call `depositIdleToVault()` on all
- [ ] Configure LayerZero peers
- [ ] Set up rebalance keeper
- [ ] Monitor buffer ratios

---

## 💰 Liquidity Requirements

### **Per Chain:**
```
Ethereum:
  - WLFIAdapter: 50,000 WLFI
  - USD1Adapter: 50,000 USD1
  
BNB Chain:
  - WLFIAdapter: 50,000 WLFI
  - USD1Adapter: 50,000 USD1

Total: 100,000 WLFI + 100,000 USD1
```

### **Calculation:**
```
Estimate based on:
  - Expected daily volume
  - Peak usage times
  - Rebalancing frequency
  
Recommended: 1-2 weeks of expected volume
Conservative: 1 month of expected volume
```

---

## 🔍 Monitoring

### **Key Metrics:**

```bash
# Total liquidity available
cast call $ADAPTER "getTotalLiquidity()(uint256)"

# For productive adapters:
cast call $PRODUCTIVE_ADAPTER "getBufferBalance()(uint256)"
cast call $PRODUCTIVE_ADAPTER "getVaultValue()(uint256)"
cast call $PRODUCTIVE_ADAPTER "getBufferStatus()(uint256,uint256)"
cast call $PRODUCTIVE_ADAPTER "needsRebalance()(bool,string)"
```

### **Alerts:**

Set up alerts for:
- ✅ Adapter liquidity < 20% of initial
- ✅ Productive buffer < 5% of target
- ✅ No rebalance in > 7 days
- ✅ Failed cross-chain messages

---

## 🎯 Summary

| Feature | Standard Adapters | Productive Adapters |
|---------|------------------|---------------------|
| **Capital Efficiency** | 0% (idle) | 100% (earning) |
| **Deployment** | Launch day | After 2-4 weeks |
| **Complexity** | Low | Medium |
| **Maintenance** | None | Periodic rebalance |
| **Revenue** | $0 | +$20k/year |
| **Risk** | Low | Low-Medium |

**Recommendation:**
1. ✅ Launch with standard adapters (proven, simple)
2. ✅ Monitor and validate for 2-4 weeks
3. ✅ Upgrade to productive adapters for capital efficiency
4. ✅ Earn extra $20k/year on adapter liquidity! 🚀

---

**See Also:**
- Standard Adapters: `WLFIAdapter.sol`, `USD1Adapter.sol`
- Productive Adapters: `productive/README.md`
- LayerZero Docs: `../README.md`
- Architecture Decision: `../../ARCHITECTURE_DECISION.md`


