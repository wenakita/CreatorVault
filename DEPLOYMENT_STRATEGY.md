# Eagle Vault LayerZero Deployment Strategy

## 🏗️ Contract Architecture Overview

The Eagle Vault system uses a **hybrid LayerZero architecture** depending on whether tokens exist natively on each chain.

## 📋 Deployment Decision Matrix

### For WLFI Token:
- **Chains WITH native WLFI**: Use `WLFIAdapter.sol` (wraps existing token)
- **Chains WITHOUT native WLFI**: Use `WLFIAssetOFT.sol` (creates omnichain version)

### For USD1 Token:
- **Chains WITH native USD1**: Use `USD1Adapter.sol` (wraps existing token)
- **Chains WITHOUT native USD1**: Use `USD1AssetOFT.sol` (creates omnichain version)

### For $EAGLE Token (New):
- **All chains**: Use `EagleShareOFT.sol` (creates new omnichain token)

## 🌍 Chain-Specific Deployment Guide

### Known Token Locations:
- **WLFI**: Check which chains have native WLFI deployments
- **USD1**: Check which chains have native USD1 deployments

### Deployment Steps:
1. **Research Phase**: Identify which chains have native WLFI/USD1
2. **Strategy Selection**: 
   - Native token exists → Deploy Adapter
   - Native token missing → Deploy Asset OFT
3. **Cross-Chain Wiring**: Connect all deployed contracts via LayerZero peers

## ⚙️ Contract Pairs

### WLFI Contracts:
- `WLFIAdapter.sol` - For chains with existing WLFI
- `WLFIAssetOFT.sol` - For chains without WLFI

### USD1 Contracts:
- `USD1Adapter.sol` - For chains with existing USD1  
- `USD1AssetOFT.sol` - For chains without USD1

### $EAGLE Contracts:
- `EagleShareOFT.sol` - For all chains (new token)
- `EagleShareAdapter.sol` - Alternative approach if needed

## 🔄 LayerZero Peer Configuration

All contracts (Adapters and Asset OFTs) must be configured as LayerZero peers to enable cross-chain token transfers between chains with different deployment strategies.

## 📝 Notes

- Asset OFTs create new omnichain token representations
- Adapters wrap existing ERC20 tokens for omnichain functionality
- Both contract types are peers in the same LayerZero network
- Token holders can transfer between any chains regardless of underlying implementation
