# Eagle OVault LayerZero Architecture FAQ

**Status:** ✅ Current Architecture (EagleVaultWrapper Pattern)  
**Last Updated:** October 27, 2025

---

## ❓ **Why use EagleVaultWrapper instead of standard OFTAdapter?**

### **Short Answer:** ✅ We want the same EAGLE token on ALL chains!

### **Detailed Explanation:**

**Standard OFTAdapter Pattern:**
```
Hub:    Vault shares (ERC20) → OFTAdapter (lockbox)
Spokes: EagleShareOFT (different token)

Problems:
  ❌ Different token contracts on hub vs spokes
  ❌ Can't use CREATE2 for same address everywhere
  ❌ Users see "vault shares" on hub, "EAGLE" on spokes
```

**Our Eagle VaultWrapper Pattern:**
```
ALL Chains: EagleShareOFT (SAME contract, SAME address via CREATE2)
Hub Only:   EagleVaultWrapper (converts vault shares ↔ EAGLE)

Benefits:
  ✅ Same token address everywhere
  ✅ Same metadata everywhere ("EAGLE", 18 decimals)
  ✅ Consistent branding
  ✅ Better UX
```

See `../../ARCHITECTURE_DECISION.md` for full rationale.

---

## ❓ **How does EagleVaultWrapper maintain the 1:1 peg?**

### **Answer:** Through strict lock/mint and burn/unlock mechanics

```solidity
// wrap(): Lock vault shares → Mint EAGLE (1:1)
function wrap(uint256 amount) external {
    // 1. Transfer vault shares FROM user TO wrapper
    VAULT_EAGLE.transferFrom(msg.sender, address(this), amount);
    
    // 2. Mint EAGLE OFT TO user (exactly 1:1)
    OFT_EAGLE.mint(msg.sender, amount);
    
    // 3. Track balances
    totalLocked += amount;  // Must equal totalMinted
}

// unwrap(): Burn EAGLE → Release vault shares (1:1)
function unwrap(uint256 amount) external {
    // 1. Burn EAGLE OFT FROM user
    OFT_EAGLE.burn(msg.sender, amount);
    
    // 2. Transfer vault shares TO user
    VAULT_EAGLE.transfer(msg.sender, amount);
    
    // 3. Track balances
    totalLocked -= amount;
}
```

**Global Invariant:**
```
SUM(EAGLE supply on all chains) = totalLocked vault shares in wrapper

This ensures:
  ✅ No inflation (can't create EAGLE without vault shares)
  ✅ 1:1 backing (every EAGLE = 1 vault share)
  ✅ Redeemability (can always unwrap → redeem)
```

---

## ❓ **Why remove fees from EagleShareOFT?**

### **Answer:** Fees break the 1:1 peg and complicate accounting

**With Fees (❌ Problematic):**
```
User wraps 1000 vault shares → Gets 1000 EAGLE
User transfers EAGLE → Fee deducted → Receiver gets 990 EAGLE

Problem: Now what?
  - 1000 vault shares locked in wrapper
  - Only 990 EAGLE in circulation
  - What happened to the 10 EAGLE fee?
  - Unwrap accounting broken!
```

**Without Fees (✅ Clean):**
```
User wraps 1000 vault shares → Gets 1000 EAGLE
User transfers 1000 EAGLE → Receiver gets 1000 EAGLE
User bridges 1000 EAGLE → Other chain gets 1000 EAGLE
User unwraps 1000 EAGLE → Gets 1000 vault shares

Perfect 1:1 peg maintained throughout! ✅
```

**Conclusion:** No fees = simpler, more reliable, better UX.

---

## ❓ **Can I add more minters to EagleShareOFT?**

### **Answer:** ❌ NO! Only specific authorized minters.

**On Ethereum (Hub):**
```solidity
// ✅ CORRECT - Only EagleVaultWrapper is minter
eagleShareOFT.setMinter(address(eagleVaultWrapper), true);

// ❌ WRONG - Don't add other minters!
// This would break the 1:1 peg and create unbacked EAGLE
eagleShareOFT.setMinter(someOtherContract, true); // DON'T DO THIS!
```

**On Spoke Chains (Arbitrum, Base, etc.):**
```solidity
// ✅ CORRECT - NO local minters
// LayerZero endpoint handles all minting/burning automatically

// ❌ WRONG - Never add minters on spokes!
eagleShareOFT.setMinter(someContract, true); // DON'T DO THIS!
```

**Why?**
- Wrapper enforces 1:1 lock/mint ratio
- Additional minters could create unbacked EAGLE
- Breaks supply invariant
- Could drain vault reserves

---

## ❓ **Why can minters burn without allowance?**

### **Answer:** It's critical for unwrap functionality and better UX

**Standard ERC20 Burn (❌ Requires Approval):**
```solidity
// User must approve wrapper first
user: eagle.approve(wrapper, 1000);

// Then unwrap
user: wrapper.unwrap(1000);
  wrapper: eagle.burn(user, 1000); // Needs allowance
```

**Our Minter Burn (✅ No Approval Needed):**
```solidity
// User just unwraps directly
user: wrapper.unwrap(1000);
  wrapper: eagle.burn(user, 1000); // No allowance needed! ✅
```

**Benefits:**
- ✅ One transaction instead of two
- ✅ Lower gas costs (no approve TX)
- ✅ Better UX
- ✅ Still secure (only authorized minters)

**Security:**
- Only trusted contracts are minters
- Wrapper is audited
- Owner-controlled authorization

---

## ❓ **How do I deploy to a new chain?**

### **Answer:** Just deploy EagleShareOFT with the same CREATE2 salt!

**Steps:**
```bash
# 1. Use THE SAME salt as other chains
SALT="0x<YOUR_SALT_HERE>"

# 2. Deploy on new chain (e.g., Polygon)
forge create contracts/layerzero/oft/EagleShareOFT.sol:EagleShareOFT \
  --constructor-args "Eagle Vault Shares" "EAGLE" $LZ_ENDPOINT $OWNER \
  --create2 $SALT \
  --rpc-url https://polygon-rpc.com \
  --private-key $PRIVATE_KEY

# 3. DO NOT set any minters on spoke chains!

# 4. Wire LayerZero peers
pnpm hardhat lz:oapp:wire --oapp-config layerzero.config.eagle-shares.ts

# Done! ✅
```

**Important:**
- ✅ Same salt = same address on all chains
- ✅ No minters on spoke chains
- ✅ LayerZero handles all cross-chain minting

---

## ❓ **What if EagleVaultWrapper gets hacked?**

### **Answer:** Use security best practices to minimize risk

**Security Measures:**

1. **Thorough Audit**
   ```
   ⚠️  Wrapper MUST be audited by reputable firm
   ⚠️  Focus on mint/burn logic
   ⚠️  Test edge cases extensively
   ```

2. **Multi-Sig Ownership**
   ```solidity
   // Use Gnosis Safe or similar
   wrapper.transferOwnership(MULTISIG_ADDRESS);
   
   // Require 3/5 signatures for critical operations
   // - Adding minters
   // - Changing fee configuration
   // - Emergency pause
   ```

3. **Time-Locks (Optional)**
   ```solidity
   // Add time-delay for sensitive operations
   // E.g., 24-hour delay before adding new minters
   ```

4. **Emergency Pause (Optional)**
   ```solidity
   // Add pausable functionality for emergencies
   // Stops wrapping/unwrapping if issue detected
   ```

5. **Monitoring**
   ```
   ✅ Track totalLocked vs global EAGLE supply
   ✅ Alert on any mismatches
   ✅ Monitor wrapper transactions
   ```

---

## ❓ **Can users redeem EAGLE directly for WLFI/USD1?**

### **Answer:** No, they must unwrap first (by design)

**Redemption Flow:**
```
1. EAGLE on any chain
   ↓ Bridge to Ethereum (if not already there)
2. EAGLE on Ethereum
   ↓ unwrap() via EagleVaultWrapper
3. Vault shares on Ethereum
   ↓ redeem() via EagleOVault
4. WLFI/USD1 assets ✅
```

**Why this flow?**
- ✅ Maintains clean separation of concerns
- ✅ Wrapper handles EAGLE ↔ vault shares
- ✅ Vault handles vault shares ↔ assets
- ✅ Clear accounting at each layer

**Optimization Idea (Future):**
```solidity
// Could add convenience function to wrapper
function unwrapAndRedeem(uint256 eagleAmount) external {
    // 1. Burn EAGLE
    OFT_EAGLE.burn(msg.sender, eagleAmount);
    
    // 2. Use wrapper's vault shares to redeem
    uint256 assets = VAULT.redeem(eagleAmount, msg.sender, address(this));
    
    // 3. Transfer assets to user
    ASSET.transfer(msg.sender, assets);
}
```

---

## ❓ **What about LayerZero VaultComposerSync?**

### **Answer:** Still compatible, but simpler with EagleVaultWrapper

**With Wrapper:**
```
User on Arbitrum → Bridge WLFI to Ethereum
  → Composer deposits to vault
  → Vault issues shares
  → Wrapper wraps shares to EAGLE
  → Bridge EAGLE back to Arbitrum
  → User receives EAGLE ✅

Advantage: User ends up with EAGLE (tradeable, bridgeable)
```

**Traditional Approach:**
```
User on Arbitrum → Bridge WLFI to Ethereum
  → Composer deposits to vault
  → Vault issues shares
  → Bridge shares to Arbitrum
  → User receives shares

Issue: Shares may not be as liquid as EAGLE
```

---

## ❓ **How is this different from wrapped tokens (WETH, WBTC)?**

### **Answer:** Similar concept, but with vault shares instead of native assets

**WETH Example:**
```
ETH (native) → wrap → WETH (ERC20)
  Benefits: Can use in DeFi, trade on DEXs
  Mechanism: 1:1 lock/mint

EagleVaultWrapper:
Vault shares → wrap → EAGLE (OFT)
  Benefits: Can bridge cross-chain, same address everywhere
  Mechanism: 1:1 lock/mint
```

**Key Difference:**
- WETH wraps native ETH (not an ERC20)
- EagleVaultWrapper wraps vault shares (already ERC20)
- But both maintain 1:1 peg through lock/mint

---

## ❓ **Can I use EagleShareOFT as collateral on lending protocols?**

### **Answer:** Yes! That's one of the benefits.

**On Ethereum (Hub):**
```
1. Deposit WLFI → Vault → Get vault shares
2. Wrap vault shares → Wrapper → Get EAGLE
3. Deposit EAGLE → Aave/Compound → Borrow against it ✅
```

**On Spoke Chains:**
```
1. Receive EAGLE via bridge
2. Deposit EAGLE → Lending Protocol → Borrow against it ✅
```

**Benefits:**
- ✅ Same token everywhere (easy integrations)
- ✅ Can borrow on any chain
- ✅ Still backed 1:1 by vault shares
- ✅ Can unwrap and redeem anytime

---

## ❓ **What if vault share price changes?**

### **Answer:** EAGLE ↔ vault shares stays 1:1, but vault shares ↔ assets changes

**Example:**
```
Day 1: 
  1 WLFI = 1 vault share
  User deposits 1000 WLFI → Gets 1000 vault shares
  User wraps → Gets 1000 EAGLE ✅

Day 30 (After Yield):
  1 vault share = 1.1 WLFI (10% yield!)
  User still has 1000 EAGLE
  User unwraps → Gets 1000 vault shares
  User redeems → Gets 1100 WLFI ✅

EAGLE maintains 1:1 with vault shares ✅
Vault shares accrue value over time ✅
```

---

## ❓ **Can I add fees to EagleVaultWrapper?**

### **Answer:** Yes, but be careful with accounting

**Current Implementation:**
```solidity
// Wrapper has fee configuration (but set to 0)
uint256 public depositFee = 0;   // No wrap fee
uint256 public withdrawFee = 0;  // No unwrap fee
```

**If You Add Fees:**
```solidity
// E.g., 1% wrap fee
depositFee = 100; // 100 basis points

// User wraps 1000 vault shares
// Fee = 1000 * 100 / 10000 = 10 shares
// Net locked = 990 shares
// Minted EAGLE = 990 (NOT 1000!)

Result: User gets 990 EAGLE for 1000 vault shares
```

**Important:**
- ✅ Fee must be deducted from locked shares
- ✅ Only mint EAGLE for net locked amount
- ❌ Don't mint full amount if fee is charged
- ⚠️  Changes 1:1 peg behavior for users

**Recommendation:** Keep fees at 0 for simplicity and better UX.

---

## ❓ **What's the upgrade path if we find a bug?**

### **Answer:** Depends on where the bug is

**EagleShareOFT Bug:**
```
❌ Problem: EagleShareOFT is NOT upgradeable (by design)
✅ Solution: Deploy new version, migrate users

Steps:
  1. Deploy EagleShareOFTv2 with fix
  2. Migrate liquidity (DEXs, etc.)
  3. Update wrapper to use new OFT
  4. Users unwrap old → wrap new
```

**EagleVaultWrapper Bug:**
```
✅ Option 1: Deploy new wrapper
  1. Pause old wrapper
  2. Deploy WrapperV2 with fix
  3. Set new wrapper as minter
  4. Remove old wrapper from minters
  
✅ Option 2: Use proxy pattern (if implemented)
  1. Upgrade wrapper implementation
  2. No migration needed
```

**Recommendation:** 
- Use transparent upgradeable proxy for wrapper (high complexity)
- Keep OFT immutable (simpler, more trustless)

---

## ❓ **How do I verify everything is working correctly?**

### **Answer:** Monitor these key metrics

**1. Supply Invariant**
```solidity
SUM(EagleShareOFT.totalSupply() on all chains) 
  == EagleVaultWrapper.totalLocked

Check daily:
  Ethereum:  500 EAGLE
  Arbitrum:  300 EAGLE  
  Base:      200 EAGLE
  ────────────────────
  Total:     1000 EAGLE
  
  Wrapper:   1000 locked shares ✅
```

**2. Wrapper Balance**
```solidity
VAULT_EAGLE.balanceOf(wrapper) == wrapper.totalLocked

If mismatch: Someone transferred shares directly to wrapper!
```

**3. Bridge Transactions**
```bash
# Monitor LayerZero message deliveries
# Should see burn on source → mint on destination
```

**4. Redemption Success**
```
Random sampling:
  1. Bridge EAGLE to Ethereum
  2. Unwrap to vault shares
  3. Redeem to WLFI/USD1
  
  Should work 100% of the time ✅
```

---

## 📚 **Additional Resources**

- **Full Architecture:** `../../ARCHITECTURE_DECISION.md`
- **Wrapper Details:** `./WRAPPER_ARCHITECTURE.md`
- **Contract Review:** `../../EAGLESHAREOFT_REVIEW.md`
- **Deployment Guide:** `./README.md`

---

## 🆘 **Still Have Questions?**

Check:
1. Main architecture document: `../../ARCHITECTURE_DECISION.md`
2. LayerZero docs: https://docs.layerzero.network/
3. ERC4626 standard: https://eips.ethereum.org/EIPS/eip-4626
4. Our test files: `../../test/EagleShareOFT.t.sol`

---

**Status:** ✅ Production-ready  
**Architecture:** EagleVaultWrapper Pattern  
**Last Updated:** October 27, 2025
