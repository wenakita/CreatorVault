# 🦅 Eagle OVault Deployment Plan - With Registry First

**CRITICAL: Registry MUST be deployed FIRST with vanity address**

---

## 🎯 Deployment Order

### ✅ Phase 0: Generate Vanity Salt for Registry

**Goal:** Find a CREATE2 salt that gives Registry address starting with `0x47` and ending with `ea91e`

```bash
# 1. Generate EagleRegistry bytecode hash
forge build

# 2. Generate vanity salt for Registry
# You'll need to create a script similar to generate-vanity-address.sh but for Registry
# Or manually calculate the salt
```

**Expected Registry Address:** `0x47...ea91e` (vanity pattern)

---

### ✅ Phase 1: Deploy EagleRegistry (FIRST!)

**Why first:** All other contracts query the registry for LayerZero endpoints

```bash
# Deploy Registry with vanity address
forge script script/DeployRegistryVanity.s.sol:DeployRegistryVanity \
  --rpc-url ethereum \
  --broadcast \
  --verify
```

**Verify:**
```bash
# Check registry deployed
export REGISTRY_ADDRESS=<deployed-address>
cast code $REGISTRY_ADDRESS --rpc-url $ETHEREUM_RPC_URL

# Check it has LayerZero endpoint configured
cast call $REGISTRY_ADDRESS "getLayerZeroEndpoint(uint256)(address)" 1 --rpc-url $ETHEREUM_RPC_URL
```

**Save the address:**
```bash
# Add to .env
echo "REGISTRY_ADDRESS=$REGISTRY_ADDRESS" >> .env
```

---

### ✅ Phase 2: Deploy Other Contracts (With Vanity Addresses)

**Now that Registry exists, deploy the rest:**

```bash
# Deploy Vault, Strategy, Wrapper, OFT (all with vanity addresses)
forge script script/DeployProductionVanity.s.sol:DeployProductionVanity \
  --rpc-url ethereum \
  --broadcast \
  --verify
```

**This deploys:**
1. **EagleOVault**: `0x47E0E593AF3534f93F9816b5243e6554425Ea91e`
2. **CharmStrategyUSD1**: `0x47120C365eda3d5aC9dDdF19749aA64ceEeeA91E`
3. **EagleVaultWrapper**: `0x47048CA688fafA01DFefC84fD10bD493834eA91e`
4. **EagleShareOFT**: `0x47841bb8d73936Ae091CA8f20fdc3a7645DeA91E`

---

### ✅ Phase 3: Configure Contracts

```bash
# Set vault strategy
cast send $VAULT_ADDRESS "setStrategy(address)" $STRATEGY_ADDRESS \
  --private-key $PRIVATE_KEY \
  --rpc-url $ETHEREUM_RPC_URL

# Set wrapper OFT
cast send $WRAPPER_ADDRESS "setOFT(address)" $OFT_ADDRESS \
  --private-key $PRIVATE_KEY \
  --rpc-url $ETHEREUM_RPC_URL

# Transfer ownership to multisig
MULTISIG=0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3

cast send $REGISTRY_ADDRESS "transferOwnership(address)" $MULTISIG \
  --private-key $PRIVATE_KEY \
  --rpc-url $ETHEREUM_RPC_URL

cast send $VAULT_ADDRESS "transferOwnership(address)" $MULTISIG \
  --private-key $PRIVATE_KEY \
  --rpc-url $ETHEREUM_RPC_URL

# ... transfer ownership for all contracts
```

---

## 🔧 Current Issue: Need Registry Vanity Salt

**Problem:** We need to generate a vanity salt for the Registry to match the pattern `0x47...ea91e`

**Solution Options:**

### Option 1: Generate Vanity Salt (Recommended)

Create a script to find the correct salt:

```typescript
// scripts/generate-registry-vanity-salt.ts
import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  // Get Registry bytecode
  const RegistryFactory = await ethers.getContractFactory('EagleRegistry');
  const deployTx = RegistryFactory.getDeployTransaction(deployer.address);
  const initCode = deployTx.data;
  const initCodeHash = ethers.keccak256(initCode);
  
  console.log('Init Code Hash:', initCodeHash);
  console.log('');
  console.log('Searching for vanity salt...');
  console.log('Pattern: 0x47...ea91e');
  console.log('');
  
  let found = false;
  let attempts = 0;
  const startTime = Date.now();
  
  // Try different salts
  for (let i = 0; i < 100000000 && !found; i++) {
    const salt = ethers.zeroPadValue(ethers.toBeHex(i), 32);
    
    const address = ethers.getCreate2Address(
      deployer.address,
      salt,
      initCodeHash
    );
    
    attempts++;
    
    // Check if matches pattern
    if (address.toLowerCase().startsWith('0x47') && 
        address.toLowerCase().endsWith('ea91e')) {
      found = true;
      const elapsed = (Date.now() - startTime) / 1000;
      
      console.log('✅ FOUND!');
      console.log('');
      console.log('Salt:', salt);
      console.log('Address:', address);
      console.log('Attempts:', attempts.toLocaleString());
      console.log('Time:', elapsed.toFixed(2), 'seconds');
      console.log('');
      console.log('Update DeployRegistryVanity.s.sol with:');
      console.log(`bytes32 constant REGISTRY_SALT = ${salt};`);
      console.log(`address constant EXPECTED_REGISTRY = ${address};`);
    }
    
    if (attempts % 100000 === 0) {
      console.log(`Tried ${attempts.toLocaleString()} combinations...`);
    }
  }
  
  if (!found) {
    console.log('❌ Not found in', attempts.toLocaleString(), 'attempts');
    console.log('Try running again or increase the loop limit');
  }
}

main().catch(console.error);
```

**Run it:**
```bash
npx ts-node scripts/generate-registry-vanity-salt.ts
```

---

### Option 2: Deploy Registry Without Vanity (Quick Start)

If you want to deploy NOW without waiting for vanity salt generation:

```bash
# Deploy registry with simple CREATE2 (not vanity)
forge script script/DeployRegistryCreate2.s.sol:DeployRegistryCreate2 \
  --rpc-url ethereum \
  --broadcast \
  --verify
```

**Then deploy other contracts:**
```bash
forge script script/DeployProductionVanity.s.sol:DeployProductionVanity \
  --rpc-url ethereum \
  --broadcast \
  --verify
```

**Result:**
- ✅ Registry: Different address (still deterministic, just not vanity)
- ✅ Vault, Strategy, Wrapper, OFT: All have vanity addresses `0x47...ea91e`

---

## 📊 Summary

### All Vanity Addresses (Ideal)
```
Registry:   0x47...ea91e  ← Need to generate salt
Vault:      0x47E0E593AF3534f93F9816b5243e6554425Ea91e  ✅
Strategy:   0x47120C365eda3d5aC9dDdF19749aA64ceEeeA91E  ✅
Wrapper:    0x47048CA688fafA01DFefC84fD10bD493834eA91e  ✅
OFT:        0x47841bb8d73936Ae091CA8f20fdc3a7645DeA91E  ✅
```

### Mixed (Quick Start)
```
Registry:   0x... (deterministic, not vanity)
Vault:      0x47E0E593AF3534f93F9816b5243e6554425Ea91e  ✅
Strategy:   0x47120C365eda3d5aC9dDdF19749aA64ceEeeA91E  ✅
Wrapper:    0x47048CA688fafA01DFefC84fD10bD493834eA91e  ✅
OFT:        0x47841bb8d73936Ae091CA8f20fdc3a7645DeA91E  ✅
```

---

## 🚀 Recommended Action

**Choose one:**

### A) Full Vanity (Takes Time)
1. Generate registry vanity salt (~10-60 minutes)
2. Update `DeployRegistryVanity.s.sol`
3. Deploy registry
4. Deploy other contracts

### B) Quick Start (Deploy Now)
1. Deploy registry with `DeployRegistryCreate2.s.sol`
2. Deploy other contracts with `DeployProductionVanity.s.sol`
3. All contracts except registry have vanity addresses

---

## 💡 My Recommendation

**Go with Option B (Quick Start)** because:
- ✅ You can deploy NOW
- ✅ 4 out of 5 contracts have vanity addresses
- ✅ Registry address is still deterministic (same on all chains if needed later)
- ✅ Functionality is identical

**The registry address doesn't need to be vanity for the system to work perfectly!**

---

## 🎯 Next Steps

**Ready to deploy?**

```bash
# Step 1: Deploy Registry (without vanity)
forge script script/DeployRegistryCreate2.s.sol:DeployRegistryCreate2 \
  --rpc-url ethereum \
  --broadcast

# Step 2: Save registry address
export REGISTRY_ADDRESS=<deployed-address>
echo "REGISTRY_ADDRESS=$REGISTRY_ADDRESS" >> .env

# Step 3: Deploy other contracts (with vanity)
forge script script/DeployProductionVanity.s.sol:DeployProductionVanity \
  --rpc-url ethereum \
  --broadcast
```

**Let me know which option you prefer!** 🚀

