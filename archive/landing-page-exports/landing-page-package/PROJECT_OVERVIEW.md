# Eagle Protocol - Project Overview

## Executive Summary

Eagle is an **omnichain fungible token (OFT)** protocol built on LayerZero V2 that enables seamless cross-chain token transfers and automated DeFi operations across Base, Ethereum, BNB Chain, and Solana.

## Core Technology

### LayerZero V2 Integration
- **Ultra-secure messaging**: Verified by multiple DVNs (Google, LayerZero Labs)
- **Cross-chain transfers**: 10-20 minute settlement time
- **Composable operations**: Chain multiple actions in one transaction

### Tri-Hub Architecture
```
        Base (Primary Hub)
         /    |    \
        /     |     \
    Ethereum  BNB  Solana
    (Compose) (Hub) (Hub)
```

## Key Components

### 1. Eagle OFT (ERC20/SPL Token)
- **Address**: `0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E` (EVM chains)
- **Same address across all EVM chains** (vanity address via CREATE2)
- **Fungible**: 1:1 bridging across chains
- **Liquid wrapper**: Represents vault shares

### 2. WLFI OFT (World Liberty Financial Token)
- **Base**: `0x47af3595BFBE6c86E59a13d5db91AEfbFF0eA91e`
- **Ethereum Adapter**: `0x2437F6555350c131647daA0C655c4B49A7aF3621`
- **BNB Adapter**: `0x2437F6555350c131647daA0C655c4B49A7aF3621`
- **Cross-chain compatible**: Bridge WLFI anywhere

### 3. EagleOVaultComposerV2
- **Address**: `0x0c74174b5F04ec15d3Fb94D15Dc13c91fAc6C21F` (Ethereum)
- **Purpose**: Orchestrate complex cross-chain redemption flows
- **Features**:
  - Automatic EAGLE unwrapping
  - Vault redemption
  - WLFI bridging
  - Built-in refund mechanism

### 4. EagleOVault
- **Address**: `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953` (Ethereum)
- **Type**: ERC4626 vault
- **Assets**: WLFI + USD1
- **Strategies**: Integrated Uniswap V3 yield strategies
- **Note**: Intentionally diluted 10,000x for EAGLE token supply

### 5. EagleVaultWrapper
- **Address**: `0x47dAc5063c526dBc6f157093DD1D62d9DE8891c5` (Ethereum)
- **Purpose**: Wrap/unwrap between EAGLE and vault shares
- **Fees**: 2% on wrap/unwrap (configurable)

## User Flows

### Flow 1: Simple Bridge
```
User on Base → Send EAGLE → Ethereum
                              ↓
                         Receive EAGLE
```
**Time**: 10-15 minutes  
**Cost**: ~$2-5 in gas + LayerZero fees

### Flow 2: 1-Transaction Compose (The Killer Feature!)
```
User on Base → Send 1 EAGLE
    ↓
Bridge to Ethereum (LayerZero)
    ↓
ComposerV2 receives EAGLE
    ↓
Unwrap: EAGLE → 0.98 vEAGLE shares
    ↓
Redeem: vEAGLE → 0.000098 WLFI
    ↓
Bridge WLFI back to Base (LayerZero)
    ↓
User receives WLFI on Base
```
**Time**: 20-30 minutes (includes both bridges)  
**Cost**: ~$5-10 in gas + LayerZero fees  
**Transactions Required**: **1** (user only signs once!)

### Flow 3: Multi-Chain Operations
```
Base ←→ Ethereum ←→ BNB Chain
  ↕                    ↕
Solana ←─────────────→
```
Users can bridge EAGLE or WLFI between any supported chains.

## Key Numbers

### Vault Statistics
- **Total Supply**: 50,000,000 vEAGLE shares
- **Total Assets**: ~7,861 WLFI
- **Share Price**: 0.0001571 WLFI per vEAGLE
- **Dilution Factor**: 10,000x (intentional)

### Conversion Rates
- **1 EAGLE** → 0.98 vEAGLE shares (2% fee)
- **0.98 vEAGLE** → 0.000098 WLFI (10,000x dilution)
- **Net**: 1 EAGLE ≈ 0.0001 WLFI

### Supported Chains
| Chain     | EAGLE OFT | WLFI OFT | ComposerV2 | Status      |
|-----------|-----------|----------|------------|-------------|
| Base      | ✅        | ✅       | ❌         | Primary Hub |
| Ethereum  | ✅        | ✅       | ✅         | Full Suite  |
| BNB Chain | ✅        | ✅       | ❌         | Hub         |
| Solana    | ✅        | ✅       | ❌         | Hub         |

## Security Features

### 1. LayerZero DVN Verification
- **Google Cloud Oracle**: Independent verification
- **LayerZero Labs DVN**: Protocol-native verification
- **Dual verification required**: Both DVNs must agree

### 2. Automatic Refunds
ComposerV2 has built-in try-catch:
```solidity
try this.handleRedeemCompose(...) {
    emit Sent(); // Success
} catch {
    // Refund EAGLE to user automatically
    IERC20(EAGLE).safeTransfer(user, amount);
    emit Refunded();
}
```

### 3. Slippage Protection
Users set minimum output amounts:
```typescript
minAmountLD: ethers.utils.parseUnits('0.00005', 18)
```

### 4. Access Control
- **Roles**: Owner, Minter, Burner (LayerZero OFT standard)
- **Whitelisting**: OVault can whitelist contracts
- **Emergency Pause**: Admin can pause in emergencies

### 5. Contract Verification
All contracts verified on:
- Etherscan (Ethereum)
- Basescan (Base)
- BscScan (BNB Chain)
- Solscan (Solana)

## Technical Advantages

### 1. Same Address Everywhere (EVM)
Using CREATE2 vanity mining:
- EAGLE: `0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E`
- WLFI Adapters: `0x2437...3621` (Ethereum & BNB)

**Why it matters**: Users only need to remember ONE address!

### 2. Gas Optimized
- Efficient LayerZero V2 encoding
- Minimal storage operations
- Batched approvals

### 3. Upgradeability
- **EagleRegistry**: Dynamic endpoint resolution
- Contracts can be upgraded to new LayerZero versions
- Modular architecture

### 4. Composability
- Compatible with all LayerZero OFT protocols
- Can be integrated into other DeFi protocols
- Standard ERC20 interface

## Use Cases

### For Users
1. **Cross-chain arbitrage**: Move tokens to best yield chains
2. **Portfolio management**: Consolidate assets on preferred chain
3. **DeFi access**: Bridge to chains with better opportunities
4. **1-click redemption**: Convert EAGLE to WLFI seamlessly

### For Developers
1. **Build on top**: Integrate EAGLE into your protocol
2. **Compose operations**: Chain multiple DeFi actions
3. **Cross-chain dApps**: Use EAGLE as cross-chain currency

### For Protocols
1. **Liquidity provision**: Accept EAGLE in your pools
2. **Collateral**: Use EAGLE as collateral for loans
3. **Governance**: Cross-chain voting with EAGLE

## Roadmap & Future

### Completed ✅
- [x] Eagle OFT deployment (4 chains)
- [x] WLFI OFT deployment (4 chains)
- [x] ComposerV2 production deployment
- [x] Tri-hub architecture implementation
- [x] Comprehensive testing

### In Progress 🔄
- [ ] Frontend dApp development
- [ ] Analytics dashboard
- [ ] Documentation site

### Planned 🔮
- [ ] Additional chain support (Arbitrum, Optimism, Polygon)
- [ ] Advanced compose operations
- [ ] Governance token launch
- [ ] Community tools & APIs

## Community & Support

### Resources
- **Documentation**: (Coming soon)
- **GitHub**: https://github.com/eagle-protocol
- **LayerZero Scan**: https://layerzeroscan.com/
- **Support**: (Add support channel)

### Social
- **Twitter**: @EagleProtocol
- **Discord**: (Add invite)
- **Telegram**: (Add invite)

## Contract Addresses Summary

### Ethereum
```
Eagle OFT:      0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E
WLFI Adapter:   0x2437F6555350c131647daA0C655c4B49A7aF3621
ComposerV2:     0x0c74174b5F04ec15d3Fb94D15Dc13c91fAc6C21F
EagleOVault:    0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953
Wrapper:        0x47dAc5063c526dBc6f157093DD1D62d9DE8891c5
```

### Base
```
Eagle OFT:      0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E
WLFI OFT:       0x47af3595BFBE6c86E59a13d5db91AEfbFF0eA91e
```

### BNB Chain
```
Eagle OFT:      0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E
WLFI Adapter:   0x2437F6555350c131647daA0C655c4B49A7aF3621
```

### Solana
```
Eagle OFT:      (Solana Program ID)
WLFI OFT:       (Solana Program ID)
```

## Technical Documentation

For detailed technical documentation, see:
- `COMPOSERV2_README.md` - ComposerV2 usage guide
- `WLFI_CROSS_CHAIN.md` - WLFI cross-chain setup
- `EAGLE_ARCHITECTURE.md` - System architecture

---

**Built with LayerZero V2** 🌐  
**Powered by DeFi Innovation** ⚡  
**Secured by DVN Verification** 🔒

