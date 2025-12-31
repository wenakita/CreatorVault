# ✅ **REQUIRED APPROVALS CHECKLIST**

## 🎯 **QUICK ANSWER:**

### **What You (Protocol Owner) Must Do:**

```solidity
// CRITICAL - Do this after deploying CCALaunchStrategy:
CCALaunchStrategy(ccaAddress).setApprovedLauncher(
    VAULT_ACTIVATION_BATCHER_ADDRESS,
    true
);
```

**That's it! Only 1 critical approval needed.**

---

## 📋 **FULL CHECKLIST:**

### **1. Deploy Contracts:**
```bash
# Deploy these once:
forge create StrategyDeploymentBatcher
forge create VaultActivationBatcher
forge create CCALaunchStrategy
```

### **2. CRITICAL APPROVAL:**
```solidity
// From your multisig (0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3):
ccaStrategy.setApprovedLauncher(vaultActivationBatcherAddress, true);
```

### **3. Users Approve Their Tokens:**
```solidity
// Each user does this before deploying:
creatorToken.approve(strategyDeploymentBatcherAddress, MAX_UINT);
```

---

## 🔐 **COINBASE SMART WALLET (Optional):**

If using Coinbase Smart Wallet features:

### **Session Keys (Optional):**
- Allow batch transactions without signing each time
- Set expiry (e.g., 24 hours)

### **Paymaster (Optional):**
- Enable gasless transactions for users
- Set spending limits per contract

### **Contract Whitelist (Optional):**
- Add StrategyDeploymentBatcher
- Add VaultActivationBatcher

**None of these are REQUIRED, just nice-to-have for better UX.**

---

## ⚠️ **WHAT HAPPENS IF YOU FORGET:**

### **If you forget `setApprovedLauncher()`:**
```
User calls batchActivate()
  ↓
VaultActivationBatcher calls cca.launchAuctionSimple()
  ↓
Modifier checks: onlyApprovedOrOwner
  ↓
Batcher is not approved ❌
  ↓
TRANSACTION REVERTS ❌
```

### **If user forgets token approval:**
```
User calls batchDeployStrategies()
  ↓
Batcher tries transferFrom(user, batcher, amount)
  ↓
User hasn't approved tokens ❌
  ↓
TRANSACTION REVERTS ❌
```

---

## ✅ **FINAL CHECKLIST:**

**Before Launch:**
- [ ] Deploy StrategyDeploymentBatcher
- [ ] Deploy VaultActivationBatcher
- [ ] Deploy CCALaunchStrategy
- [ ] **Call setApprovedLauncher()** ⚠️ **CRITICAL!**

**Per User:**
- [ ] User approves CREATOR token to batcher
- [ ] User calls batchDeployStrategies()

**That's all that's REQUIRED!** ✅

Everything else (session keys, paymaster, whitelisting) is optional UX improvements.

---

## 🚀 **DEPLOYMENT SCRIPT:**

```javascript
// 1. Deploy (one time)
const batcher = await deploy("StrategyDeploymentBatcher");
const activationBatcher = await deploy("VaultActivationBatcher");
const cca = await deploy("CCALaunchStrategy");

// 2. CRITICAL APPROVAL (one time)
await cca.setApprovedLauncher(activationBatcher.address, true);
console.log("✅ Batcher approved!");

// 3. User approves (per user)
await creatorToken.connect(user).approve(batcher.address, MAX);
console.log("✅ User approved!");

// 4. User deploys (per user)
await batcher.connect(user).batchDeployStrategies(...);
console.log("✅ Deployed!");
```

**Done!** 🎉

