# 🎯 CREATE2 Deployment Guide - Same Address on All Chains

**CRITICAL: EagleShareOFT MUST have the same address on all chains**

---

## 🔑 Why Same Address Matters

Having the same EagleShareOFT address on all chains provides:
- ✅ **Consistent UX** - Users see same address everywhere
- ✅ **Trust** - Easy to verify it's the same token
- ✅ **Simplified integration** - Same address for all chain configs
- ✅ **Professional appearance** - Shows technical sophistication

---

## 🛠️ How CREATE2 Works

CREATE2 allows deterministic contract addresses based on:
1. **Deployer address** (must be same on all chains)
2. **Salt** (must be same on all chains)
3. **Contract bytecode** (must be identical)

**Formula:**
```
address = keccak256(0xff + deployer + salt + keccak256(bytecode))[12:]
```

**Result:** Deploy with same deployer + salt + bytecode = **same address on all chains!**

---

## 📋 Requirements for Same Address

### 1. Same Deployer Address
Use a **CREATE2 factory** or **EOA with same nonce** on all chains.

**Recommended: Use CREATE2 Factory**
- Deterministic Factory: `0x4e59b44847b379578588920cA78FbF26c0B4956C`
- Available on: Ethereum, BSC, Arbitrum, Base, Avalanche, and 100+ chains
- No need to manage nonces

### 2. Same Salt
```solidity
bytes32 salt = keccak256("EagleShareOFT-v1");
// Or use a specific salt from vanity generation
bytes32 salt = 0x...;  // Your chosen salt
```

### 3. Identical Bytecode
- Same Solidity version: `0.8.22`
- Same compiler settings
- Same constructor arguments (if any)
- Same optimization settings

---

## 🚀 Deployment Steps

### Step 1: Calculate Target Address

**Before deploying anywhere, calculate the address:**

```bash
# Run address calculator
npx hardhat run scripts/calculate-create2-address.ts

# Or use forge
forge script script/DebugCreate2.s.sol --sig "run()"
```

**Expected output:**
```
Salt: 0x...
Bytecode hash: 0x...
Predicted address: 0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61
```

**Save this address!** This will be the EagleShareOFT address on ALL chains.

---

### Step 2: Deploy to Ethereum (Hub) First

```bash
# Deploy using CREATE2
forge script script/DeployVanityVault.s.sol:DeployVanityVault \
  --rpc-url $ETHEREUM_RPC_URL \
  --broadcast \
  --verify \
  --slow
```

**Verify the address matches prediction:**
```bash
# Check deployed address
echo "Deployed EagleShareOFT: 0x..."
echo "Expected address: 0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61"

# They MUST match!
```

---

### Step 3: Deploy to Spoke Chains (Same Address)

**Deploy to each spoke chain using SAME salt:**

#### BSC Deployment
```bash
forge script script/multi-chain/DeployBSC.s.sol \
  --rpc-url $BSC_RPC_URL \
  --broadcast \
  --verify

# Verify address
cast call 0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61 "name()" --rpc-url $BSC_RPC_URL
# Should return: "Eagle Share"
```

#### Arbitrum Deployment
```bash
forge script script/DeployArbitrum.s.sol \
  --rpc-url $ARBITRUM_RPC_URL \
  --broadcast \
  --verify

# Verify address
cast call 0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61 "name()" --rpc-url $ARBITRUM_RPC_URL
```

#### Base Deployment
```bash
forge script script/multi-chain/DeployBase.s.sol \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify

# Verify address
cast call 0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61 "name()" --rpc-url $BASE_RPC_URL
```

#### Avalanche Deployment
```bash
forge script script/multi-chain/DeployAvalanche.s.sol \
  --rpc-url $AVALANCHE_RPC_URL \
  --broadcast \
  --verify

# Verify address
cast call 0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61 "name()" --rpc-url $AVALANCHE_RPC_URL
```

---

### Step 4: Verify Same Address on All Chains

**Run verification script:**

```bash
# Check all chains have same address
npx hardhat run scripts/verify-same-address.ts
```

**Expected output:**
```
✅ Ethereum:  0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61
✅ BSC:       0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61
✅ Arbitrum:  0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61
✅ Base:      0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61
✅ Avalanche: 0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61

🎉 All chains have the same EagleShareOFT address!
```

---

## 🔧 Technical Implementation

### Using CREATE2 Factory

**Recommended approach:**

```solidity
// In deployment script
address constant CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
bytes32 constant SALT = keccak256("EagleShareOFT-v1");

// Calculate address (same on all chains)
address predictedAddress = address(uint160(uint256(keccak256(abi.encodePacked(
    bytes1(0xff),
    CREATE2_FACTORY,
    SALT,
    keccak256(type(EagleShareOFT).creationCode)
)))));

// Deploy via factory
bytes memory bytecode = type(EagleShareOFT).creationCode;
address deployed = CREATE2Factory(CREATE2_FACTORY).deploy(bytecode, SALT);

require(deployed == predictedAddress, "Address mismatch!");
```

### Current Implementation

**Your project already uses CREATE2:**

See `script/DeployVanityVault.s.sol` and related scripts.

---

## ⚠️ Common Pitfalls

### ❌ Different Constructor Arguments
```solidity
// DON'T do this:
new EagleShareOFT("Eagle Share", "EAGLE", msg.sender);  // Different on each chain

// DO this:
new EagleShareOFT("Eagle Share", "EAGLE", FIXED_DELEGATE);  // Same on all chains
```

### ❌ Different Compiler Settings
```toml
# Ensure same settings in foundry.toml for all deployments
solc_version = "0.8.22"
optimizer = true
optimizer_runs = 200
via_ir = true
evm_version = "paris"
```

### ❌ Different Deployer Nonces
If using EOA instead of factory:
- Nonce must be same on all chains
- Very hard to coordinate
- **Use CREATE2 factory instead!**

---

## 📊 Verification Checklist

Before announcing deployment:

- [ ] Calculated predicted address before any deployment
- [ ] Deployed to Ethereum first
- [ ] Verified Ethereum address matches prediction
- [ ] Deployed to BSC with same salt
- [ ] Verified BSC address matches Ethereum
- [ ] Deployed to Arbitrum with same salt
- [ ] Verified Arbitrum address matches Ethereum
- [ ] Deployed to Base with same salt
- [ ] Verified Base address matches Ethereum
- [ ] Deployed to Avalanche with same salt
- [ ] Verified Avalanche address matches Ethereum
- [ ] All 5 chains have identical address
- [ ] Verified on all block explorers
- [ ] Updated documentation with address

---

## 🎯 Expected Result

**After successful deployment:**

### EagleShareOFT Address (All Chains)
```
0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61
```

**Verify on block explorers:**
- Ethereum: https://etherscan.io/address/0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61
- BSC: https://bscscan.com/address/0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61
- Arbitrum: https://arbiscan.io/address/0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61
- Base: https://basescan.org/address/0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61
- Avalanche: https://snowtrace.io/address/0x64831bbc309f74eeFD447d00EFDcf92cA3EB2e61

**All should show:**
- Name: `Eagle Share`
- Symbol: `EAGLE`
- Decimals: `18`

---

## 🛠️ Troubleshooting

### Address Doesn't Match on Second Chain

**Possible causes:**
1. Different salt used
2. Different bytecode (compiler settings)
3. Different constructor arguments
4. Different deployer address

**Solution:**
```bash
# 1. Check salt in deployment script
grep -r "SALT" script/

# 2. Verify compiler settings match
cat foundry.toml

# 3. Check constructor args are same
# 4. Use CREATE2 factory, not EOA
```

### Can't Deploy to Same Address (Already Taken)

**This means:**
- Address already has code on that chain
- Either you already deployed, or someone else used that address

**Solution:**
```bash
# Check if it's your deployment
cast call $ADDRESS "name()" --rpc-url $RPC_URL

# If it returns "Eagle Share", you already deployed!
# If it returns something else, choose a different salt
```

---

## 📝 Deployment Script Template

**For each chain:**

```solidity
// DeploySpokeChain.s.sol
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/layerzero/oft/EagleShareOFT.sol";

contract DeploySpokeChain is Script {
    // CRITICAL: Same on all chains
    bytes32 constant SALT = keccak256("EagleShareOFT-v1");
    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant DELEGATE = 0xYourDelegateAddress;  // Same on all chains
    
    function run() external {
        vm.startBroadcast();
        
        // Deploy with CREATE2
        EagleShareOFT oft = new EagleShareOFT{salt: SALT}(
            "Eagle Share",
            "EAGLE",
            LZ_ENDPOINT,
            DELEGATE
        );
        
        console.log("EagleShareOFT deployed to:", address(oft));
        
        // Verify it's the expected address
        address expected = computeCreate2Address(
            SALT,
            keccak256(type(EagleShareOFT).creationCode)
        );
        require(address(oft) == expected, "Address mismatch!");
        
        vm.stopBroadcast();
    }
}
```

---

## 🎉 Success Criteria

Your deployment is successful when:

✅ All 5 chains have EagleShareOFT at **same address**  
✅ All contracts verified on block explorers  
✅ All show same name, symbol, decimals  
✅ LayerZero peers configured correctly  
✅ Cross-chain transfers work  

---

## 📚 Additional Resources

- **Vanity Address Generation:** `scripts/vanity-generator-runner.ts`
- **Address Calculator:** `scripts/calculate-create2-address.ts`
- **CREATE2 Debug:** `script/DebugCreate2.s.sol`
- **Main Deployment:** `script/DeployVanityVault.s.sol`

---

**REMEMBER: Same deployer + same salt + same bytecode = same address! 🎯**

*This is critical for a professional, trustworthy cross-chain token.*

