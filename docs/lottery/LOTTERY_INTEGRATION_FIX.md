# Lottery Integration Fix

## 🐛 **Issue Found**

The `ShareOFT` contract was calling the `CreatorLotteryManager` with an **incorrect interface**.

### **Before (BROKEN):**

```solidity
// ❌ Wrong interface
interface ICreatorLotteryManager {
    function processSwapLottery(address recipient, address token, uint256 amount) 
        external returns (uint256);
}

// ❌ Wrong call
ICreatorLotteryManager(mgr).processSwapLottery(recipient, address(this), amount)
```

### **After (FIXED):**

```solidity
// ✅ Correct interface
interface ICreatorLotteryManager {
    function processSwapLottery(
        address creatorCoin,  // The underlying creator token (AKITA)
        address trader,       // The buyer
        address tokenIn,      // The token being bought (wsAKITA)
        uint256 amountIn      // Amount bought
    ) external payable returns (uint256);
}

// ✅ Correct call with creator coin lookup
address creatorCoin = vault != address(0) ? ICreatorOVault(vault).asset() : address(0);
ICreatorLotteryManager(mgr).processSwapLottery(
    creatorCoin,      // e.g., AKITA token address
    recipient,        // Buyer address
    address(this),    // wsAKITA (ShareOFT)
    amount            // Amount of wsAKITA bought
)
```

---

## 🔧 **What Was Fixed**

### **1. Updated Interface** (`CreatorShareOFT.sol`)
- Changed `ICreatorLotteryManager` interface to match the actual contract
- Added `payable` modifier (lottery may require gas fees for VRF)
- Updated parameters to match expected signature

### **2. Fixed Function Call** (`_triggerLottery`)
- Now fetches the `creatorCoin` address from the vault
- Passes correct parameters in correct order
- Validates `creatorCoin` is not zero before calling lottery

### **3. Added Vault Interface**
- Added `asset()` function to `ICreatorOVault` interface
- This allows ShareOFT to lookup the underlying creator token

---

## ✅ **How It Works Now**

### **Buy Flow with Lottery:**

```
1. User buys wsAKITA on Uniswap
   ↓
2. ShareOFT.transfer() detects it's a buy (from SwapOnly address)
   ↓
3. _processBuy() executes:
   - Takes 6.9% fee → GaugeController
   - Transfers remaining tokens to buyer
   ↓
4. _triggerLottery() executes:
   - Looks up AKITA token address from vault
   - Calls LotteryManager.processSwapLottery(AKITA, buyer, wsAKITA, amount)
   ↓
5. LotteryManager:
   - Verifies AKITA is registered & active
   - Calculates USD value using AKITA oracle
   - Creates lottery entry with probability based on trade size
   - May trigger instant win via VRF
```

---

## 🧪 **Testing Checklist**

### **Unit Tests Needed:**

- [ ] `ShareOFT._triggerLottery()` calls lottery with correct parameters
- [ ] Lottery call succeeds when vault is set
- [ ] Lottery call fails gracefully when vault is not set
- [ ] Lottery call doesn't revert the transfer if it fails

### **Integration Tests Needed:**

- [ ] End-to-end buy flow:
  - User swaps ETH → wsAKITA on Uniswap
  - Fee is collected
  - Lottery entry is created
  - Transfer completes successfully

- [ ] Creator coin lookup:
  - Verify `vault.asset()` returns correct AKITA address
  - Verify lottery manager receives correct creator coin

### **Manual Testing:**

```bash
# 1. Deploy contracts
forge script script/DeployBase.s.sol --rpc-url base --broadcast

# 2. Buy wsAKITA on testnet DEX
# - Watch for LotteryTriggered event
# - Check lottery manager state

# 3. Verify parameters
cast call $LOTTERY_MANAGER "entries(uint256)" <entryId>
# Should show:
# - creatorCoin = AKITA address (0x5b67...)
# - trader = buyer address
# - tokenIn = wsAKITA address
# - amountIn = amount bought
```

---

## 📝 **Key Changes Summary**

### **File: `contracts/layerzero/CreatorShareOFT.sol`**

| Change | Before | After |
|--------|--------|-------|
| Interface params | `(recipient, token, amount)` | `(creatorCoin, trader, tokenIn, amountIn)` |
| Interface modifier | No `payable` | Added `payable` |
| Call params | `(recipient, this, amount)` | `(creatorCoin, recipient, this, amount)` |
| Creator coin | Not passed | Fetched from `vault.asset()` |
| Vault interface | No `asset()` | Added `asset()` function |

---

## 🎯 **Why This Matters**

### **Before Fix:**
- ❌ Lottery calls would **fail silently**
- ❌ No lottery entries created for buyers
- ❌ Jackpot never awarded
- ❌ Social-fi engagement broken

### **After Fix:**
- ✅ Lottery calls **succeed**
- ✅ Buyers get lottery entries
- ✅ Jackpot awards work correctly
- ✅ Social-fi engagement enabled

---

## 🚀 **Deployment Steps**

1. **Recompile contracts:**
   ```bash
   forge build
   ```

2. **Run tests:**
   ```bash
   forge test --match-contract ShareOFT
   ```

3. **Deploy to testnet first:**
   ```bash
   forge script script/DeployBase.s.sol --rpc-url base-sepolia --broadcast --verify
   ```

4. **Verify lottery integration:**
   - Make test swap
   - Check for `LotteryTriggered` event
   - Verify entry in lottery manager

5. **Deploy to mainnet:**
   ```bash
   forge script script/DeployBase.s.sol --rpc-url base --broadcast --verify
   ```

---

## 📊 **Expected Events After Fix**

When a user buys wsAKITA, you should see these events in order:

```solidity
1. Transfer(from: uniswapPool, to: feeCollector, value: feeAmount)
2. Transfer(from: uniswapPool, to: buyer, value: transferAmount)  
3. BuyFee(from: pool, to: buyer, amount: totalAmount, fee: feeAmount)
4. FeeCollected(gauge: gaugeController, amount: feeAmount)
5. LotteryTriggered(recipient: buyer, amount: transferAmount, entryId: X)
```

If `LotteryTriggered` is missing, the lottery call failed!

---

## 🔗 **Related Files**

- `contracts/layerzero/CreatorShareOFT.sol` - Main fix
- `contracts/lottery/CreatorLotteryManager.sol` - Lottery manager
- `contracts/vault/CreatorOVault.sol` - Vault (implements `asset()`)
- `contracts/governance/CreatorGaugeController.sol` - Fee recipient

---

## ⚠️ **Important Notes**

1. **Backward Compatibility:**
   - This is a **breaking change** if contracts are already deployed
   - Existing ShareOFT contracts will need to be **redeployed** or **upgraded**

2. **Upgrade Path:**
   - If using proxy pattern: Upgrade implementation
   - If not upgradeable: Deploy new ShareOFT and migrate liquidity

3. **Gas Considerations:**
   - Lottery call now includes `payable` modifier
   - May require small ETH amount for cross-chain VRF
   - Test gas costs on testnet first

---

## ✅ **Verification Commands**

After deployment, verify the fix:

```bash
# Check ShareOFT has correct lottery interface
cast abi-encode "processSwapLottery(address,address,address,uint256)" \
  $AKITA_TOKEN $BUYER $WSAKITA_TOKEN 1000000000000000000

# Make a test buy and check events
cast logs --address $WSAKITA_TOKEN --from-block latest

# Verify lottery entry was created
cast call $LOTTERY_MANAGER "entryCounter()"
```

---

**Status:** ✅ **FIXED**  
**Priority:** 🔴 **CRITICAL** - Required for lottery functionality  
**Tested:** ⏳ Pending integration tests


