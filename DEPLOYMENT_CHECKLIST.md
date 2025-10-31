# 🚀 Eagle OVault Deployment Checklist

**Last Updated:** October 31, 2025  
**Status:** Ready for Production Deployment

---

## 📋 Pre-Deployment Checklist

### 1. Environment Setup

- [ ] **Create `.env` file** from `.env.example`
  ```bash
  cp .env.example .env
  ```

- [ ] **Set Private Key** (CRITICAL - Keep Secure!)
  ```bash
  PRIVATE_KEY=0x... # Your deployment wallet private key
  ```

- [ ] **Set RPC URLs**
  ```bash
  # Mainnet
  ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
  
  # Spoke Chains
  BSC_RPC_URL=https://bsc-rpc.publicnode.com
  ARBITRUM_RPC_URL=https://arbitrum-rpc.publicnode.com
  BASE_RPC_URL=https://base-rpc.publicnode.com
  AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
  ```

- [ ] **Set Etherscan API Keys** (for contract verification)
  ```bash
  ETHERSCAN_API_KEY=your_key_here
  ARBISCAN_API_KEY=your_key_here
  BASESCAN_API_KEY=your_key_here
  ```

- [ ] **Set Role Addresses** (or use deployer address for all)
  ```bash
  OWNER_ADDRESS=0x...
  MANAGER_ADDRESS=0x...
  KEEPER_ADDRESS=0x...
  EMERGENCY_ADMIN_ADDRESS=0x...
  FEE_RECIPIENT=0x...
  ```

### 2. Wallet Funding

Based on gas estimates, ensure your deployment wallet has:

- [ ] **Ethereum Mainnet:** ~3.6 ETH
  - EagleOVault: ~1.2 ETH
  - CharmStrategyUSD1: ~1.0 ETH
  - EagleVaultWrapper: ~1.0 ETH
  - EagleShareOFT: ~0.4 ETH

- [ ] **BSC:** ~0.5 BNB
- [ ] **Arbitrum:** ~0.1 ETH
- [ ] **Base:** ~0.05 ETH
- [ ] **Avalanche:** ~1 AVAX

### 3. Dependencies & Build

- [ ] **Install Dependencies**
  ```bash
  pnpm install
  # or
  npm install
  ```

- [ ] **Install Foundry Dependencies**
  ```bash
  forge install
  ```

- [ ] **Compile Contracts**
  ```bash
  forge build
  # Verify all contracts compile successfully
  ```

- [ ] **Run Tests**
  ```bash
  forge test -vv
  # Ensure all tests pass (71/71 expected)
  ```

### 4. Code Review

- [ ] **Review Contract Sizes**
  ```bash
  forge build --sizes
  ```
  - EagleOVault: ~27 KB ✅
  - EagleVaultWrapper: ~44 KB ✅
  - EagleShareOFT: ~35 KB ✅
  - CharmStrategyUSD1: ~40 KB ✅

- [ ] **Check for TODO/FIXME comments**
  ```bash
  grep -r "TODO\|FIXME" contracts/
  ```

- [ ] **Review Access Control**
  - Owner roles properly set
  - Manager roles configured
  - Emergency admin set

---

## 🎯 Deployment Steps

### Phase 1: Ethereum Mainnet (Hub Chain)

#### Step 1.1: Deploy Core Vault System

```bash
# Deploy EagleOVault + CharmStrategyUSD1 + EagleVaultWrapper
forge script script/DeployVanityVault.s.sol:DeployVanityVault \
  --rpc-url $ETHEREUM_RPC_URL \
  --broadcast \
  --verify \
  --slow
```

**Expected Outputs:**
- ✅ EagleOVault deployed
- ✅ CharmStrategyUSD1 deployed
- ✅ EagleVaultWrapper deployed
- ✅ Strategy connected to vault
- ✅ Wrapper connected to vault

**Save Addresses:**
```bash
VAULT_ADDRESS=0x...
STRATEGY_ADDRESS=0x...
WRAPPER_ADDRESS=0x...
```

#### Step 1.2: Deploy LayerZero OFT

```bash
# Deploy EagleShareOFT on Ethereum
forge script script/layerzero/DeployEagleShareOFT.s.sol \
  --rpc-url $ETHEREUM_RPC_URL \
  --broadcast \
  --verify
```

**Save Address:**
```bash
OFT_ADDRESS=0x...
```

#### Step 1.3: Initial Configuration

```bash
# Set deployment threshold (e.g., 1000 USD worth)
npx hardhat run scripts/set-deployment-threshold.ts --network ethereum

# Verify strategy approvals
npx hardhat run scripts/check-strategy-approvals.ts --network ethereum

# Check vault state
npx hardhat run scripts/check-current-vault-state.ts --network ethereum
```

### Phase 2: Deploy to Spoke Chains

#### Step 2.1: BSC Deployment

```bash
# Deploy EagleShareOFT on BSC
forge script script/multi-chain/DeployBSC.s.sol \
  --rpc-url $BSC_RPC_URL \
  --broadcast \
  --verify
```

**Save Address:**
```bash
BSC_OFT_ADDRESS=0x...
```

#### Step 2.2: Arbitrum Deployment

```bash
# Deploy EagleShareOFT on Arbitrum
forge script script/DeployArbitrum.s.sol \
  --rpc-url $ARBITRUM_RPC_URL \
  --broadcast \
  --verify
```

**Save Address:**
```bash
ARBITRUM_OFT_ADDRESS=0x...
```

#### Step 2.3: Base Deployment

```bash
# Deploy EagleShareOFT on Base
forge script script/multi-chain/DeployBase.s.sol \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify
```

**Save Address:**
```bash
BASE_OFT_ADDRESS=0x...
```

#### Step 2.4: Avalanche Deployment

```bash
# Deploy EagleShareOFT on Avalanche
forge script script/multi-chain/DeployAvalanche.s.sol \
  --rpc-url $AVALANCHE_RPC_URL \
  --broadcast \
  --verify
```

**Save Address:**
```bash
AVALANCHE_OFT_ADDRESS=0x...
```

### Phase 3: Configure LayerZero Connections

#### Step 3.1: Set Peers

```bash
# Configure cross-chain connections for all chains
pnpm configure:all

# Or configure individually:
pnpm configure:bsc
pnpm configure:arbitrum
pnpm configure:base
pnpm configure:avalanche
```

#### Step 3.2: Configure DVN (Decentralized Verifier Network)

```bash
# Configure LayerZero DVN for each chain
pnpm configure-dvn:bsc
pnpm configure-dvn:arbitrum
pnpm configure-dvn:base
pnpm configure-dvn:avalanche
```

#### Step 3.3: Verify Connections

```bash
# Verify peers are set correctly
pnpm verify:bsc
pnpm verify:arbitrum
pnpm verify:base
pnpm verify:avalanche
```

---

## ✅ Post-Deployment Verification

### 1. Contract Verification

- [ ] **Verify on Etherscan**
  ```bash
  # Should auto-verify with --verify flag
  # Manual verification if needed:
  forge verify-contract $VAULT_ADDRESS EagleOVault --chain-id 1
  ```

- [ ] **Verify on BSCScan**
- [ ] **Verify on Arbiscan**
- [ ] **Verify on BaseScan**
- [ ] **Verify on SnowTrace (Avalanche)**

### 2. Functional Testing

#### Ethereum Tests

- [ ] **Test Vault Deposit**
  ```bash
  npx hardhat run scripts/test-vault-deposit.ts --network ethereum
  ```

- [ ] **Test Strategy Deployment**
  ```bash
  # Deposit some tokens and trigger strategy deployment
  npx hardhat run scripts/trigger-strategy-deployment.ts --network ethereum
  ```

- [ ] **Check Charm Position**
  ```bash
  npx hardhat run scripts/check-charm-success.ts --network ethereum
  ```

- [ ] **Test Wrapper Conversion**
  ```bash
  npx hardhat run scripts/test-wrapper-conversion.ts --network ethereum
  ```

#### Cross-Chain Tests

- [ ] **Test BSC → Ethereum Transfer**
  ```bash
  pnpm test-bsc-arbitrum
  ```

- [ ] **Test Arbitrum → Ethereum Transfer**
- [ ] **Test Base → Ethereum Transfer**
- [ ] **Test Avalanche → Ethereum Transfer**

### 3. Access Control Verification

- [ ] **Verify Owner Role**
  ```bash
  cast call $VAULT_ADDRESS "owner()" --rpc-url $ETHEREUM_RPC_URL
  ```

- [ ] **Verify Manager Role**
  ```bash
  cast call $VAULT_ADDRESS "hasRole(bytes32,address)" \
    $(cast --format-bytes32-string "MANAGER_ROLE") \
    $MANAGER_ADDRESS \
    --rpc-url $ETHEREUM_RPC_URL
  ```

- [ ] **Verify Keeper Role**
- [ ] **Verify Emergency Admin**

### 4. Integration Checks

- [ ] **Charm Finance Integration**
  - Verify strategy can deposit to Charm
  - Verify strategy can withdraw from Charm
  - Check LP position in Charm vault

- [ ] **Oracle Checks**
  - Verify Chainlink price feeds working
  - Verify Uniswap TWAP working
  - Check price deviation thresholds

- [ ] **LayerZero Integration**
  - Verify endpoint addresses
  - Check peer connections
  - Test message passing

---

## 🌐 Frontend Deployment

### 1. Environment Setup

- [ ] **Create Frontend `.env.production`**
  ```bash
  cd frontend
  cp .env.example .env.production
  ```

- [ ] **Update Contract Addresses**
  ```bash
  VITE_VAULT_ADDRESS=0x...
  VITE_OFT_ADDRESS=0x...
  VITE_WRAPPER_ADDRESS=0x...
  VITE_STRATEGY_ADDRESS=0x...
  ```

- [ ] **Set WalletConnect Project ID**
  ```bash
  # Get from https://cloud.walletconnect.com
  VITE_WALLETCONNECT_PROJECT_ID=your_project_id
  ```

- [ ] **Set Alchemy Keys** (optional, for Account Kit)
  ```bash
  VITE_ALCHEMY_API_KEY=your_key
  VITE_ALCHEMY_GAS_POLICY_ID=your_policy_id
  ```

### 2. Build & Deploy

- [ ] **Install Frontend Dependencies**
  ```bash
  cd frontend
  npm install
  ```

- [ ] **Build Frontend**
  ```bash
  npm run build
  ```

- [ ] **Test Build Locally**
  ```bash
  npm run preview
  ```

### 3. Deploy to Vercel

- [ ] **Connect GitHub Repository to Vercel**
- [ ] **Set Root Directory:** `frontend`
- [ ] **Set Build Command:** `npm run build`
- [ ] **Set Output Directory:** `dist`
- [ ] **Add Environment Variables** in Vercel dashboard
- [ ] **Deploy**

### 4. Frontend Verification

- [ ] **Test Wallet Connection**
- [ ] **Test Vault Deposit**
- [ ] **Test Vault Withdrawal**
- [ ] **Test Wrapper Conversion**
- [ ] **Test Cross-Chain Transfer**
- [ ] **Verify Analytics Dashboard**
- [ ] **Check Mobile Responsiveness**

---

## 📊 Monitoring & Maintenance

### 1. Set Up Monitoring

- [ ] **Etherscan Alerts**
  - Watch vault address
  - Watch strategy address
  - Watch wrapper address

- [ ] **LayerZero Scanner**
  - Monitor cross-chain messages
  - Track failed transactions

- [ ] **Price Feed Monitoring**
  - Set up alerts for oracle failures
  - Monitor price deviations

### 2. Regular Checks

- [ ] **Daily:**
  - Check vault TVL
  - Check strategy performance
  - Monitor gas prices
  - Check LayerZero message status

- [ ] **Weekly:**
  - Review strategy yields
  - Check Charm position health
  - Verify all chain connections
  - Review transaction volumes

- [ ] **Monthly:**
  - Security audit review
  - Performance optimization
  - Gas cost analysis
  - User feedback review

### 3. Emergency Procedures

- [ ] **Document Emergency Contacts**
- [ ] **Test Emergency Pause Function**
- [ ] **Prepare Emergency Withdrawal Script**
- [ ] **Set Up Multi-sig for Critical Operations**

---

## 📝 Documentation Updates

- [ ] **Update README.md** with production addresses
- [ ] **Update Frontend Config** with contract addresses
- [ ] **Create User Guide** for depositing/withdrawing
- [ ] **Document Cross-Chain Process**
- [ ] **Create Admin Guide** for management functions

---

## 🔐 Security Checklist

- [ ] **Private Keys Secured**
  - Never commit to git
  - Use hardware wallet for production
  - Store backups securely

- [ ] **Multi-sig Setup** (Recommended)
  - Use Gnosis Safe for owner role
  - Require 2-3 signatures for critical ops

- [ ] **Access Control Review**
  - Minimize number of privileged accounts
  - Document all role assignments
  - Regular access audits

- [ ] **Contract Verification**
  - All contracts verified on block explorers
  - Source code matches deployed bytecode

- [ ] **Audit Trail**
  - Document all deployment transactions
  - Keep logs of all configuration changes
  - Maintain changelog

---

## 📞 Support & Resources

### Documentation
- Main README: `README.md`
- Architecture Docs: `contracts/layerzero/README.md`
- Deployment Guides: `QUICK_START_MAINNET.md`

### Scripts
- Check vault state: `scripts/check-current-vault-state.ts`
- Check Charm position: `scripts/check-charm-success.ts`
- Verify peers: `scripts/verify-peers-set.ts`

### Networks
- **Ethereum:** https://etherscan.io
- **BSC:** https://bscscan.com
- **Arbitrum:** https://arbiscan.io
- **Base:** https://basescan.org
- **Avalanche:** https://snowtrace.io

### External Services
- **LayerZero:** https://layerzeroscan.com
- **Charm Finance:** https://charm.fi
- **WalletConnect:** https://cloud.walletconnect.com
- **Alchemy:** https://dashboard.alchemy.com

---

## ✅ Final Checklist

Before going live:

- [ ] All contracts deployed and verified
- [ ] All tests passing
- [ ] Cross-chain connections configured
- [ ] Frontend deployed and tested
- [ ] Monitoring set up
- [ ] Emergency procedures documented
- [ ] Team trained on admin functions
- [ ] User documentation complete
- [ ] Security review completed
- [ ] Backup and recovery procedures tested

---

## 🎉 Launch!

Once all items are checked:

1. **Announce Launch** on social media
2. **Monitor Closely** for first 24-48 hours
3. **Be Ready** to respond to issues
4. **Collect Feedback** from early users
5. **Iterate** based on real-world usage

---

**Good luck with your deployment! 🚀**

*For questions or issues, refer to the documentation or create an issue on GitHub.*

