# 🚨 PRE-LAUNCH VERIFICATION

## Critical Questions Answered

---

## ❓ Question 1: Will Strategies Actually Deploy?

### **SHORT ANSWER: ⚠️ ONLY IF STRATEGIES ARE PRE-CONFIGURED**

### **What the Code Does:**

```typescript
// In ActivateAkita.tsx - Step 3:
{
  to: AKITA.vault as `0x${string}`,
  data: encodeFunctionData({
    abi: VAULT_ABI,
    functionName: 'forceDeployToStrategies',
    args: [],
  }),
  value: 0n,
}
```

This calls `forceDeployToStrategies()` on the vault, which:

1. **Loops through existing strategies** in the strategy queue
2. **Deploys idle funds** to each strategy
3. **Does NOT create new strategies**

### **The Problem:**

**The vault needs strategies to be added BEFORE activation!**

```solidity
// In CreatorOVault.sol
function addStrategy(
    address newStrategy,
    bool performHealthCheck
) external onlyManagement {
    // Adds strategy to the queue
    strategies[newStrategy].activation = block.timestamp;
    strategyQueue.push(newStrategy);
}
```

**Strategies must be added via `addStrategy()` BEFORE calling `forceDeployToStrategies()`**

---

## 🔴 **CRITICAL ISSUE IDENTIFIED:**

### **The Activation Flow Does NOT Deploy Strategies!**

**What happens:**
1. ✅ User deposits 50M AKITA
2. ❌ `forceDeployToStrategies()` is called but strategy queue is EMPTY
3. ❌ Nothing is deployed (funds stay idle in vault)
4. ✅ Vault shares are wrapped to wsAKITA
5. ✅ CCA auction launches

**Result: All 50M AKITA sits idle in the vault, NOT deployed to strategies!**

---

## ❓ Question 2: Are We Selling Any Tokens?

### **SHORT ANSWER: ✅ NO, NO TOKENS ARE SOLD**

### **What Actually Happens:**

**Launch Flow:**
1. Creator deposits 50M AKITA → vault
2. Vault mints 50M sAKITA shares → creator
3. Creator wraps 50M sAKITA → 50M wsAKITA
4. 25M wsAKITA → CCA auction
5. 25M wsAKITA → stays in creator's wallet

**CCA Auction:**
- Users bid ETH for wsAKITA
- wsAKITA is **distributed**, not sold by creator
- ETH raised goes to **liquidity pool**, not to creator
- Creator keeps their 25M wsAKITA

**After Auction:**
- V4 pool created with:
  - wsAKITA from auction
  - ETH raised from auction
- Creator does NOT receive the ETH
- Creator does NOT sell their 25M wsAKITA

### **So NO, Creator Is NOT Selling:**
✅ Creator deposits AKITA (doesn't sell)
✅ Creator receives wsAKITA (doesn't sell)
✅ Creator keeps 25M wsAKITA (doesn't sell)
✅ CCA distributes other 25M wsAKITA (not a sale by creator)

**The creator is LAUNCHING the ecosystem, not selling tokens.**

---

## 🛠️ **REQUIRED FIXES BEFORE LAUNCH:**

### **Fix 1: Pre-Configure Strategies**

**You MUST deploy and add strategies to the vault BEFORE activation:**

```bash
# 1. Deploy Charm WETH Strategy
forge script DeployCharmStrategy.s.sol \
  --rpc-url $BASE_RPC \
  --broadcast \
  --verify \
  --constructor-args $AKITA_VAULT $WETH_ADDRESS

# 2. Add to vault
cast send $AKITA_VAULT \
  "addStrategy(address,bool)" \
  $CHARM_WETH_STRATEGY \
  true \
  --rpc-url $BASE_RPC \
  --private-key $PRIVATE_KEY

# 3. Repeat for USDC, Ajna, etc.
```

**OR use the deployment batcher:**

```typescript
// Use DeployStrategies.tsx component
// This deploys all 3 strategies and adds them to vault
```

### **Fix 2: Verify Strategy Queue**

**Before launching, verify strategies are configured:**

```bash
# Check strategy count
cast call $AKITA_VAULT "getStrategyCount()" --rpc-url $BASE_RPC

# Check specific strategy
cast call $AKITA_VAULT "strategies(address)" $STRATEGY_ADDRESS --rpc-url $BASE_RPC

# List all strategies
cast call $AKITA_VAULT "getStrategyQueue()" --rpc-url $BASE_RPC
```

**Expected result: 3-4 strategies in queue**

---

## ✅ **CORRECTED LAUNCH CHECKLIST:**

### **BEFORE Activation:**

- [ ] **Deploy Charm WETH Strategy**
  - Contract deployed
  - Verified on Basescan
  - Address saved

- [ ] **Deploy Charm USDC Strategy**
  - Contract deployed
  - Verified on Basescan
  - Address saved

- [ ] **Deploy Ajna Strategy**
  - Contract deployed
  - Pool created (if needed)
  - Verified on Basescan
  - Address saved

- [ ] **Add All Strategies to Vault**
  - `vault.addStrategy(charmWETH, true)`
  - `vault.addStrategy(charmUSDC, true)`
  - `vault.addStrategy(ajna, true)`

- [ ] **Set Strategy Allocations**
  - Each strategy: 25% (2500 bps)
  - Total: 75% (7500 bps)
  - 25% stays idle

- [ ] **Set Minimum Idle**
  - `vault.setMinimumTotalIdle(12.5M * 1e18)`

- [ ] **Verify Configuration**
  - Check strategy count
  - Check allocations
  - Check minimum idle
  - Test deposit (small amount)

### **DURING Activation:**

- [ ] User has 50M AKITA
- [ ] User clicks "Launch Auction"
- [ ] Transaction succeeds
- [ ] Verify wsAKITA balance (25M)
- [ ] Verify auction is live

### **AFTER Activation:**

- [ ] Check vault strategies
- [ ] Verify AKITA is deployed (not idle)
- [ ] Monitor auction
- [ ] Prepare for Day 7 completion

---

## 🚨 **CURRENT STATUS:**

### **What Works:**
✅ Vault contract deployed
✅ Wrapper contract deployed
✅ ShareOFT (wsAKITA) deployed
✅ CCA Strategy deployed
✅ Frontend UI ready

### **What's Missing:**
❌ Strategy contracts NOT deployed
❌ Strategies NOT added to vault
❌ Strategy allocations NOT set
❌ Minimum idle NOT configured

### **What Happens If You Launch Now:**
⚠️ Activation will succeed
⚠️ Auction will launch
⚠️ BUT: All AKITA stays idle in vault
⚠️ No yield generation
⚠️ Strategies section shows 0% deployed

---

## 💡 **RECOMMENDED ACTION PLAN:**

### **Option A: Deploy Strategies First (RECOMMENDED)**

**Timeline: 2-4 hours**

1. Deploy 3 strategy contracts (1 hour)
2. Add strategies to vault (30 min)
3. Set allocations and test (30 min)
4. Verify everything (30 min)
5. THEN launch activation

**Pros:**
✅ Everything works as shown in UI
✅ Professional launch
✅ Yield generation starts immediately
✅ No surprises

**Cons:**
⏱️ Delays launch by a few hours

---

### **Option B: Launch Without Strategies (NOT RECOMMENDED)**

**Timeline: Immediate**

1. Launch activation now
2. Auction runs with idle AKITA
3. Deploy strategies later
4. Manually deploy funds after launch

**Pros:**
✅ Launch immediately

**Cons:**
❌ Misleading to users (UI shows strategies)
❌ No yield generation
❌ Manual intervention needed
❌ Looks unprofessional
❌ May lose user confidence

---

## 🎯 **MY STRONG RECOMMENDATION:**

### **Deploy Strategies First!**

**Use the existing `DeployStrategies.tsx` component:**

1. Go to a dedicated deployment page
2. Click "Deploy All Strategies"
3. Single transaction deploys:
   - Charm WETH Strategy
   - Charm USDC Strategy
   - Ajna Strategy
4. Adds them to vault
5. Sets allocations
6. THEN launch activation

**This takes 1-2 hours but ensures:**
✅ Professional launch
✅ Everything works as promised
✅ Users see real yield immediately
✅ No manual fixes needed later

---

## 📋 **FINAL VERIFICATION SCRIPT:**

```bash
#!/bin/bash
# Run this BEFORE launching

echo "Checking AKITA Vault Configuration..."

# 1. Check strategies
STRATEGY_COUNT=$(cast call $AKITA_VAULT "getStrategyCount()" --rpc-url $BASE_RPC)
echo "Strategy count: $STRATEGY_COUNT"

if [ "$STRATEGY_COUNT" -lt 3 ]; then
  echo "❌ ERROR: Less than 3 strategies configured!"
  echo "Deploy strategies first!"
  exit 1
fi

# 2. Check minimum idle
MIN_IDLE=$(cast call $AKITA_VAULT "minimumTotalIdle()" --rpc-url $BASE_RPC)
echo "Minimum idle: $MIN_IDLE"

# 3. Check each strategy allocation
echo "Strategy allocations:"
cast call $AKITA_VAULT "getStrategyQueue()" --rpc-url $BASE_RPC

echo ""
echo "✅ Vault is properly configured!"
echo "Safe to launch activation."
```

---

## ✅ **ANSWER TO YOUR QUESTIONS:**

### **Q1: Will strategies be deployed as promised?**
**A: ⚠️ NO, not unless you deploy and configure them FIRST.**

Currently, the strategy contracts don't exist. When you call `forceDeployToStrategies()`, it will do nothing because the strategy queue is empty.

**You must deploy strategies BEFORE activation.**

### **Q2: Are we selling any tokens?**
**A: ✅ NO, you are NOT selling any tokens.**

You are:
- Depositing AKITA to vault
- Receiving wsAKITA shares
- Launching a fair distribution auction
- Keeping 25M wsAKITA yourself

The CCA distributes wsAKITA to the community, but YOU are not selling. The ETH raised goes to liquidity, not to you.

---

## 🚀 **NEXT STEPS:**

1. **Deploy strategies first** (use `DeployStrategies.tsx`)
2. **Verify configuration** (run verification script)
3. **THEN launch activation** (when everything is ready)

Would you like me to help you deploy the strategies first?

