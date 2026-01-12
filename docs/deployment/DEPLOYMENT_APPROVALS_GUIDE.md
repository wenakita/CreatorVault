# 🔐 **DEPLOYMENT APPROVALS & SETUP GUIDE**

## 📋 **WHAT YOU NEED TO APPROVE/SETUP:**

---

## 1️⃣ **PRE-DEPLOYMENT SETUP**

### **A. Deploy Core Contracts First:**

These contracts need to be deployed BEFORE using the batchers:

```solidity
// 1. Deploy StrategyDeploymentBatcher
forge create StrategyDeploymentBatcher

// 2. Deploy VaultActivationBatcher  
forge create VaultActivationBatcher

// 3. Deploy CCALaunchStrategy (for each vault)
forge create CCALaunchStrategy
```

**No approvals needed for deployment itself.**

---

## 2️⃣ **POST-DEPLOYMENT APPROVALS**

### **A. CCALaunchStrategy - Approve VaultActivationBatcher:**

**What:** Allow VaultActivationBatcher to launch auctions

**Why:** The CCA contract has `onlyApprovedOrOwner` modifier that would block the batcher

**How:**
```solidity
// As owner/multisig, call:
CCALaunchStrategy(ccaAddress).setApprovedLauncher(
    VAULT_ACTIVATION_BATCHER_ADDRESS,
    true
);
```

**When:** After deploying CCALaunchStrategy, before users can activate vaults

**Required:** ✅ **YES - CRITICAL!**

---

### **B. Token Approvals (User Side):**

**What:** Users need to approve tokens before deployment

**Why:** Batcher needs to pull creator tokens

**How:**
```javascript
// User approves their CREATOR token to StrategyDeploymentBatcher
await creatorToken.approve(
    STRATEGY_DEPLOYMENT_BATCHER_ADDRESS,
    ethers.constants.MaxUint256
);
```

**When:** Before calling `batchDeployStrategies()`

**Required:** ✅ **YES** (but user does this, not you)

---

## 3️⃣ **COINBASE SMART WALLET / BASE SPECIFIC**

### **What You Might Need on Coinbase CDP:**

If you're using **Coinbase Smart Wallet** or **Base network**:

#### **A. Smart Wallet Session Keys (Optional):**
- Set up session keys for batch transactions
- Allow repeated calls without signing each time

#### **B. Gas Sponsorship (Optional):**
- Set up paymaster for gasless transactions
- Configure which contracts can be called

#### **C. Transaction Limits (Optional):**
- Set daily/weekly spending limits
- Whitelist specific contracts

**None of these are REQUIRED, but they improve UX.**

---

## 4️⃣ **FUNCTION WHITELIST (If Using Smart Wallet Policies)**

### **Functions Users Will Call:**

#### **On StrategyDeploymentBatcher:**
```solidity
function batchDeployStrategies(
    address underlyingToken,
    address quoteToken,
    address creatorVault,
    address _ajnaFactory,
    uint24 v3FeeTier,
    uint160 initialSqrtPriceX96,
    address owner,
    string memory vaultName,
    string memory vaultSymbol
) external
```

#### **On VaultActivationBatcher:**
```solidity
function batchActivate(
    address creatorToken,
    address vault,
    address wrapper,
    address ccaStrategy,
    uint256 depositAmount,
    uint8 auctionPercent,
    uint128 requiredRaise
) external
```

#### **On CreatorVaultBatcher (deploy + launch):**
```solidity
function deployAndLaunch(...) external returns (...)
function deployAndLaunchWithPermit2(...) external returns (...)
```

#### **On CharmAlphaVault (if needed):**
```solidity
function acceptGovernance() external
```

**If using smart wallet with function-level controls, whitelist these.**

---

## 5️⃣ **CONTRACT ADDRESSES TO WHITELIST**

### **Contracts Users Will Interact With:**

```javascript
const WHITELIST = {
    // Your deployed contracts
    strategyDeploymentBatcher: "0x...",
    vaultActivationBatcher: "0x...",
    creatorVaultBatcher: "0x...",
    
    // Base protocol contracts (already deployed)
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    UNISWAP_V3_FACTORY: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    UNISWAP_ROUTER: "0x2626664c2603336E57B271c5C0b26F421741e481",
    
    // User's tokens (dynamic per creator)
    creatorToken: "0x...",  // AKITA, DOGE, etc.
    creatorVault: "0x...",  // Their CreatorOVault
    
    // Optional: Ajna factory
    ajnaFactory: "0x..."
};
```

---

## 6️⃣ **APPROVAL CHECKLIST**

### **Before Launch:**

- [ ] 1. Deploy StrategyDeploymentBatcher
- [ ] 2. Deploy VaultActivationBatcher
- [ ] 3. Deploy CCALaunchStrategy (per vault)
- [ ] 4. **Call `setApprovedLauncher()` on CCA** ⚠️ **CRITICAL!**
- [ ] 5. (Optional) Set up smart wallet session keys
- [ ] 6. (Optional) Configure gas sponsorship
- [ ] 7. (Optional) Whitelist contracts in smart wallet
- [ ] 8. (Optional) Set spending limits

### **Before Each User Deployment:**

- [ ] 1. User approves their CREATOR token to StrategyDeploymentBatcher
- [ ] 2. User calls `batchDeployStrategies()`
- [ ] 3. User calls `acceptGovernance()` on CharmAlphaVault (if not automated)
- [ ] 4. (Optional) User approves for vault activation
- [ ] 5. (Optional) User calls `batchActivate()` for CCA launch

---

## 7️⃣ **SMART CONTRACT APPROVALS SUMMARY**

| Contract | Function | What It Does | Required |
|----------|----------|--------------|----------|
| **CCALaunchStrategy** | `setApprovedLauncher()` | Allow VaultActivationBatcher | ✅ **YES** |
| **CreatorToken** | `approve()` | Allow batcher to pull tokens | ✅ **YES** (user) |
| **CharmAlphaVault** | `acceptGovernance()` | Take ownership of vault | ⚠️ **If not automated** |

---

## 8️⃣ **DEPLOYMENT SCRIPT WITH APPROVALS**

```javascript
// Step 1: Deploy contracts
const batcher = await deploy("StrategyDeploymentBatcher");
const activationBatcher = await deploy("VaultActivationBatcher");
const cca = await deploy("CCALaunchStrategy", [/* params */]);

// Step 2: CRITICAL - Approve batcher for CCA
await cca.setApprovedLauncher(activationBatcher.address, true);
console.log("✅ VaultActivationBatcher approved for CCA");

// Step 3: (Optional) Setup smart wallet policies
if (usingSmartWallet) {
    await smartWallet.whitelistContract(batcher.address);
    await smartWallet.whitelistContract(activationBatcher.address);
    console.log("✅ Contracts whitelisted in smart wallet");
}

// Step 4: User approves their token
await creatorToken.connect(user).approve(
    batcher.address,
    ethers.constants.MaxUint256
);
console.log("✅ User approved CREATOR token");

// Step 5: Deploy strategies
await batcher.connect(user).batchDeployStrategies(
    creatorToken.address,
    USDC,
    vault.address,
    ajnaFactory,
    3000,
    sqrtPrice,
    user.address,
    "CreatorVault: akita/USDC",
    "CV-akita-USDC"
);
console.log("✅ Strategies deployed!");
```

---

## 9️⃣ **COINBASE SMART WALLET SPECIFIC**

### **If Using Coinbase Smart Wallet:**

#### **A. Session Keys Setup:**
```javascript
// Allow batch transactions without signing each
await smartWallet.grantSessionKey(
    sessionKey,
    [batcher.address, activationBatcher.address],
    86400  // 24 hours
);
```

#### **B. Paymaster Setup:**
```javascript
// Enable gasless transactions
await paymaster.approveContract(
    batcher.address,
    true  // Allow sponsorship
);
```

#### **C. Spending Limits:**
```javascript
// Set daily spending limit
await smartWallet.setSpendingLimit(
    ethers.utils.parseEther("1000"),  // Max 1000 tokens/day
    86400  // Daily
);
```

**These are OPTIONAL but improve UX.**

---

## 🔟 **MULTISIG APPROVALS**

### **If Using Your Multisig (0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3):**

You'll need to approve:

1. **CCALaunchStrategy.setApprovedLauncher(batcher, true)**
   - Requires: Multisig signatures
   - When: After CCA deployment

2. **CharmAlphaVault.acceptGovernance()**
   - Requires: Multisig signatures
   - When: After strategy deployment
   - Note: Only if you own the vault (not creator)

---

## 📊 **APPROVAL FLOW DIAGRAM**

```
┌─────────────────────────────────────┐
│  1. Deploy Core Contracts           │
│     - StrategyDeploymentBatcher     │
│     - VaultActivationBatcher        │
│     - CCALaunchStrategy             │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│  2. CRITICAL APPROVAL                │
│     CCA.setApprovedLauncher(...)    │ ⚠️ MUST DO THIS!
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│  3. (Optional) Smart Wallet Setup   │
│     - Session keys                  │
│     - Paymaster                     │
│     - Spending limits               │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│  4. User Token Approval              │
│     Token.approve(batcher, max)     │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│  5. Deploy Strategies                │
│     batchDeployStrategies(...)      │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│  6. (If needed) Accept Governance   │
│     Vault.acceptGovernance()        │
└─────────────────────────────────────┘
```

---

## ⚠️ **CRITICAL APPROVALS SUMMARY**

### **MUST DO:**
1. ✅ **CCA.setApprovedLauncher(VaultActivationBatcher, true)**
   - Without this, vault activation will FAIL
   - Do this after deploying CCALaunchStrategy

### **USER MUST DO:**
2. ✅ **CreatorToken.approve(StrategyDeploymentBatcher, amount)**
   - Without this, deployment will FAIL
   - User does this before calling batchDeployStrategies

### **OPTIONAL (BUT RECOMMENDED):**
3. ⚠️ Whitelist contracts in smart wallet (if using)
4. ⚠️ Set up session keys (if using)
5. ⚠️ Configure paymaster (if using)

---

## 🎯 **QUICK ANSWER:**

### **"What do I need to approve on Coinbase CDP?"**

**Required:**
1. ✅ Call `CCALaunchStrategy.setApprovedLauncher(batcherAddress, true)`

**Optional (for better UX):**
2. ⚠️ Whitelist StrategyDeploymentBatcher in smart wallet
3. ⚠️ Whitelist VaultActivationBatcher in smart wallet
4. ⚠️ Set up session keys for batch transactions
5. ⚠️ Configure paymaster for gasless transactions

**Users will need to:**
6. ✅ Approve their CREATOR token to StrategyDeploymentBatcher

---

**The ONLY critical approval is the CCA approval (#1). Everything else is optional!** ✅

