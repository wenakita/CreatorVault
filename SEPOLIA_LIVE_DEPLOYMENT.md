# 🚀 Eagle OVault - LIVE SEPOLIA DEPLOYMENT

## ✅ DEPLOYMENT STATUS: COMPLETE

**Deployment Date**: October 21, 2025  
**Chain**: Sepolia Testnet (Chain ID: 11155111)  
**Deployer**: `0x7310Dd6EF89b7f829839F140C6840bc929ba2031`

---

## 📜 DEPLOYED CONTRACT ADDRESSES

### Core Contracts

| Contract | Address | Etherscan |
|----------|---------|-----------|
| **EagleRegistry** | `0x59940f7fbd43447aE80Dc5F997290f4B4131D7e6` | [View](https://sepolia.etherscan.io/address/0x59940f7fbd43447aE80Dc5F997290f4B4131D7e6) |
| **WLFI OFT** | `0xebe5AA10eF54aE257B3ced8e229ed4f7a12eC693` | [View](https://sepolia.etherscan.io/address/0xebe5AA10eF54aE257B3ced8e229ed4f7a12eC693) |
| **USD1 OFT** | `0x68cF24743CA335ae3c2e21c2538F4E929224F096` | [View](https://sepolia.etherscan.io/address/0x68cF24743CA335ae3c2e21c2538F4E929224F096) |
| **EagleOVault** | `0xdDC8061BB5e2caE36E27856620086bc6d59C2242` | [View](https://sepolia.etherscan.io/address/0xdDC8061BB5e2caE36E27856620086bc6d59C2242) |
| **EagleShareOFT** | `0x87B831E8e1b09B35c888595cBae81CeA0d6bB260` | [View](https://sepolia.etherscan.io/address/0x87B831E8e1b09B35c888595cBae81CeA0d6bB260) |
| **EagleVaultWrapper** | `0xA205ebeB4a3E0bb70D87c206eD0e9aA88561415a` | [View](https://sepolia.etherscan.io/address/0xA205ebeB4a3E0bb70D87c206eD0e9aA88561415a) |
| **EagleOVaultComposer** | `0x0e5Fbb0F2cfA7b52C320c8654a621C2B487ff3e5` | [View](https://sepolia.etherscan.io/address/0x0e5Fbb0F2cfA7b52C320c8654a621C2B487ff3e5) |

### Test Token Mints

- ✅ 1,000,000 WLFI minted to deployer
- ✅ 1,000,000 USD1 minted to deployer

---

## 🔑 CONFIGURED ROLES

All roles initially set to deployer address:

| Role | Address |
|------|---------|
| **Owner** | `0x7310Dd6EF89b7f829839F140C6840bc929ba2031` |
| **Manager** | `0x7310Dd6EF89b7f829839F140C6840bc929ba2031` |
| **Keeper** | `0x7310Dd6EF89b7f829839F140C6840bc929ba2031` |
| **Emergency Admin** | `0x7310Dd6EF89b7f829839F140C6840bc929ba2031` |
| **Performance Fee Recipient** | `0x7310Dd6EF89b7f829839F140C6840bc929ba2031` |
| **Wrapper Fee Recipient** | `0x7310Dd6EF89b7f829839F140C6840bc929ba2031` |

---

## ⚙️ CONFIGURED PERMISSIONS

### EagleShareOFT
- ✅ Minter role granted to `EagleVaultWrapper`

### EagleVaultWrapper
- ✅ Composer whitelisted (no fees)
- ✅ Owner whitelisted (no fees)
- ✅ Fees set: 1% wrap, 2% unwrap

### Token Approvals
- ✅ Vault approved to spend WLFI
- ✅ Vault approved to spend USD1

---

## 🌐 LAYERZERO CONFIGURATION

| Setting | Value |
|---------|-------|
| **LayerZero Endpoint** | `0x6EDCE65403992e310A62460808c4b910D972f10f` |
| **LayerZero EID** | `40161` (Sepolia) |
| **Registry Chain ID** | `11155` |
| **Full Chain ID** | `11155111` |

---

## 📋 NEXT STEPS (IN ORDER)

### 1. Create Uniswap V3 Pool ✅ COMPLETE

**Pool Address**: `0x1a66D6b7c64E4D4c5905E0251B4e30fcEc9E1dB2`

- Token0 (USD1): `0x68cF24743CA335ae3c2e21c2538F4E929224F096`
- Token1 (WLFI): `0xebe5AA10eF54aE257B3ced8e229ed4f7a12eC693`
- Fee Tier: 0.3%
- Initial Price: 1:1
- Status: ✅ Deployed & Initialized

### 2. Test Vault Flows ⏳

After pool creation, test deposit/withdraw/wrap/unwrap:

```bash
forge script script/PostDeployment2_TestVault.s.sol:PostDeployment2_TestVault \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast \
  --legacy \
  -vv
```

### 3. Add Liquidity to Pool ⏳

Use Uniswap interface:
- https://app.uniswap.org/add
- Connect wallet with deployer address
- Add WLFI/USD1 liquidity (0.3% fee tier)

### 4. Update Vault Pool Address ⏳

```bash
cast send 0xdDC8061BB5e2caE36E27856620086bc6d59C2242 \
  "updatePool(address)" <POOL_ADDRESS> \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --legacy
```

### 5. Deploy to Arbitrum Sepolia (Spoke Chain) ⏳

### 6. Configure LayerZero Peers ⏳

### 7. Verify Contracts on Etherscan ⏳

---

## 🔍 VERIFICATION COMMANDS

```bash
# EagleRegistry
forge verify-contract 0x59940f7fbd43447aE80Dc5F997290f4B4131D7e6 \
  contracts/EagleRegistry.sol:EagleRegistry \
  --chain sepolia \
  --constructor-args $(cast abi-encode "constructor(address)" 0x7310Dd6EF89b7f829839F140C6840bc929ba2031)

# WLFI OFT
forge verify-contract 0xebe5AA10eF54aE257B3ced8e229ed4f7a12eC693 \
  contracts/layerzero/oft/WLFIAssetOFT.sol:WLFIAssetOFT \
  --chain sepolia \
  --constructor-args $(cast abi-encode "constructor(string,string,address,address)" "Wrapped LFI" "WLFI" 0x6EDCE65403992e310A62460808c4b910D972f10f 0x7310Dd6EF89b7f829839F140C6840bc929ba2031)

# USD1 OFT
forge verify-contract 0x68cF24743CA335ae3c2e21c2538F4E929224F096 \
  contracts/layerzero/oft/USD1AssetOFT.sol:USD1AssetOFT \
  --chain sepolia \
  --constructor-args $(cast abi-encode "constructor(string,string,address,address)" "USD1 Stablecoin" "USD1" 0x6EDCE65403992e310A62460808c4b910D972f10f 0x7310Dd6EF89b7f829839F140C6840bc929ba2031)

# EagleOVault (complex constructor - may need manual verification)
forge verify-contract 0xdDC8061BB5e2caE36E27856620086bc6d59C2242 \
  contracts/EagleOVault.sol:EagleOVault \
  --chain sepolia

# EagleShareOFT
forge verify-contract 0x87B831E8e1b09B35c888595cBae81CeA0d6bB260 \
  contracts/layerzero/oft/EagleShareOFT.sol:EagleShareOFT \
  --chain sepolia \
  --constructor-args $(cast abi-encode "constructor(string,string,address,address)" "Eagle Vault Shares" "vEAGLE" 0x6EDCE65403992e310A62460808c4b910D972f10f 0x7310Dd6EF89b7f829839F140C6840bc929ba2031)

# EagleVaultWrapper
forge verify-contract 0xA205ebeB4a3E0bb70D87c206eD0e9aA88561415a \
  contracts/EagleVaultWrapper.sol:EagleVaultWrapper \
  --chain sepolia \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address)" 0xdDC8061BB5e2caE36E27856620086bc6d59C2242 0x87B831E8e1b09B35c888595cBae81CeA0d6bB260 0x7310Dd6EF89b7f829839F140C6840bc929ba2031 0x7310Dd6EF89b7f829839F140C6840bc929ba2031)

# EagleOVaultComposer
forge verify-contract 0x0e5Fbb0F2cfA7b52C320c8654a621C2B487ff3e5 \
  contracts/layerzero/composers/EagleOVaultComposer.sol:EagleOVaultComposer \
  --chain sepolia
```

---

## 📊 SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                     SEPOLIA (HUB CHAIN)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Assets (OFTs)                  Vault                        │
│  ┌──────────────┐               ┌──────────────────┐        │
│  │ WLFI OFT     │──────────────▶│ EagleOVault      │        │
│  │ 0xebe5...693 │               │ 0xdDC8...2242    │        │
│  └──────────────┘               └────────┬─────────┘        │
│  ┌──────────────┐                        │                  │
│  │ USD1 OFT     │───────────────────────▶│                  │
│  │ 0x68cF...096 │                        │                  │
│  └──────────────┘                        │                  │
│                                           │ vault shares     │
│  Wrapper & Share OFT                     │                  │
│  ┌──────────────────────────────────────┼─────────────┐    │
│  │ EagleVaultWrapper                    ▼             │    │
│  │ 0xA205...15a                  [native vEAGLE]      │    │
│  │                                       │             │    │
│  │    wrap() ──────────────────────────▶│             │    │
│  │                               mint/burn             │    │
│  │                                       ▼             │    │
│  │                            EagleShareOFT           │    │
│  │                            0x87B8...260            │    │
│  │                         (bridgeable vEAGLE)        │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
│  LayerZero Orchestration                                   │
│  ┌────────────────────────────────────────────────────┐   │
│  │ EagleOVaultComposer  0x0e5F...3e5                  │   │
│  │ - Coordinates cross-chain deposit/redeem           │   │
│  │ - Works with wrapper for share conversion          │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ LayerZero Bridge
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 SPOKE CHAINS (TO BE DEPLOYED)                │
│            (Arbitrum, Base, Optimism, etc.)                  │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ EagleShareOFT (same contract, same symbol)         │     │
│  │ - Receive bridged vEAGLE from hub                  │     │
│  │ - Trade on local DEXs                              │     │
│  │ - Bridge back to hub to unwrap/withdraw            │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ DEPLOYMENT SUCCESS CHECKLIST

- [x] EagleRegistry deployed and configured
- [x] WLFI OFT deployed (1M tokens minted)
- [x] USD1 OFT deployed (1M tokens minted)
- [x] EagleOVault deployed with Yearn-inspired features
- [x] EagleShareOFT deployed
- [x] EagleVaultWrapper deployed
- [x] EagleOVaultComposer deployed
- [x] All roles configured
- [x] All permissions set (minter, whitelist, approvals)
- [x] Wrapper fees configured (1% wrap, 2% unwrap)
- [x] **Uniswap V3 pool created** (0x1a66D6b7c64E4D4c5905E0251B4e30fcEc9E1dB2)
- [ ] Initial liquidity added (PENDING)
- [ ] Vault flows tested (PENDING)
- [ ] Contracts verified on Etherscan (PENDING)
- [ ] Spoke chains deployed (PENDING)
- [ ] LayerZero peers configured (PENDING)

---

## 🎯 ACHIEVEMENT UNLOCKED

✅ **Full Eagle OVault System Deployed to Sepolia!**

- 7 contracts deployed successfully
- LayerZero V2 integration complete
- Registry-based architecture implemented
- Wrapper pattern for unified cross-chain experience
- Yearn-inspired vault features active
- Multi-strategy support ready
- Ready for pool creation and testing

**Next Milestone**: Create pool & test all flows

---

**Last Updated**: October 21, 2025  
**Status**: 🟢 LIVE ON SEPOLIA

