# ⚡ Quick Start - Deploy & Test on Arbitrum

## 🎯 Your Test Tokens

```
WLFI:   0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747
USD1:   0x8C815948C41D2A87413E796281A91bE91C4a94aB
MEAGLE: 0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e (Charm vault receipt)
```

---

## 🚀 Deploy in 3 Commands

### **1. Deploy Vault**

```bash
npx hardhat run scripts/deploy-arbitrum-test.ts --network arbitrum
```

**Copy the vault address from output!**

---

### **2. Update Test Script**

```bash
# Edit scripts/test-arbitrum-vault.ts
# Change line 11:
const VAULT_ADDRESS = "0xYOUR_DEPLOYED_VAULT_ADDRESS";
```

---

### **3. Run Tests**

```bash
npx hardhat run scripts/test-arbitrum-vault.ts --network arbitrum
```

---

## ✅ Expected Results

```
🧪 Testing EagleOVault V2 Hybrid on Arbitrum

Tester address: 0x...
ETH balance: X ETH

📊 Initial State:
  Your Balances:
    WLFI: XX.X
    USD1: XX.X
    EAGLE: 0.0

🧪 TEST 1: Direct Deposit (Method 3)
  Approving WLFI...
    ✅ WLFI approved
  Approving USD1...
    ✅ USD1 approved
  
  Depositing 10.0 WLFI + 10.0 USD1...
  Transaction sent: 0x...
  ✅ Transaction confirmed!
  Gas used: ~200000
  
  Results:
    Shares minted: ~20.0
    Your EAGLE balance: ~20.0

✅ Testing Complete!
```

---

## 🧪 Manual Testing (Hardhat Console)

```bash
# Open console
npx hardhat console --network arbitrum
```

```javascript
// Connect to vault
const vault = await ethers.getContractAt(
  "EagleOVaultV2Hybrid",
  "YOUR_VAULT_ADDRESS"
);

// Get signer
const [signer] = await ethers.getSigners();

// Connect to tokens
const wlfi = await ethers.getContractAt(
  "IERC20",
  "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747"
);
const usd1 = await ethers.getContractAt(
  "IERC20",
  "0x8C815948C41D2A87413E796281A91bE91C4a94aB"
);

// Check your balances
const wlfiBalance = await wlfi.balanceOf(signer.address);
const usd1Balance = await usd1.balanceOf(signer.address);
console.log("WLFI:", ethers.utils.formatEther(wlfiBalance));
console.log("USD1:", ethers.utils.formatEther(usd1Balance));

// Approve vault
await wlfi.approve(vault.address, ethers.constants.MaxUint256);
await usd1.approve(vault.address, ethers.constants.MaxUint256);
console.log("✅ Approved");

// Deposit
const amount = ethers.utils.parseEther("10");
const tx = await vault.depositDual(amount, amount, signer.address);
await tx.wait();
console.log("✅ Deposited!");

// Check EAGLE balance
const eagleBalance = await vault.balanceOf(signer.address);
console.log("EAGLE:", ethers.utils.formatEther(eagleBalance));

// Check vault state
const totalAssets = await vault.totalAssets();
const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
console.log("Total Assets:", ethers.utils.formatEther(totalAssets));
console.log("Vault WLFI:", ethers.utils.formatEther(vaultWlfi));
console.log("Vault USD1:", ethers.utils.formatEther(vaultUsd1));
```

---

## 🎨 Test Portals Integration

### **Step 1: Get Quote from Portals API**

```bash
# Replace YOUR_VAULT_ADDRESS with actual address
curl "https://api.portals.fi/v2/portal?inputToken=arbitrum:0x0000000000000000000000000000000000000000&inputAmount=10000000000000000&outputToken=arbitrum:0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747&sender=YOUR_VAULT_ADDRESS&validate=true"
```

### **Step 2: Execute Portals Zap**

```javascript
// In Hardhat console
const portalsCallData = "0x..."; // from API response tx.data
const expectedMin = ethers.utils.parseEther("0.009"); // 10% slippage for testing

const tx = await vault.zapETHViaPortals(
  portalsCallData,
  expectedMin,
  expectedMin,
  { value: ethers.utils.parseEther("0.01") }
);

await tx.wait();
console.log("✅ Portals zap successful!");
```

---

## 🔍 Verify on Arbiscan

After deployment, verify your contract:

```bash
npx hardhat verify --network arbitrum YOUR_VAULT_ADDRESS \
  0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747 \
  0x8C815948C41D2A87413E796281A91bE91C4a94aB \
  0xE592427A0AEce92De3Edee1F18E0157C05861564 \
  0xbf5a7f3629fb325e2a8453d595ab103465f75e62 \
  0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 \
  YOUR_DEPLOYER_ADDRESS
```

Then view on: `https://arbiscan.io/address/YOUR_VAULT_ADDRESS`

---

## 💡 Pro Tips

### **Testing Order**

1. ✅ **Start with Direct Deposit** (Method 3) - Easiest to test
2. ✅ **Then try Uniswap Zap** (Method 2) - If pools exist
3. ✅ **Finally Portals** (Method 1) - Requires API setup

### **If You Don't Have Test Tokens**

```typescript
// If you control the token contracts, mint some:
const wlfi = await ethers.getContractAt("YourTokenContract", WLFI_ADDRESS);
await wlfi.mint(yourAddress, ethers.utils.parseEther("1000"));
```

### **Save Gas on Testing**

```typescript
// Use lower gas price on Arbitrum
{
  maxFeePerGas: ethers.utils.parseUnits("0.1", "gwei"),
  maxPriorityFeePerGas: ethers.utils.parseUnits("0.01", "gwei")
}
```

---

## 📋 Checklist

Before running:
- [ ] Have Arbitrum ETH for gas
- [ ] Have WLFI tokens
- [ ] Have USD1 tokens
- [ ] Updated `.env` with PRIVATE_KEY
- [ ] Arbitrum RPC is working

After deployment:
- [ ] Saved vault address
- [ ] Updated test script with vault address
- [ ] Verified contract on Arbiscan (optional)
- [ ] Tested direct deposit
- [ ] Checked EAGLE balance

---

## 🎉 You're Ready!

Run these commands in order:

```bash
# 1. Deploy
npx hardhat run scripts/deploy-arbitrum-test.ts --network arbitrum

# 2. Copy vault address from output

# 3. Update test script with vault address

# 4. Run tests
npx hardhat run scripts/test-arbitrum-vault.ts --network arbitrum

# 5. Celebrate! 🎉
```

---

**Good luck! Let me know if you hit any issues!** 🦅

