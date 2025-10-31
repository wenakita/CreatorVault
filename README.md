# 🦅 Eagle Omnichain Vault

**Production-ready dual-token vault with Charm Finance integration and LayerZero omnichain capabilities**

**Network:** Ethereum Mainnet  
**Status:** 🚀 **READY FOR MAINNET DEPLOYMENT**

> **📘 NEW DEPLOYERS**: Start with [`DEPLOYMENT_DOCS_INDEX.md`](./DEPLOYMENT_DOCS_INDEX.md) for complete deployment documentation

---

## 🚀 Quick Deployment Links

| Document | Purpose | Time |
|----------|---------|------|
| [`MAINNET_READY_SUMMARY.md`](./MAINNET_READY_SUMMARY.md) | **START HERE** - Overview & status | 5 min read |
| [`QUICK_START_MAINNET.md`](./QUICK_START_MAINNET.md) | Fast deployment guide | 15 min deploy |
| [`MAINNET_LAUNCH_CHECKLIST.md`](./MAINNET_LAUNCH_CHECKLIST.md) | Complete step-by-step guide | Full details |
| [`DEPLOYMENT_DOCS_INDEX.md`](./DEPLOYMENT_DOCS_INDEX.md) | Navigation for all docs | Index |

**Deployment Requirements:**
- 💰 **Funding**: 3.6 ETH total (see [`GAS_ESTIMATION.md`](./GAS_ESTIMATION.md))
- ⏱️ **Time**: 15-20 minutes
- ⛽ **Optimal Gas**: <30 gwei
- ✅ **Tests**: 163+ passing (98% coverage)

---

## 📍 Production Contract Addresses

### Core Contracts (Ethereum Mainnet)

| Contract | Address | Status |
|----------|---------|--------|
| **EagleOVault** | [`0x32a2544De7a644833fE7659dF95e5bC16E698d99`](https://etherscan.io/address/0x32a2544De7a644833fE7659dF95e5bC16E698d99) | ✅ Live |
| **CharmStrategyUSD1** | [`0xd286Fdb2D3De4aBf44649649D79D5965bD266df4`](https://etherscan.io/address/0xd286Fdb2D3De4aBf44649649D79D5965bD266df4) | ✅ Earning |
| **EagleVaultWrapper** | [`0xF9CEf2f5E9bb504437b770ED75cA4D46c407ba03`](https://etherscan.io/address/0xF9CEf2f5E9bb504437b770ED75cA4D46c407ba03) | ✅ Live |
| **EagleShareOFT** | [`0x477d42841dC5A7cCBc2f72f4448f5eF6B61eA91E`](https://etherscan.io/address/0x477d42841dC5A7cCBc2f72f4448f5eF6B61eA91E) | ✅ Live |

### External Integrations

| Protocol | Address | Purpose |
|----------|---------|---------|
| **Charm Finance** | `0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71` | Yield farming |
| **WLFI Token** | `0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6` | Vault asset |
| **USD1 Token** | `0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d` | Vault asset |

---

## 🎯 What It Does

### EagleOVault
- Accepts deposits of WLFI + USD1 tokens
- Issues vEAGLE vault shares (ERC4626)
- Auto-deploys to yield strategies
- Uses Chainlink + Uniswap TWAP oracles for pricing

### Charm Strategy
- Swaps tokens to optimal ratio for Charm Finance
- Deposits to Charm's USD1/WLFI AlphaProVault
- Earns Uniswap V3 trading fees
- **99.5% capital efficiency**

### Vault Wrapper
- Converts vault shares ↔ EAGLE OFT tokens (1:1)
- Enables cross-chain bridging via LayerZero
- **Same EAGLE token on ALL chains** (via CREATE2)

---

## 📊 Current Status

**Funds in Charm Finance:**
- 19.12 WLFI + 0.067 USD1
- 19.62 Charm LP shares
- Status: Earning yield ✅

**Capital Efficiency:** 99.5% deployed and earning

---

## 🚀 Quick Start

### Setup
```bash
npm install
forge build
```

### Check Vault Status
```bash
npx hardhat run scripts/check-current-vault-state.ts --network ethereum
```

### Check Charm Position
```bash
npx hardhat run scripts/check-charm-success.ts --network ethereum
```

---

## 📁 Repository Structure

```
eagle-ovault-clean/
│
├── 📘 DEPLOYMENT GUIDES (START HERE!)
│   ├── DEPLOYMENT_DOCS_INDEX.md        # Navigation guide
│   ├── MAINNET_READY_SUMMARY.md        # Executive summary  
│   ├── MAINNET_LAUNCH_CHECKLIST.md     # Complete checklist
│   ├── QUICK_START_MAINNET.md          # Fast deployment (15min)
│   ├── SECURITY_AUDIT_CHECKLIST.md     # Security review
│   ├── DEPLOYMENT_VERIFICATION.md      # Post-deploy checks
│   └── GAS_ESTIMATION.md               # Funding requirements
│
├── 💎 CONTRACTS (PRODUCTION READY)
│   ├── contracts/
│   │   ├── EagleOVault.sol                    # Main vault (27KB)
│   │   ├── EagleVaultWrapper.sol              # Wrapper (44KB)
│   │   ├── EagleRegistry.sol                  # Chain registry
│   │   ├── strategies/
│   │   │   ├── CharmStrategyUSD1.sol          # USD1 strategy (40KB)
│   │   │   └── CharmStrategy.sol              # WETH strategy (39KB)
│   │   └── layerzero/
│   │       ├── oft/EagleShareOFT.sol          # OFT token (35KB)
│   │       ├── composers/EagleOVaultComposer.sol  # Unified composer (36KB)
│   │       └── adapters/                      # Asset adapters
│
├── 🧪 TESTS (71/71 PASSING - 100%)
│   ├── test/
│   │   ├── EagleOVault.t.sol              # Vault tests
│   │   ├── EagleShareOFT.t.sol            # OFT tests (36/36)
│   │   ├── EagleVaultWrapper.t.sol        # Wrapper tests (35/35)
│   │   ├── CharmStrategyUSD1.t.sol        # Strategy tests
│   │   └── CharmStrategy.t.sol            # WETH strategy tests
│
├── 🚀 DEPLOYMENT SCRIPTS
│   ├── script/
│   │   ├── DeployVanityVault.s.sol        # CREATE2 deployment
│   │   ├── DeployRegistryCreate2.s.sol    # Registry deployment
│   │   ├── DeploySepoliaComplete.s.sol    # Testnet deploy
│   │   └── multi-chain/                   # Cross-chain scripts
│
├── 📚 ARCHITECTURE DOCS
│   ├── ARCHITECTURE_DECISION.md           # EagleVaultWrapper rationale
│   ├── EAGLESHAREOFT_REVIEW.md           # OFT contract review
│   ├── WRAPPER_TEST_REPORT.md            # Wrapper test analysis
│   ├── COMPOSER_VAULT_COUPLING.md        # Coupling documentation
│   ├── ABSTRACTION_LAYER.md              # UX abstraction
│   ├── LAYERZERO_INTEGRATION.md          # LayerZero integration
│   ├── UNIFIED_COMPOSER.md               # Composer documentation
│   └── contracts/layerzero/
│       ├── README.md                      # LayerZero guide
│       ├── WRAPPER_ARCHITECTURE.md        # Wrapper details
│       ├── ARCHITECTURE_FAQ.md            # FAQs
│       └── COMPLETE_ARCHITECTURE.md       # Complete guide
│
├── ⚙️ CONFIGURATION
│   ├── hardhat.config.ts                  # Hardhat config
│   ├── foundry.toml                       # Foundry config
│   ├── layerzero.config.ts                # LayerZero config
│   └── package.json                       # Dependencies
│
└── 🎨 FRONTEND
    └── frontend/                           # React + Vite UI
```

**✨ Recently Cleaned:**
- ✅ Removed duplicate documentation
- ✅ Removed old fee-related scripts (fees removed from OFT)
- ✅ Removed utility tools (vanity generators)
- ✅ Removed outdated deployment docs
- ✅ All contracts compile successfully

---

## 🔑 Key Features

### Vault
- ✅ Dual-token deposits (WLFI + USD1)
- ✅ ERC4626 standard compliance
- ✅ Oracle-based pricing (Chainlink + TWAP)
- ✅ Multi-strategy support
- ✅ Auto-deployment to strategies

### Charm Integration
- ✅ Smart ratio matching via Uniswap swaps
- ✅ Deposits to Charm AlphaProVault
- ✅ Earns Uniswap V3 LP fees
- ✅ Automatic rebalancing

### Cross-Chain (EagleVaultWrapper Architecture)
- ✅ LayerZero OFT standard
- ✅ **Same EAGLE token on ALL chains** (Ethereum, Arbitrum, Base, etc.)
- ✅ Same address everywhere via CREATE2
- ✅ 1:1 wrapper for vault shares ↔ EAGLE conversion
- ✅ No fees on transfers

> **Architecture:** We use `EagleVaultWrapper` instead of standard OFTAdapter to achieve the same EAGLE token address and metadata on all chains. See [`ARCHITECTURE_DECISION.md`](./ARCHITECTURE_DECISION.md) for details.

---

## 📜 Scripts

See `scripts/README.md` for full list.

**Essential Commands:**
```bash
# Check vault
npx hardhat run scripts/check-current-vault-state.ts --network ethereum

# Check Charm position
npx hardhat run scripts/check-charm-success.ts --network ethereum

# Check approvals
npx hardhat run scripts/check-strategy-approvals.ts --network ethereum

# Set deployment threshold
npx hardhat run scripts/set-deployment-threshold.ts --network ethereum
```

---

## 🧪 Testing

```bash
# Run tests
npx hardhat test

# Specific test
npx hardhat test test/VaultDeploymentTest.test.ts
```

---

## 📖 Documentation

### 🚀 Deployment (Start Here!)
- **[Deployment Docs Index](DEPLOYMENT_DOCS_INDEX.md)** - 📍 Navigation for all deployment docs
- **[Mainnet Ready Summary](MAINNET_READY_SUMMARY.md)** - Executive overview
- **[Quick Start Mainnet](QUICK_START_MAINNET.md)** - Fast 15-min deployment
- **[Mainnet Launch Checklist](MAINNET_LAUNCH_CHECKLIST.md)** - Complete step-by-step guide
- **[Security Audit Checklist](SECURITY_AUDIT_CHECKLIST.md)** - Security review procedures
- **[Deployment Verification](DEPLOYMENT_VERIFICATION.md)** - Post-deployment verification
- **[Gas Estimation](GAS_ESTIMATION.md)** - Funding requirements (3.6 ETH)

### 🏗️ Architecture
- **[Architecture Decision](ARCHITECTURE_DECISION.md)** - EagleVaultWrapper pattern explained
- **[EagleShareOFT Review](EAGLESHAREOFT_REVIEW.md)** - OFT contract review (36/36 tests ✅)
- **[Wrapper Test Report](WRAPPER_TEST_REPORT.md)** - Wrapper testing analysis (35/35 tests ✅)
- **[Composer Vault Coupling](COMPOSER_VAULT_COUPLING.md)** - Tight coupling documentation
- **[Abstraction Layer](ABSTRACTION_LAYER.md)** - User experience abstraction
- **[LayerZero Integration](LAYERZERO_INTEGRATION.md)** - Cross-chain integration guide
- **[Unified Composer](UNIFIED_COMPOSER.md)** - EagleOVaultComposer documentation

### 🌐 LayerZero / Cross-Chain
- **[LayerZero README](contracts/layerzero/README.md)** - Cross-chain deployment guide
- **[Wrapper Architecture](contracts/layerzero/WRAPPER_ARCHITECTURE.md)** - Detailed wrapper flow
- **[Architecture FAQ](contracts/layerzero/ARCHITECTURE_FAQ.md)** - Common questions answered
- **[Complete Architecture](contracts/layerzero/COMPLETE_ARCHITECTURE.md)** - Full technical guide

### 📋 Vault Details
- **[README EagleOVault](README_EAGLEOVAULT.md)** - Complete vault documentation

---

## 🔧 Development

### Prerequisites
- Node.js v18+
- Foundry
- Hardhat

### Install Dependencies
```bash
npm install
forge install
```

### Compile Contracts
```bash
forge build
# or
npx hardhat compile
```

### Run Local Node
```bash
npx hardhat node
```

---

## 🌐 Frontend

Live at: **https://test.47eagle.com**

```bash
cd frontend
npm install
npm run dev    # Development
npm run build  # Production
```

---

## 📞 Support

- **GitHub:** https://github.com/wenakita/EagleOVaultV2
- **Network:** Ethereum Mainnet
- **Explorer:** https://etherscan.io

---

## 🏆 Achievements

- ✅ Deployed on Ethereum Mainnet
- ✅ Integrated with Charm Finance
- ✅ Earning Uniswap V3 fees
- ✅ 99.5% capital efficiency
- ✅ Production-ready frontend
- ✅ LayerZero OFT enabled

---

---

## 🧹 Repository Status

**Last Cleanup:** October 27, 2025  
**Test Status:** 71/71 passing (100%) ✅  
**Build Status:** All contracts compile successfully ✅  
**Production Ready:** Yes ✅

**Recent Changes:**
- ✅ Removed duplicate documentation from `gist-content/` and `documents/`
- ✅ Removed 9+ old fee-related scripts (fees removed from EagleShareOFT)
- ✅ Removed vanity-generator and vanity-miner utilities
- ✅ Removed outdated deployment documentation
- ✅ Unified composer contract with EagleRegistry integration
- ✅ Repository cleaned and organized for mainnet deployment

**Contract Sizes (Production):**
- EagleOVault: 27 KB ✅
- EagleVaultWrapper: 44 KB ✅
- EagleShareOFT: 35 KB ✅
- EagleOVaultComposer: 36 KB ✅
- CharmStrategyUSD1: 40 KB ✅

---

**Last Updated:** October 27, 2025  
**License:** MIT  
**Version:** Production v2.1 (Unified Composer + Repository Cleanup)
