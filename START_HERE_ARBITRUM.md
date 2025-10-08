# 🦅 START HERE - Arbitrum Testing

## ⚡ Deploy & Test in 5 Minutes

### **Your Test Setup**
- **Network**: Arbitrum (Chain ID: 42161)
- **WLFI**: `0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747`
- **USD1**: `0x8C815948C41D2A87413E796281A91bE91C4a94aB`
- **MEAGLE**: `0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e`

---

## 🚀 Quick Deploy

```bash
# 1. Deploy vault (1 command)
npx hardhat run scripts/deploy-arbitrum-test.ts --network arbitrum

# 2. Save the vault address from output
# Example: 0x1234...5678

# 3. Update test script (edit line 11)
# Change: const VAULT_ADDRESS = "0x1234...5678";

# 4. Run tests
npx hardhat run scripts/test-arbitrum-vault.ts --network arbitrum

# Done! ✅
```

---

## 📊 What Gets Deployed

```
EagleOVaultV2Hybrid
├─ Method 1: Portals Zap (ANY token)
├─ Method 2: Uniswap Zap (ETH, common tokens)
└─ Method 3: Direct Deposit (WLFI+USD1)
```

**All three methods in ONE contract!**

---

## 🧪 Test Results Preview

```
🧪 Testing EagleOVault V2 Hybrid on Arbitrum

📊 Initial State:
  Your Balances:
    WLFI: 100.0
    USD1: 100.0
    EAGLE: 0.0

🧪 TEST 1: Direct Deposit
  ✅ Transaction confirmed!
  Shares minted: 20.0
  Your EAGLE balance: 20.0

✅ Testing Complete!
```

---

## 💡 What You Can Test

### **Immediate Tests (No extra setup)**
1. ✅ Direct deposit WLFI + USD1
2. ✅ Check EAGLE balance
3. ✅ Withdraw shares

### **Advanced Tests (Requires setup)**
1. ⏳ Uniswap zap (needs WLFI/USD1 Uniswap pools)
2. ⏳ Portals integration (needs API key)
3. ⏳ Charm strategy (needs strategy deployment)

---

## 📚 Documentation Map

**Start Here:**
- `START_HERE_ARBITRUM.md` ← You are here!
- `QUICK_START_ARBITRUM.md` - Command reference

**Deep Dive:**
- `ARBITRUM_TESTING_GUIDE.md` - Complete testing guide
- `ARBITRUM_READY.md` - Architecture overview

**Integration:**
- `HYBRID_MODEL_README.md` - Hybrid vault features
- `HYBRID_FRONTEND_GUIDE.md` - Frontend integration
- `PORTALS_INTEGRATION_GUIDE.md` - Portals setup

---

## ⚠️ Prerequisites

You need:
- [x] Arbitrum ETH for gas (~0.01 ETH)
- [x] Test WLFI tokens
- [x] Test USD1 tokens
- [x] `.env` file with PRIVATE_KEY

**Get Arbitrum ETH:**
- Bridge from Ethereum
- Or use faucet (if testnet)
- Or buy on exchange

**Get Test Tokens:**
- If you control them, mint to your address
- Or ask the token deployer

---

## 🎯 Success Criteria

After running the deploy & test scripts, you should see:

✅ Vault deployed with address  
✅ Tokens approved  
✅ Deposit successful  
✅ EAGLE shares received  
✅ Can check balances  
✅ No errors in console  

---

## 🚨 If Something Goes Wrong

### **"Insufficient balance"**
→ You need more WLFI or USD1 tokens

### **"Transaction failed"**
→ Check gas limit, try adding: `{ gasLimit: 500000 }`

### **"Uniswap zap failed"**
→ Pools might not exist, skip this test for now

### **"Contract not deployed"**
→ Check you're on correct network (Arbitrum)

---

## 📞 Need Help?

1. Check the specific guide for your issue
2. Review error message on Arbiscan
3. Try Hardhat console for debugging
4. Ask for help with error message + transaction hash

---

## 🎉 Next After Testing

Once basic tests pass:

1. ✅ Deploy CharmAlphaVaultStrategy
2. ✅ Add strategy to vault
3. ✅ Test strategy deployment
4. ✅ Build frontend
5. ✅ Deploy to mainnet

---

## 🏁 Ready to Deploy?

**Run this command:**

```bash
npx hardhat run scripts/deploy-arbitrum-test.ts --network arbitrum
```

**Then follow the output instructions!**

Good luck! 🦅🚀

