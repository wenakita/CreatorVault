# 🎯 Ethereum Mainnet Only Deployment

**Simplified deployment guide for Ethereum mainnet only**

---

## 📋 Deployment Scope

### ✅ What We're Deploying

**Ethereum Mainnet Only:**
1. **EagleRegistry** - Configuration registry
2. **EagleOVault** - Main ERC4626 vault (accepts WLFI + USD1)
3. **CharmStrategyUSD1** - Yield strategy (Charm Finance integration)
4. **EagleVaultWrapper** - Wraps vault shares for LayerZero
5. **EagleShareOFT** - OFT token for cross-chain (hub on Ethereum)

### ⏳ What We're NOT Deploying Yet

**Other Chains (Later):**
- BSC (Binance Smart Chain)
- Arbitrum
- Base
- Avalanche

**These will come later with CREATE2 to ensure EagleShareOFT has the same address everywhere.**

---

## 🚀 Simplified Deployment Flow

```
┌─────────────────────────────────────────────────────┐
│  ETHEREUM MAINNET ONLY                              │
│                                                      │
│  Step 1: Deploy EagleRegistry                       │
│          ↓                                           │
│  Step 2: Deploy EagleOVault (vault)                 │
│          ↓                                           │
│  Step 3: Deploy CharmStrategyUSD1 (strategy)        │
│          ↓                                           │
│  Step 4: Deploy EagleVaultWrapper (wrapper)         │
│          ↓                                           │
│  Step 5: Deploy EagleShareOFT (OFT hub)             │
│          ↓                                           │
│  Step 6: Configure contracts                        │
│          ↓                                           │
│  Step 7: Verify on Etherscan                        │
│          ↓                                           │
│  ✅ DONE! (for now)                                  │
└─────────────────────────────────────────────────────┘
```

---

## 📝 Deployment Commands

### Prerequisites

```bash
# Check environment
pnpm precheck

# Should have:
# ✅ PRIVATE_KEY set
# ✅ ETHEREUM_RPC_URL set
# ✅ ETHERSCAN_API_KEY set
# ✅ Wallet funded (need ~0.5 ETH for gas)
```

---

### Step 1: Deploy EagleRegistry

```bash
# Deploy registry first (other contracts need this)
pnpm deploy:registry --network ethereum

# Save the address
export REGISTRY_ADDRESS=<deployed-address>
```

**Verify:**
```bash
# Check registry deployed
cast code $REGISTRY_ADDRESS --rpc-url $ETHEREUM_RPC_URL
# Should return bytecode (not empty)

# Check LayerZero endpoint configured
cast call $REGISTRY_ADDRESS "getLayerZeroEndpoint(uint256)(address)" 1 --rpc-url $ETHEREUM_RPC_URL
# Should return LayerZero endpoint address
```

---

### Step 2: Deploy EagleOVault

```bash
# Deploy the main vault
pnpm deploy:vault --network ethereum

# Save the address
export VAULT_ADDRESS=<deployed-address>
```

**Verify:**
```bash
# Check vault deployed
cast code $VAULT_ADDRESS --rpc-url $ETHEREUM_RPC_URL

# Check vault accepts WLFI and USD1
cast call $VAULT_ADDRESS "asset()(address)" --rpc-url $ETHEREUM_RPC_URL
```

---

### Step 3: Deploy CharmStrategyUSD1

```bash
# Deploy the yield strategy
pnpm deploy:strategy --network ethereum

# Save the address
export STRATEGY_ADDRESS=<deployed-address>
```

**Verify:**
```bash
# Check strategy deployed
cast code $STRATEGY_ADDRESS --rpc-url $ETHEREUM_RPC_URL

# Check strategy connected to vault
cast call $STRATEGY_ADDRESS "vault()(address)" --rpc-url $ETHEREUM_RPC_URL
# Should return $VAULT_ADDRESS
```

---

### Step 4: Deploy EagleVaultWrapper

```bash
# Deploy the wrapper
pnpm deploy:wrapper --network ethereum

# Save the address
export WRAPPER_ADDRESS=<deployed-address>
```

**Verify:**
```bash
# Check wrapper deployed
cast code $WRAPPER_ADDRESS --rpc-url $ETHEREUM_RPC_URL

# Check wrapper points to vault
cast call $WRAPPER_ADDRESS "vault()(address)" --rpc-url $ETHEREUM_RPC_URL
# Should return $VAULT_ADDRESS

# Check wrapper points to registry
cast call $WRAPPER_ADDRESS "registry()(address)" --rpc-url $ETHEREUM_RPC_URL
# Should return $REGISTRY_ADDRESS
```

---

### Step 5: Deploy EagleShareOFT

```bash
# Deploy the OFT (hub on Ethereum)
pnpm deploy:oft --network ethereum

# Save the address
export OFT_ADDRESS=<deployed-address>
```

**Verify:**
```bash
# Check OFT deployed
cast code $OFT_ADDRESS --rpc-url $ETHEREUM_RPC_URL

# Check OFT points to wrapper
cast call $OFT_ADDRESS "wrapper()(address)" --rpc-url $ETHEREUM_RPC_URL
# Should return $WRAPPER_ADDRESS

# Check OFT is ERC20
cast call $OFT_ADDRESS "name()(string)" --rpc-url $ETHEREUM_RPC_URL
# Should return "Eagle Share OFT" or similar
```

---

### Step 6: Configure Contracts

```bash
# Set vault strategy
cast send $VAULT_ADDRESS "setStrategy(address)" $STRATEGY_ADDRESS \
  --private-key $PRIVATE_KEY \
  --rpc-url $ETHEREUM_RPC_URL

# Set wrapper OFT
cast send $WRAPPER_ADDRESS "setOFT(address)" $OFT_ADDRESS \
  --private-key $PRIVATE_KEY \
  --rpc-url $ETHEREUM_RPC_URL

# Grant necessary roles (if using AccessControl)
# ... additional configuration as needed
```

---

### Step 7: Verify on Etherscan

```bash
# Verify all contracts
pnpm verify:registry --network ethereum
pnpm verify:vault --network ethereum
pnpm verify:strategy --network ethereum
pnpm verify:wrapper --network ethereum
pnpm verify:oft --network ethereum
```

---

## ✅ Post-Deployment Checklist

### Contract Verification

- [ ] EagleRegistry deployed and verified
- [ ] EagleOVault deployed and verified
- [ ] CharmStrategyUSD1 deployed and verified
- [ ] EagleVaultWrapper deployed and verified
- [ ] EagleShareOFT deployed and verified

### Configuration Verification

- [ ] Registry has LayerZero endpoint configured
- [ ] Vault has strategy set
- [ ] Wrapper points to vault
- [ ] Wrapper points to registry
- [ ] OFT points to wrapper
- [ ] All roles/permissions set correctly

### Functional Testing

- [ ] Can deposit WLFI into vault
- [ ] Can deposit USD1 into vault
- [ ] Vault issues shares correctly
- [ ] Wrapper can wrap vault shares
- [ ] OFT can mint/burn correctly
- [ ] Strategy is earning yield

---

## 📊 Deployed Addresses

**Save these for frontend/backend configuration:**

```bash
# Ethereum Mainnet
REGISTRY_ADDRESS=<to-be-deployed>
VAULT_ADDRESS=<to-be-deployed>
STRATEGY_ADDRESS=<to-be-deployed>
WRAPPER_ADDRESS=<to-be-deployed>
OFT_ADDRESS=<to-be-deployed>
```

**Update these in:**
- `frontend/.env.production`
- `backend/.env.production`
- `README.md` (production addresses section)

---

## 🔄 Next Steps (Later)

### Phase 2: Multi-Chain Expansion

**When ready to expand to other chains:**

1. **Deploy with CREATE2** to ensure same OFT address
2. **Deploy on spoke chains:** BSC, Arbitrum, Base, Avalanche
3. **Configure LayerZero peers** between all chains
4. **Test cross-chain messaging**
5. **Update frontend** to support all chains

**See `CREATE2_DEPLOYMENT_GUIDE.md` for multi-chain deployment.**

---

## 🎯 Simplified Agent 0 Workflow

**For Ethereum-only deployment, Agent 0 will guide you through:**

### Phase 1: Backend Deployment (5 min)
- Start database
- Run migrations
- Start API server

### Phase 2: Contract Deployment (10 min)
- Deploy Registry
- Deploy Vault
- Deploy Strategy
- Deploy Wrapper
- Deploy OFT
- Configure all contracts

### Phase 3: Verification (5 min)
- Verify all contracts on Etherscan
- Run functional tests
- Check all configurations

### Phase 4: Frontend Deployment (5 min)
- Update frontend config with new addresses
- Deploy to Vercel
- Test wallet connection

### Phase 5: Backend Services (5 min)
- Update backend config
- Start indexer
- Start cron jobs

### Phase 6: Monitoring (5 min)
- Start monitoring stack
- Configure alerts
- Verify dashboards

**Total: ~35 minutes** (vs. ~45 minutes for multi-chain)

---

## 💡 Benefits of Ethereum-Only First

### Advantages

1. **Faster deployment** - Only 1 chain to deploy to
2. **Simpler testing** - No cross-chain complexity
3. **Lower gas costs** - Only pay gas on 1 chain
4. **Easier debugging** - Fewer moving parts
5. **Incremental approach** - Validate before expanding

### What Still Works

- ✅ Full vault functionality
- ✅ Yield generation via Charm
- ✅ WLFI + USD1 deposits
- ✅ Share wrapping
- ✅ OFT standard (ready for cross-chain later)

### What Doesn't Work Yet

- ❌ Cross-chain transfers (no spoke chains)
- ❌ Multi-chain liquidity
- ❌ Bridging between chains

**These will work once we deploy to other chains later.**

---

## 🚨 Important Notes

### Gas Costs

**Estimated gas for Ethereum deployment:**
- Registry: ~0.05 ETH
- Vault: ~0.10 ETH
- Strategy: ~0.08 ETH
- Wrapper: ~0.12 ETH
- OFT: ~0.10 ETH
- Configuration: ~0.05 ETH

**Total: ~0.5 ETH** (at current gas prices)

### Time Estimates

- Deployment: ~10 minutes
- Verification: ~5 minutes
- Configuration: ~5 minutes
- Testing: ~10 minutes

**Total: ~30 minutes**

---

## ✅ Ready to Deploy

**You're all set for Ethereum mainnet deployment!**

### Quick Start

```bash
# 1. Check environment
pnpm precheck

# 2. Start Agent 0
# (Open Composer and paste Agent 0 prompt)

# 3. Follow Agent 0's instructions
# Agent 0 will guide you through each step

# 4. Done!
# All contracts deployed on Ethereum mainnet
```

**Let's deploy! 🚀**

