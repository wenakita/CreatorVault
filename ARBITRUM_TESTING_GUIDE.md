# 🧪 Arbitrum Testing Guide - EagleOVault V2 Hybrid

## 🎯 Quick Reference

**Your Test Tokens on Arbitrum:**
- **WLFI**: `0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747`
- **USD1**: `0x8C815948C41D2A87413E796281A91bE91C4a94aB`
- **MEAGLE** (Charm receipt): `0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e`

---

## 🚀 Deployment Steps

### **1. Configure Environment**

Add to your `.env` file:

```bash
# Arbitrum RPC
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Your private key (KEEP SECRET!)
PRIVATE_KEY=your_private_key_here

# Optional: Arbiscan API key for verification
ARBISCAN_API_KEY=your_arbiscan_api_key
```

### **2. Deploy Vault**

```bash
# Make sure you're on Arbitrum network
npx hardhat run scripts/deploy-arbitrum-test.ts --network arbitrum
```

**Expected Output:**
```
🦅 Deploying EagleOVault V2 Hybrid on ARBITRUM...
Deployer: 0x...
Balance: X ETH

📋 Arbitrum Configuration:
  Test Tokens:
    WLFI: 0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747
    USD1: 0x8C815948C41D2A87413E796281A91bE91C4a94aB
    ...

✅ Vault deployed to: 0xYourVaultAddress
```

**Save the vault address!** You'll need it for testing.

### **3. Update Test Script**

Edit `scripts/test-arbitrum-vault.ts` and update:

```typescript
const VAULT_ADDRESS = "0xYourVaultAddressFromStep2";
```

---

## 🧪 Testing

### **Test 1: Direct Deposit (Easiest)**

This tests Method 3 - direct deposit with WLFI + USD1.

```bash
# Run the test script
npx hardhat run scripts/test-arbitrum-vault.ts --network arbitrum
```

**What it does:**
1. Checks your WLFI and USD1 balances
2. Approves vault to spend tokens
3. Deposits 10 WLFI + 10 USD1
4. Shows you how many EAGLE shares you got

**Prerequisites:**
- You need WLFI and USD1 in your wallet
- At least 10 of each token

---

### **Test 2: Uniswap Zap (If Pools Exist)**

Test Method 2 - zapping from ETH via Uniswap.

**Note**: This will only work if Uniswap V3 pools exist for WLFI/USD1 pairs!

```typescript
// Already included in test script
// Zaps 0.01 ETH → WLFI + USD1
```

**Prerequisites:**
- You need some ETH on Arbitrum
- Uniswap V3 pools must exist for WLFI and USD1

---

### **Test 3: Portals Zap (Advanced)**

Test Method 1 - zapping from ANY token via Portals.

#### **Step 3.1: Get Portals Quote**

```bash
# Get quote for WLFI → USD1 via Portals API
curl "https://api.portals.fi/v2/portal?inputToken=arbitrum:0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747&inputAmount=1000000000000000000&outputToken=arbitrum:0x8C815948C41D2A87413E796281A91bE91C4a94aB&sender=YOUR_VAULT_ADDRESS"
```

#### **Step 3.2: Execute Zap**

```typescript
// In Hardhat console or script
const portalsCallData = "0x..."; // from API response
const expectedWlfiMin = ethers.utils.parseEther("0.95");
const expectedUsd1Min = ethers.utils.parseEther("0.95");

await vault.zapViaPortals(
  WLFI_ADDRESS,
  ethers.utils.parseEther("1"),
  portalsCallData,
  expectedWlfiMin,
  expectedUsd1Min
);
```

---

## 📊 Monitoring Your Vault

### **Check Balances**

```typescript
// Your EAGLE shares
const shares = await vault.balanceOf(yourAddress);
console.log("EAGLE:", ethers.utils.formatEther(shares));

// Vault's holdings
const [wlfi, usd1] = await vault.getVaultBalances();
console.log("Vault WLFI:", ethers.utils.formatEther(wlfi));
console.log("Vault USD1:", ethers.utils.formatEther(usd1));

// Total value
const totalAssets = await vault.totalAssets();
console.log("Total Assets:", ethers.utils.formatEther(totalAssets));
```

### **Using Hardhat Console**

```bash
npx hardhat console --network arbitrum
```

```javascript
const vault = await ethers.getContractAt(
  "EagleOVaultV2Hybrid",
  "YOUR_VAULT_ADDRESS"
);

// Check your balance
const [signer] = await ethers.getSigners();
const balance = await vault.balanceOf(signer.address);
console.log("Your EAGLE:", ethers.utils.formatEther(balance));

// Check vault state
const totalAssets = await vault.totalAssets();
console.log("Total Assets:", ethers.utils.formatEther(totalAssets));
```

---

## 🔧 Troubleshooting

### **Issue: "Insufficient WLFI/USD1 balance"**

**Solution**: You need test tokens!

If you control these token contracts, mint some:
```typescript
// If tokens are mintable
const wlfi = await ethers.getContractAt("IERC20", WLFI_ADDRESS);
await wlfi.mint(yourAddress, ethers.utils.parseEther("1000"));
```

Or transfer from another address that has them.

---

### **Issue: "Transaction failed" on Uniswap zap**

**Reason**: Uniswap V3 pools might not exist for WLFI/USD1

**Solution**: 
1. Skip Test 2 (Uniswap zap)
2. Focus on Test 1 (Direct deposit) and Test 3 (Portals)
3. Or create Uniswap V3 pools for these tokens first

---

### **Issue: "Portals API returns error"**

**Reason**: Portals might not support your test tokens

**Solution**:
1. Test with real tokens (ETH, USDC) first
2. Or skip Portals test for now
3. Focus on Direct deposit which doesn't need Portals

---

### **Issue: "Gas estimation failed"**

**Solution**: Add explicit gas limit:
```typescript
await vault.depositDual(amount, amount, receiver, {
  gasLimit: 500000
});
```

---

## 📝 Testing Checklist

Use this to track your testing progress:

### **Basic Functionality**
- [ ] Deploy vault successfully
- [ ] Check initial vault state
- [ ] Approve tokens (WLFI and USD1)
- [ ] Direct deposit WLFI + USD1
- [ ] Check EAGLE balance received
- [ ] Check vault balances updated

### **Advanced Functionality**
- [ ] Zap from ETH (if Uniswap pools exist)
- [ ] Zap from ERC20 via Portals
- [ ] Withdraw shares
- [ ] Check withdrawal amounts
- [ ] Test batch deployment threshold

### **Edge Cases**
- [ ] Deposit with unbalanced ratio (90/10)
- [ ] Deposit very small amount
- [ ] Deposit large amount
- [ ] Multiple deposits from same user
- [ ] Multiple users depositing

---

## 🎨 Frontend Testing

Once deployment works, test with a simple HTML page:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Eagle Vault Test</title>
  <script src="https://cdn.ethers.io/lib/ethers-5.7.umd.min.js"></script>
</head>
<body>
  <h1>🦅 Eagle Vault Tester</h1>
  
  <button onclick="connect()">Connect Wallet</button>
  <button onclick="deposit()">Deposit 10 WLFI + 10 USD1</button>
  <button onclick="checkBalance()">Check Balance</button>
  
  <div id="output"></div>
  
  <script>
    const VAULT = "YOUR_VAULT_ADDRESS";
    const WLFI = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
    const USD1 = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
    
    let provider, signer, vault;
    
    async function connect() {
      provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      signer = provider.getSigner();
      
      vault = new ethers.Contract(VAULT, [
        "function depositDual(uint256,uint256,address) external returns (uint256)",
        "function balanceOf(address) external view returns (uint256)"
      ], signer);
      
      document.getElementById('output').innerHTML = "✅ Connected!";
    }
    
    async function deposit() {
      try {
        const amount = ethers.utils.parseEther("10");
        const tx = await vault.depositDual(amount, amount, await signer.getAddress());
        document.getElementById('output').innerHTML = "⏳ Transaction sent...";
        await tx.wait();
        document.getElementById('output').innerHTML = "✅ Deposit successful!";
      } catch (error) {
        document.getElementById('output').innerHTML = "❌ " + error.message;
      }
    }
    
    async function checkBalance() {
      const balance = await vault.balanceOf(await signer.getAddress());
      document.getElementById('output').innerHTML = 
        "Your EAGLE: " + ethers.utils.formatEther(balance);
    }
  </script>
</body>
</html>
```

---

## 🎯 Success Criteria

Your testing is successful when:

✅ **Deployment**
- Vault deploys without errors
- All addresses are correct
- Configuration is set properly

✅ **Direct Deposit**
- Tokens are approved
- Deposit transaction succeeds
- EAGLE shares are minted
- Vault balances increase

✅ **Withdrawals**
- Can withdraw shares
- Receive WLFI + USD1 back
- Balances update correctly

✅ **Optional (if pools exist)**
- Uniswap zap works from ETH
- Portals integration works

---

## 📞 Getting Help

If you run into issues:

1. **Check transaction on Arbiscan**: https://arbiscan.io/
2. **Verify token addresses** are correct
3. **Ensure you have tokens** in your wallet
4. **Check gas limits** are sufficient
5. **Review error messages** carefully

---

## 🎉 Next Steps After Testing

Once testing is successful:

1. ✅ Test all three deposit methods
2. ✅ Test withdrawals
3. ✅ Add Charm strategy (use MEAGLE token)
4. ✅ Test strategy deployment
5. ✅ Build frontend interface
6. ✅ Deploy to mainnet

---

## 📊 Example Test Run

```
🧪 Testing EagleOVault V2 Hybrid on Arbitrum

Tester address: 0xYourAddress
ETH balance: 0.1 ETH

📋 Contract Addresses:
  Vault: 0xVaultAddress
  WLFI: 0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747
  USD1: 0x8C815948C41D2A87413E796281A91bE91C4a94aB

📊 Initial State:
  Your Balances:
    WLFI: 100.0
    USD1: 100.0
    EAGLE: 0.0

🧪 TEST 1: Direct Deposit (Method 3)
  Approving WLFI...
    ✅ WLFI approved
  Approving USD1...
    ✅ USD1 approved
  
  Depositing 10.0 WLFI + 10.0 USD1...
  Transaction sent: 0x123...
  ✅ Transaction confirmed!
  Gas used: 234567
  
  Results:
    Shares minted: 20.0
    Your EAGLE balance: 20.0

✅ Testing Complete!
```

---

**Happy Testing! 🚀**

Questions? Check the main documentation or reach out for help!

