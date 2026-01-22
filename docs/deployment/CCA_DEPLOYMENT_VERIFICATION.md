# 🔍 **CCA Deployment Deep Verification (Base / Uniswap v1.1.0)**

## ✅ **CCA Flow is CORRECT (current code)**

This document is a sanity-check of the on-chain flow from vault activation → CCA auction creation, and the key deployment/config requirements for Base.

---

## 📊 **The Complete CCA Launch Flow**

### **Step-by-Step Breakdown:**

```
User → VaultActivationBatcher.batchActivate()
    ↓
1. Pull CREATOR tokens from user
    ↓
2. Deposit to CreatorOVault
   → Receive vault shares (sTokens)
    ↓
3. Wrap shares via CreatorOVaultWrapper
   → Receive ■TOKEN (ShareOFT)
    ↓
4. Approve CCA strategy to spend ■TOKEN
    ↓
5. Call CCALaunchStrategy.launchAuctionSimple()
    ↓
    → CCALaunchStrategy.launchAuction()
        ↓
        a. Transfer ■TOKEN from batcher to CCALaunchStrategy
        b. Approve CCA_FACTORY to spend ■TOKEN
        c. Call CCA_FACTORY.initializeDistribution()
        d. Returns auction address
    ↓
6. Return remaining ■TOKEN to user
```

---

## ✅ **Authorization model (no longer onlyOwner)**

`CCALaunchStrategy.launchAuctionSimple()` is gated by `onlyApprovedOrOwner`:
- The **owner** can launch auctions directly.
- The **VaultActivationBatcher** can launch auctions after it is approved via `setApprovedLauncher(batcher, true)`.

### ✅ Required deployment step

From your protocol owner / multisig:

```solidity
ccaStrategy.setApprovedLauncher(vaultActivationBatcherAddress, true);
```

---

## 🧩 **Factory address (Uniswap v1.1.0)**

Uniswap’s fully-live CCA factory on Base is:
- `0xcca1101C61cF5cb44C968947985300DF945C3565`

Our `CCALaunchStrategy` now stores the factory in **state** (`ccaFactory`) and defaults to v1.1.0. If Uniswap ships a new factory, the owner can update it via `setCcaFactory(newFactory)` without redeploying the strategy.

## 🚨 **What can still break deployment**

### **Current Setup:**
```solidity
// VaultActivationBatcher (line 117)
auction = ICCAStrategy(ccaStrategy).launchAuctionSimple(auctionAmount, requiredRaise);
```

### **If you forget `setApprovedLauncher`**

`VaultActivationBatcher.batchActivate()` will revert when it tries to call `launchAuctionSimple()`.

### **If defaults are misconfigured**

Uniswap CCA expects **Q96** pricing for `floorPrice` and `tickSpacing`. Our strategy defaults now use Q96, and the default issuance schedule includes a **large final block** issuance to reduce end-price manipulability (per Uniswap guidance).

---

## ✅ Summary

The happy path is:
1. User calls `VaultActivationBatcher.batchActivate(...)`
2. Batcher deposits → wraps → approves strategy
3. Strategy creates auction via `ccaFactory.initializeDistribution(...)`
4. Remaining ■TOKEN is returned to the user

Deployment must ensure:
- `ccaStrategy.setApprovedLauncher(vaultActivationBatcher, true)`
- `ccaStrategy.ccaFactory == 0xcca1101C...3565` (v1.1.0)

```solidity
// In CCALaunchStrategy.sol
mapping(address => bool) public approvedLaunchers;

modifier onlyApprovedOrOwner() {
    require(msg.sender == owner() || approvedLaunchers[msg.sender], "Not approved");
    _;
}

function setApprovedLauncher(address launcher, bool approved) external onlyOwner {
    approvedLaunchers[launcher] = approved;
}

function launchAuctionSimple(
    uint256 amount,
    uint128 requiredRaise
) external onlyApprovedOrOwner nonReentrant returns (address auction) {
    // ...
}
```

**Pros:**
- ✅ Controlled access
- ✅ Owner can approve VaultActivationBatcher
- ✅ Multiple batchers can be approved

**Cons:**
- ⚠️ Requires deployment update
- ⚠️ Extra step to approve batcher

---

### **Option 3: Two-Step Process (No Code Changes)**

```solidity
// Step 1: User deposits/wraps manually
vault.deposit(amount, user);
wrapper.wrap(shares);

// Step 2: User approves CCALaunchStrategy
shareOFT.approve(ccaStrategy, auctionAmount); // ■TOKEN

// Step 3: Owner (creator) launches auction with user's tokens
ccaStrategy.launchAuctionSimple(auctionAmount, requiredRaise);
```

**Pros:**
- ✅ No code changes needed
- ✅ Works with current contract

**Cons:**
- ❌ Not a single transaction
- ❌ User must do multiple steps
- ❌ Not as smooth UX

---

## 🎯 **Recommended Solution**

### **Update CCALaunchStrategy to Use Approved Launchers**

This gives you the best of both worlds:
- ✅ Security (only approved addresses can launch)
- ✅ Flexibility (approve VaultActivationBatcher)
- ✅ Single transaction UX

### **Implementation:**

```solidity
// Add to CCALaunchStrategy.sol

mapping(address => bool) public approvedLaunchers;

event LauncherApproved(address indexed launcher, bool approved);

modifier onlyApprovedOrOwner() {
    require(msg.sender == owner() || approvedLaunchers[msg.sender], "Not approved");
    _;
}

function setApprovedLauncher(address launcher, bool approved) external onlyOwner {
    approvedLaunchers[launcher] = approved;
    emit LauncherApproved(launcher, approved);
}

function launchAuctionSimple(
    uint256 amount,
    uint128 requiredRaise
) external onlyApprovedOrOwner nonReentrant returns (address auction) {
    // Transfer tokens from caller
    auctionToken.safeTransferFrom(msg.sender, address(this), amount);
    
    // Create default linear auction steps
    bytes memory auctionSteps = _createLinearSteps(defaultDuration);
    
    // Use default floor price
    uint256 floorPrice = defaultFloorPrice;
    
    // Forward to main function
    return this.launchAuction(amount, floorPrice, requiredRaise, auctionSteps);
}
```

Then after deployment:
```solidity
ccaStrategy.setApprovedLauncher(address(vaultActivationBatcher), true);
```

---

## ✅ **After Fix: Complete Flow Will Work**

```
1. Deploy CCALaunchStrategy (with approved launchers)
2. Deploy VaultActivationBatcher
3. Call ccaStrategy.setApprovedLauncher(batcherAddress, true)
4. User calls batcher.batchActivate()
    ↓
5. Batcher pulls tokens ✅
6. Batcher deposits to vault ✅
7. Batcher wraps to ■TOKEN ✅
8. Batcher approves CCA strategy ✅
9. Batcher calls launchAuctionSimple() ✅
10. CCA checks: msg.sender (batcher) is approved ✅
11. CCA pulls ■TOKEN from batcher ✅
12. CCA creates auction ✅
13. Returns auction address ✅
14. Batcher returns remaining tokens to user ✅

SUCCESS! 🎉
```

---

## 📋 **Verification Summary**

| Component | Status | Issue |
|-----------|--------|-------|
| **VaultActivationBatcher** | ✅ Correct | None |
| **Token Flow** | ✅ Correct | None |
| **Approval Flow** | ✅ Correct | None |
| **CCALaunchStrategy** | ⚠️ **Needs Fix** | **onlyOwner blocks batcher** |

---

## 🎯 **Action Required**

**To deploy CCA with AA batcher:**

1. ✅ **Update CCALaunchStrategy** to use approved launchers
2. ✅ **Deploy both contracts**
3. ✅ **Approve VaultActivationBatcher** in CCALaunchStrategy
4. ✅ **Test via AA**

**OR**

Use **Option 3** (two-step process) with current contracts, but worse UX.

---

## 💡 **Bottom Line**

**The code logic is correct, BUT:**
- ❌ Current CCALaunchStrategy won't work with VaultActivationBatcher
- ✅ Easy fix: Add approved launchers mapping
- ✅ After fix: Everything will deploy correctly via AA

**Current status: CCA needs 1 contract update before AA deployment works.** 🔧

