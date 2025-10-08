# 🌐 EagleComposer & Asset Custody - Complete Explanation

## 📋 **Question 1: When Does EagleComposer Come Into Play?**

### **TL;DR**
**EagleComposer is ONLY used for CROSS-CHAIN deposits/withdrawals.**

On the same chain (like your Arbitrum test), you **don't need it**!

---

## 🏗️ **Two Architectures**

### **Architecture 1: Single Chain (What You're Using Now)**

```
┌────────────────────────────────────────────┐
│  User on Arbitrum                          │
│  Has: WLFI, USD1, or any token            │
└──────────────┬─────────────────────────────┘
               │ Direct deposit
               ▼
┌────────────────────────────────────────────┐
│  EagleOVault (Arbitrum)                    │
│  • Receives deposits directly              │
│  • Mints EAGLE shares                      │
│  • Deploys to strategies                   │
└──────────────┬─────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│  SmartCharmStrategy (Arbitrum)             │
│  • Holds MEAGLE                            │
│  • Earns Uniswap fees                      │
└────────────────────────────────────────────┘

NO COMPOSER NEEDED! ✅
```

### **Architecture 2: Cross-Chain (Composer Required)**

```
┌────────────────────────────────────────────┐
│  User on BSC (different chain!)            │
│  Has: WLFI tokens on BSC                   │
└──────────────┬─────────────────────────────┘
               │ Cross-chain deposit
               ▼
┌────────────────────────────────────────────┐
│  WLFI OFT on BSC                           │
│  • Burns WLFI on BSC                       │
│  • Sends LayerZero message                 │
└──────────────┬─────────────────────────────┘
               │ LayerZero
               ▼
┌────────────────────────────────────────────┐
│  EagleComposer on Ethereum (Hub)  ← HERE! │
│  • Receives WLFI on Ethereum               │
│  • Deposits into EagleOVault               │
│  • Gets EAGLE shares                       │
│  • Sends EAGLE back to user on BSC        │
└──────────────┬─────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│  EagleOVault on Ethereum (Hub)             │
│  • Holds all the actual assets             │
│  • Manages strategies                      │
│  • THIS is where assets live!              │
└────────────────────────────────────────────┘
```

---

## 🎯 **When Composer is Used**

### **Scenario 1: Local Deposit (NO Composer)**

```javascript
// User on Arbitrum depositing to vault on Arbitrum
vault.depositDual(100, 100, user);

// Flow: User → Vault
// Composer: NOT USED ❌
```

### **Scenario 2: Cross-Chain Deposit (YES Composer)**

```javascript
// User on BSC wants to deposit into Ethereum vault
assetOFT.send({
  to: composerAddress,  // On Ethereum
  amount: 100,
  dstChain: ethereum
});

// Flow: User (BSC) → OFT (BSC) → LayerZero → Composer (ETH) → Vault (ETH)
// Composer: USED ✅
```

---

## 📋 **Question 2: Can We Keep All Assets Inside Vault?**

### **Short Answer: YES!** (With Trade-offs)

You have **TWO options**:

---

### **Option A: Keep Assets in Vault (No External Strategies)**

```solidity
// Don't add any strategies
// vault.addStrategy(...) ← Skip this!

// Assets stay in vault permanently
vault.depositDual(100, 100, user);
// Result: 100 WLFI + 100 USD1 sit in vault
```

**Pros:**
- ✅ **Full custody** - All assets in one place
- ✅ **Simplest** - No strategy complexity
- ✅ **Safest** - No external contract risk
- ✅ **Instant withdrawals** - No need to withdraw from strategies
- ✅ **Lower gas** - No strategy deployment costs

**Cons:**
- ❌ **No yield** - Assets sit idle
- ❌ **No diversification** - Single point of storage
- ❌ **Inefficient** - Capital not working

---

### **Option B: Vault-Controlled Strategies (Current Setup)**

```solidity
// Add strategies that vault controls
vault.addStrategy(charmStrategy, 7000);  // 70% allocation

// Assets split:
// - 30% in vault (for instant withdrawals)
// - 70% in strategies (earning yield)
```

**Pros:**
- ✅ **Earning yield** - Assets work for users
- ✅ **Diversification** - Multiple strategies
- ✅ **Still controlled** - Vault can withdraw anytime
- ✅ **Gas efficient** - Batch deployments
- ✅ **Flexible** - Can rebalance allocations

**Cons:**
- ⚠️ **Partial custody** - Some assets in strategies
- ⚠️ **Strategy risk** - Depends on external contracts
- ⚠️ **Withdrawal complexity** - Might need to withdraw from strategies

---

## 🔐 **Asset Custody Models**

### **Model 1: 100% Vault Custody (Conservative)**

```
EagleOVault holds:
  ├─ 100% WLFI (all in vault contract)
  └─ 100% USD1 (all in vault contract)

Strategies: NONE

Custody: 100% in your vault ✅
Yield: 0% ❌
Risk: Minimal
```

### **Model 2: Vault + Strategies (Balanced - Current)**

```
EagleOVault holds:
  ├─ 30% WLFI (direct, for instant withdrawals)
  ├─ 30% USD1 (direct, for instant withdrawals)
  └─ SmartCharmStrategy:
      └─ 70% assets → MEAGLE → Uniswap LP

Custody: 
  • 30% in vault ✅
  • 70% in Charm (via strategy you control) ⚠️
  
Yield: Earning Uniswap fees ✅
Risk: Charm contract risk
```

### **Model 3: Full Deployment (Aggressive)**

```
EagleOVault holds:
  ├─ 0% direct (all deployed)
  └─ Multiple Strategies:
      ├─ 40% Charm (Uniswap fees)
      ├─ 30% Aave (lending yield)
      └─ 30% Curve (stable yield)

Custody: 0% in vault, 100% in strategies
Yield: Maximum ✅
Risk: Multiple strategy risks
Withdrawals: Must withdraw from strategies
```

---

## 💡 **Recommendation: Hybrid Custody**

Keep **30-40% in vault**, deploy **60-70% to strategies**:

```solidity
// Configure vault
vault.addStrategy(charmStrategy, 6000);  // 60% to strategies
// Vault keeps 40% for instant withdrawals

Benefits:
  ✅ Most withdrawals fulfilled instantly (from 40% buffer)
  ✅ 60% earning yield
  ✅ Good balance of safety and returns
```

---

## 🌐 **Cross-Chain: Where Composer Matters**

### **Scenario: User on BSC wants to deposit into Ethereum vault**

```
┌──────────────────────────────────────────────────────┐
│  STEP 1: User on BSC                                 │
│  Has: 100 WLFI on BSC                                │
│  Wants: EAGLE shares (can receive on any chain)      │
└────────────┬─────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────┐
│  STEP 2: WLFI OFT on BSC                             │
│  • User calls: wlfiOFT.send(composer, 100, ethereum) │
│  • Burns: 100 WLFI on BSC                            │
│  • Message: LayerZero to Ethereum                    │
└────────────┬─────────────────────────────────────────┘
             │ LayerZero network
             ▼
┌──────────────────────────────────────────────────────┐
│  STEP 3: EagleComposer on Ethereum ← COMPOSER HERE!  │
│  • Receives: 100 WLFI on Ethereum                    │
│  • Calls: vault.deposit(100, user)                   │
│  • Gets: 100 EAGLE shares                            │
│  • Locks: EAGLE in ShareOFTAdapter                   │
│  • Sends: Message to mint EAGLE on BSC              │
└────────────┬─────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────┐
│  STEP 4: EagleOVault on Ethereum (Hub Chain)         │
│  • Receives: 100 WLFI from Composer                  │
│  • Holds: ALL actual assets here!                    │
│  • Deploys: To strategies when threshold met         │
│  • Returns: EAGLE shares to Composer                 │
└────────────┬─────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────┐
│  STEP 5: ShareOFT on BSC                             │
│  • Mints: 100 EAGLE to user on BSC                   │
│  • User: Now has EAGLE on BSC!                       │
│  • Assets: Still on Ethereum in vault                │
└──────────────────────────────────────────────────────┘
```

**Key Point**: Assets ALWAYS stay on the hub chain (Ethereum). Composer just routes the cross-chain messages!

---

## 🎯 **Your Current Setup (Arbitrum Only)**

Since you're testing on **Arbitrum only** (no cross-chain), you have:

```
✅ What you have:
  • EagleOVault on Arbitrum
  • SmartCharmStrategy on Arbitrum
  • Charm vault on Arbitrum
  • Users deposit directly

❌ What you DON'T need (yet):
  • EagleComposer (only for cross-chain)
  • OFT tokens (only for cross-chain)
  • ShareOFTAdapter (only for cross-chain)
```

---

## 💰 **Asset Custody: Where Are Tokens?**

### **Current State (After Your Tests):**

```
Total Value: ~1,340

Located:
  ├─ EagleOVault (948.7 WLFI + 1.9 USD1):
  │   └─ ~950 value (71%) ✅ IN YOUR VAULT
  │
  └─ SmartCharmStrategy:
      └─ 365.4 MEAGLE shares
          └─ Represents: ~129 WLFI + ~11 USD1 in Charm
              └─ Located in: Charm contract (not your vault)
                  └─ ~140 value (29%) ⚠️ IN CHARM

Your Custody:
  • Direct: 71% ✅
  • Via Strategy: 29% (Charm holds it)
```

---

## ✅ **To Keep 100% in Vault**

```solidity
// Option 1: Don't add strategies
// (Current vault already works this way if no strategies)

// Option 2: Remove existing strategies
vault.removeStrategy(strategyAddress);

// Option 3: Set strategy weight to 0%
vault.updateStrategyWeight(strategyAddress, 0);

// Result: All deposits stay in vault
vault.depositDual(100, 100, user);
// Assets: Stay in vault contract ✅
// Yield: None ❌
// Custody: 100% ✅
```

---

## 🎯 **Summary**

### **Q1: When is Composer used?**

**Answer**: Only for **cross-chain deposits** from other chains to the hub chain.

```
Same chain deposit: User → Vault directly (no composer)
Cross-chain deposit: User (BSC) → Composer (ETH) → Vault (ETH)
```

**Your Arbitrum test**: No composer needed! ✅

### **Q2: Can we keep all assets in vault?**

**Answer**: **Yes!** Just don't add strategies (or set weight to 0%).

```
With strategies: 70% in Charm, 30% in vault
Without strategies: 100% in vault ✅

Trade-off: Custody vs Yield
  • 100% custody = 0% yield
  • Partial custody = Earning yield
```

---

## 💡 **Recommended Setup**

### **For Maximum Custody:**
```solidity
// Keep 70% in vault, 30% in strategies
vault.addStrategy(strategy, 3000);  // Only 30%
```

### **For Maximum Yield:**
```solidity
// Keep 20% in vault, 80% in strategies
vault.addStrategy(strategy, 8000);  // 80%
```

### **For Balance (Current):**
```solidity
// Keep 30% in vault, 70% in strategies
vault.addStrategy(strategy, 7000);  // 70%
```

---

**Want me to show you how to configure for 100% vault custody or explain more about cross-chain flows?**

