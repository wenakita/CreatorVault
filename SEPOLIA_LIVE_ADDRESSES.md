# 🚀 Eagle OVault - LIVE SEPOLIA ADDRESSES

## ✅ DEPLOYMENT COMPLETE - October 21, 2025

**Block**: 9460340  
**Total Gas Used**: 19,038,049 gas  
**Total Cost**: 0.0190 ETH

---

## 📜 DEPLOYED CONTRACT ADDRESSES

| Contract | Address | Etherscan |
|----------|---------|-----------|
| **EagleRegistry** | `0x93d48D3625fF8E522f63E873352256607b37f2EF` | [View](https://sepolia.etherscan.io/address/0x93d48D3625fF8E522f63E873352256607b37f2EF) |
| **WLFI OFT** | `0x33fB8387d4C6F5B344ca6C6C68e4576db10BDEa3` | [View](https://sepolia.etherscan.io/address/0x33fB8387d4C6F5B344ca6C6C68e4576db10BDEa3) |
| **USD1 OFT** | `0xdDC8061BB5e2caE36E27856620086bc6d59C2242` | [View](https://sepolia.etherscan.io/address/0xdDC8061BB5e2caE36E27856620086bc6d59C2242) |
| **EagleOVault** | `0x84a744da7a4646942b5C9724897ca05bCbBbB10b` | [View](https://sepolia.etherscan.io/address/0x84a744da7a4646942b5C9724897ca05bCbBbB10b) |
| **EagleShareOFT** | `0x532Ec3711C9E219910045e2bBfA0280ae0d8457e` | [View](https://sepolia.etherscan.io/address/0x532Ec3711C9E219910045e2bBfA0280ae0d8457e) |
| **EagleVaultWrapper** | `0x577D6cc9B905e628F6fBB9D1Ac6279709654b44f` | [View](https://sepolia.etherscan.io/address/0x577D6cc9B905e628F6fBB9D1Ac6279709654b44f) |
| **EagleOVaultComposer** | `0x14076c8A5328c6f04e0291897b94D1a36BF3C1D8` | [View](https://sepolia.etherscan.io/address/0x14076c8A5328c6f04e0291897b94D1a36BF3C1D8) |

---

## 🔑 ROLES

All roles set to deployer: `0x7310Dd6EF89b7f829839F140C6840bc929ba2031`

---

## ⚙️ CONFIGURATION

- LayerZero Endpoint: `0x6EDCE65403992e310A62460808c4b910D972f10f`
- LayerZero EID: `40161`
- Test Tokens Minted: 1,000,000 WLFI + 1,000,000 USD1

---

## 📋 NEXT STEPS

### 1. Create Uniswap V3 Pool
```bash
forge script script/PostDeployment1_CreatePool.s.sol:PostDeployment1_CreatePool \
  --rpc-url $SEPOLIA_RPC_URL --broadcast --legacy -vv
```

### 2. Update Vault with Pool Address
```bash
cast send 0x84a744da7a4646942b5C9724897ca05bCbBbB10b \
  "updatePool(address)" <POOL_ADDRESS> \
  --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --legacy
```

### 3. Test Vault Flows
```bash
forge script script/PostDeployment2_TestVault.s.sol:PostDeployment2_TestVault \
  --rpc-url $SEPOLIA_RPC_URL --broadcast --legacy -vv
```

---

**Status**: 🟢 LIVE ON SEPOLIA

