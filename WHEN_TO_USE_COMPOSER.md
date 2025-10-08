# 🌐 When to Use EagleComposer - Visual Guide

## 🎯 **Two Deployment Scenarios**

---

## **Scenario A: Single Chain Deployment (What You Have Now)**

```
┌─────────────────────────────────────────────────┐
│           ARBITRUM ONLY                         │
│                                                 │
│  ┌──────────┐                                   │
│  │   User   │                                   │
│  └────┬─────┘                                   │
│       │ Deposits directly                       │
│       ▼                                         │
│  ┌──────────────────────┐                       │
│  │   EagleOVault        │                       │
│  │   - Holds assets     │                       │
│  │   - Mints EAGLE      │                       │
│  │   - Manages strategies│                      │
│  └──────────┬───────────┘                       │
│             │                                   │
│             ▼                                   │
│  ┌──────────────────────┐                       │
│  │ SmartCharmStrategy   │                       │
│  │ - Holds MEAGLE       │                       │
│  └──────────────────────┘                       │
│                                                 │
│  Composer Needed? NO ❌                         │
│  All on same chain!                             │
└─────────────────────────────────────────────────┘
```

**Contracts deployed:**
- ✅ EagleOVault
- ✅ SmartCharmStrategy  
- ❌ NO Composer
- ❌ NO OFTs
- ❌ NO ShareAdapter

**Use case:** Local vault on one chain

---

## **Scenario B: Multi-Chain Deployment (Future)**

```
┌─────────────────────────────────────────────────┐
│                BSC (Spoke)                      │
│                                                 │
│  ┌──────────┐                                   │
│  │   User   │                                   │
│  └────┬─────┘                                   │
│       │ Has WLFI on BSC                         │
│       ▼                                         │
│  ┌──────────────────────┐                       │
│  │   WLFI OFT           │                       │
│  │   - Burns WLFI       │                       │
│  └──────────┬───────────┘                       │
│             │                                   │
└─────────────┼───────────────────────────────────┘
              │
              │ LayerZero Message
              ▼
┌─────────────────────────────────────────────────┐
│           ETHEREUM (Hub)                        │
│                                                 │
│  ┌──────────────────────┐                       │
│  │  EagleComposer  ← HERE!                     │
│  │  - Receives WLFI     │                       │
│  │  - Orchestrates      │                       │
│  └──────────┬───────────┘                       │
│             │                                   │
│             ▼                                   │
│  ┌──────────────────────┐                       │
│  │   EagleOVault        │                       │
│  │   - Holds ALL assets │ ← Assets stay here!  │
│  │   - Mints EAGLE      │                       │
│  │   - Manages strategies│                      │
│  └──────────┬───────────┘                       │
│             │                                   │
│             ▼                                   │
│  ┌──────────────────────┐                       │
│  │  ShareOFTAdapter     │                       │
│  │  - Locks EAGLE       │                       │
│  └──────────┬───────────┘                       │
│             │                                   │
└─────────────┼───────────────────────────────────┘
              │
              │ LayerZero Message
              ▼
┌─────────────────────────────────────────────────┐
│                BSC (Spoke)                      │
│                                                 │
│  ┌──────────────────────┐                       │
│  │   EAGLE OFT          │                       │
│  │   - Mints EAGLE      │                       │
│  └──────────┬───────────┘                       │
│             │                                   │
│             ▼                                   │
│  ┌──────────────────────┐                       │
│  │   User               │                       │
│  │   - Gets EAGLE on BSC│                       │
│  └──────────────────────┘                       │
│                                                 │
│  Composer Needed? YES ✅                        │
│  Orchestrates cross-chain!                      │
└─────────────────────────────────────────────────┘
```

**Contracts needed:**
- ✅ EagleOVault (Ethereum)
- ✅ EagleComposer (Ethereum) ← **REQUIRED**
- ✅ ShareOFTAdapter (Ethereum)
- ✅ WLFI/USD1 OFTs (all chains)
- ✅ EAGLE ShareOFT (spoke chains)

**Use case:** Omnichain vault across multiple chains

---

## 🔑 **Key Difference**

| Aspect | Single Chain | Multi-Chain |
|--------|-------------|-------------|
| **Composer** | ❌ Not needed | ✅ Required |
| **User deposits** | Direct to vault | Via OFT → Composer → Vault |
| **Assets location** | On deployed chain | Always on hub chain |
| **EAGLE location** | Same chain as vault | Can be on any chain |
| **Complexity** | Simple | Advanced |

---

## 💰 **Where Assets Live in Multi-Chain**

Even with composer:

```
User on BSC has: EAGLE shares (on BSC)
User on Arbitrum has: EAGLE shares (on Arbitrum)
User on Base has: EAGLE shares (on Base)

BUT actual assets are:
  └─ ALL on Ethereum (Hub Chain)
      └─ In EagleOVault contract
          └─ 30% direct
          └─ 70% in strategies (still on Ethereum)

Assets NEVER leave the hub chain! ✅
Only EAGLE shares are omnichain
```

---

## 🎯 **For YOUR Current Setup**

**You're testing on Arbitrum only:**

```
Current:
  ├─ EagleOVault on Arbitrum ✅
  ├─ SmartCharmStrategy on Arbitrum ✅
  ├─ Charm vault on Arbitrum ✅
  └─ NO Composer (not needed!) ✅

Assets:
  ├─ 948 WLFI + 2 USD1 in vault (direct)
  └─ 365 MEAGLE in strategy (Charm)
      └─ All on Arbitrum

This is perfect for single-chain! ✅
```

**To go multi-chain later:**

```
Future (Omnichain):
  Hub (Ethereum):
    ├─ EagleOVault ← Assets stay here
    ├─ EagleComposer ← Routes cross-chain deposits
    ├─ ShareOFTAdapter ← Enables EAGLE cross-chain
    └─ Strategies ← Earn yield on Ethereum
  
  Spokes (BSC, Arbitrum, Base):
    ├─ EAGLE ShareOFT ← Users hold these
    ├─ WLFI AssetOFT ← For deposits
    └─ USD1 AssetOFT ← For deposits

Assets still: 100% on Ethereum hub! ✅
```

---

## ✅ **To Keep 100% Assets in Vault**

### **Option 1: No Strategies** (Simplest)
```solidity
// Just never call addStrategy()
// All assets stay in vault ✅
```

### **Option 2: Remove Existing Strategies**
```solidity
vault.removeStrategy(strategyAddress);
// Withdraws from strategy, brings assets back ✅
```

### **Option 3: Set Weight to 0**
```solidity
vault.updateStrategyWeight(strategyAddress, 0);
// Strategy exists but gets 0% allocation ✅
```

---

## 📊 **Your Choice Matrix**

**Choose based on priority:**

### **Priority: Safety & Custody**
```solidity
Allocation: 0% strategies
Result: 100% in vault
APY: 0%
Use: Cold storage, maximum safety
```

### **Priority: Balance** (Recommended)
```solidity
Allocation: 30-40% strategies
Result: 60-70% in vault
APY: 5-8%
Use: Most users, good balance
```

### **Priority: Yield**
```solidity
Allocation: 70-80% strategies
Result: 20-30% in vault
APY: 12-15%
Use: Aggressive yield, risk tolerant
```

---

## 🎯 **Summary**

### **Question 1: When is Composer used?**
```
Same chain: NO (direct deposits)
Cross-chain: YES (routes between chains)

Your Arbitrum test: NO Composer needed! ✅
```

### **Question 2: Can we keep all assets in vault?**
```
YES! Three ways:
1. Don't add strategies
2. Remove existing strategies
3. Set strategy weights to 0

Trade-off: 100% custody = 0% yield
Recommended: 60-70% in vault, 30-40% strategies
```

**Current setup is already great!** ✅

