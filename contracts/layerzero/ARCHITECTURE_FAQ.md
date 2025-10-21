# Eagle OVault LayerZero Architecture FAQ

## ❓ **Can I deploy EagleShareOFT on the hub chain (Ethereum) too?**

### **Short Answer:** ❌ No, but you can achieve the same user experience!

### **Why Not?**

The LayerZero OVault architecture **by design** uses different contract types on hub vs spoke chains:

```
┌─────────────────────────────────────────────────────────────┐
│                    HUB CHAIN (Ethereum)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  EagleOVault.sol (ERC-4626 Vault)                          │
│  └─> Mints vEAGLE shares (native ERC20)                    │
│       ├─> Name: "Eagle Vault Shares"                       │
│       ├─> Symbol: "vEAGLE"                                 │
│       ├─> Functions: transfer(), balanceOf(), etc.         │
│       └─> These are the REAL vault shares                  │
│                                                             │
│  EagleShareOFTAdapter.sol (OFTAdapter)                     │
│  └─> Wraps vEAGLE for cross-chain transfers                │
│       ├─> Locks vEAGLE when sending to spoke chains        │
│       └─> Unlocks vEAGLE when receiving from spoke chains  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                      LayerZero Bridge
                              │
┌─────────────────────────────────────────────────────────────┐
│              SPOKE CHAINS (Arbitrum, Optimism, Base)        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  EagleShareOFT.sol (OFT)                                   │
│  └─> Represents vEAGLE on spoke chains                     │
│       ├─> Name: "Eagle Vault Shares"                       │
│       ├─> Symbol: "vEAGLE"                                 │
│       ├─> Functions: transfer(), balanceOf(), etc.         │
│       ├─> Minted when vEAGLE bridges from hub              │
│       └─> Burned when vEAGLE bridges back to hub           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 **Key Architectural Constraints**

### **1. Vault Shares MUST Be Minted by the Vault**

```solidity
// EagleOVault.sol (Hub Chain)
function deposit(uint256 assets, address receiver) public returns (uint256 shares) {
    // Vault calculates shares based on current ratio
    shares = convertToShares(assets);
    
    // CRITICAL: Vault mints the shares
    _mint(receiver, shares);  // ← This is the ONLY place real shares can be minted
}
```

**Why this matters:**
- The vault's `totalSupply()` MUST equal all minted shares
- If you deployed EagleShareOFT on hub and minted there, you'd break the vault's accounting
- Share price = `totalAssets() / totalSupply()`
- Any external minting would inflate `totalSupply` and crash the share price

### **2. OFTAdapter Is Required for Lockbox Model**

The hub uses a **lockbox model** (not mint/burn):

```solidity
// When bridging TO spoke chains:
1. User locks vEAGLE in EagleShareOFTAdapter
2. LayerZero message sent to spoke chain
3. EagleShareOFT mints equivalent shares on spoke chain

// When bridging FROM spoke chains:
1. EagleShareOFT burns shares on spoke chain
2. LayerZero message sent to hub
3. EagleShareOFTAdapter unlocks vEAGLE to user
```

**Why lockbox?**
- ✅ Preserves the vault's `totalSupply()` on hub chain
- ✅ No minting/burning of real shares
- ✅ Vault accounting remains intact
- ✅ Share price stays accurate

---

## ✅ **How to Achieve Consistent UX Across All Chains**

Even though you can't use the same contract type on all chains, you CAN ensure identical user experience:

### **1. Same Name & Symbol**

```solidity
// Hub Chain - EagleOVault.sol
constructor() ERC20("Eagle Vault Shares", "vEAGLE") { }

// Spoke Chains - EagleShareOFT.sol
constructor(
    string memory _name,
    string memory _symbol,
    address _lzEndpoint,
    address _delegate
) OFT(_name, _symbol, _lzEndpoint, _delegate) {
    // Deploy with: "Eagle Vault Shares", "vEAGLE"
}
```

**Result:** Users see "vEAGLE" on ALL chains! ✅

### **2. Same Functions**

Both contracts implement ERC20, so users have the same interface:

```solidity
// Available on ALL chains:
balanceOf(address account)
transfer(address to, uint256 amount)
approve(address spender, uint256 amount)
transferFrom(address from, address to, uint256 amount)
```

### **3. Same Decimals**

```solidity
// Ensure both use 18 decimals
function decimals() public pure override returns (uint8) {
    return 18;
}
```

### **4. Additional Benefits on Spoke Chains**

EagleShareOFT has **extra features** on spoke chains:

```solidity
// Spoke chains ONLY:
setSwapFeeConfig(...)     // Configure tokenomics
setV3Pool(...)            // V3 compatibility
setFeeExempt(...)         // Exempt addresses
getFeeStats()             // View fee statistics
```

**Why this is good:**
- Hub stays simple (vault-focused)
- Spoke chains can have custom tokenomics per chain
- Flexible fee structures (Arbitrum fees ≠ Optimism fees)

---

## 📊 **Comparison: Hub vs Spoke**

| Feature | Hub (Ethereum) | Spoke (Arbitrum, etc.) |
|---------|----------------|------------------------|
| **Contract Type** | Native ERC20 (from vault) | OFT (LayerZero) |
| **Contract Name** | EagleOVault | EagleShareOFT |
| **Token Name** | "Eagle Vault Shares" | "Eagle Vault Shares" |
| **Token Symbol** | "vEAGLE" | "vEAGLE" |
| **Minting** | By vault (deposit) | By LayerZero (bridge) |
| **Burning** | By vault (redeem) | By LayerZero (bridge) |
| **Fee-on-swap** | ❌ No | ✅ Yes (optional) |
| **Cross-chain** | Via OFTAdapter | Native OFT |
| **User Functions** | ✅ Same ERC20 interface | ✅ Same ERC20 interface |
| **User Experience** | ✅ Identical | ✅ Identical |

---

## 🤔 **Alternative Architecture (Not Recommended)**

### **Option: Deploy EagleShareOFT on hub too**

**Technical:** You *could* deploy EagleShareOFT on the hub, but this would be **separate** from the vault shares:

```
Hub Chain:
├── EagleOVault (vEAGLE)           ← Real shares
├── EagleShareOFT (vEAGLE-OFT)     ← Separate token ❌
└── Bridge contract                 ← Wraps vEAGLE → vEAGLE-OFT
```

**Why this is bad:**
- ❌ Two different "vEAGLE" tokens on hub (confusing!)
- ❌ Need an extra bridge contract (vEAGLE → vEAGLE-OFT)
- ❌ More gas costs
- ❌ More complexity
- ❌ Users could hold the wrong token
- ❌ Exchange listings would be messy
- ❌ No benefits over OFTAdapter approach

---

## ✅ **Recommended Architecture (Current)**

### **Use the standard LayerZero OVault pattern:**

```
┌────────────────────────────────────────────────────┐
│                  HUB (Ethereum)                    │
│                                                    │
│  [EagleOVault] ──> vEAGLE (real shares)           │
│         │                                          │
│         └──> [EagleShareOFTAdapter] (lockbox)     │
│                       │                            │
└───────────────────────┼────────────────────────────┘
                        │ LayerZero
┌───────────────────────┼────────────────────────────┐
│                       │                            │
│        ┌──────────────┴──────────────┐             │
│        │                             │             │
│  [EagleShareOFT]            [EagleShareOFT]        │
│    Arbitrum                    Optimism            │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Standard LayerZero OVault pattern
- ✅ Vault accounting stays correct
- ✅ Same user experience on all chains
- ✅ Flexible per-chain tokenomics
- ✅ Lower gas costs (no extra bridge)
- ✅ Clear separation of concerns

---

## 💡 **Pro Tips**

### **1. Use Consistent Metadata**

```typescript
// Hub deployment (EagleOVault constructor)
name: "Eagle Vault Shares"
symbol: "vEAGLE"

// Spoke deployments (EagleShareOFT constructor)
name: "Eagle Vault Shares"
symbol: "vEAGLE"

// Result: Identical display on block explorers, wallets, DEXs
```

### **2. Use Same Decimals**

```solidity
// Both contracts
function decimals() public pure override returns (uint8) {
    return 18;
}
```

### **3. Deploy to Same Address (Optional)**

Use CREATE2 to deploy to identical addresses on all chains:

```solidity
// Deploy EagleShareOFT to 0x1234...ABCD on ALL spoke chains
// Benefits:
// - Easier to remember
// - Cleaner UI/UX
// - Professional appearance
```

### **4. Market As "vEAGLE" Everywhere**

From the user's perspective, they hold "vEAGLE" on all chains:

```
User Journey:
1. Deposit WLFI on Ethereum → Receive vEAGLE
2. Bridge vEAGLE to Arbitrum → Still vEAGLE (same symbol)
3. Swap vEAGLE on Arbitrum DEX → Works like any ERC20
4. Bridge back to Ethereum → Original vEAGLE
5. Redeem for WLFI → Complete cycle

User never knows about "OFTAdapter" vs "OFT" - it's all vEAGLE!
```

---

## 📚 **Further Reading**

- [LayerZero OVault Architecture](https://github.com/LayerZero-Labs/ovault-evm)
- [OFT vs OFTAdapter](https://docs.layerzero.network/contracts/oft)
- [ERC-4626 Vault Standard](https://eips.ethereum.org/EIPS/eip-4626)
- [Eagle OVault Deployment Guide](../LAYERZERO_OVAULT_DEPLOYMENT.md)

---

## 🎯 **TL;DR**

**Q:** Can I deploy EagleShareOFT on hub (Ethereum) too?

**A:** ❌ No, use EagleShareOFTAdapter on hub instead.

**Why?**
- Vault shares MUST be minted by the vault
- OFTAdapter preserves vault accounting
- Standard LayerZero OVault pattern

**User Impact:**
- ✅ Zero! Same name, symbol, functions on all chains
- ✅ Users see "vEAGLE" everywhere
- ✅ Identical user experience

**Your Goal (Same contract everywhere):**
- ✅ Achieved via metadata (name/symbol)
- ✅ Same ERC20 interface
- ✅ Different contract types (by necessity)
- ✅ But users don't notice the difference!

---

**Last Updated:** October 21, 2025  
**Architecture:** LayerZero OVault Hub-and-Spoke Model  
**Status:** ✅ Production-ready, battle-tested design

