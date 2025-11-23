# Eagle OVault LayerZero Contracts

**Architecture:** EagleVaultWrapper Pattern (Same EAGLE token on ALL chains)  
**Status:** ✅ Production-ready  
**Last Updated:** October 27, 2025

---

## 🎯 Architecture Overview

We use a **custom architecture** where the **same EagleShareOFT contract** is deployed on **ALL chains** (including the hub) with the **same address** via CREATE2.

### Why Not Standard OFTAdapter?

**Standard LayerZero Pattern:**
- ❌ Different tokens on hub vs spokes
- ❌ "Vault shares" vs "EAGLE" confusion
- ❌ Can't use same address on all chains

**Our Pattern (EagleVaultWrapper):**
- ✅ Same "EAGLE" token everywhere
- ✅ Same address everywhere (via CREATE2)
- ✅ Consistent branding
- ✅ Better UX

See `../../ARCHITECTURE_DECISION.md` for full rationale.

---

## 📁 Directory Structure

```
layerzero/
├── adapters/          # Asset OFT adapters ONLY (not for shares!)
│   ├── WLFIAdapter.sol           # Hub chain: wraps existing WLFI
│   └── USD1Adapter.sol           # Hub chain: wraps existing USD1
│
├── oft/               # Omnichain Fungible Tokens
│   ├── EagleShareOFT.sol         # ALL CHAINS: EAGLE token ✅
│   ├── WLFIAssetOFT.sol          # All chains: WLFI OFT (if new)
│   └── USD1AssetOFT.sol          # All chains: USD1 OFT (if new)
│
└── composers/         # VaultComposerSync orchestrators
    └── EagleOVaultComposer.sol   # Hub chain: cross-chain vault ops
```

**Note:** `EagleShareOFTAdapter` is **DEPRECATED**. See `../deprecated/` for old adapter.

---

## 🌐 Multi-Chain Architecture

```
╔══════════════════════════════════════════════════════════════╗
║                 ALL CHAINS (Same Contract)                   ║
╚══════════════════════════════════════════════════════════════╝

  EagleShareOFT (0xSAME_ADDRESS via CREATE2)
  ├─ Name: "Eagle Vault Shares"
  ├─ Symbol: "EAGLE"
  ├─ LayerZero OFT functionality
  └─ No fees on transfers ✅


╔══════════════════════════════════════════════════════════════╗
║           ETHEREUM MAINNET (Hub) - Special Setup             ║
╚══════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────┐
│ 1. EagleOVault                                               │
│    └─ ERC4626 vault (WLFI/USD1 deposits)                    │
└─────────────────────────────────────────────────────────────┘
                        ↓ 1:1 conversion
┌─────────────────────────────────────────────────────────────┐
│ 2. EagleVaultWrapper                                         │
│    ├─ wrap():   Lock vault shares → Mint EAGLE (1:1)       │
│    └─ unwrap(): Burn EAGLE → Release vault shares (1:1)    │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. EagleShareOFT                                             │
│    └─ Cross-chain transfers via LayerZero                   │
└─────────────────────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════╗
║           SPOKE CHAINS (Arbitrum, Base, etc.)                ║
╚══════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────┐
│ EagleShareOFT (0xSAME_ADDRESS)                               │
│ ├─ Receives bridged EAGLE from hub                          │
│ ├─ Standard ERC20 transfers                                 │
│ ├─ Cross-chain transfers via LayerZero                      │
│ └─ Can be bridged back to hub                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Deployment Guide

### **Phase 1: Hub Chain (Ethereum)**

Deploy in this order:

```bash
# 1. Deploy EagleOVault (if not already deployed)
forge create contracts/EagleOVault.sol:EagleOVault \
  --constructor-args <WLFI> <USD1> <OWNER>

# 2. Deploy EagleShareOFT (with CREATE2 for same address)
forge create contracts/layerzero/oft/EagleShareOFT.sol:EagleShareOFT \
  --constructor-args "Eagle Vault Shares" "EAGLE" <LZ_ENDPOINT> <OWNER> \
  --create2 <SALT>

# 3. Deploy EagleVaultWrapper
forge create contracts/EagleVaultWrapper.sol:EagleVaultWrapper \
  --constructor-args <VAULT_ADDRESS> <EAGLE_OFT_ADDRESS> <OWNER>

# 4. Set wrapper as minter (CRITICAL!)
cast send <EAGLE_OFT_ADDRESS> \
  "setMinter(address,bool)" <WRAPPER_ADDRESS> true \
  --private-key <KEY>

# 5. Deploy Asset OFTs or Adapters (choose ONE):
#    Option A: If WLFI/USD1 already exist
forge create contracts/layerzero/adapters/WLFIAdapter.sol:WLFIAdapter \
  --constructor-args <WLFI_ADDRESS> <LZ_ENDPOINT> <OWNER>

#    Option B: If WLFI/USD1 are new tokens
forge create contracts/layerzero/oft/WLFIAssetOFT.sol:WLFIAssetOFT \
  --constructor-args "WLFI" "WLFI" <LZ_ENDPOINT> <OWNER>
```

---

### **Phase 2: Spoke Chains (Arbitrum, Base, etc.)**

Deploy same EagleShareOFT with **SAME CREATE2 salt**:

```bash
# Deploy EagleShareOFT (SAME salt = SAME address!)
forge create contracts/layerzero/oft/EagleShareOFT.sol:EagleShareOFT \
  --constructor-args "Eagle Vault Shares" "EAGLE" <LZ_ENDPOINT> <OWNER> \
  --create2 <SAME_SALT> \
  --rpc-url <ARBITRUM_RPC>

# DO NOT set any minters on spokes!
# LayerZero endpoint handles all minting/burning

# Deploy Asset OFTs (if using new tokens)
forge create contracts/layerzero/oft/WLFIAssetOFT.sol:WLFIAssetOFT \
  --constructor-args "WLFI" "WLFI" <LZ_ENDPOINT> <OWNER> \
  --rpc-url <ARBITRUM_RPC>
```

---

### **Phase 3: LayerZero Configuration**

Wire all chains together:

```bash
# Configure trusted peers for EAGLE shares
pnpm hardhat lz:oapp:wire --oapp-config layerzero.config.eagle-shares.ts

# Configure trusted peers for asset OFTs
pnpm hardhat lz:oapp:wire --oapp-config layerzero.config.assets.ts

# Verify configuration
pnpm hardhat lz:oapp:config:get --oapp-config layerzero.config.eagle-shares.ts
```

---

## 🔄 User Flows

### **Flow 1: Deposit & Bridge to Arbitrum**

```
1. User deposits WLFI on Ethereum → EagleOVault
   └─ Receives vault shares (ERC4626)

2. User wraps vault shares → EagleVaultWrapper
   └─ Vault shares locked in wrapper
   └─ EAGLE OFT minted to user (1:1)

3. User bridges EAGLE → Arbitrum via LayerZero
   └─ EAGLE burned on Ethereum
   └─ EAGLE minted on Arbitrum (same address!)

4. User receives EAGLE on Arbitrum
   └─ Can trade, hold, or transfer
```

### **Flow 2: Bridge Back & Redeem**

```
1. User bridges EAGLE from Arbitrum → Ethereum
   └─ EAGLE burned on Arbitrum
   └─ EAGLE minted on Ethereum

2. User unwraps EAGLE → EagleVaultWrapper
   └─ EAGLE burned
   └─ Vault shares released to user (1:1)

3. User redeems vault shares → EagleOVault
   └─ Receives WLFI/USD1
```

---

## 📋 Contract Purposes

### **EagleShareOFT** (ALL Chains) ✅

**Purpose:** Standard LayerZero OFT for Eagle Vault Shares

**Deploy Where:** ALL chains (Ethereum, Arbitrum, Base, Optimism, etc.)

**Key Features:**
- ✅ Same metadata everywhere ("EAGLE", 18 decimals)
- ✅ Same address everywhere (via CREATE2)
- ✅ Standard ERC20 functionality
- ✅ LayerZero cross-chain transfers
- ✅ **No fees on any transfers** (important!)
- ✅ Minter role for EagleVaultWrapper (hub only)

**Critical:**
- On **Ethereum (hub):** EagleVaultWrapper is the ONLY minter
- On **spokes:** NO local minters (LayerZero handles minting)

See `../../EAGLESHAREOFT_REVIEW.md` for full contract review.

---

### **EagleVaultWrapper** (Hub Chain Only) ✅

**Purpose:** Converts vault shares ↔ EAGLE OFT (1:1)

**Deploy Where:** Ethereum mainnet only

**Functions:**
```solidity
function wrap(uint256 amount) external;
  // Lock vault shares, mint EAGLE OFT (1:1)

function unwrap(uint256 amount) external;
  // Burn EAGLE OFT, release vault shares (1:1)
```

**Key Features:**
- ✅ 1:1 peg with vault shares
- ✅ No fees on wrapping/unwrapping
- ✅ Authorized minter of EAGLE OFT
- ✅ Minter can burn without allowance (important!)

**Security:**
- ⚠️ Must be audited thoroughly
- ⚠️ Only authorized contract should be minter
- ⚠️ Use multi-sig for ownership

---

### **Asset Adapters** (Hub Chain Only)

**Purpose:** Wrap existing ERC20 tokens for cross-chain transfer

| Contract | Wraps | Deploy Where |
|----------|-------|--------------|
| `WLFIAdapter` | Existing WLFI token | Ethereum |
| `USD1Adapter` | Existing USD1 token | Ethereum |

**Use when:** Token already exists and you don't want to migrate balances.

---

### **Asset OFTs** (All Chains)

**Purpose:** New tokens with native cross-chain support

| Contract | Purpose | Deploy Where |
|----------|---------|--------------|
| `WLFIAssetOFT` | New WLFI with LayerZero | All chains |
| `USD1AssetOFT` | New USD1 with LayerZero | All chains |

**Use when:** Creating new token from scratch with multi-chain support.

---

## 💰 Token Supply Management

### **Global Invariant**

```
INVARIANT:
  SUM(EAGLE.totalSupply() across ALL chains) 
  = EagleVaultWrapper.totalLocked
  = Wrapped vault shares

This ensures:
  ✅ No inflation (can't create EAGLE out of thin air)
  ✅ 1:1 backing (every EAGLE = 1 vault share)
  ✅ Redeemability (can always unwrap → redeem)
```

### **Example:**

```
Ethereum:  500 EAGLE + 500 locked vault shares
Arbitrum:  300 EAGLE
Base:      200 EAGLE
─────────────────────────────────────────────
Total:     1000 EAGLE = 1000 locked shares ✅
```

---

## 🔐 Security Considerations

### **✅ Safe Design Choices**

1. **EagleVaultWrapper is Only Minter on Hub**
   - Only wrapper can mint EAGLE on Ethereum
   - Wrapper enforces 1:1 lock/mint ratio
   - No arbitrary minting

2. **No Fees on EagleShareOFT**
   - Removed all fee-on-transfer logic
   - Prevents accounting mismatches
   - Maintains 1:1 peg

3. **Minter Burn Privilege**
   - Wrapper can burn without allowance
   - Critical for unwrap functionality
   - Better UX

4. **Immutable References**
   - Wrapper's token addresses are immutable
   - Cannot be changed after deployment
   - Prevents rug pulls

### **⚠️ Trust Assumptions**

1. **EagleVaultWrapper is Trusted**
   - Must be audited thoroughly
   - Bugs could break 1:1 peg
   - Use multi-sig ownership

2. **LayerZero Endpoint is Trusted**
   - Standard LayerZero trust model
   - Endpoint can mint/burn on spokes

3. **EagleOVault is Secure**
   - Vault security is critical
   - Vault shares back all EAGLE tokens

---

## 🧪 Testing

### **Run EagleShareOFT Tests**

```bash
forge test --match-contract EagleShareOFTTest -vv
```

**Results:** ✅ 36/36 tests passing (100% coverage)

### **Test Categories**

- ✅ Constructor validation
- ✅ Minter management
- ✅ Mint/burn functionality
- ✅ Transfers (no fees)
- ✅ Access control
- ✅ Integration flows

See `../../test/EagleShareOFT.t.sol` for full test suite.

---

## 📊 Gas Efficiency

| Function | Avg Gas | Max Gas |
|----------|---------|---------|
| **wrap()** | ~100,000 | ~110,000 |
| **unwrap()** | ~80,000 | ~90,000 |
| **mint()** | 64,265 | 72,571 |
| **burn()** | 35,001 | 39,342 |
| **transfer()** | 40,028 | 51,698 |
| **bridge()** | ~200,000 | ~250,000 |

**Total wrap + bridge:** ~300,000 gas (~$72 @ 100 gwei, $2,400 ETH)

---

## ⚠️ Important Notes

### **1. Minter Configuration**

**On Ethereum (Hub):**
```solidity
// ✅ CORRECT
eagleShareOFT.setMinter(address(eagleVaultWrapper), true);

// ❌ WRONG - LayerZero should NOT be minter on hub!
// (LayerZero is only minter on spokes, automatically)
```

**On Spokes (Arbitrum, Base, etc.):**
```solidity
// ✅ CORRECT - NO minters
// LayerZero endpoint handles all minting/burning automatically

// ❌ WRONG
eagleShareOFT.setMinter(someAddress, true); // Don't do this!
```

### **2. CREATE2 Deployment**

Use the **same salt** on all chains for same address:

```bash
# Generate deterministic salt
SALT="0x$(openssl rand -hex 32)"

# Deploy on all chains with SAME salt
forge create ... --create2 $SALT --rpc-url ethereum
forge create ... --create2 $SALT --rpc-url arbitrum
forge create ... --create2 $SALT --rpc-url base
```

### **3. Never Mint Shares Directly**

❌ **WRONG:**
```solidity
eagleShareOFT.mint(user, amount); // Direct mint breaks vault accounting
```

✅ **CORRECT:**
```solidity
// On Ethereum: Use wrapper
eagleVaultWrapper.wrap(amount); // Wrapper mints (1:1 with locked shares)

// On spokes: Use LayerZero
// (Automatic when bridging from hub)
```

### **4. Wrapper Must Be Set Before Use**

```bash
# 1. Deploy contracts
# 2. Set wrapper as minter (CRITICAL step!)
cast send $EAGLE_OFT "setMinter(address,bool)" $WRAPPER true

# 3. Test wrapping works
cast send $WRAPPER "wrap(uint256)" 1000000000000000000 --from $USER

# 4. Verify minted
cast call $EAGLE_OFT "balanceOf(address)" $USER
```

---

## 📚 References

- **Architecture Decision:** `../../ARCHITECTURE_DECISION.md`
- **EagleShareOFT Review:** `../../EAGLESHAREOFT_REVIEW.md`
- **EagleVaultWrapper Contract:** `../../contracts/EagleVaultWrapper.sol`
- **LayerZero OFT Docs:** https://docs.layerzero.network/
- **CREATE2 Deployment:** https://docs.openzeppelin.com/cli/2.8/deploying-with-create2

---

## 🔄 Migration from Old Architecture

If you previously used `EagleShareOFTAdapter`:

See `../deprecated/README.md` for migration guide.

**TL;DR:**
- Old: OFTAdapter on hub, OFT on spokes (different tokens)
- New: Same OFT everywhere, wrapper on hub (same token)

---

**Status:** ✅ Production-ready  
**Architecture:** EagleVaultWrapper Pattern  
**Last Updated:** October 27, 2025
