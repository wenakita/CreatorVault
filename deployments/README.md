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

| Network | Contract | Address |
|---------|----------|---------|
| Ethereum | EagleOVault | `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953` |
| Ethereum | EagleShareOFT | `0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E` |
| Ethereum | EagleRegistry | `0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e` |
| Base | WLFI OFT | `0x47af3595BFBE6c86E59a13d5db91AEfbFF0eA91e` |
| Arbitrum | Eagle Share OFT | `0xf83922BcD5a80C07ccb61dbA5E7f7A02cC05a1fD` |

## LayerZero Configuration

Cross-chain messaging is configured via LayerZero V2:
- **Ethereum**: Hub chain (EID: 30101)
- **Base**: Spoke chain (EID: 30184)
- **Arbitrum**: Spoke chain (EID: 30110)
- **BSC**: Spoke chain (EID: 30102)
- **Avalanche**: Spoke chain (EID: 30106)

## Deployment Status

- ✅ **Ethereum**: Fully deployed and operational
- ✅ **Base**: WLFI OFT deployed and verified
- ✅ **Arbitrum**: Share OFT deployed
- 🔄 **BSC/Avalanche**: Configured, pending deployment
- 🔄 **Cross-chain**: Peer configurations established

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
