# 🚀 Deployment Order - Step by Step

**IMPORTANT:** This is the ORDER you deploy, while agents are preparing the tools in parallel.

---

## ⏱️ Timeline Overview

```
┌─────────────────────────────────────────────────────────────┐
│  PARALLEL: Agents Preparing Tools (60 minutes)              │
│  Agent 2: Backend + Prisma                                  │
│  Agent 3: Testing Suite                                     │
│  Agent 4: Security Audit                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    (After agents finish)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  SEQUENTIAL: You Deploy (30-40 minutes)                     │
│  Follow the order below ↓                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Deployment Phases

### **Phase 0: Preparation (While Agents Work)**

**Do this NOW while agents are running:**

#### 1. Setup Environment
```bash
# Copy environment template
cp .env.deployment.template .env

# Edit with your actual values
nano .env  # or vim, code, etc.
```

**Required values:**
```bash
PRIVATE_KEY=0xYOUR_ACTUAL_PRIVATE_KEY
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=your_etherscan_key
```

#### 2. Fund Your Wallet
Transfer to your deployment wallet:
- **3.6 ETH** for Ethereum deployment
- **0.5 BNB** for BSC
- **0.1 ETH** for Arbitrum
- **0.05 ETH** for Base
- **1 AVAX** for Avalanche

#### 3. Run Pre-Flight Checks
```bash
# Install dependencies (if not done)
pnpm install
forge install

# Run checks
pnpm precheck
```

**Wait for:** ✅ All checks pass

---

### **Phase 1: Wait for Agents to Finish**

**Do NOT deploy until all agents complete!**

Check progress:
- [ ] Agent 2: Backend + Prisma complete
- [ ] Agent 3: Testing suite complete
- [ ] Agent 4: Security audit complete

**Estimated wait:** 60 minutes

---

### **Phase 2: Review Agent Outputs (10 minutes)**

Once agents finish, review their work:

#### Review Agent 2 (Backend)
```bash
# Check backend was created
ls -la backend/

# Review database schema
cat backend/prisma/schema.prisma

# Check API endpoints
cat backend/src/api/README.md
```

#### Review Agent 3 (Testing)
```bash
# Check tests exist
ls -la test/

# Run tests to ensure they pass
forge test -vv
```

#### Review Agent 4 (Security)
```bash
# Read security audit
cat SECURITY_AUDIT_REPORT.md

# Check for critical issues
grep -i "critical\|high" SECURITY_AUDIT_REPORT.md

# Review known risks
cat KNOWN_RISKS.md
```

**STOP if:** Any critical security issues found!

---

### **Phase 3: Deploy Backend Infrastructure (15 minutes)**

**Deploy backend FIRST** so it can start indexing immediately when contracts deploy.

#### 3.1: Setup Database
```bash
cd backend

# Start PostgreSQL with Docker
docker-compose up -d postgres

# Run Prisma migrations
npx prisma migrate deploy

# Verify database is ready
npx prisma db seed  # Optional: seed initial data
```

#### 3.2: Deploy Backend API
```bash
# Option A: Local (for testing)
npm run dev

# Option B: Deploy to Railway/Render/Fly.io
# Follow backend/DEPLOYMENT.md (created by Agent 2)

# Verify API is running
curl http://localhost:3000/api/health
```

**Wait for:** ✅ Backend API running and healthy

---

### **Phase 4: Deploy Smart Contracts (20 minutes)**

**Now deploy contracts in this order:**

#### 4.1: Deploy to Ethereum (Hub Chain)
```bash
# Deploy vault + strategy + wrapper + OFT
./deploy.sh

# Select option 5: Deploy to Ethereum Mainnet
# OR run directly:
forge script script/DeployVanityVault.s.sol:DeployVanityVault \
  --rpc-url $ETHEREUM_RPC_URL \
  --broadcast \
  --verify \
  --slow
```

**Save these addresses:**
```bash
VAULT_ADDRESS=0x...
STRATEGY_ADDRESS=0x...
WRAPPER_ADDRESS=0x...
OFT_ADDRESS=0x...
```

**Verify deployment:**
```bash
npx hardhat run scripts/validation/validate-ethereum.ts --network ethereum
```

**Wait for:** ✅ All Ethereum contracts deployed and verified

#### 4.2: Update Backend with Contract Addresses
```bash
# Update backend/.env
cd backend
nano .env

# Add contract addresses
VAULT_ADDRESS=0x...
STRATEGY_ADDRESS=0x...
WRAPPER_ADDRESS=0x...
OFT_ADDRESS=0x...

# Restart backend to start indexing
docker-compose restart backend
```

#### 4.3: Deploy to Spoke Chains (Parallel)

**⭐ CRITICAL: EagleShareOFT MUST have same address on all chains! ⭐**

Before deploying to spokes, verify the Ethereum address:
```bash
# Get Ethereum EagleShareOFT address
ETHEREUM_OFT_ADDRESS=$(cast call $VAULT_ADDRESS "oft()" --rpc-url $ETHEREUM_RPC_URL)
echo "Ethereum OFT: $ETHEREUM_OFT_ADDRESS"

# This MUST be the same on ALL spoke chains!
```

**You can deploy to all spoke chains at the same time:**

```bash
# Open 4 terminal windows and run simultaneously:

# Terminal 1: BSC
forge script script/multi-chain/DeployBSC.s.sol \
  --rpc-url $BSC_RPC_URL \
  --broadcast \
  --verify

# Terminal 2: Arbitrum
forge script script/DeployArbitrum.s.sol \
  --rpc-url $ARBITRUM_RPC_URL \
  --broadcast \
  --verify

# Terminal 3: Base
forge script script/multi-chain/DeployBase.s.sol \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify

# Terminal 4: Avalanche
forge script script/multi-chain/DeployAvalanche.s.sol \
  --rpc-url $AVALANCHE_RPC_URL \
  --broadcast \
  --verify
```

**Verify same address on all chains:**
```bash
# Check each chain has the SAME address
echo "Ethereum:  $(cast call $VAULT_ADDRESS 'oft()' --rpc-url $ETHEREUM_RPC_URL)"
echo "BSC:       $(cast code 0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61 --rpc-url $BSC_RPC_URL | head -c 10)"
echo "Arbitrum:  $(cast code 0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61 --rpc-url $ARBITRUM_RPC_URL | head -c 10)"
echo "Base:      $(cast code 0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61 --rpc-url $BASE_RPC_URL | head -c 10)"
echo "Avalanche: $(cast code 0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61 --rpc-url $AVALANCHE_RPC_URL | head -c 10)"

# All should have bytecode (not 0x)
# All should be the SAME address!
```

**Save the universal address:**
```bash
OFT_ADDRESS=0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61  # Same on ALL chains
```

**Wait for:** ✅ All spoke chains deployed with SAME address

---

### **Phase 5: Configure LayerZero (10 minutes)**

**Connect all chains together:**

#### 5.1: Set Peers
```bash
# Configure all cross-chain connections
pnpm configure:all

# This sets up:
# - Ethereum ↔ BSC
# - Ethereum ↔ Arbitrum
# - Ethereum ↔ Base
# - Ethereum ↔ Avalanche
```

#### 5.2: Configure DVN
```bash
# Configure Decentralized Verifier Network for each chain
pnpm configure-dvn:bsc
pnpm configure-dvn:arbitrum
pnpm configure-dvn:base
pnpm configure-dvn:avalanche
```

#### 5.3: Verify Connections
```bash
# Verify peers are set correctly
pnpm verify:bsc
pnpm verify:arbitrum
pnpm verify:base
pnpm verify:avalanche
```

**Wait for:** ✅ All LayerZero connections verified

---

### **Phase 6: Run Tests (15 minutes)**

**Test everything before going live:**

#### 6.1: Smart Contract Tests
```bash
# Run full test suite
forge test -vv

# Run integration tests
npx hardhat test
```

#### 6.2: Functional Tests
```bash
# Test deposit
npx hardhat run scripts/testing/test-deposit.ts --network ethereum

# Test withdrawal
npx hardhat run scripts/testing/test-withdrawal.ts --network ethereum

# Test strategy deployment
npx hardhat run scripts/testing/test-strategy-deployment.ts --network ethereum

# Test cross-chain transfer
npx hardhat run scripts/testing/test-cross-chain.ts --network bsc
```

#### 6.3: Backend Tests
```bash
cd backend

# Test API endpoints
npm run test

# Test indexer is syncing
curl http://localhost:3000/api/vault/stats
```

**Wait for:** ✅ All tests passing

---

### **Phase 7: Deploy Frontend (10 minutes)**

**Last step - deploy the UI:**

#### 7.1: Update Frontend Config
```bash
cd frontend

# Copy production env
cp .env.example .env.production

# Edit with contract addresses
nano .env.production
```

**Add all addresses:**
```bash
VITE_VAULT_ADDRESS=0x...
VITE_OFT_ADDRESS=0x...
VITE_WRAPPER_ADDRESS=0x...
VITE_STRATEGY_ADDRESS=0x...
VITE_BACKEND_API_URL=https://your-backend.railway.app
```

#### 7.2: Build & Deploy
```bash
# Build frontend
npm run build

# Test locally
npm run preview

# Deploy to Vercel
vercel --prod
```

**Wait for:** ✅ Frontend live and accessible

---

### **Phase 8: Start Monitoring (5 minutes)**

**Set up monitoring before announcing:**

#### 8.1: Start Monitoring Services
```bash
# Start Grafana + Prometheus (created by Agent 4)
cd monitoring
docker-compose up -d

# Access dashboards
open http://localhost:3000  # Grafana
```

#### 8.2: Start Security Monitoring
```bash
# Run security monitoring scripts
npm run monitor:security

# This watches for:
# - Large transactions
# - Access control changes
# - Oracle price deviations
# - Unusual activity
```

#### 8.3: Set Up Alerts
```bash
# Configure alerts (Slack/Discord/Email)
# Follow monitoring/ALERT_SETUP.md (created by Agent 4)
```

**Wait for:** ✅ Monitoring active

---

### **Phase 9: Final Verification (10 minutes)**

**Last checks before going live:**

```bash
# Run complete validation
npx hardhat run scripts/validation/validate-all.ts

# Check vault state
npx hardhat run scripts/check-current-vault-state.ts --network ethereum

# Check Charm integration
npx hardhat run scripts/check-charm-success.ts --network ethereum

# Verify backend is indexing
curl http://localhost:3000/api/vault/history

# Test frontend end-to-end
# - Connect wallet
# - Make small test deposit
# - Verify it shows in UI
# - Verify backend tracked it
```

**Checklist:**
- [ ] All contracts deployed and verified
- [ ] Backend indexing blockchain events
- [ ] All tests passing
- [ ] Cross-chain transfers working
- [ ] Frontend showing correct data
- [ ] Monitoring active
- [ ] No critical security issues

---

### **Phase 10: Go Live! 🎉**

**You're ready to launch!**

#### 10.1: Make Announcement
- Tweet about launch
- Update Discord/Telegram
- Post on relevant forums
- Update documentation with live addresses

#### 10.2: Monitor Closely
**First 24 hours are critical:**
- Watch for unusual transactions
- Monitor gas costs
- Check for errors in logs
- Respond to user questions
- Be ready to pause if needed

#### 10.3: Start Small
- Recommend small deposits initially
- Test with your own funds first
- Gradually increase exposure
- Collect user feedback

---

## 📊 Complete Timeline

| Phase | Task | Time | Can Start |
|-------|------|------|-----------|
| 0 | Preparation | 10 min | NOW (while agents work) |
| 1 | Wait for agents | 60 min | After Phase 0 |
| 2 | Review outputs | 10 min | After agents finish |
| 3 | Deploy backend | 15 min | After Phase 2 |
| 4 | Deploy contracts | 20 min | After Phase 3 |
| 5 | Configure LayerZero | 10 min | After Phase 4 |
| 6 | Run tests | 15 min | After Phase 5 |
| 7 | Deploy frontend | 10 min | After Phase 6 |
| 8 | Start monitoring | 5 min | After Phase 7 |
| 9 | Final verification | 10 min | After Phase 8 |
| 10 | Go live! | - | After Phase 9 |

**Total time:** ~2.5 hours (including 1 hour waiting for agents)

---

## 🎯 Critical Order Rules

### ✅ DO Deploy In This Order:
1. **Backend FIRST** (so it's ready to index)
2. **Ethereum contracts** (hub chain)
3. **Spoke chain contracts** (can be parallel)
4. **LayerZero config** (connect chains)
5. **Frontend LAST** (after everything works)

### ❌ DON'T:
- Deploy contracts before backend is ready
- Deploy frontend before contracts work
- Skip testing phases
- Announce before monitoring is active
- Deploy to mainnet without testing

---

## 🚨 Emergency Procedures

### If Something Goes Wrong:

#### During Contract Deployment:
```bash
# Pause immediately
npx hardhat run scripts/emergency/pause-all.ts --network ethereum
```

#### After Deployment:
```bash
# Emergency withdrawal
npx hardhat run scripts/emergency/emergency-withdraw.ts --network ethereum

# Revoke compromised roles
npx hardhat run scripts/emergency/revoke-roles.ts --network ethereum
```

#### Backend Issues:
```bash
# Stop backend
cd backend
docker-compose down

# Check logs
docker-compose logs backend

# Fix and restart
docker-compose up -d
```

---

## 📞 Quick Reference

### Current Status Check:
```bash
# Check everything at once
./check-deployment-status.sh  # (You can create this)

# Or individually:
pnpm precheck                  # Environment
forge test -vv                 # Contracts
curl http://localhost:3000/api/health  # Backend
curl https://your-frontend.vercel.app  # Frontend
```

### Useful Commands:
```bash
# Deployment
./deploy.sh                    # Interactive deployment
pnpm precheck                  # Pre-flight checks

# Validation
npx hardhat run scripts/validation/validate-all.ts

# Monitoring
npm run monitor:security       # Security monitoring
docker-compose logs -f         # Backend logs

# Emergency
npx hardhat run scripts/emergency/pause-all.ts
```

---

## ✅ Final Checklist

Before going live:
- [ ] Phase 0: Environment configured, wallet funded
- [ ] Phase 1: All agents finished
- [ ] Phase 2: Reviewed all agent outputs
- [ ] Phase 3: Backend deployed and indexing
- [ ] Phase 4: All contracts deployed
- [ ] Phase 5: LayerZero configured
- [ ] Phase 6: All tests passing
- [ ] Phase 7: Frontend deployed
- [ ] Phase 8: Monitoring active
- [ ] Phase 9: Final verification complete
- [ ] Phase 10: Ready to announce!

---

**Good luck with your deployment! 🚀**

*Remember: Take your time, follow the order, and don't skip testing!*

