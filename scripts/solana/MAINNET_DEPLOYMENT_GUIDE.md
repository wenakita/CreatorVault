# Solana Mainnet Deployment Guide

## 💰 Cost Estimate

**Program Size**: 254KB (260,096 bytes)

**Deployment Costs**:
- Rent-exempt balance: ~0.9 SOL
- Deployment transaction: ~0.1-0.2 SOL
- **Total Required**: ~**1.1-1.2 SOL**

**Current Balance**: 0.33 SOL ❌ INSUFFICIENT

## 📋 Prerequisites

### 1. Fund Your Wallet

You need at least **1.2 SOL** on mainnet:

```bash
# Check current balance
solana balance --url mainnet-beta

# Your wallet address:
# 7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY
```

**Where to get SOL**:
- Centralized exchanges (Coinbase, Binance, Kraken)
- DEX (Jupiter, Raydium)
- Bridge from other chains

### 2. Verify Program Binary

```bash
cd /home/akitav2/eagle-ovault-clean

# Check file exists and size
ls -lh target/deploy/eagle_registry_solana.so

# Verify it's the correct binary
sha256sum target/deploy/eagle_registry_solana.so
```

### 3. Backup Current Keys

```bash
# Backup your keypair
cp ~/.config/solana/id.json ~/solana-mainnet-backup-$(date +%Y%m%d).json

# Verify backup
ls -la ~/solana-mainnet-backup-*.json
```

## 🚀 Deployment Steps

### Option A: Fresh Deployment (New Program ID)

```bash
cd /home/akitav2/eagle-ovault-clean

# Generate new program keypair (if not using existing)
solana-keygen new -o target/deploy/eagle_registry_solana-keypair.json

# Deploy
solana program deploy \
  target/deploy/eagle_registry_solana.so \
  --url mainnet-beta \
  --keypair ~/.config/solana/id.json \
  --program-id target/deploy/eagle_registry_solana-keypair.json

# Initialize immediately after deployment
cd scripts/solana
MAINNET=true npm run initialize:simple
```

### Option B: Use Existing Devnet Program ID (Deterministic)

If you want the same address across networks:

```bash
# This would require CREATE2-style deployment
# Not directly supported by Solana
# Skip to Option A
```

### Option C: Deploy with Buffer (Cheaper Upgrades)

```bash
# Write to buffer first (cheaper to test)
solana program write-buffer \
  target/deploy/eagle_registry_solana.so \
  --url mainnet-beta \
  --keypair ~/.config/solana/id.json

# Get buffer address from output, then deploy
solana program deploy \
  --buffer <BUFFER_ADDRESS> \
  --program-id target/deploy/eagle_registry_solana-keypair.json \
  --url mainnet-beta
```

## 🔧 Post-Deployment

### 1. Verify Deployment

```bash
# Check program account
solana program show <PROGRAM_ID> --url mainnet-beta

# View on Explorer
echo "https://explorer.solana.com/address/<PROGRAM_ID>"
```

### 2. Initialize Registry

```bash
cd /home/akitav2/eagle-ovault-clean/scripts/solana

# Update the script for mainnet
export SOLANA_NETWORK=mainnet-beta
npm run initialize:simple
```

### 3. Register EVM Chains

After successful initialization:

```bash
# Register Ethereum
npm run register-chain -- --chain ethereum --eid 30101

# Register Base  
npm run register-chain -- --chain base --eid 30184

# Register Arbitrum
npm run register-chain -- --chain arbitrum --eid 30110

# Register BNB Chain
npm run register-chain -- --chain bnb --eid 30102

# Register Avalanche
npm run register-chain -- --chain avalanche --eid 30106

# Register Sonic
npm run register-chain -- --chain sonic --eid 30332
```

## ⚠️ Safety Considerations

### Before Deployment

- [ ] Code has been audited
- [ ] All tests pass
- [ ] Deployment cost understood
- [ ] Backup of all keys
- [ ] Emergency procedures documented

### Smart Contract Safety

- [ ] Upgrade authority set correctly
- [ ] Owner/admin roles configured
- [ ] Emergency pause mechanism tested
- [ ] Rate limiting in place
- [ ] Circuit breakers configured

### Mainnet Checklist

- [ ] Sufficient SOL balance (1.2+ SOL)
- [ ] Correct RPC endpoint (mainnet-beta)
- [ ] Program binary verified
- [ ] Keys backed up
- [ ] Deployment script tested on devnet
- [ ] Monitoring/alerting ready
- [ ] Team notified

## 📊 Cost Breakdown

| Item | Estimated Cost |
|------|---------------|
| Program Account Rent | ~0.9 SOL |
| Deployment Transaction | ~0.1 SOL |
| Initialization Transaction | ~0.01 SOL |
| **Total** | **~1.01 SOL** |
| **Recommended Balance** | **1.5 SOL** (with buffer) |

## 🔄 Upgrade Process (Future)

Once deployed, you can upgrade the program:

```bash
# Build new version
anchor build

# Deploy upgrade
solana program deploy \
  target/deploy/eagle_registry_solana.so \
  --program-id <EXISTING_PROGRAM_ID> \
  --upgrade-authority ~/.config/solana/id.json \
  --url mainnet-beta
```

**Upgrade Cost**: ~0.5 SOL (only pays for increased size)

## 📞 Support

If deployment fails:
1. Check transaction on Solscan
2. Verify SOL balance
3. Check RPC endpoint status
4. Review program logs
5. Ensure program binary is valid

## 🎯 Next Steps After Deployment

1. ✅ Deploy program
2. ✅ Initialize registry
3. ✅ Register EVM chains
4. 🔄 Test cross-chain messaging
5. 🔄 Update frontend with mainnet program ID
6. 🔄 Enable mainnet in production
7. 🔄 Monitor program performance
8. 🔄 Set up alerts and dashboards

## 📝 Mainnet Configuration

Update your configuration files:

**Frontend** (`frontend/.env.production`):
```env
VITE_SOLANA_PROGRAM_ID=<MAINNET_PROGRAM_ID>
VITE_SOLANA_RPC=https://api.mainnet-beta.solana.com
VITE_SOLANA_NETWORK=mainnet-beta
```

**Registry Config**:
- LayerZero Mainnet Endpoint: `76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6`
- Authority: `7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY`

## ⚡ Production RPC Endpoints

Free tier (rate limited):
- `https://api.mainnet-beta.solana.com`

Paid/Better performance:
- Helius: `https://mainnet.helius-rpc.com/?api-key=<YOUR_KEY>`
- QuickNode: `https://your-endpoint.quiknode.pro/...`
- Alchemy: `https://solana-mainnet.g.alchemy.com/v2/<YOUR_KEY>`
- GenesysGo: `https://ssc-dao.genesysgo.net/`

## 🎉 Success Criteria

Deployment is successful when:
- ✅ Program deployed to mainnet
- ✅ Program account is rent-exempt
- ✅ Initialize transaction succeeds
- ✅ Registry PDA created
- ✅ Can query registry state
- ✅ Cross-chain messaging works

---

**Ready to deploy?** Ensure you have **1.2+ SOL** and run the deployment script!

