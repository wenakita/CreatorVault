# 🔄 Redeployment Guide - Fresh Start

**For redeploying Eagle OVault with clean addresses**

---

## 🎯 Overview

This guide walks you through:
1. Cleaning all old addresses
2. Preparing for fresh deployment
3. Deploying with new addresses
4. Updating all documentation

---

## ⚠️ Before You Start

### Backup Important Data

**Save these if you need them:**
- [ ] Old contract addresses
- [ ] Old transaction hashes
- [ ] Old deployment logs
- [ ] Any user data from old deployment

**The cleanup script will:**
- ✅ Create automatic backup in `backup-TIMESTAMP/`
- ✅ Remove old deployment artifacts
- ✅ Clean environment files
- ✅ Update documentation with placeholders

---

## 🧹 Step 1: Clean Old Addresses

### Run the Cleanup Script

```bash
# Run automated cleanup
pnpm clean:addresses

# Or run directly
bash scripts/clean-old-addresses.sh
```

**What this does:**
1. Creates backup of current files
2. Removes `broadcast/` directory (deployment records)
3. Removes `deployments/` directory
4. Cleans `frontend/.env.production`
5. Updates documentation with placeholders
6. Creates `DEPLOYED_ADDRESSES.md` template

### Verify Cleanup

```bash
# Check that old artifacts are gone
ls broadcast/        # Should not exist
ls deployments/      # Should not exist

# Check frontend env is clean
cat frontend/.env.production  # Should have empty contract addresses

# Check README has placeholders
grep "TBD" README.md  # Should show "TBD - Deploy First"
```

---

## 📋 Step 2: Prepare Environment

### Update .env File

```bash
# If you don't have .env, create it
cp .env.deployment.template .env

# Edit with your values
nano .env
```

**Required values:**
```bash
PRIVATE_KEY=0x...  # Your deployment wallet (NEW wallet recommended)
ETHEREUM_RPC_URL=https://...
ETHERSCAN_API_KEY=...
```

### Fund Deployment Wallet

**Required funding:**
- Ethereum: ~3.6 ETH
- BSC: ~0.5 BNB
- Arbitrum: ~0.1 ETH
- Base: ~0.05 ETH
- Avalanche: ~1 AVAX

```bash
# Check your wallet balance
cast balance $YOUR_WALLET_ADDRESS --rpc-url $ETHEREUM_RPC_URL
```

### Run Pre-Flight Checks

```bash
# Verify everything is ready
pnpm precheck
```

**Expected output:**
- ✅ Environment variables set
- ✅ Wallet funded
- ✅ Network connections working
- ✅ No old addresses found

---

## 🚀 Step 3: Deploy Fresh Contracts

### Phase 1: Deploy to Ethereum (Hub)

```bash
# Deploy all Ethereum contracts
forge script script/DeployVanityVault.s.sol:DeployVanityVault \
  --rpc-url $ETHEREUM_RPC_URL \
  --broadcast \
  --verify \
  --slow
```

**Save addresses immediately:**
```bash
# From deployment output
VAULT_ADDRESS=0x...
STRATEGY_ADDRESS=0x...
WRAPPER_ADDRESS=0x...
OFT_ADDRESS=0x...

# Add to DEPLOYED_ADDRESSES.md
```

**⭐ CRITICAL:** Note the EagleShareOFT address - this MUST be the same on all chains!

### Phase 2: Deploy to Spoke Chains

**Deploy to each chain with SAME CREATE2 salt:**

```bash
# BSC
forge script script/multi-chain/DeployBSC.s.sol \
  --rpc-url $BSC_RPC_URL \
  --broadcast \
  --verify

# Arbitrum
forge script script/DeployArbitrum.s.sol \
  --rpc-url $ARBITRUM_RPC_URL \
  --broadcast \
  --verify

# Base
forge script script/multi-chain/DeployBase.s.sol \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify

# Avalanche
forge script script/multi-chain/DeployAvalanche.s.sol \
  --rpc-url $AVALANCHE_RPC_URL \
  --broadcast \
  --verify
```

### Phase 3: Verify Same Address

```bash
# Run verification script
npx ts-node scripts/verify-same-address.ts
```

**Expected output:**
```
✅ Ethereum:  0x[OFT_ADDRESS]
✅ BSC:       0x[OFT_ADDRESS]  # SAME!
✅ Arbitrum:  0x[OFT_ADDRESS]  # SAME!
✅ Base:      0x[OFT_ADDRESS]  # SAME!
✅ Avalanche: 0x[OFT_ADDRESS]  # SAME!

🎉 SUCCESS! EagleShareOFT has the same address on ALL chains!
```

**If addresses don't match:** See `CREATE2_DEPLOYMENT_GUIDE.md` for troubleshooting.

---

## 📝 Step 4: Update Documentation

### Update DEPLOYED_ADDRESSES.md

Fill in the template with your actual addresses:

```markdown
## 📊 Ethereum Mainnet (Hub Chain)

| Contract | Address | Tx Hash | Block | Verified |
|----------|---------|---------|-------|----------|
| EagleOVault | `0x...` | `0x...` | `12345678` | ✅ |
| CharmStrategyUSD1 | `0x...` | `0x...` | `12345679` | ✅ |
| EagleVaultWrapper | `0x...` | `0x...` | `12345680` | ✅ |
| EagleShareOFT | `0x...` | `0x...` | `12345681` | ✅ |
```

### Update README.md

Replace the placeholder section with actual addresses:

```markdown
## 📍 Production Contract Addresses

### Core Contracts (Ethereum Mainnet)

| Contract | Address | Status |
|----------|---------|--------|
| **EagleOVault** | [`0x...`](https://etherscan.io/address/0x...) | ✅ Live |
| **CharmStrategyUSD1** | [`0x...`](https://etherscan.io/address/0x...) | ✅ Live |
| **EagleVaultWrapper** | [`0x...`](https://etherscan.io/address/0x...) | ✅ Live |
| **EagleShareOFT** | [`0x...`](https://etherscan.io/address/0x...) | ✅ Live |
```

### Update Frontend Environment

```bash
# Edit frontend/.env.production
cd frontend
nano .env.production
```

**Add your addresses:**
```bash
VITE_VAULT_ADDRESS=0x...
VITE_OFT_ADDRESS=0x...
VITE_WRAPPER_ADDRESS=0x...
VITE_STRATEGY_ADDRESS=0x...
```

---

## 🔗 Step 5: Configure LayerZero

### Set Peers

```bash
# Configure all cross-chain connections
pnpm configure:all
```

### Configure DVN

```bash
# Configure Decentralized Verifier Network
pnpm configure-dvn:bsc
pnpm configure-dvn:arbitrum
pnpm configure-dvn:base
pnpm configure-dvn:avalanche
```

### Verify Connections

```bash
# Verify all peers are set
pnpm verify:bsc
pnpm verify:arbitrum
pnpm verify:base
pnpm verify:avalanche
```

---

## ✅ Step 6: Verification & Testing

### Run Tests

```bash
# Smart contract tests
forge test -vv

# Integration tests
npx hardhat test

# Functional tests
npx hardhat run scripts/testing/test-deposit.ts --network ethereum
npx hardhat run scripts/testing/test-cross-chain.ts --network bsc
```

### Verify on Block Explorers

Check each contract is verified:
- Ethereum: https://etherscan.io
- BSC: https://bscscan.com
- Arbitrum: https://arbiscan.io
- Base: https://basescan.org
- Avalanche: https://snowtrace.io

### Test Functionality

```bash
# Make small test deposit
npx hardhat run scripts/testing/test-deposit.ts --network ethereum

# Test cross-chain transfer
npx hardhat run scripts/testing/test-cross-chain.ts --network bsc

# Verify backend is indexing
curl http://localhost:3000/api/vault/stats
```

---

## 🌐 Step 7: Deploy Frontend

### Build Frontend

```bash
cd frontend

# Install dependencies
npm install

# Build
npm run build

# Test locally
npm run preview
```

### Deploy to Vercel

```bash
# Deploy
vercel --prod

# Or use Vercel dashboard
# 1. Connect GitHub repo
# 2. Set root directory: frontend
# 3. Add environment variables
# 4. Deploy
```

---

## 📊 Step 8: Final Checklist

Before announcing:

- [ ] All contracts deployed to all chains
- [ ] EagleShareOFT has SAME address on all 5 chains
- [ ] All contracts verified on block explorers
- [ ] LayerZero peers configured and tested
- [ ] Cross-chain transfers working
- [ ] Backend deployed and indexing
- [ ] Frontend deployed with correct addresses
- [ ] Documentation updated (README, DEPLOYED_ADDRESSES)
- [ ] Test deposit successful
- [ ] Monitoring active
- [ ] Team briefed on new addresses

---

## 🎉 Step 9: Go Live!

### Announce Deployment

Update:
- Social media
- Discord/Telegram
- Documentation sites
- GitHub README

### Monitor Closely

**First 24-48 hours:**
- Watch for unusual transactions
- Monitor gas costs
- Check for errors in logs
- Respond to user questions
- Be ready to pause if needed

### Start Small

- Recommend small deposits initially
- Test with your own funds first
- Gradually increase exposure
- Collect user feedback

---

## 🔄 Comparison: Old vs New

### Old Deployment (Example)
```
Vault:    0x32a2544De7a644833fE7659dF95e5bC16E698d99
Strategy: 0xd286Fdb2D3De4aBf44649649D79D5965bD266df4
Wrapper:  0xF9CEf2f5E9bb504437b770ED75cA4D46c407ba03
OFT:      0x477d42841dC5A7cCBc2f72f4448f5eF6B61eA91E
```

### New Deployment
```
Vault:    0x[NEW_ADDRESS]
Strategy: 0x[NEW_ADDRESS]
Wrapper:  0x[NEW_ADDRESS]
OFT:      0x[NEW_ADDRESS] # SAME on ALL chains!
```

---

## 🆘 Troubleshooting

### Cleanup Script Failed

```bash
# Check backup was created
ls -la backup-*/

# Manually restore if needed
cp backup-*/README.md ./
```

### Addresses Don't Match Across Chains

**Problem:** EagleShareOFT has different addresses on different chains

**Solution:**
1. Check you used the same CREATE2 salt
2. Verify bytecode is identical
3. See `CREATE2_DEPLOYMENT_GUIDE.md`
4. Redeploy to chains with wrong address

### Old Addresses Still Showing

```bash
# Search for old addresses
grep -r "0x32a2544De7a644833fE7659dF95e5bC16E698d99" .

# Update manually if found
```

### Frontend Not Connecting

**Check:**
1. Contract addresses in `.env.production`
2. RPC URLs working
3. Network IDs correct
4. Wallet connected to right network

---

## 📚 Additional Resources

- **Deployment Order:** `DEPLOYMENT_ORDER.md`
- **CREATE2 Guide:** `CREATE2_DEPLOYMENT_GUIDE.md`
- **Architecture:** `ARCHITECTURE_OVERVIEW.md`
- **Testing:** `TESTING_GUIDE.md` (created by Agent 3)
- **Security:** `SECURITY_AUDIT_REPORT.md` (created by Agent 4)

---

## 💡 Pro Tips

1. **Use a fresh wallet** for deployment to avoid nonce issues
2. **Deploy during low gas** (<30 gwei) to save costs
3. **Test on testnet first** if unsure
4. **Save all transaction hashes** for reference
5. **Document everything** as you go
6. **Double-check addresses** before announcing
7. **Keep private keys secure** - use hardware wallet for production

---

**Good luck with your redeployment! 🚀**

*Remember: EagleShareOFT MUST have the same address on ALL chains!*

