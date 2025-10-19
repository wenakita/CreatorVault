# 🦅 Eagle Omnichain Vault

**Production-ready omnichain vault with matching addresses across all chains**

**EAGLE Token:** `0x47a8f1df6cafeb0d7104e7468b4688cf1cdea91e` (same on all chains!)

---

## 🚀 Quick Start

**New here?** Start with these guides:
- **[Start Here](docs/START_HERE.md)** - Choose your deployment path
- **[System Diagram](docs/SYSTEM_DIAGRAM.md)** - Visual overview
- **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Complete walkthrough

---

## 🎯 **Architecture Overview**

This implementation follows the **official LayerZero OVault pattern** with 5 core contracts:

### **🏛️ Hub Chain (Ethereum)**
- **`EagleOVault`** - ERC4626 vault managing dual-token (WLFI + USD1) Uniswap V3 LP strategy
- **`EagleShareOFTAdapter`** - Lockbox adapter for cross-chain share transfers  
- **`EagleOVaultComposer`** - LayerZero composer orchestrating omnichain operations
- **`WLFIAssetOFT`** & **`USD1AssetOFT`** - Asset OFTs for cross-chain token transfers

### **🌐 Spoke Chains (BSC, Arbitrum, Base, Avalanche)**
- **`EagleShareOFT`** - Omnichain share tokens representing vault ownership
- **`WLFIAssetOFT`** & **`USD1AssetOFT`** - Asset OFTs mirroring hub chain tokens

## 🎯 Core Contracts

**4 Production-Ready Contracts:**

1. **EagleOVault** (800 lines)
   - ERC4626 vault with oracle pricing
   - 10,000:1 share ratio for precision
   - Multi-strategy support
   - Chainlink + TWAP oracles

2. **EagleShareOFT** (637 lines)
   - OFT token at **same address on all chains**
   - 2% fee on DEX trading (1% treasury + 1% vault)
   - Uniswap V3 compatible
   - Cross-chain via LayerZero

3. **EagleVaultWrapper** (172 lines)
   - Wraps vault shares → OFT tokens (1:1)
   - Free wrapping/unwrapping
   - Ethereum only

4. **CharmStrategy** (582 lines)
   - Smart auto-rebalancing
   - Accounts for idle tokens
   - Integrates with Charm Finance

## 🏗️ Architecture

### **Matching Address Design:**

```
Hub (Ethereum):
  EagleOVault → Vault backend (deposits/withdrawals)
  EagleVaultWrapper → 1:1 wrapper (free)
  EagleShareOFT → 0x47a8...ea91e ← Trading token
  
Spoke Chains:
  EagleShareOFT → 0x47a8...ea91e ← SAME address! ✅
```

### **Key Features:**
- ✅ Same EAGLE address on all chains
- ✅ Oracle pricing (Chainlink + TWAP)
- ✅ 2% fee on DEX trading only
- ✅ Free vault operations
- ✅ V3 Uniswap compatible
- ✅ Smart rebalancing (accounts for idle tokens)
- ✅ Security reviewed (Slither 9/10)

## 🎭 **Vanity Address Integration**

The deployment system supports vanity addresses with the pattern `0x47...EA91E`:

```typescript
// In deployConfig.ts
export const VANITY_CONFIG = {
  targetPrefix: '47',
  targetSuffix: 'EA91E',
  create2Factory: ''
}
```

## 🛠️ **Available Tasks**

### **Deployment**
```bash
npx hardhat deploy:eagle-ovault --network <network>
```

### **Vault Operations**
```bash
# Get vault info
npx hardhat ovault:info --vault <address> --network <network>

# Dual-token deposit
npx hardhat ovault:deposit-dual --vault <address> --wlfi 1000 --usd1 1000 --network <network>

# Dual-token withdrawal  
npx hardhat ovault:withdraw-dual --vault <address> --shares 500 --network <network>

# Rebalance portfolio
npx hardhat ovault:rebalance --vault <address> --network <network>
```

## 🔒 **Security Features**

### **Reentrancy Protection**
- `nonReentrant` modifiers on all external functions
- Checks-Effects-Interactions pattern

### **Input Validation**
- Zero address checks on critical parameters
- Amount validation for deposits/withdrawals
- Balance verification before transfers

### **Access Control**
- Owner-only sensitive operations
- Manager system for vault operations
- Authorized user mapping

### **Slippage Protection**
- TWAP-based price validation
- Configurable slippage limits
- Rebalance thresholds

## 📊 **Cross-Chain Flow Examples**

### **Deposit Flow (BSC → Ethereum)**
```
1. User deposits WLFI on BSC
2. BSC WLFI OFT → Ethereum WLFI OFT (LayerZero)
3. Composer receives WLFI on Ethereum
4. Composer deposits into EagleOVault
5. Vault mints EAGLE shares
6. Composer sends EAGLE shares to user's destination chain
```

### **Withdrawal Flow (Base → Ethereum)**
```
1. User withdraws EAGLE shares on Base
2. Base EAGLE OFT → Ethereum Share Adapter (LayerZero)
3. Composer receives shares on Ethereum
4. Composer redeems from EagleOVault
5. Vault burns shares, returns WLFI/USD1
6. Composer sends assets to user's destination chain
```

## 🌐 **Network Configuration**

| Chain | Chain ID | LayerZero EID | LZ Endpoint |
|-------|----------|---------------|-------------|
| Ethereum | 1 | 30101 | 0x1a44076050125825900e736c501f859c50fE728c |
| BSC | 56 | 30102 | 0x1a44076050125825900e736c501f859c50fE728c |
| Arbitrum | 42161 | 30110 | 0x1a44076050125825900e736c501f859c50fE728c |
| Base | 8453 | 30184 | 0x1a44076050125825900e736c501f859c50fE728c |
| Avalanche | 43114 | 30106 | 0x1a44076050125825900e736c501f859c50fE728c |

## 🧪 **Testing Strategy**

### **Unit Tests**
- Individual contract functionality
- Edge cases and error conditions
- Gas optimization verification

### **Integration Tests**
- Cross-chain message flows
- End-to-end deposit/withdrawal
- Slippage and rebalancing logic

### **Security Tests**
- Static analysis with Slither
- Formal verification of critical paths
- Stress testing with large amounts

## 🔄 **Differences from Previous Implementation**

| Aspect | Previous | Clean Implementation |
|--------|----------|---------------------|
| **Architecture** | Custom hybrid | ✅ Official LayerZero OVault |
| **Contracts** | Mixed standards | ✅ 5 standard OVault contracts |
| **Deployment** | Manual scripts | ✅ Hardhat tasks with config |
| **Testing** | Limited | ✅ Comprehensive test suite |
| **Documentation** | Scattered | ✅ Centralized and clear |
| **Security** | Basic | ✅ Production-ready hardening |

## 🚀 Deployment

**Ready to deploy?**

1. **[Start Here](docs/START_HERE.md)** - Choose your path
2. **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Complete walkthrough
3. **[Quick Deploy](docs/QUICK_DEPLOY.md)** - Copy-paste commands

**Your EAGLE will be at:** `0x47a8f1df6cafeb0d7104e7468b4688cf1cdea91e` on all chains!

---

## 📚 **Documentation**

**All documentation is in the [`docs/`](docs/) directory:**

### **🚀 Getting Started**
- [Start Here](docs/START_HERE.md) - Choose your deployment path
- [System Diagram](docs/SYSTEM_DIAGRAM.md) - Visual overview
- [Complete Summary](docs/COMPLETE.md) - Project overview
- [Documentation Index](docs/README.md) - Full navigation

### **Architecture & Design**
- [Final Architecture Guide](docs/FINAL_ARCHITECTURE_GUIDE.md) - Complete architecture
- [Dual Token Hub Architecture](docs/DUAL_TOKEN_HUB_ARCHITECTURE.md) - Hub chain details
- [Design System](docs/design-system.md) - UI/UX specifications

### **Deployment**
- [Production Deployment](docs/deployment/production-deployment.md) - Mainnet preparation
- [Cross-Chain Setup](docs/deployment/cross-chain-setup.md) - Multi-chain configuration
- [LayerZero Security](docs/deployment/layerzero-security.md) - Security setup

### **Fee System & Trading**
- [Fee Structure](docs/FEE_STRUCTURE.md) - 2% fee on DEX trading
- [Fee Setup Guide](docs/FEE_SETUP_GUIDE.md) - Quick fee configuration
- [V3 Compatibility](docs/V3_COMPATIBILITY_TEST.md) - Uniswap V3 testing

### **Security**
- [Security Analysis](docs/SECURITY_ANALYSIS.md) - Detailed Slither analysis
- [Security Review](docs/SECURITY_REVIEW_SUMMARY.md) - Quick overview

### **Contracts**
- [Price Oracle Guide](docs/contracts/price-oracle-guide.md) - Chainlink + TWAP oracles

### **Frontend Application**
- [Getting Started](docs/frontend/getting-started.md) - Frontend setup
- [Features](docs/frontend/features.md) - Frontend capabilities
- [Deployment](docs/frontend/deployment.md) - Deploy to production
- [Vercel Guide](docs/frontend/vercel-deployment.md) - Vercel-specific deployment

Frontend code is in the `frontend/` directory (Next.js 14 application).

---

## 📝 **License**

MIT License - see LICENSE file for details.

---

**Built with ❤️ using LayerZero OVault Standard**
