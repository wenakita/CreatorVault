# 🚀 **CREATOR VAULT LAUNCH GUIDE**

## 📋 **QUICK START - DEPLOY YOUR VAULT**

This guide walks you through deploying your Creator Vault in **5 simple steps**.

**Total Time:** 15-20 minutes  
**Total Cost:** ~$15-20 in gas on Base  
**Deployed Infrastructure:** VaultActivationBatcher at `0x6d796554698f5Ddd74Ff20d745304096aEf93CB6` (supports `batchActivate`; operator-safe Permit2 activation requires deploying the updated batcher build)

---

## 🎯 **WHAT YOU'LL DEPLOY**

1. **CreatorOVault** - Your ERC-4626 vault
2. **CreatorOVaultWrapper** - User-facing deposit/withdraw interface
3. **CreatorShareOFT** - Cross-chain wsToken (LayerZero OFT)
4. **CCALaunchStrategy** - 7-day Continuous Clearing Auction
5. **CreatorGaugeController** - Fee distribution system

---

## 📝 **PREREQUISITES**

- [ ] Your creator token deployed on Base
- [ ] Wallet with ~0.01 ETH for gas
- [ ] Token symbol (e.g., "AKITA")
- [ ] Basic understanding of contract deployment

---

## 🔧 **STEP 1: DEPLOY VAULT CONTRACTS**

### **Option A: Using Foundry (Recommended)**

```bash
# Set your parameters
export CREATOR_TOKEN=0x...  # Your token address
export CREATOR_ADDRESS=0x...  # Your address
export TOKEN_SYMBOL=AKITA
export PRIVATE_KEY=0x...

# Deploy CreatorOVault
forge create contracts/vault/CreatorOVault.sol:CreatorOVault \
    --constructor-args $CREATOR_TOKEN $CREATOR_ADDRESS "${TOKEN_SYMBOL} Vault" "v${TOKEN_SYMBOL}" \
    --rpc-url base \
    --private-key $PRIVATE_KEY \
    --verify

# Save the deployed address
export VAULT_ADDRESS=0x...  # From output above

# Deploy CreatorOVaultWrapper
forge create contracts/vault/CreatorOVaultWrapper.sol:CreatorOVaultWrapper \
    --constructor-args $CREATOR_TOKEN $VAULT_ADDRESS $CREATOR_ADDRESS \
    --rpc-url base \
    --private-key $PRIVATE_KEY \
    --verify

# Save the deployed address
export WRAPPER_ADDRESS=0x...  # From output above

# Deploy CreatorShareOFT
forge create contracts/services/messaging/CreatorShareOFT.sol:CreatorShareOFT \
    --constructor-args "Wrapped ${TOKEN_SYMBOL} Share" "ws${TOKEN_SYMBOL}" "0x1a44076050125825900e736c501f859c50fE728c" $CREATOR_ADDRESS \
    --rpc-url base \
    --private-key $PRIVATE_KEY \
    --verify

# Save the deployed address
export SHAREOFT_ADDRESS=0x...  # From output above
```

### **Option B: Using Etherscan/BaseScan**

1. Go to [BaseScan Contract Deployer](https://basescan.org/verifyContract)
2. Deploy each contract with constructor args
3. Verify on BaseScan
4. Save all addresses

---

## 🔧 **STEP 2: CONFIGURE PERMISSIONS**

### **Configure Wrapper:**

```bash
# Set ShareOFT on Wrapper
cast send $WRAPPER_ADDRESS "setShareOFT(address)" $SHAREOFT_ADDRESS \
    --rpc-url base \
    --private-key $PRIVATE_KEY
```

### **Configure ShareOFT:**

```bash
# Set vault on ShareOFT
cast send $SHAREOFT_ADDRESS "setVault(address)" $VAULT_ADDRESS \
    --rpc-url base \
    --private-key $PRIVATE_KEY

# Give wrapper minter rights
cast send $SHAREOFT_ADDRESS "setMinter(address,bool)" $WRAPPER_ADDRESS true \
    --rpc-url base \
    --private-key $PRIVATE_KEY
```

### **Configure Vault:**

```bash
# Whitelist wrapper on vault
cast send $VAULT_ADDRESS "setWhitelist(address,bool)" $WRAPPER_ADDRESS true \
    --rpc-url base \
    --private-key $PRIVATE_KEY
```

---

## 🔧 **STEP 3: DEPLOY GAUGE & CCA**

### **Deploy GaugeController:**

```bash
forge create contracts/governance/CreatorGaugeController.sol:CreatorGaugeController \
    --constructor-args $SHAREOFT_ADDRESS $CREATOR_ADDRESS $CREATOR_ADDRESS $CREATOR_ADDRESS \
    --rpc-url base \
    --private-key $PRIVATE_KEY \
    --verify

export GAUGE_ADDRESS=0x...  # From output

# Configure gauge on vault and shareOFT
cast send $VAULT_ADDRESS "setGaugeController(address)" $GAUGE_ADDRESS --rpc-url base --private-key $PRIVATE_KEY
cast send $SHAREOFT_ADDRESS "setGaugeController(address)" $GAUGE_ADDRESS --rpc-url base --private-key $PRIVATE_KEY
cast send $GAUGE_ADDRESS "setVault(address)" $VAULT_ADDRESS --rpc-url base --private-key $PRIVATE_KEY
cast send $GAUGE_ADDRESS "setWrapper(address)" $WRAPPER_ADDRESS --rpc-url base --private-key $PRIVATE_KEY
```

### **Deploy CCALaunchStrategy:**

```bash
forge create contracts/vault/strategies/CCALaunchStrategy.sol:CCALaunchStrategy \
    --constructor-args $SHAREOFT_ADDRESS "0x0000000000000000000000000000000000000000" $VAULT_ADDRESS $CREATOR_ADDRESS $CREATOR_ADDRESS \
    --rpc-url base \
    --private-key $PRIVATE_KEY \
    --verify

export CCA_ADDRESS=0x...  # From output
```

---

## 🔧 **STEP 4: APPROVE VAULT ACTIVATION BATCHER**

**CRITICAL STEP:** This allows 1-click CCA launching!

```bash
# Approve the VaultActivationBatcher to launch your CCA
cast send $CCA_ADDRESS \
    "setApprovedLauncher(address,bool)" \
    0x6d796554698f5Ddd74Ff20d745304096aEf93CB6 \
    true \
    --rpc-url base \
    --private-key $PRIVATE_KEY
```

✅ **Your vault is now configured and ready to launch!**

---

## 🎉 **STEP 5: LAUNCH YOUR CCA**

### **Prepare Your Launch:**

1. **Decide your parameters:**
   - Deposit Amount: How many tokens to deposit (e.g., 50,000,000 AKITA)
   - Auction %: What % to auction (e.g., 69%)
   - Required Raise: Minimum ETH to raise (e.g., 10 ETH)

2. **Approve tokens:**

```bash
# Approve VaultActivationBatcher to spend your tokens
cast send $CREATOR_TOKEN \
    "approve(address,uint256)" \
    0x6d796554698f5Ddd74Ff20d745304096aEf93CB6 \
    50000000000000000000000000 \
    --rpc-url base \
    --private-key $PRIVATE_KEY
```

3. **Launch CCA:**

```bash
# Launch your 7-day CCA in ONE transaction!
cast send 0x6d796554698f5Ddd74Ff20d745304096aEf93CB6 \
    "batchActivate(address,address,address,address,uint256,uint8,uint128)" \
    $CREATOR_TOKEN \
    $VAULT_ADDRESS \
    $WRAPPER_ADDRESS \
    $CCA_ADDRESS \
    50000000000000000000000000 \
    69 \
    10000000000000000000 \
    --rpc-url base \
    --private-key $PRIVATE_KEY
```

🎉 **YOUR CCA IS NOW LIVE FOR 7 DAYS!**

---

## 📋 **CHECKLIST**

Use this to track your progress:

### **Phase 1: Deploy Core Contracts**
- [ ] Deploy CreatorOVault
- [ ] Deploy CreatorOVaultWrapper  
- [ ] Deploy CreatorShareOFT

### **Phase 2: Configure Permissions**
- [ ] Set ShareOFT on Wrapper
- [ ] Set Vault on ShareOFT
- [ ] Give Wrapper minter rights on ShareOFT
- [ ] Whitelist Wrapper on Vault

### **Phase 3: Deploy Governance**
- [ ] Deploy CreatorGaugeController
- [ ] Deploy CCALaunchStrategy
- [ ] Configure Gauge on all contracts

### **Phase 4: Enable 1-Click Launch**
- [ ] Approve VaultActivationBatcher on CCA

### **Phase 5: Launch**
- [ ] Approve tokens
- [ ] Call batchActivate()
- [ ] ✅ CCA LIVE!

---

## 🎯 **WHAT HAPPENS NEXT**

### **During 7-Day CCA:**
- Users bid ETH for ■AKITA
- Auction clears at fair market price
- You can monitor bids in real-time

### **After Auction Completes:**
- Call `sweepCurrency()` on `CCALaunchStrategy` (permissionless)
- Token owner configures the V4 tax hook via `setTaxConfig(...)`
- Trading begins (with 6.9% hook fees routed to the GaugeController)

### **Optional: Deploy Strategies:**
- Deploy Charm vault strategy (yield farming)
- Deploy Ajna lending strategy
- Increase PPS automatically

---

## 💡 **TIPS & BEST PRACTICES**

### **Testing:**
- Test on Base Sepolia first
- Use small amounts initially
- Verify all contracts before mainnet

### **Security:**
- Use a multisig for creator address
- Double-check all addresses
- Verify contracts on BaseScan

### **Gas Optimization:**
- Deploy during low gas times
- Batch transactions where possible
- Use forge scripts for efficiency

---

## 🆘 **TROUBLESHOOTING**

### **"Insufficient balance" error:**
- Make sure you have enough ETH for gas
- Check token balance for deposit

### **"Not approved" error:**
- Run the approve transaction first
- Check approval amount is sufficient

### **"Unauthorized" error:**
- Make sure you called setApprovedLauncher()
- Verify you're using correct CCA address

---

## 📞 **SUPPORT**

### **Contract Addresses:**
- VaultActivationBatcher: `0x6d796554698f5Ddd74Ff20d745304096aEf93CB6`
- LayerZero Endpoint (Base): `0x1a44076050125825900e736c501f859c50fE728c`

### **Resources:**
- BaseScan: https://basescan.org
- Base RPC: https://mainnet.base.org
- Docs: See repository documentation

---

## 🎉 **CONGRATULATIONS!**

You've successfully deployed your Creator Vault! Your community can now:
- Deposit tokens via the wrapper
- Get wsTokens for cross-chain transfers
- Participate in the CCA auction
- Trade on Uniswap V4 after launch
- Earn yield from strategies

**Welcome to the Creator Economy!** 🚀

