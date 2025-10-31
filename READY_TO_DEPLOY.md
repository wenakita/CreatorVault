# 🚀 READY TO DEPLOY - Eagle OVault Production

**Status:** ✅ ALL SYSTEMS GO  
**Date:** October 31, 2025  
**Network:** Ethereum Mainnet  
**Strategy:** Mixed Vanity Addresses

---

## ✅ Pre-Flight Checklist Complete

- ✅ EagleShareOFT vanity address generated: `0x47E593E960334B5ac4Ab8EA2495141a30c0eA91E`
- ✅ EagleShareOFT updated to use EagleRegistry
- ✅ All contracts compile successfully
- ✅ Deployment script updated with correct salts
- ✅ Environment variables configured
- ✅ Vanity address verification logic updated

---

## 📦 Contracts Ready for Deployment

| Contract | Address | Pattern | Status |
|----------|---------|---------|--------|
| **EagleRegistry** | `0x47c2e78bCCCdF3E4Ad835c1c2df3Fb760b0EA91E` | `0x47...ea91e` | Already Deployed ✅ |
| **EagleOVault** | `0x47b12BFd18dfe769687a5A72AdA7C281A86BE8D6` | `0x47...` | Ready 🟢 |
| **EagleShareOFT** | `0x47E593E960334B5ac4Ab8EA2495141a30c0eA91E` | `0x47...ea91e` | Ready 🟢 (PREMIUM) |
| **EagleVaultWrapper** | `0x475bEB9BAC7BD0eA9F0458AD0D50Ea7f8f4e94b3` | `0x47...` | Ready 🟢 |
| **CharmStrategyUSD1** | `0x4732CE204d399e0f02D9BB6FE439f2e4d243C2Db` | `0x47...` | Ready 🟢 |

---

## 🎯 Deployment Methods

### Method 1: Automated Script (Recommended)
```bash
cd /home/akitav2/.cursor/worktrees/eagle-ovault-clean__WSL__ubuntu-24.04_/8fkjs
./DEPLOY_COMMANDS.sh
```

**Features:**
- ✅ Includes 10-second safety delay
- ✅ Verifies environment variables
- ✅ Auto-verifies on Etherscan
- ✅ Verbose output for debugging
- ✅ Shows deployment summary

---

### Method 2: Manual Command
```bash
cd /home/akitav2/.cursor/worktrees/eagle-ovault-clean__WSL__ubuntu-24.04_/8fkjs

source .env

forge script script/DeployProductionVanity.s.sol:DeployProductionVanity \
  --rpc-url $ETHEREUM_RPC_URL \
  --broadcast \
  --verify \
  --slow \
  -vvv
```

---

### Method 3: Deploy Without Verification (Faster)
If Etherscan verification is slow or you want to verify manually later:

```bash
cd /home/akitav2/.cursor/worktrees/eagle-ovault-clean__WSL__ubuntu-24.04_/8fkjs

source .env

forge script script/DeployProductionVanity.s.sol:DeployProductionVanity \
  --rpc-url $ETHEREUM_RPC_URL \
  --broadcast \
  --slow \
  -vvv
```

Then verify manually later:
```bash
forge verify-contract <ADDRESS> <CONTRACT> --chain-id 1 --watch
```

---

## 💰 Estimated Costs

**Gas Estimates (at current gas prices):**

| Gas Price | Total Cost | Per Contract |
|-----------|------------|--------------|
| 30 gwei | ~0.32 ETH | ~0.08 ETH |
| 50 gwei | ~0.53 ETH | ~0.13 ETH |
| 100 gwei | ~1.05 ETH | ~0.26 ETH |

**Total Gas:** ~10.5M gas for all 4 contracts

---

## ⚠️ CRITICAL: Immediate Post-Deployment Actions

### 1. Verify Addresses (Automatic)
The script will automatically verify that deployed addresses match expected vanity addresses.

### 2. Transfer Ownership to Multisig (MANUAL - DO THIS IMMEDIATELY!)

**Multisig Address:** `0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3`

For each contract, run:
```solidity
// EagleOVault
cast send <VAULT_ADDRESS> "transferOwnership(address)" 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3 \
  --rpc-url $ETHEREUM_RPC_URL \
  --private-key $PRIVATE_KEY

// EagleShareOFT
cast send <OFT_ADDRESS> "transferOwnership(address)" 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3 \
  --rpc-url $ETHEREUM_RPC_URL \
  --private-key $PRIVATE_KEY

// EagleVaultWrapper
cast send <WRAPPER_ADDRESS> "transferOwnership(address)" 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3 \
  --rpc-url $ETHEREUM_RPC_URL \
  --private-key $PRIVATE_KEY

// CharmStrategyUSD1
cast send <STRATEGY_ADDRESS> "transferOwnership(address)" 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3 \
  --rpc-url $ETHEREUM_RPC_URL \
  --private-key $PRIVATE_KEY
```

### 3. Verify on Etherscan
If auto-verification fails, manually verify each contract on Etherscan.

### 4. Initial Testing
- Deposit max 100 WLFI for testing
- Test wrap/unwrap functionality
- Verify share calculations
- Test withdrawals

---

## 🔒 Security Checklist

- [ ] Deployer wallet has sufficient ETH
- [ ] Multisig address is correct: `0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3`
- [ ] EagleRegistry is deployed and configured
- [ ] All vanity addresses are verified
- [ ] Ownership will be transferred immediately after deployment
- [ ] Initial testing will use small amounts only

---

## 📊 Deployment Timeline

1. **Start Deployment:** 0 min
2. **Deploy EagleOVault:** ~2 min
3. **Deploy EagleShareOFT:** ~2 min
4. **Deploy EagleVaultWrapper:** ~2 min
5. **Deploy CharmStrategyUSD1:** ~2 min
6. **Etherscan Verification:** ~2-5 min (automatic)
7. **Total Time:** ~10-15 minutes

---

## 🆘 Troubleshooting

### If deployment fails:
1. Check gas price and increase if needed
2. Verify RPC URL is working
3. Check deployer has sufficient ETH
4. Review error message in output

### If verification fails:
1. Wait 1-2 minutes for Etherscan to index
2. Manually verify using `forge verify-contract`
3. Or verify via Etherscan UI

### If address mismatch:
1. **STOP IMMEDIATELY**
2. Do NOT proceed with deployment
3. Check that bytecode hasn't changed
4. Regenerate vanity salt if needed

---

## 📝 Deployment Log Template

```
═══════════════════════════════════════════════════════════
EAGLE OVAULT PRODUCTION DEPLOYMENT
═══════════════════════════════════════════════════════════

Deployment Date: _______________
Deployment Time: _______________
Network: Ethereum Mainnet (Chain ID: 1)
Deployer Address: _______________
Gas Price: _______________ gwei
Total Gas Used: _______________ gas
Total Cost: _______________ ETH

DEPLOYED ADDRESSES:
───────────────────────────────────────────────────────────
EagleOVault:        _______________
EagleShareOFT:      _______________
EagleVaultWrapper:  _______________
CharmStrategyUSD1:  _______________

VANITY VERIFICATION:
───────────────────────────────────────────────────────────
EagleOVault:        [ ] 0x47... ✓
EagleShareOFT:      [ ] 0x47...ea91e ✅
EagleVaultWrapper:  [ ] 0x47... ✓
CharmStrategyUSD1:  [ ] 0x47... ✓

ETHERSCAN LINKS:
───────────────────────────────────────────────────────────
Vault:     https://etherscan.io/address/_______________
OFT:       https://etherscan.io/address/_______________
Wrapper:   https://etherscan.io/address/_______________
Strategy:  https://etherscan.io/address/_______________

POST-DEPLOYMENT:
───────────────────────────────────────────────────────────
[ ] All addresses verified
[ ] Ownership transferred to multisig
[ ] Contracts verified on Etherscan
[ ] Initial testing completed
[ ] Roles and limits configured

NOTES:
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

═══════════════════════════════════════════════════════════
```

---

## 🎉 Ready to Deploy!

**When you're ready, run:**

```bash
cd /home/akitav2/.cursor/worktrees/eagle-ovault-clean__WSL__ubuntu-24.04_/8fkjs
./DEPLOY_COMMANDS.sh
```

**Or use the manual command from Method 2 above.**

---

**Good luck! 🦅🚀**

