# 🧪 Sepolia Testnet Deployment Guide

Complete guide for deploying Eagle Vault contracts on Sepolia testnet.

---

## 📋 Prerequisites

### 1. Sepolia ETH
Get testnet ETH from faucets:
- https://sepoliafaucet.com
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://sepolia-faucet.pk910.de

**Recommended:** At least 0.2 ETH for full deployment

### 2. Environment Setup
Make sure `.env` has your private key:
```bash
PRIVATE_KEY=your_private_key_here
```

### 3. RPC Configuration
The Sepolia RPC is already configured in `hardhat.config.ts`:
```typescript
sepolia: {
  url: process.env.RPC_URL_SEPOLIA || 'https://sepolia-rpc.publicnode.com',
  accounts,
  chainId: 11155111,
}
```

---

## 🚀 Deployment Options

### Option 1: Full Deployment (Recommended)

Deploy both Registry and OFT in one command:

```bash
npx hardhat run scripts/deploy-full-sepolia.ts --network sepolia
```

**This will:**
1. ✅ Deploy `EagleRegistry`
2. ✅ Configure Sepolia chain
3. ✅ Set LayerZero V2 endpoint
4. ✅ Deploy `EagleShareOFT`
5. ✅ Connect OFT to Registry
6. ✅ Save deployment info to `deployments/sepolia-deployment.json`

---

### Option 2: Step-by-Step Deployment

#### Step 1: Deploy Registry
```bash
npx hardhat run scripts/deploy-registry-sepolia.ts --network sepolia
```

**Copy the registry address, then:**

```bash
export SEPOLIA_REGISTRY_ADDRESS=0x...
```

#### Step 2: Deploy OFT
```bash
npx hardhat run scripts/deploy-oft-sepolia.ts --network sepolia
```

---

## 📊 What Gets Deployed

### EagleRegistry
- **Purpose:** Stores chain configurations and LayerZero endpoints
- **Features:**
  - Chain registration (Sepolia configured)
  - LayerZero V2 endpoint management
  - EID (Endpoint ID) mapping
  - Multi-chain support

### EagleShareOFT
- **Purpose:** Cross-chain Eagle Vault share token
- **Features:**
  - Omnichain Fungible Token (OFT) standard
  - LayerZero V2 integration
  - Optional swap fees (disabled for testnet)
  - Mint/burn capabilities (restricted to vault bridge)
  - Registry integration

---

## 🔧 Sepolia Configuration

### Network Details
```json
{
  "chainId": 11155111,
  "name": "Sepolia",
  "layerZeroEndpoint": "0x6EDCE65403992e310A62460808c4b910D972f10f",
  "layerZeroEid": 40161,
  "weth": "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
}
```

### LayerZero V2
- **Endpoint:** `0x6EDCE65403992e310A62460808c4b910D972f10f`
- **EID:** `40161`
- **Version:** V2 (latest)

---

## ✅ Verification

### Verify Registry on Etherscan
```bash
npx hardhat verify --network sepolia <REGISTRY_ADDRESS> "<DEPLOYER_ADDRESS>"
```

### Verify OFT on Etherscan
```bash
npx hardhat verify --network sepolia <OFT_ADDRESS> \
  "Eagle Vault Shares" \
  "EAGLE" \
  "0x0000000000000000000000000000000000000000" \
  "<REGISTRY_ADDRESS>" \
  "<DEPLOYER_ADDRESS>" \
  '{"buyFee":0,"sellFee":0,"treasuryShare":5000,"vaultShare":5000,"treasury":"<DEPLOYER_ADDRESS>","vaultBeneficiary":"<DEPLOYER_ADDRESS>","feesEnabled":false}'
```

---

## 🧪 Testing

### 1. Check Registry
```typescript
const registry = await ethers.getContractAt(
  "EagleRegistry",
  "<REGISTRY_ADDRESS>"
);

const chainId = await registry.getCurrentChainId();
const endpoint = await registry.getLayerZeroEndpoint(11155111);
const eid = await registry.getEidForChainId(11155111);

console.log("Chain ID:", chainId);
console.log("Endpoint:", endpoint);
console.log("EID:", eid);
```

### 2. Check OFT
```typescript
const oft = await ethers.getContractAt(
  "EagleShareOFT",
  "<OFT_ADDRESS>"
);

const name = await oft.name();
const symbol = await oft.symbol();
const owner = await oft.owner();

console.log("Name:", name);
console.log("Symbol:", symbol);
console.log("Owner:", owner);
```

### 3. Test Minting (Requires Vault Bridge Setup)
```typescript
// First, set yourself as vault bridge for testing
await oft.setVaultBridge(deployer.address);

// Then mint test tokens
await oft.mint(deployer.address, ethers.parseEther("1000"));

// Check balance
const balance = await oft.balanceOf(deployer.address);
console.log("Balance:", ethers.formatEther(balance));
```

---

## 🔗 Connecting to Other Chains

### Set Up LayerZero Peers

To bridge tokens between Sepolia and other testnets (e.g., BSC Testnet):

```typescript
// On Sepolia OFT
await oft.setPeer(
  DESTINATION_EID,  // e.g., 40102 for BSC Testnet
  ethers.zeroPadValue(DESTINATION_OFT_ADDRESS, 32)
);

// On destination chain OFT
await oft.setPeer(
  40161,  // Sepolia EID
  ethers.zeroPadValue(SEPOLIA_OFT_ADDRESS, 32)
);
```

### Bridge Tokens
```typescript
const sendParam = {
  dstEid: DESTINATION_EID,
  to: ethers.zeroPadValue(recipientAddress, 32),
  amountLD: ethers.parseEther("100"),
  minAmountLD: ethers.parseEther("95"),
  extraOptions: "0x",
  composeMsg: "0x",
  oftCmd: "0x"
};

const [fee] = await oft.quoteSend(sendParam, false);
await oft.send(sendParam, fee, deployer.address, { value: fee.nativeFee });
```

---

## 📝 Deployment Info

After deployment, find details in:
```
deployments/sepolia-deployment.json
```

Contains:
- Contract addresses
- Configuration
- Timestamp
- Deployer address

---

## 🐛 Troubleshooting

### "Insufficient funds"
Get more Sepolia ETH from faucets listed above.

### "Registry not found"
Make sure you deployed the registry first and set `SEPOLIA_REGISTRY_ADDRESS`.

### "Invalid endpoint"
LayerZero V2 endpoint should be: `0x6EDCE65403992e310A62460808c4b910D972f10f`

### "Transaction reverted"
Check gas settings. Sepolia can be slow during peak times.

---

## 🔐 Security Notes

### For Testnet:
- ✅ Fees disabled
- ✅ Simple configuration
- ✅ Owner has full control

### For Mainnet:
- ⚠️ Enable fees if needed
- ⚠️ Set proper fee recipients
- ⚠️ Configure vault bridge carefully
- ⚠️ Test thoroughly on testnet first

---

## 📚 Related Documentation

- [LayerZero V2 Docs](https://docs.layerzero.network/)
- [OFT Standard](https://docs.layerzero.network/v2/developers/evm/oft/quickstart)
- [Sepolia Faucets](https://sepoliafaucet.com)
- [Hardhat Network Config](../hardhat.config.ts)

---

## ✅ Checklist

Before deploying:
- [ ] Have 0.2+ Sepolia ETH
- [ ] `.env` configured with `PRIVATE_KEY`
- [ ] Hardhat network configured
- [ ] RPC endpoint accessible

After deploying:
- [ ] Registry deployed and configured
- [ ] OFT deployed and connected to registry
- [ ] Contracts verified on Etherscan
- [ ] Deployment info saved
- [ ] Addresses documented

---

**Ready to deploy?** Run:
```bash
npx hardhat run scripts/deploy-full-sepolia.ts --network sepolia
```

Good luck! 🚀

