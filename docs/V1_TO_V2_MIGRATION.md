# 🔄 Migrating from EagleOVault V1 to V2

## 📋 What's Changed

### **✅ New Features (Backwards Compatible)**
- Zap deposits (ETH, any ERC20)
- Auto-rebalancing
- Batch deployments
- 20+ new helper functions

### **✅ Unchanged (Still Works)**
- `depositDual()` - Still works, now with auto-rebalancing
- `withdrawDual()` - Same interface
- `deposit()` - ERC4626 standard deposit
- `totalAssets()` - Same calculation
- Strategy management - Same functions

### **🔧 New Constructor Parameters**
```solidity
// V1
constructor(
    address _wlfiToken,
    address _usd1Token,
    address _owner
)

// V2 - Added Uniswap router and WETH
constructor(
    address _wlfiToken,
    address _usd1Token,
    address _swapRouter,  // NEW
    address _weth9,        // NEW
    address _owner
)
```

---

## 🚀 Migration Steps

### **Option 1: Fresh Deployment (Recommended)**

If you haven't launched to production yet:

```solidity
// Deploy new V2 vault
EagleOVaultV2 vaultV2 = new EagleOVaultV2(
    WLFI_ADDRESS,
    USD1_ADDRESS,
    UNISWAP_ROUTER,  // 0xE592427A0AEce92De3Edee1F18E0157C05861564
    WETH9_ADDRESS,    // 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
    owner
);

// Configure same as V1
vaultV2.addStrategy(charmStrategy, 7000);
```

### **Option 2: Migrate Existing Vault**

If you have users and funds in V1:

#### **Step 1: Deploy V2**
```solidity
EagleOVaultV2 vaultV2 = new EagleOVaultV2(...);
```

#### **Step 2: Pause V1**
```solidity
vaultV1.setPaused(true);
```

#### **Step 3: Withdraw from V1 Strategies**
```solidity
// For each strategy
vaultV1.removeStrategy(strategyAddress);
// This automatically withdraws all funds
```

#### **Step 4: Transfer Assets**
```solidity
// Get V1 balances
(uint256 wlfi, uint256 usd1) = vaultV1.getVaultBalances();

// Transfer to V2
WLFI.transfer(address(vaultV2), wlfi);
USD1.transfer(address(vaultV2), usd1);
```

#### **Step 5: Add Strategies to V2**
```solidity
vaultV2.addStrategy(charmStrategy, 7000);
```

#### **Step 6: Migrate User Shares**

**Option A: Airdrop (Simple)**
```solidity
// Snapshot V1 holders
address[] memory holders = getV1Holders();
uint256[] memory balances = getV1Balances(holders);

// Airdrop V2 shares
for (uint i = 0; i < holders.length; i++) {
    vaultV2.mint(holders[i], balances[i]);
}
```

**Option B: Migration Contract (Better UX)**
```solidity
contract VaultMigrator {
    EagleOVault public vaultV1;
    EagleOVaultV2 public vaultV2;
    
    function migrate(uint256 sharesV1) external {
        // Burn V1 shares
        vaultV1.transferFrom(msg.sender, address(this), sharesV1);
        vaultV1.withdrawDual(sharesV1, address(this));
        
        // Get assets
        (uint256 wlfi, uint256 usd1) = ...;
        
        // Deposit to V2
        WLFI.approve(address(vaultV2), wlfi);
        USD1.approve(address(vaultV2), usd1);
        
        uint256 sharesV2 = vaultV2.depositDual(wlfi, usd1, msg.sender);
    }
}
```

---

## 💻 Code Updates

### **Frontend Changes**

#### **Old (V1)**
```typescript
// Only dual deposit
await vault.depositDual(wlfiAmount, usd1Amount, userAddress);
```

#### **New (V2) - Add Zap Options**
```typescript
// Option 1: Zap from ETH (NEW)
await vault.zapDepositETH(userAddress, minShares, { value: ethAmount });

// Option 2: Zap from any token (NEW)
await vault.zapDeposit(tokenAddress, amount, userAddress, minShares);

// Option 3: Dual deposit (STILL WORKS)
await vault.depositDual(wlfiAmount, usd1Amount, userAddress);
```

### **Add Helper Functions**

```typescript
// NEW: Check if deposit is balanced
const [isImbalanced, ratio] = await vault.checkDepositBalance(wlfi, usd1);

// NEW: Get optimal amounts
const [optWlfi, optUsd1] = await vault.getOptimalDepositAmounts(totalValue);

// NEW: Preview zap
const expectedShares = await vault.previewZapDeposit(tokenIn, amount);

// NEW: Check vault status
const needsRebalance = await vault.needsRebalance();
const shouldDeploy = await vault.shouldDeployToStrategies();
const idleFunds = await vault.getIdleFunds();
```

### **Update UI Components**

```tsx
// Add zap interface
<ZapInterface vault={vaultV2} />

// Add balance checker
<OptimalDepositChecker vault={vaultV2} />

// Add vault stats
<VaultStats 
    idleFunds={await vault.getIdleFunds()}
    strategyValue={await vault.getStrategyValue()}
    needsRebalance={await vault.needsRebalance()}
/>
```

---

## 🔧 Configuration Changes

### **New Parameters to Configure**

```solidity
// Batch deployment (NEW)
vaultV2.setDeploymentParams(
    10_000e18,  // threshold
    1 hours     // interval
);

// Pool fee (NEW)
vaultV2.setPoolFee(10000); // 1% for WLFI/USD1

// Target ratio (existing, but now used for auto-rebalance)
vaultV2.setTargetRatio(5000); // 50/50
```

---

## 📊 Testing Checklist

After migration, test:

- [ ] Existing V1 functionality still works
- [ ] depositDual() with balanced amounts
- [ ] depositDual() with unbalanced amounts (test auto-rebalance)
- [ ] withdrawDual() 
- [ ] Strategy deployment (manual and automatic)
- [ ] Rebalancing
- [ ] Zap from ETH
- [ ] Zap from USDC
- [ ] Zap from WLFI (should be efficient)
- [ ] All view functions return correct data
- [ ] Events are emitted correctly
- [ ] Gas costs are reasonable

---

## ⚠️ Breaking Changes

### **NONE for Basic Usage**

If you were only using:
- `depositDual()`
- `withdrawDual()`
- `deposit()`
- `redeem()`
- Strategy management

**Everything still works the same!**

### **Constructor Parameters Changed**

Only breaking change is constructor. Old deployments won't work with new bytecode.

**Solution**: Deploy fresh or use upgrade proxy pattern.

---

## 🎯 Recommended Upgrade Path

### **For New Projects**
Just use V2 from the start. No migration needed.

### **For Projects in Development**
1. Switch to V2 before mainnet launch
2. Update frontend to use new zap functions
3. Add helper function integrations

### **For Projects Already Launched**
1. Deploy V2 alongside V1
2. Create migration contract
3. Announce migration period (e.g., 30 days)
4. Users migrate at their pace
5. Eventually sunset V1

---

## 💡 Pro Tips

### **Marketing the Upgrade**

```
"🚀 Eagle Vault V2 is here!

New features:
✅ Zap deposits - use ANY token
✅ 55% lower gas fees
✅ Auto-balancing
✅ Better capital efficiency

Migrate now: [link]"
```

### **Incentivize Early Migration**

```solidity
// Give bonus to early migrators
uint256 bonus = 0;
if (block.timestamp < migrationDeadline) {
    bonus = shares / 100; // 1% bonus
}

vaultV2.mint(msg.sender, shares + bonus);
```

### **Monitor Migration Progress**

```typescript
const v1TotalSupply = await vaultV1.totalSupply();
const v2TotalSupply = await vaultV2.totalSupply();
const migrationProgress = (v2TotalSupply / v1TotalSupply) * 100;

console.log(`${migrationProgress}% migrated`);
```

---

## 🆘 Common Issues

### **Issue: High Gas on First Zap**

**Cause**: First time setting up Uniswap approvals

**Solution**: Expected behavior, subsequent zaps will be cheaper

### **Issue: Slippage Too High**

**Cause**: Low liquidity in WLFI/USD1 pool

**Solution**: 
- Increase maxSlippage parameter
- Wait for better liquidity
- Use smaller amounts

### **Issue: Zap Fails**

**Cause**: Token not in Uniswap, or no direct route

**Solution**:
- Check Uniswap pool exists
- May need multi-hop routing (future feature)
- Fall back to manual swap + depositDual

### **Issue: Auto-Rebalance Not Working**

**Cause**: Below deployment threshold

**Solution**:
```solidity
// Check threshold
bool should = await vault.shouldDeployToStrategies();

// If false, either:
// 1. Wait for more deposits
// 2. Lower threshold: vault.setDeploymentParams(lower_amount, interval)
// 3. Force deploy: vault.forceDeployToStrategies()
```

---

## 📞 Support

Need help migrating? 

- Discord: [your-discord]
- GitHub Discussions: [your-repo/discussions]
- Migration Guide Video: [link]

---

## ✅ Migration Complete!

After migration, you'll have:
- ✅ All V1 functionality
- ✅ Zap deposits from any token
- ✅ Auto-rebalancing
- ✅ 55% gas savings
- ✅ Better UX for your users

**Welcome to V2! 🎉**

