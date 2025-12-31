# 🎯 **CREATE2 DEPLOYMENT GUIDE**

## 🚀 **WHY CREATE2?**

The CreatorVaultFactory now uses **CREATE2 by default** for deterministic addresses across all chains!

### **Benefits:**

✅ **Same Address Everywhere**
- Deploy AKITA vault on Base: `0x1234...`
- Deploy AKITA vault on Optimism: `0x1234...` (SAME ADDRESS!)
- Perfect for LayerZero OFT cross-chain transfers

✅ **Predictable Addresses**
- Know your vault address BEFORE deploying
- Can fund/approve before deployment
- Better UX for pre-launch marketing

✅ **Canonical Addresses**
- One "official" vault per token across all chains
- Easy to verify legitimacy
- Simpler for integrations

---

## 🏗️ **HOW IT WORKS**

### **The Factory Uses CREATE2:**

```solidity
function deployCreatorVaultAuto(
    address _creatorCoin,
    address _creator
) external returns (
    address vault,
    address wrapper,
    address shareOFT,
    address gaugeController,
    address ccaStrategy
) {
    // Generate deterministic salt from token address + symbol
    bytes32 salt = generateSalt(_creatorCoin, symbol);
    
    // Deploy with CREATE2 (deterministic addresses)
    return deployCreatorVaultDeterministic(..., salt);
}
```

### **Salt Generation:**

```solidity
function generateSalt(
    address _creatorCoin, 
    string memory _symbol
) external pure returns (bytes32) {
    return keccak256(
        abi.encodePacked(
            "CREATORTECH_V1_",  // Version prefix
            _creatorCoin,        // Token address
            _symbol              // Token symbol
        )
    );
}
```

**Result:** Same token = same salt = same addresses across all chains!

---

## 📊 **DEPLOYED CONTRACTS**

### **Using CREATE2 (Deterministic):**
- ✅ `CreatorOVault` (Vault)
- ✅ `CreatorOVaultWrapper` (Wrapper)
- ✅ `CreatorShareOFT` (wsToken)

### **Using Regular CREATE (Non-Deterministic):**
- ⚠️ `CreatorGaugeController` (Fee distribution)
- ⚠️ `CCALaunchStrategy` (Auction)

**Why not CREATE2 for everything?**
- Gauge Controller and CCA Strategy are chain-specific
- They interact with chain-specific infrastructure (V4 pools, oracles)
- Having different addresses per chain is intentional

---

## 🌐 **CROSS-CHAIN DEPLOYMENT**

### **Example: Deploy AKITA Vault Everywhere**

```bash
# 1. Deploy on Base
forge script script/DeployCreatorVaultFactory.s.sol \
    --rpc-url base \
    --broadcast

# Factory creates vault at: 0xABC123... (deterministic)

# 2. Deploy on Optimism
forge script script/DeployCreatorVaultFactory.s.sol \
    --rpc-url optimism \
    --broadcast

# Factory creates vault at: 0xABC123... (SAME ADDRESS!)

# 3. Deploy on Arbitrum
forge script script/DeployCreatorVaultFactory.s.sol \
    --rpc-url arbitrum \
    --broadcast

# Factory creates vault at: 0xABC123... (SAME ADDRESS!)
```

**Result:** Users can send wsAKITA between chains knowing the vault is always at the same address!

---

## 🔮 **PREDICTING ADDRESSES**

You can predict addresses BEFORE deployment:

```solidity
// Call this before deploying
(
    address predictedVault,
    address predictedWrapper,
    address predictedOFT
) = factory.predictAddresses(
    AKITA_TOKEN,
    "AKITA Vault",
    "vAKITA",
    "Wrapped AKITA Share",
    "wsAKITA",
    CREATOR_ADDRESS,
    salt
);

// Use predicted addresses in your frontend NOW
// Then deploy later - addresses will match!
```

### **Frontend Example:**

```typescript
// Before deployment, show users their future addresses
async function predictVaultAddresses(tokenAddress: string, creator: string) {
  const symbol = await getTokenSymbol(tokenAddress);
  const salt = generateSalt(tokenAddress, symbol);
  
  const [vault, wrapper, shareOFT] = await factoryContract.read.predictAddresses([
    tokenAddress,
    `${symbol} Vault`,
    `v${symbol}`,
    `Wrapped ${symbol} Share`,
    `ws${symbol}`,
    creator,
    salt
  ]);
  
  return { vault, wrapper, shareOFT };
}

// Use in UI
function PreviewVault() {
  const [addresses, setAddresses] = useState(null);
  
  async function preview() {
    const predicted = await predictVaultAddresses(tokenAddress, creator);
    setAddresses(predicted);
  }
  
  return (
    <div>
      <button onClick={preview}>Preview Addresses</button>
      {addresses && (
        <div>
          <p>Your vault will be at: {addresses.vault}</p>
          <p>Your wrapper will be at: {addresses.wrapper}</p>
          <p>Your wsToken will be at: {addresses.shareOFT}</p>
        </div>
      )}
    </div>
  );
}
```

---

## 🎯 **DEPLOYMENT SCRIPT WITH CREATE2**

```solidity
// script/DeployVaultWithCREATE2.s.sol
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/factories/CreatorVaultFactory.sol";

contract DeployVaultWithCREATE2 is Script {
    function run() external {
        address factory = vm.envAddress("CREATOR_VAULT_FACTORY");
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        address creator = vm.envAddress("CREATOR_ADDRESS");
        
        vm.startBroadcast();
        
        // Deploy with CREATE2 (automatic via deployCreatorVaultAuto)
        (
            address vault,
            address wrapper,
            address shareOFT,
            address gaugeController,
            address ccaStrategy
        ) = CreatorVaultFactory(factory).deployCreatorVaultAuto(
            tokenAddress,
            creator
        );
        
        vm.stopBroadcast();
        
        console.log("Deployed with CREATE2:");
        console.log("  Vault:", vault);
        console.log("  Wrapper:", wrapper);
        console.log("  ShareOFT:", shareOFT);
        console.log("  Gauge:", gaugeController);
        console.log("  CCA:", ccaStrategy);
    }
}
```

---

## 🔍 **VERIFYING DETERMINISM**

Check that addresses match across chains:

```bash
# Get vault info on Base
cast call $FACTORY "getDeployment(address)" $TOKEN --rpc-url base

# Get vault info on Optimism  
cast call $FACTORY "getDeployment(address)" $TOKEN --rpc-url optimism

# Compare vault addresses - they should match!
```

---

## 💡 **USE CASES**

### **1. Cross-Chain Governance**
```solidity
// Same vault address on all chains
// Governance proposals can reference one address
proposal: "Transfer ownership of vault at 0xABC123..."
// Works on Base, Optimism, Arbitrum, etc.
```

### **2. Pre-Launch Marketing**
```typescript
// Show users their vault address BEFORE deploying
"Your AKITA vault will be at: 0xABC123... on ALL chains!"
// Deploy later - address is guaranteed
```

### **3. Canonical Registry**
```typescript
// One official address per token
const AKITA_VAULT = "0xABC123...";  // Same everywhere
// Easy to verify, hard to fake
```

### **4. LayerZero OFT Integration**
```solidity
// ShareOFT can trust same vault address across chains
// Simplified peer verification
mapping(uint16 => address) public trustedRemote;
// trustedRemote[BASE_CHAIN_ID] = 0xABC123...
// trustedRemote[OPTIMISM_CHAIN_ID] = 0xABC123... (SAME!)
```

---

## ⚠️ **IMPORTANT NOTES**

### **Salt Uniqueness:**
- Each token gets ONE vault per factory
- If you try to deploy AKITA twice: REVERTS
- This is intentional - one canonical vault per token

### **Factory Address:**
- Factory MUST be at same address on all chains
- Use CREATE2 for factory deployment too!
- Or use a standard CREATE2 factory like Arachnid's

### **Dependencies:**
- LayerZero endpoint must exist on all chains
- Gauge/CCA can be different per chain (intentional)

---

## 📋 **SUMMARY**

| Feature | Before (CREATE) | After (CREATE2) |
|---------|----------------|-----------------|
| Address | Different per chain | Same on all chains ✅ |
| Predictable | No | Yes ✅ |
| Cross-chain | Complex | Simple ✅ |
| Gas cost | Same | Same |
| Security | Same | Same |

**CREATE2 = Better UX, Same Cost, More Secure!** 🚀

---

## 🎉 **YOU'RE ALL SET!**

The factory now uses CREATE2 by default. Just call:

```solidity
factory.deployCreatorVaultAuto(tokenAddress, creator);
```

And get deterministic addresses across ALL chains! 🌍

