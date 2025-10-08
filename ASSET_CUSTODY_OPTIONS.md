# 💰 Asset Custody Options - Complete Guide

## 🎯 **Three Custody Models**

---

## **Model 1: Full Vault Custody (0% in Strategies)**

### **Configuration:**
```solidity
// Don't add any strategies
// OR set all weights to 0
vault.updateStrategyWeight(strategyAddress, 0);
```

### **Asset Flow:**
```
User deposits 100 WLFI + 100 USD1
    ↓
EagleOVault receives
    ↓
Vault holds: 100 WLFI + 100 USD1 ← STAYS HERE
    ↓
Mints: 200 EAGLE to user
    ↓
NO deployment to strategies
```

### **Where Assets Are:**
```
EagleOVault Contract: 100 WLFI + 100 USD1 (100%) ✅
Strategies: 0 (0%)
External Protocols: 0 (0%)

YOU CONTROL: 100% ✅
```

### **Pros & Cons:**
```
✅ Full custody - all in your vault
✅ Instant withdrawals - no strategy delays
✅ Simplest - no strategy management
✅ Safest - no external contract risk

❌ No yield - 0% APY
❌ Capital inefficient
❌ Users miss out on returns
```

---

## **Model 2: Balanced Custody (30% Vault, 70% Strategies)**

### **Configuration:**
```solidity
vault.addStrategy(charmStrategy, 7000);  // 70%
vault.addStrategy(aaveStrategy, 0);      // Future
```

### **Asset Flow:**
```
User deposits 100 WLFI + 100 USD1
    ↓
EagleOVault receives
    ↓
Threshold met → Split:
    ├─ 30 WLFI + 30 USD1 → Stays in vault
    └─ 70 WLFI + 70 USD1 → Sent to strategy
        ↓
    SmartCharmStrategy
        ↓
    Deposits to Charm
        ↓
    Charm creates Uniswap LP
```

### **Where Assets Are:**
```
EagleOVault Contract: 30 WLFI + 30 USD1 (30%) ✅
SmartCharmStrategy: 
  └─ MEAGLE shares (70%)
      └─ Charm holds: 70 WLFI + 70 USD1
          └─ Uniswap V3 LP

YOU CONTROL: 30% direct, 70% via strategy ⚖️
CHARM HOLDS: 70% (you can withdraw anytime)
```

### **Pros & Cons:**
```
✅ Earning yield - ~12-15% APY from Uniswap fees
✅ Good balance - safety + returns
✅ Most withdrawals instant - from 30% buffer
✅ Vault can withdraw from Charm anytime

⚠️ Partial custody - 70% in Charm
⚠️ Strategy risk - Charm contract dependency
⚠️ Some withdrawals slower - if need from strategies
```

---

## **Model 3: Maximum Yield (10% Vault, 90% Strategies)**

### **Configuration:**
```solidity
vault.addStrategy(charmStrategy, 4000);   // 40%
vault.addStrategy(aaveStrategy, 3000);    // 30%
vault.addStrategy(curveStrategy, 2000);   // 20%
// Total: 90%, vault keeps 10%
```

### **Where Assets Are:**
```
EagleOVault Contract: 10 WLFI + 10 USD1 (10%) ⚠️
Charm: 40%
Aave: 30%
Curve: 20%

YOU CONTROL: 10% direct, 90% via strategies
EXTERNAL: 90%
```

### **Pros & Cons:**
```
✅ Maximum yield - diversified across protocols
✅ Risk diversification - not all in one place

❌ Minimal custody - only 10% in vault
❌ Higher risk - multiple external dependencies
❌ Most withdrawals - require strategy withdrawals
❌ Complex - managing multiple strategies
```

---

## 🔐 **What "In Vault" Actually Means**

### **Assets "In Vault" (Direct Custody):**
```solidity
// Located at: EagleOVault contract address
// Controlled by: Vault contract code
// Withdrawable by: Vault logic only
// Risk: Your vault contract only

function getVaultBalances() returns (wlfi, usd1) {
  return (wlfiBalance, usd1Balance);  // These are IN vault
}
```

### **Assets "In Strategy" (Indirect Custody):**
```solidity
// Located at: Charm/Aave/etc contract address
// Controlled by: External protocol
// Withdrawable by: Strategy can call withdraw
// Risk: External protocol risk + your strategy risk

// Vault controls strategy, strategy controls assets in Charm
```

---

## 🎯 **Comparison Table**

| Metric | 0% Strategies | 30% Strategies | 70% Strategies | 100% Strategies |
|--------|---------------|----------------|----------------|-----------------|
| **Custody in Vault** | 100% | 70% | 30% | 0% |
| **Yield** | 0% | ~5% | ~12% | ~15% |
| **Instant Withdrawals** | 100% | 70% | 30% | Rare |
| **Risk** | Lowest | Low | Medium | Higher |
| **Gas Costs** | Lowest | Low | Medium | Higher |
| **Management** | None | Simple | Medium | Complex |

---

## 💡 **For Your Use Case**

### **If Priority is CUSTODY:**
```solidity
// Keep 80% in vault
vault.addStrategy(strategy, 2000);  // Only 20% out
```

### **If Priority is YIELD:**
```solidity
// Keep 20% in vault  
vault.addStrategy(strategy, 8000);  // 80% earning
```

### **If Priority is BALANCE:** (Recommended)
```solidity
// Keep 40% in vault
vault.addStrategy(strategy, 6000);  // 60% earning
```

---

## 🔄 **Can Change Anytime!**

```solidity
// Start conservative (80% in vault)
vault.addStrategy(strategy, 2000);

// Later, after confidence builds, increase
vault.updateStrategyWeight(strategy, 6000);  // Now 60% out

// Or go back to full custody
vault.removeStrategy(strategy);  // Withdraws all, back to 100% vault
```

---

## ✅ **Summary**

### **EagleComposer:**
- ✅ Used ONLY for cross-chain operations
- ❌ NOT needed for same-chain deposits
- ❌ NOT used in your Arbitrum test
- ✅ Required when launching on multiple chains

### **Asset Custody:**
- ✅ Can keep 100% in vault (set strategy weight = 0)
- ⚖️ Or split between vault + strategies (current: 30/70)
- ✅ You control the allocation
- ✅ Can change anytime

**Current Setup (Arbitrum):**
- 30% in vault (full custody)
- 70% in Charm via strategy (earning yield)
- Perfect balance! ✅

