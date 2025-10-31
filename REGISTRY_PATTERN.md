# 📋 EagleRegistry Pattern - Dynamic Configuration

**How Eagle OVault uses EagleRegistry for LayerZero endpoints**

---

## 🎯 Overview

Instead of hardcoding LayerZero endpoints in contracts, Eagle OVault uses the **EagleRegistry pattern** for dynamic configuration management.

---

## 🏗️ Architecture

### Traditional Approach (Hardcoded)
```solidity
// ❌ Bad: Hardcoded endpoint
contract EagleShareOFT {
    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    
    constructor() OFT("Eagle Share", "EAGLE", LZ_ENDPOINT, msg.sender) {}
}
```

**Problems:**
- ❌ Can't update if LayerZero upgrades
- ❌ Need to redeploy contracts for changes
- ❌ Different endpoints per chain hardcoded
- ❌ No flexibility

### Eagle Approach (Registry)
```solidity
// ✅ Good: Dynamic lookup via registry
contract EagleShareOFT {
    IEagleRegistry public registry;
    
    constructor(address _registry) {
        registry = IEagleRegistry(_registry);
        address endpoint = registry.getLayerZeroEndpoint(block.chainid);
        // Initialize with dynamic endpoint
    }
}
```

**Benefits:**
- ✅ Update configuration without redeployment
- ✅ Centralized management
- ✅ Easy to upgrade LayerZero version
- ✅ Consistent across all contracts

---

## 📝 EagleRegistry Interface

```solidity
interface IEagleRegistry {
    // Get LayerZero endpoint for a chain
    function getLayerZeroEndpoint(uint256 chainId) external view returns (address);
    
    // Get OFT address for a chain
    function getOFTAddress(uint256 chainId) external view returns (address);
    
    // Get vault address (hub chain only)
    function getVaultAddress() external view returns (address);
    
    // Get wrapper address (hub chain only)
    function getWrapperAddress() external view returns (address);
    
    // Admin functions
    function setLayerZeroEndpoint(uint256 chainId, address endpoint) external;
    function setOFTAddress(uint256 chainId, address oft) external;
}
```

---

## 🚀 Deployment Process

### Step 1: Deploy Registry on Each Chain

**Deploy EagleRegistry FIRST on every chain:**

```bash
# Ethereum
forge script script/DeployRegistryCreate2.s.sol \
  --rpc-url $ETHEREUM_RPC_URL \
  --broadcast \
  --verify

# BSC
forge script script/DeployRegistryCreate2.s.sol \
  --rpc-url $BSC_RPC_URL \
  --broadcast \
  --verify

# Arbitrum, Base, Avalanche...
# (Same script, same CREATE2 salt = same address!)
```

**Result:** EagleRegistry at same address on all chains

### Step 2: Configure Registry

**Set LayerZero endpoints in registry:**

```bash
# Ethereum (chainId = 1)
cast send $REGISTRY_ADDRESS \
  "setLayerZeroEndpoint(uint256,address)" \
  1 0x1a44076050125825900e736c501f859c50fE728c \
  --private-key $PRIVATE_KEY \
  --rpc-url $ETHEREUM_RPC_URL

# BSC (chainId = 56)
cast send $REGISTRY_ADDRESS \
  "setLayerZeroEndpoint(uint256,address)" \
  56 0x1a44076050125825900e736c501f859c50fE728c \
  --private-key $PRIVATE_KEY \
  --rpc-url $BSC_RPC_URL

# Repeat for all chains...
```

### Step 3: Deploy Other Contracts

**Now deploy contracts that use the registry:**

```bash
# These contracts will query registry for LayerZero endpoint
forge script script/DeployVanityVault.s.sol \
  --rpc-url $ETHEREUM_RPC_URL \
  --broadcast \
  --verify
```

---

## 🔧 Configuration in .env

Your `.env` file has LayerZero endpoints for reference:

```bash
# LayerZero V2 Endpoints (for registry configuration)
LZ_ENDPOINT_ETHEREUM=0x1a44076050125825900e736c501f859c50fE728c
LZ_ENDPOINT_BSC=0x1a44076050125825900e736c501f859c50fE728c
LZ_ENDPOINT_ARBITRUM=0x1a44076050125825900e736c501f859c50fE728c
LZ_ENDPOINT_BASE=0x1a44076050125825900e736c501f859c50fE728c
LZ_ENDPOINT_AVALANCHE=0x1a44076050125825900e736c501f859c50fE728c
```

**These are used to:**
1. Configure the registry after deployment
2. Reference in deployment scripts
3. Verify correct endpoints are set

**NOT used for:**
- ❌ Hardcoding in contracts (registry handles this)

---

## 📊 Registry Deployment Flow

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: Deploy EagleRegistry (All Chains)              │
├─────────────────────────────────────────────────────────┤
│  Ethereum:  EagleRegistry → 0xABC...                    │
│  BSC:       EagleRegistry → 0xABC... (same!)            │
│  Arbitrum:  EagleRegistry → 0xABC... (same!)            │
│  Base:      EagleRegistry → 0xABC... (same!)            │
│  Avalanche: EagleRegistry → 0xABC... (same!)            │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Step 2: Configure Registry (Each Chain)                │
├─────────────────────────────────────────────────────────┤
│  registry.setLayerZeroEndpoint(1, 0x1a44...)  // ETH    │
│  registry.setLayerZeroEndpoint(56, 0x1a44...) // BSC    │
│  registry.setLayerZeroEndpoint(42161, 0x1a44...) // ARB │
│  etc...                                                  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Step 3: Deploy Contracts (Use Registry)                │
├─────────────────────────────────────────────────────────┤
│  EagleOVault → queries registry                         │
│  EagleVaultWrapper → queries registry                   │
│  EagleShareOFT → queries registry                       │
│  All get correct LayerZero endpoint dynamically!        │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Benefits of Registry Pattern

### 1. Future-Proof
```solidity
// LayerZero upgrades to V3?
// Just update registry, no contract redeployment!
registry.setLayerZeroEndpoint(1, NEW_V3_ENDPOINT);
```

### 2. Centralized Management
```solidity
// One place to manage all configuration
// Easy to audit, easy to update
```

### 3. Consistent Across Contracts
```solidity
// All contracts get same endpoint
// No risk of mismatched addresses
```

### 4. Testnet/Mainnet Flexibility
```solidity
// Same contracts work on testnet and mainnet
// Just configure registry differently
```

---

## 🔍 Verification

### Check Registry Configuration

```bash
# Get LayerZero endpoint for Ethereum (chainId 1)
cast call $REGISTRY_ADDRESS \
  "getLayerZeroEndpoint(uint256)(address)" \
  1 \
  --rpc-url $ETHEREUM_RPC_URL

# Should return: 0x1a44076050125825900e736c501f859c50fE728c
```

### Check All Chains

```bash
# Script to verify all chains
for chain in ethereum bsc arbitrum base avalanche; do
  echo "Checking $chain..."
  cast call $REGISTRY_ADDRESS \
    "getLayerZeroEndpoint(uint256)(address)" \
    $CHAIN_ID \
    --rpc-url $RPC_URL
done
```

---

## 🚨 Important Notes

### 1. Deploy Registry FIRST
Always deploy EagleRegistry before other contracts on each chain.

### 2. Same Address on All Chains
Use CREATE2 to ensure registry has same address everywhere.

### 3. Configure Before Use
Set LayerZero endpoints in registry before deploying other contracts.

### 4. Access Control
Only owner can update registry configuration:
```solidity
function setLayerZeroEndpoint(uint256 chainId, address endpoint) 
    external 
    onlyOwner 
{
    // ...
}
```

---

## 📚 Related Documentation

- **Architecture:** `ARCHITECTURE_OVERVIEW.md` - Full system architecture
- **Deployment:** `DEPLOYMENT_ORDER.md` - Deployment sequence
- **Registry Contract:** `contracts/EagleRegistry.sol` - Implementation

---

## 🎯 Quick Reference

**Registry Address (Same on All Chains):**
```
[TO BE FILLED AFTER DEPLOYMENT]
```

**LayerZero V2 Endpoints:**
```
Ethereum:  0x1a44076050125825900e736c501f859c50fE728c
BSC:       0x1a44076050125825900e736c501f859c50fE728c
Arbitrum:  0x1a44076050125825900e736c501f859c50fE728c
Base:      0x1a44076050125825900e736c501f859c50fE728c
Avalanche: 0x1a44076050125825900e736c501f859c50fE728c
```

**Deployment Order:**
1. Deploy EagleRegistry (all chains)
2. Configure registry (set endpoints)
3. Deploy other contracts (they query registry)

---

**This pattern makes Eagle OVault flexible, upgradeable, and easy to manage! 🎉**

