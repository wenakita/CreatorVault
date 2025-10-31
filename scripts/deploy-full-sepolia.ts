import { ethers } from "hardhat";

/**
 * Complete Sepolia Deployment
 * 
 * Deploys both EagleRegistry and EagleShareOFT on Sepolia
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=" .repeat(60));
  console.log("🚀 EAGLE SEPOLIA DEPLOYMENT");
  console.log("=".repeat(60));
  console.log("\n📍 Deploying to: Sepolia Testnet");
  console.log("👤 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.1")) {
    console.warn("\n⚠️  WARNING: Low balance! You may need more Sepolia ETH");
    console.log("Get Sepolia ETH from: https://sepoliafaucet.com");
  }
  
  // Sepolia configuration
  const SEPOLIA_CHAIN_ID = 11155111;
  const SEPOLIA_CHAIN_ID_UINT16 = 13991; // 11155111 % 65536 (uint16 truncation)
  const SEPOLIA_LZ_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f";
  const SEPOLIA_LZ_EID = 40161;
  const WETH_SEPOLIA = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  
  // ========================================
  // STEP 1: Deploy EagleRegistry
  // ========================================
  
  console.log("\n" + "=".repeat(60));
  console.log("STEP 1: Deploying EagleRegistry");
  console.log("=".repeat(60));
  
  const EagleRegistry = await ethers.getContractFactory("EagleRegistry");
  console.log("\n📝 Deploying contract...");
  const registry = await EagleRegistry.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  
  console.log("✅ EagleRegistry deployed:", registryAddress);
  
  // Configure registry
  console.log("\n📝 Configuring registry...");
  
  console.log("  → Registering Sepolia chain...");
  await (await registry.registerChain(
    SEPOLIA_CHAIN_ID_UINT16,
    "Sepolia",
    WETH_SEPOLIA,
    "WETH",
    true
  )).wait();
  
  console.log("  → Setting LayerZero endpoint...");
  await (await registry.setLayerZeroEndpoint(
    SEPOLIA_CHAIN_ID_UINT16,
    SEPOLIA_LZ_ENDPOINT
  )).wait();
  
  console.log("  → Setting EID mapping...");
  await (await registry.setChainIdToEid(
    SEPOLIA_CHAIN_ID,
    SEPOLIA_LZ_EID
  )).wait();
  
  console.log("✅ Registry configured");
  
  // Verify
  const endpoint = await registry.getLayerZeroEndpoint(SEPOLIA_CHAIN_ID_UINT16);
  const eid = await registry.getEidForChainId(SEPOLIA_CHAIN_ID);
  console.log("\n🔍 Verification:");
  console.log("  Endpoint:", endpoint);
  console.log("  EID:", eid.toString());
  console.log("  Using uint16 chain ID:", SEPOLIA_CHAIN_ID_UINT16, "for registry (actual:", SEPOLIA_CHAIN_ID, ")");
  
  // ========================================
  // STEP 2: Deploy EagleShareOFT
  // ========================================
  
  console.log("\n" + "=".repeat(60));
  console.log("STEP 2: Deploying EagleShareOFT");
  console.log("=".repeat(60));
  
  // Fee configuration (zero fees for testnet)
  const feeConfig = {
    buyFee: 0,
    sellFee: 0,
    treasuryShare: 5000,
    vaultShare: 5000,
    treasury: deployer.address,
    vaultBeneficiary: deployer.address,
    feesEnabled: false
  };
  
  console.log("\n📝 Deploying EagleShareOFT...");
  const EagleShareOFT = await ethers.getContractFactory("EagleShareOFT");
  
  const oft = await EagleShareOFT.deploy(
    "Eagle Vault Shares",           // name
    "EAGLE",                         // symbol
    SEPOLIA_LZ_ENDPOINT,             // _lzEndpoint
    deployer.address                 // _delegate (owner)
  );
  
  await oft.waitForDeployment();
  const oftAddress = await oft.getAddress();
  
  console.log("✅ EagleShareOFT deployed:", oftAddress);
  
  // Verify
  const name = await oft.name();
  const symbol = await oft.symbol();
  const owner = await oft.owner();
  const oftEndpoint = await oft.endpoint();
  
  console.log("\n🔍 Verification:");
  console.log("  Name:", name);
  console.log("  Symbol:", symbol);
  console.log("  Owner:", owner);
  console.log("  Endpoint:", oftEndpoint);
  
  // ========================================
  // DEPLOYMENT SUMMARY
  // ========================================
  
  const deploymentInfo = {
    network: "sepolia",
    chainId: SEPOLIA_CHAIN_ID,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      registry: registryAddress,
      oft: oftAddress
    },
    configuration: {
      layerZeroEndpoint: SEPOLIA_LZ_ENDPOINT,
      layerZeroEid: SEPOLIA_LZ_EID,
      weth: WETH_SEPOLIA,
      feesEnabled: false
    }
  };
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  
  console.log("\n📊 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n🔗 Etherscan Links:");
  console.log("Registry:", `https://sepolia.etherscan.io/address/${registryAddress}`);
  console.log("OFT:", `https://sepolia.etherscan.io/address/${oftAddress}`);
  
  console.log("\n📝 Save these addresses:");
  console.log(`export SEPOLIA_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`export SEPOLIA_OFT_ADDRESS=${oftAddress}`);
  
  console.log("\n📝 Next Steps:");
  console.log("1. ✅ Verify contracts on Etherscan:");
  console.log(`   npx hardhat verify --network sepolia ${registryAddress} "${deployer.address}"`);
  console.log(`   npx hardhat verify --network sepolia ${oftAddress} "Eagle Vault Shares" "EAGLE" "${ethers.ZeroAddress}" "${registryAddress}" "${deployer.address}" '${JSON.stringify(feeConfig)}'`);
  console.log("\n2. 🔗 Configure LayerZero peers (if bridging to other chains)");
  console.log("\n3. 🧪 Test minting:");
  console.log(`   await oft.mint("${deployer.address}", ethers.parseEther("1000"))`);
  console.log("   (Note: Only vault bridge can mint, or set one for testing)");
  
  // Save to file
  const fs = require('fs');
  const path = require('path');
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  fs.writeFileSync(
    path.join(deploymentsDir, 'sepolia-deployment.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n💾 Deployment info saved to: deployments/sepolia-deployment.json");
  
  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

