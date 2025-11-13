# 🦅 Eagle Composer Scripts

Complete toolkit for deploying, verifying, and testing your EagleOVaultComposer.

## Scripts Overview

1. **`deployComposer.ts`** - Deploy Composer (10 min)
2. **`deployComposerCreate2.ts`** - Deploy with CREATE2 for vanity address (15 min) 🎯 NEW!
3. **`verifyComposer.ts`** - Quick verification (2 min)
4. **`testComposerLocal.ts`** - Full operation test (5 min)

---

## 1. Deploy Composer (NEW! 🎉)

### `deployComposer.ts` - Full Deployment Script

Deploys the EagleOVaultComposer with all dependencies.

```bash
npx hardhat run scripts/deployComposer.ts --network ethereum
```

**What it does:**
1. ✅ Validates all required contract addresses
2. ✅ Deploys EagleRegistry (if needed)
3. ✅ Deploys EagleOVaultComposer
4. ✅ Verifies deployment
5. ✅ Saves addresses to file
6. ✅ Provides next steps

**Prerequisites:**
- EagleOVault deployed
- EagleVaultWrapper deployed
- EagleShareOFT deployed
- WLFI Asset OFT deployed

**Configuration:**

Open `scripts/deployComposer.ts` and set your addresses:

```typescript
const ADDRESSES = {
  VAULT: "0x...",      // Your EagleOVault address
  WRAPPER: "0x...",    // Your EagleVaultWrapper address
  EAGLE_OFT: "0x...",  // Your EagleShareOFT address
  WLFI_OFT: "0x...",   // Your WLFI Asset OFT address
  REGISTRY: undefined, // Optional - will deploy if not set
  ADMIN: undefined,    // Optional - defaults to deployer
};
```

**Expected Output:**
```
🦅 Deploying EagleOVaultComposer
==================================================

📍 Network Info:
  Network: ethereum
  Chain ID: 1
  Deployer: 0x7310...
  Balance: 1.5 ETH

==================================================

🔍 Step 1: Validating Required Contracts
  ✅ EagleOVault: 0x1234...
  ✅ EagleVaultWrapper: 0x5678...
  ✅ EagleShareOFT: 0x9abc...
  ✅ WLFI Asset OFT: 0xdef0...

🔍 Step 2: Setting up EagleRegistry
  ✅ EagleRegistry deployed at: 0x1111...

🚀 Step 3: Deploying EagleOVaultComposer
  ✅ EagleOVaultComposer deployed at: 0x2222...

🔍 Step 4: Verifying Deployment
  ✅ All verifications passed!

💾 Step 5: Saving Deployment Info
  ✅ Deployment info saved to: deployments/composer-ethereum-...json
  ✅ Updated main deployments file: deployments/ethereum.json

==================================================
🎉 DEPLOYMENT SUCCESSFUL!
==================================================

📋 Deployed Addresses:
  Composer: 0x2222...
  Registry: 0x1111...

📝 Next Steps:
  1. Update test scripts
  2. Update frontend hook
  3. Verify on Etherscan
  4. Test deployment
```

---

## 2. Deploy Composer with CREATE2 (Vanity Address) 🎯

### `deployComposerCreate2.ts` - Deterministic Vanity Address Deployment

Deploy your Composer to a vanity address starting with `0x47`!

**Already done for you:**
- ✅ Rust miner found salt: `0x00000000000000000000000000000000000000000000000000000000000001a6`
- ✅ Vanity address: `0x478eaa3170c670386349d69bbd0658a0ef1c8f16`
- ✅ Script ready to use

**Deploy:**
```bash
npx hardhat run scripts/deployComposerCreate2.ts --network ethereum
```

**What it does:**
1. ✅ Validates init bytecode hash matches
2. ✅ Predicts final address (verifies it's the vanity address)
3. ✅ Deploys via Arachnid CREATE2 Factory
4. ✅ Verifies deployment succeeded
5. ✅ Saves deployment artifacts

**Expected Output:**
```
🦅 Eagle OVault Composer - CREATE2 Deployment

🎯 Expected Address: 0x478eaa3170c670386349d69bbd0658a0ef1c8f16

✅ Predicted Address: 0x478eaa3170c670386349d69bbd0658a0ef1c8f16
✅ Address matches expected vanity address!

🚀 Deploying via CREATE2 Factory...
✅ Transaction sent: 0x...
✅ Deployed in block: 12345678

✅ DEPLOYMENT SUCCESSFUL!
🎉 Composer Address: 0x478eaa3170c670386349d69bbd0658a0ef1c8f16
```

**Benefits of CREATE2:**
- ✅ Same address on all EVM chains (if you use same salt)
- ✅ Vanity address starting with `0x47` (Eagle signature)
- ✅ Predictable address before deployment
- ✅ Can pre-compute address for other chains

**Mining Your Own Vanity Address:**

See the `create2-miner/` directory for the Rust mining tool:

```bash
cd create2-miner
cargo build --release
cargo run --release
```

Edit `src/main.rs` to change the target prefix or other parameters.

---

## 3. Verify Composer

## Setup (30 seconds)

### Option 1: Direct Edit (Simplest)

Just open the script files and update the addresses:

```typescript
// In scripts/verifyComposer.ts
const COMPOSER_ADDRESS = "0xYourComposerAddress";

// In scripts/testComposerLocal.ts
const CONFIG = {
  COMPOSER: "0xYourComposerAddress",
  WLFI: "0xYourWLFIAddress",
  EAGLE: "0xYourEAGLEAddress",
  TEST_AMOUNT: parseEther("10"),
};
```

### Option 2: Use Config File (Advanced)

1. Copy the example config:
```bash
cp scripts/addresses.example.ts scripts/addresses.ts
```

2. Edit `scripts/addresses.ts` with your addresses

3. Import in your scripts (modify scripts to use it)

## Scripts

### 1. `verifyComposer.ts` - Quick Health Check (2 min)

Verifies that your Composer is properly configured.

```bash
npx hardhat run scripts/verifyComposer.ts --network ethereum
```

**Checks:**
- ✅ Contract addresses configured
- ✅ Vault endpoint ID valid
- ✅ Preview functions work
- ✅ Token approvals set
- ✅ OApp configuration
- ✅ Ownership

**Expected Output:**
```
🦅 Eagle OVault Composer Verification

✅ Check 1: Contract Configuration
  Vault: 0x...
  Wrapper: 0x...
  EAGLE OFT: 0x...
  ✅ All contracts configured

✅ Check 2: Vault Endpoint ID
  Vault EID: 30101
  ✅ Valid endpoint ID

✅ Check 3: Preview Functions
  100 WLFI → 99.50 EAGLE
  100 EAGLE → 98.00 WLFI
  ✅ Preview functions work

Composer Status: ✅ READY
```

---

### 2. `testComposerLocal.ts` - Full Operation Test (5 min)

Tests actual deposit and redeem operations with your wallet.

```bash
npx hardhat run scripts/testComposerLocal.ts --network ethereum
```

**Tests:**
1. Preview deposit (WLFI → EAGLE)
2. Execute deposit (if you have WLFI)
3. Preview redeem (EAGLE → WLFI)
4. Execute redeem (if you have EAGLE)

**Expected Output:**
```
💰 Initial Balances:
  WLFI: 100.0
  EAGLE: 50.0

🔍 TEST 1: Preview depositAndWrap
  Input: 10.0 WLFI
  Expected output: 9.95 EAGLE
  Conversion rate: 99.50%
  ✅ Preview successful

💸 TEST 2: Execute depositAndWrap
  ✅ WLFI approved
  ✅ Transaction confirmed
  
  📊 Results:
  WLFI spent: 10.0
  EAGLE received: 9.95
  Effective rate: 99.50%
  ✅ depositAndWrap successful!
```

---

## Troubleshooting

### Error: "Please update addresses"

**Problem:** You haven't set the contract addresses yet.

**Solution:**
```typescript
// Edit the script file and replace "0x..." with your actual addresses
const COMPOSER_ADDRESS = "0x1234..."; // Your real address
```

### Error: "Failed to get contracts"

**Problem:** Composer address is wrong or contract not deployed.

**Solution:**
1. Double-check your Composer address
2. Make sure you're on the right network
3. Verify contract is deployed: `cast code <address>`

### Error: "Insufficient WLFI balance"

**Problem:** You don't have WLFI to test with.

**Solution:**
- The script will skip the actual deposit test
- Preview will still work
- You can test redeem if you have EAGLE

### Error: "Preview failed"

**Problem:** Composer not properly configured.

**Solution:**
1. Run `verifyComposer.ts` first
2. Check that all addresses are set in Composer
3. Make sure Vault is initialized

---

## Quick Reference

```bash
# 1. Verify setup
npx hardhat run scripts/verifyComposer.ts --network ethereum

# 2. Test operations
npx hardhat run scripts/testComposerLocal.ts --network ethereum

# 3. If you get address errors:
# Edit scripts/verifyComposer.ts line 11
# Edit scripts/testComposerLocal.ts lines 13-16
```

---

## Next Steps

After successful testing:

1. ✅ **Update frontend** with same addresses
   - Edit `frontend/src/hooks/useEagleComposer.ts`
   - Update `ADDRESSES` object

2. ✅ **Test in UI**
   ```bash
   cd frontend && npm run dev
   ```

3. ✅ **Monitor operations**
   - Watch for events
   - Track gas costs
   - Gather user feedback

4. ✅ **Go to production**
   - Start with small caps
   - Gradual rollout
   - Announce to community

---

## Support

- **Documentation:** See `QUICK_START.md` for full guide
- **Technical details:** See `contracts/layerzero/composers/EagleOVaultComposer.sol`
- **Help:** Ask in Discord or open GitHub issue

---

**Ready to test!** 🚀

Just update the addresses and run the scripts. Takes ~5 minutes total.
