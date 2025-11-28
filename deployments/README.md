# Eagle OVault Deployments

This directory contains all contract deployment addresses and configurations for the Eagle OVault protocol across multiple blockchain networks.

## Directory Structure

```
deployments/
├── arbitrum/          # Arbitrum One deployments
├── avalanche/         # Avalanche C-Chain deployments
├── base/             # Base network deployments
├── bsc/              # BNB Smart Chain deployments
├── ethereum/         # Ethereum mainnet deployments
├── monad/            # Monad network deployments
├── sonic/            # Sonic network deployments
├── hyperevm/         # HyperEVM (Hyperliquid) deployments
└── shared/           # Cross-chain configurations
```

## File Naming Convention

- `{chain}.json` - Main deployment summary for the chain
- `{chain}-config.json` - Chain configuration (RPC, endpoints, etc.)
- `{chain}-registry.json` - EagleRegistry deployment
- `{chain}-{component}.json` - Specific component deployments

## Deployed Contracts

### Ethereum (Mainnet)
- **EagleOVault**: Main vault contract accepting WLFI + USD1
- **EagleShareOFT**: LayerZero OFT for cross-chain shares
- **EagleVaultWrapper**: Additional vault functionality
- **EagleOVaultComposer**: Cross-chain composition logic
- **WLFI OFT Adapter**: Ethereum-side WLFI bridge adapter

### Base Network
- **WLFI OFT**: WLFI token bridge endpoint on Base
- **EagleRegistry**: Cross-chain registry for Base

### Arbitrum One
- **Eagle Share OFT**: Share token deployment
- **EagleRegistry**: Cross-chain registry for Arbitrum

### Other Networks
- BSC, Avalanche: Configured but pending deployment

## Key Addresses

### ✅ **Deployed Contracts:**

| Network | Contract | Address | Status |
|---------|----------|---------|--------|
| **Ethereum** | EagleOVault | [`0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953`](https://etherscan.io/address/0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953) | ✅ Active |
| **Ethereum** | EagleShareOFT | [`0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E`](https://etherscan.io/address/0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E) | ✅ Active |
| **Ethereum** | EagleRegistry | [`0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e`](https://etherscan.io/address/0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e) | ✅ Active |
| **Base** | WLFI OFT | [`0x47af3595BFBE6c86E59a13d5db91AEfbFF0eA91e`](https://basescan.org/address/0x47af3595BFBE6c86E59a13d5db91AEfbFF0eA91e) | ✅ Active |
| **Arbitrum** | Eagle Share OFT | [`0xf83922BcD5a80C07ccb61dbA5E7f7A02cC05a1fD`](https://arbiscan.io/address/0xf83922BcD5a80C07ccb61dbA5E7f7A02cC05a1fD) | ✅ Active |

### 🔄 **Configured Networks (Ready for Deployment):**

| Network | Chain ID | LayerZero EID | Status |
|---------|----------|---------------|--------|
| **BSC** | 56 | 30102 | Configured |
| **Avalanche** | 43114 | 30106 | Configured |
| **Monad** | 10143 | 30390 | Configured |
| **Sonic** | 146 | 30332 | Configured |
| **HyperEVM** | 999 | 30275 | Configured |

### 🌐 **Universal Addresses (Same Across All Chains):**
- **EagleRegistry**: `0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e`
- **EagleShareOFT**: `0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E`

## LayerZero Configuration

Cross-chain messaging is configured via LayerZero V2:
- **Ethereum**: Hub chain (EID: 30101)
- **Base**: Spoke chain (EID: 30184)
- **Arbitrum**: Spoke chain (EID: 30110)
- **BSC**: Spoke chain (EID: 30102)
- **Avalanche**: Spoke chain (EID: 30106)

## Deployment Status

### ✅ **Active Deployments:**
- **Ethereum**: Fully deployed and operational
  - EagleOVault, EagleShareOFT, EagleVaultWrapper, EagleOVaultComposer, WLFI Adapter
- **Base**: WLFI OFT deployed and verified
- **Arbitrum**: Eagle Share OFT deployed

### 🔄 **Configured Networks (Ready for Deployment):**
- **BSC (BNB Chain)**: LayerZero configured, contracts ready
- **Avalanche**: LayerZero configured, contracts ready
- **Monad**: LayerZero configured, contracts ready
- **Sonic**: LayerZero configured, contracts ready
- **HyperEVM**: LayerZero configured, contracts ready

### 🌐 **Cross-Chain Status:**
- ✅ **Ethereum ↔ Base**: Active peer configurations
- ✅ **LayerZero V2**: All networks configured with endpoints
- ✅ **Registry System**: Cross-chain registry deployed on Base & Arbitrum

## Usage

These deployment files are used by:
- Frontend applications for contract addresses
- Deployment scripts for verification
- Documentation and transparency
- Development and testing environments

## Security Notes

- All addresses verified on respective block explorers
- Contracts follow OpenZeppelin security practices
- Multi-signature controls on admin functions
- Regular security audits recommended

---

**Last Updated**: $(date)
**Protocol Version**: v1.0.0
