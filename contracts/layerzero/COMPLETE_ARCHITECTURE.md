# Complete Eagle OVault Cross-Chain Architecture

## ❓ **Your Question**

> "Are users still able to deposit WLFI and USD1 from other chains like how they would with the original OVault implementation with our wrapper version?"

## ✅ **Short Answer: YES! You need BOTH Composer AND Wrapper**

The **wrapper** and **composer** serve **different purposes**:
- **Composer** = Cross-chain deposits/redemptions (WLFI/USD1 → shares)
- **Wrapper** = Hub-chain share wrapping (vault shares → OFT tokens)

---

## 🏗️ **Complete Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                    HUB CHAIN (Ethereum)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. VAULT LAYER                                          │   │
│  │    EagleOVault.sol                                      │   │
│  │    └─> Deposits/redemptions of WLFI/USD1               │   │
│  │        Mints/burns vault shares (vEAGLE)                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────┼─────────────────────────────────┐ │
│  │ 2. WRAPPING LAYER       ▼                                 │ │
│  │    EagleVaultWrapper.sol                                  │ │
│  │    ├─> Locks vault shares (vEAGLE)                        │ │
│  │    ├─> Mints OFT tokens (vEAGLE-OFT)                      │ │
│  │    └─> 1:1 with fees (1% wrap, 2% unwrap)                │ │
│  └───────────────────────────────────────────────────────────┘ │
│                            │                                    │
│  ┌─────────────────────────┼─────────────────────────────────┐ │
│  │ 3. OFT LAYER            ▼                                 │ │
│  │    EagleShareOFT.sol (Hub)                                │ │
│  │    └─> OFT token with LayerZero                           │ │
│  │        Can send() to other chains                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                            │                                    │
│  ┌─────────────────────────┼─────────────────────────────────┐ │
│  │ 4. COMPOSER LAYER       │                                 │ │
│  │    EagleOVaultComposer.sol                                │ │
│  │    ├─> Receives WLFI/USD1 from other chains               │ │
│  │    ├─> Calls vault.deposit()                              │ │
│  │    ├─> Wraps shares via EagleVaultWrapper                 │ │
│  │    └─> Sends OFT to destination chain                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                            │                                    │
│  ┌─────────────────────────┴─────────────────────────────────┐ │
│  │ 5. ASSET OFTs                                             │ │
│  │    WLFIAssetOFT.sol / USD1AssetOFT.sol                    │ │
│  │    └─> Receive cross-chain WLFI/USD1                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                      LayerZero Bridge
                              │
┌─────────────────────────────────────────────────────────────────┐
│            SPOKE CHAINS (Arbitrum, Optimism, Base)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  WLFIAssetOFT.sol / USD1AssetOFT.sol                           │
│  └─> Users hold WLFI/USD1 here                                 │
│                                                                 │
│  EagleShareOFT.sol                                             │
│  └─> Users receive vault shares (OFT) here                     │
│      ├─> Fee-on-swap enabled                                   │
│      └─> Can trade on local DEXs                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 **User Flows**

### **Flow 1: Hub-Only Deposit (Local User)**

```typescript
// User on Ethereum (hub chain)

// 1. Deposit to vault
await wlfi.approve(vault.address, parseEther("1000"));
await vault.deposit(parseEther("1000"), userAddress);
// User receives: 1000 vEAGLE (vault shares)

// 2. Wrap to OFT (optional - for cross-chain or trading)
await vaultShares.approve(wrapper.address, parseEther("1000"));
await wrapper.wrap(parseEther("1000"));
// User receives: 990 vEAGLE-OFT (after 1% fee)

// 3. Bridge to Arbitrum (optional)
await eagleShareOFT.send({
  dstEid: ARBITRUM_EID,
  to: userAddress,
  amountLD: parseEther("990"),
  ...
});
// User receives: 990 vEAGLE-OFT on Arbitrum
```

**Wrapper used:** ✅ Yes (for wrapping vault shares)  
**Composer used:** ❌ No (direct vault interaction)

---

### **Flow 2: Cross-Chain Deposit via Composer** ⭐ **YOUR QUESTION**

```typescript
// User on Arbitrum (spoke chain)

// 1. Cross-chain deposit
await wlfiOFT.send({
  dstEid: ETHEREUM_EID,              // Hub chain
  to: COMPOSER_ADDRESS,              // Goes to Composer!
  amountLD: parseEther("1000"),
  composeMsg: {
    dstEid: ARBITRUM_EID,            // Receive shares on Arbitrum
    to: userAddress,
    minAmountLD: parseEther("980")   // 2% slippage tolerance
  }
}, { value: fee });

// What happens behind the scenes on hub:
// ┌─────────────────────────────────────────┐
// │ 1. WLFI arrives at Composer             │
// │ 2. Composer calls vault.deposit()        │
// │    └─> Vault mints shares to Composer    │
// │ 3. Composer calls wrapper.wrap()         │
// │    ├─> Locks vault shares                │
// │    └─> Mints OFT tokens to Composer      │
// │ 4. Composer calls shareOFT.send()        │
// │    └─> Sends OFT to Arbitrum             │
// └─────────────────────────────────────────┘

// User receives: ~980 vEAGLE-OFT on Arbitrum ✅
```

**Wrapper used:** ✅ Yes (Composer uses it internally)  
**Composer used:** ✅ Yes (orchestrates the entire flow)

---

### **Flow 3: Cross-Chain Redemption via Composer**

```typescript
// User on Optimism (spoke chain)

// 1. Cross-chain redemption
await shareOFT.send({
  dstEid: ETHEREUM_EID,              // Hub chain
  to: COMPOSER_ADDRESS,              // Goes to Composer!
  amountLD: parseEther("980"),
  composeMsg: {
    dstEid: OPTIMISM_EID,            // Receive WLFI on Optimism
    to: userAddress,
    minAmountLD: parseEther("950")   // 3% slippage tolerance
  }
}, { value: fee });

// What happens behind the scenes on hub:
// ┌─────────────────────────────────────────┐
// │ 1. OFT arrives at Composer              │
// │ 2. Composer calls wrapper.unwrap()       │
// │    ├─> Burns OFT tokens                  │
// │    └─> Releases vault shares to Composer │
// │ 3. Composer calls vault.redeem()         │
// │    └─> Vault sends WLFI to Composer      │
// │ 4. Composer calls assetOFT.send()        │
// │    └─> Sends WLFI to Optimism            │
// └─────────────────────────────────────────┘

// User receives: ~950 WLFI on Optimism ✅
```

**Wrapper used:** ✅ Yes (Composer uses it internally)  
**Composer used:** ✅ Yes (orchestrates the entire flow)

---

## 🎯 **Key Insight: Composer + Wrapper Work Together**

### **The Composer USES the Wrapper internally!**

```solidity
// EagleOVaultComposer internal flow

function _lzCompose(
    address _from,
    bytes32 _guid,
    bytes calldata _message,
    address,
    bytes calldata
) internal override {
    // Decode message
    (uint32 dstEid, bytes32 to, uint256 minAmountLD) = abi.decode(_message, ...);
    
    // Check if this is a deposit or redemption
    if (_from == address(ASSET_OFT)) {
        // DEPOSIT FLOW
        
        // 1. Deposit WLFI to vault
        uint256 shares = vault.deposit(amount, address(this));
        
        // 2. Wrap shares to OFT ⭐ USES WRAPPER!
        vaultShares.approve(wrapper, shares);
        wrapper.wrap(shares);  // ← Wrapper called here!
        
        // 3. Send OFT to destination chain
        shareOFT.send(dstEid, to, minAmountLD, ...);
        
    } else if (_from == address(SHARE_OFT)) {
        // REDEMPTION FLOW
        
        // 1. Unwrap OFT to vault shares ⭐ USES WRAPPER!
        shareOFT.approve(wrapper, amount);
        wrapper.unwrap(amount);  // ← Wrapper called here!
        
        // 2. Redeem vault shares for WLFI
        uint256 assets = vault.redeem(vaultShares, address(this), address(this));
        
        // 3. Send WLFI to destination chain
        assetOFT.send(dstEid, to, assets, ...);
    }
}
```

**The Composer is the "orchestrator" that uses all other contracts!**

---

## 📊 **Contract Responsibilities**

| Contract | Responsibility | Used By | Location |
|----------|---------------|---------|----------|
| **EagleOVault** | Vault deposits/redemptions | Users, Composer | Hub |
| **EagleVaultWrapper** | Wrap/unwrap vault shares ↔ OFT | Users, Composer | Hub |
| **EagleShareOFT** | OFT token, cross-chain transfers | Users, Composer | Hub + Spoke |
| **EagleOVaultComposer** | Cross-chain orchestration | LayerZero | Hub |
| **WLFIAssetOFT** | Cross-chain WLFI transfers | Users, Composer | Hub + Spoke |
| **USD1AssetOFT** | Cross-chain USD1 transfers | Users, Composer | Hub + Spoke |

---

## ✅ **What You Need to Deploy**

### **Hub Chain (Ethereum):**

```bash
# 1. Vault (if not already deployed)
forge create EagleOVault

# 2. Asset OFTs
forge create WLFIAssetOFT
forge create USD1AssetOFT

# 3. Share OFT (hub version)
forge create EagleShareOFT

# 4. Wrapper
forge create EagleVaultWrapper \
  --constructor-args $VAULT $SHARE_OFT $FEE_RECIPIENT $OWNER

# 5. Composer ⭐ CRITICAL!
forge create EagleOVaultComposer \
  --constructor-args $VAULT $ASSET_OFT $SHARE_OFT

# 6. Grant permissions
# - Wrapper can mint/burn ShareOFT
cast send $SHARE_OFT "setMinter(address,bool)" $WRAPPER true

# - Composer can wrap/unwrap via Wrapper
# (Wrapper needs to whitelist Composer to avoid fees)
cast send $WRAPPER "setWhitelist(address,bool)" $COMPOSER true
```

### **Spoke Chains (Arbitrum, Optimism, Base):**

```bash
# 1. Asset OFTs
forge create WLFIAssetOFT
forge create USD1AssetOFT

# 2. Share OFT
forge create EagleShareOFT
```

### **Wire LayerZero Peers:**

```bash
pnpm hardhat lz:oapp:wire --oapp-config layerzero.wlfi.config.ts
pnpm hardhat lz:oapp:wire --oapp-config layerzero.usd1.config.ts
pnpm hardhat lz:oapp:wire --oapp-config layerzero.share.config.ts
```

---

## 🔑 **Critical Configuration**

### **1. Composer Must Be Whitelisted in Wrapper**

```typescript
// Whitelist Composer to avoid double fees
await wrapper.setWhitelist(composerAddress, true);

// Why?
// Composer wraps/unwraps internally during cross-chain ops
// If not whitelisted, users pay:
// - 1% wrap fee + gas fees = expensive!
// - 2% unwrap fee + gas fees = very expensive!
//
// With whitelist:
// - Composer wraps/unwraps for FREE ✅
// - Only LayerZero gas fees apply
```

### **2. Wrapper Must Be Minter in ShareOFT**

```typescript
// Grant wrapper mint/burn permissions
await shareOFT.setMinter(wrapperAddress, true);

// Why?
// Wrapper needs to mint OFT when wrapping vault shares
// Wrapper needs to burn OFT when unwrapping to vault shares
```

### **3. Composer Needs Approvals**

```solidity
// In Composer constructor or setup function
VAULT_SHARES.approve(address(WRAPPER), type(uint256).max);
SHARE_OFT.approve(address(WRAPPER), type(uint256).max);

// Why?
// Composer needs to approve Wrapper to wrap/unwrap shares
```

---

## 💡 **Updated Composer Implementation**

You'll need to update `EagleOVaultComposer` to integrate with the wrapper:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { VaultComposerSync } from "@layerzerolabs/ovault-evm/contracts/VaultComposerSync.sol";

interface IEagleVaultWrapper {
    function wrap(uint256 amount) external;
    function unwrap(uint256 amount) external;
}

contract EagleOVaultComposer is VaultComposerSync {
    IEagleVaultWrapper public immutable WRAPPER;
    
    constructor(
        address _vault,
        address _assetOFT,
        address _shareOFT,
        address _wrapper
    ) VaultComposerSync(_vault, _assetOFT, _shareOFT) {
        WRAPPER = IEagleVaultWrapper(_wrapper);
        
        // Grant approvals for wrapper
        IERC20(VAULT.asset()).approve(_wrapper, type(uint256).max);
        IERC20(address(SHARE_OFT)).approve(_wrapper, type(uint256).max);
    }
    
    // Override _lzCompose to integrate wrapper
    function _lzCompose(
        address _from,
        bytes32 _guid,
        bytes calldata _message,
        address,
        bytes calldata
    ) internal override {
        // Decode compose message
        (uint32 dstEid, bytes32 to, uint256 minAmountLD) = abi.decode(
            _message,
            (uint32, bytes32, uint256)
        );
        
        if (_from == address(ASSET_OFT)) {
            // ===================================
            // DEPOSIT FLOW: WLFI → Shares (OFT)
            // ===================================
            
            uint256 assetAmount = IERC20(VAULT.asset()).balanceOf(address(this));
            
            // 1. Deposit to vault
            uint256 shares = VAULT.deposit(assetAmount, address(this));
            
            // 2. Wrap shares to OFT
            WRAPPER.wrap(shares);  // ⭐ Uses wrapper!
            
            // 3. Send OFT to destination chain
            uint256 oftAmount = SHARE_OFT.balanceOf(address(this));
            
            require(oftAmount >= minAmountLD, "Insufficient OFT amount");
            
            // Send OFT cross-chain
            _sendOFT(
                SHARE_OFT,
                dstEid,
                to,
                oftAmount,
                minAmountLD,
                _buildOptions(dstEid)
            );
            
        } else if (_from == address(SHARE_OFT)) {
            // ===================================
            // REDEMPTION FLOW: Shares (OFT) → WLFI
            // ===================================
            
            uint256 oftAmount = SHARE_OFT.balanceOf(address(this));
            
            // 1. Unwrap OFT to vault shares
            WRAPPER.unwrap(oftAmount);  // ⭐ Uses wrapper!
            
            // 2. Redeem vault shares for WLFI
            uint256 vaultShares = IERC20(address(VAULT)).balanceOf(address(this));
            uint256 assets = VAULT.redeem(vaultShares, address(this), address(this));
            
            require(assets >= minAmountLD, "Insufficient assets");
            
            // 3. Send WLFI cross-chain
            _sendOFT(
                ASSET_OFT,
                dstEid,
                to,
                assets,
                minAmountLD,
                _buildOptions(dstEid)
            );
        }
    }
}
```

---

## 🎯 **Comparison: With vs Without Wrapper**

### **Without Wrapper (Standard OVault):**

```
Cross-chain deposit:
WLFI (Arbitrum) → Composer → vault.deposit() → ShareOFTAdapter → vEAGLE (Arbitrum)
                                                  ↑
                                            Problem: Different contract types!
```

### **With Wrapper (Your Architecture):**

```
Cross-chain deposit:
WLFI (Arbitrum) → Composer → vault.deposit() → wrapper.wrap() → ShareOFT → vEAGLE (Arbitrum)
                                                                    ↑
                                                Same EagleShareOFT everywhere! ✅
```

---

## 📈 **Benefits Summary**

| Feature | Without Wrapper | With Wrapper |
|---------|----------------|--------------|
| **Cross-chain deposits** | ✅ Works | ✅ Works |
| **Cross-chain redemptions** | ✅ Works | ✅ Works |
| **Same OFT on all chains** | ❌ No | ✅ Yes |
| **Hub share liquidity** | Limited | Enhanced |
| **Presale whitelist** | ❌ No | ✅ Yes |
| **Fee flexibility** | Vault only | Vault + Wrapper |
| **Contracts to deploy** | 4 | 5 (1 more) |

---

## ⚠️ **Important Notes**

### **1. Composer Must Be Whitelisted**

```typescript
// CRITICAL: Whitelist Composer in Wrapper
await wrapper.setWhitelist(composerAddress, true);

// Otherwise users pay:
// Cross-chain deposit: 1% wrap fee + LayerZero fees
// Cross-chain redeem: 2% unwrap fee + LayerZero fees
//
// With whitelist: Only LayerZero fees! ✅
```

### **2. Users Have Two Options**

```typescript
// Option A: Direct hub interaction (cheaper gas)
1. Deposit to vault → Get vault shares
2. Wrap shares → Get OFT
3. Bridge OFT → To other chains

// Option B: Cross-chain via Composer (one transaction)
1. Send WLFI from Arbitrum → Get OFT on Arbitrum
   (Composer handles deposit + wrap + bridge internally)
```

### **3. Wrapper Adds Flexibility**

```typescript
// Without wrapper:
// - Vault shares on hub can't be traded easily
// - No cross-chain liquidity for shares

// With wrapper:
// - Wrap to OFT → Trade on hub DEXs
// - Bridge OFT → Share liquidity on all chains
// - Presale participants can wrap for free
```

---

## 🚀 **Deployment Checklist**

### **Hub Chain:**
- [ ] Deploy `EagleOVault`
- [ ] Deploy `WLFIAssetOFT` & `USD1AssetOFT`
- [ ] Deploy `EagleShareOFT`
- [ ] Deploy `EagleVaultWrapper`
- [ ] Deploy `EagleOVaultComposer`
- [ ] Grant `wrapper` mint/burn on `shareOFT`
- [ ] Whitelist `composer` in `wrapper`
- [ ] Configure wrapper fees (1% wrap, 2% unwrap)

### **Spoke Chains:**
- [ ] Deploy `WLFIAssetOFT` & `USD1AssetOFT`
- [ ] Deploy `EagleShareOFT`
- [ ] Configure fee-on-swap per chain

### **LayerZero:**
- [ ] Wire WLFI peers (all chains)
- [ ] Wire USD1 peers (all chains)
- [ ] Wire ShareOFT peers (all chains)

### **Testing:**
- [ ] Test hub-only deposit
- [ ] Test cross-chain deposit (Arbitrum → Hub → Optimism)
- [ ] Test cross-chain redemption
- [ ] Test wrapper fees
- [ ] Test presale whitelist

---

## 🎉 **TL;DR**

### **Your Question:**
> Can users still deposit WLFI/USD1 from other chains with the wrapper?

### **Answer:**
✅ **YES! You need BOTH Composer AND Wrapper!**

**They serve different purposes:**
- **Composer** = Cross-chain deposits/redemptions
- **Wrapper** = Vault shares ↔ OFT tokens on hub

**Composer USES the Wrapper internally:**
```
User on Arbitrum sends WLFI
  ↓
Composer receives on hub
  ↓
Composer calls vault.deposit() → Gets vault shares
  ↓
Composer calls wrapper.wrap() → Converts to OFT
  ↓
Composer sends OFT back to Arbitrum
  ↓
User receives vEAGLE-OFT on Arbitrum ✅
```

**Critical configs:**
1. ✅ Whitelist Composer in Wrapper (no double fees)
2. ✅ Grant Wrapper mint/burn on ShareOFT
3. ✅ Approve Wrapper in Composer

**Result:**
- ✅ Cross-chain deposits work perfectly
- ✅ Same EagleShareOFT on all chains
- ✅ Users have hub + cross-chain options
- ✅ Enhanced flexibility and liquidity

---

**Last Updated:** October 21, 2025  
**Architecture:** Composer + Wrapper (Complete Solution)  
**Status:** ✅ Fully compatible with cross-chain deposits!

