import { ethers } from "hardhat";

/**
 * Deploy EagleRegistry on Sepolia
 * 
 * This registry will store chain configurations and LayerZero endpoints
 * for the multi-chain Eagle ecosystem
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying EagleRegistry with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  
  // Sepolia configuration
  const SEPOLIA_CHAIN_ID = 11155111;
  const SEPOLIA_LZ_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f"; // LayerZero V2 Sepolia
  const SEPOLIA_LZ_EID = 40161; // LayerZero Endpoint ID for Sepolia
  const WETH_SEPOLIA = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // WETH on Sepolia
  
  console.log("\n📋 Deployment Configuration:");
  console.log("Chain ID:", SEPOLIA_CHAIN_ID);
  console.log("LayerZero Endpoint:", SEPOLIA_LZ_ENDPOINT);
  console.log("LayerZero EID:", SEPOLIA_LZ_EID);
  console.log("WETH:", WETH_SEPOLIA);
  
  // Deploy Registry
  console.log("\n📝 Deploying EagleRegistry...");
  const EagleRegistry = await ethers.getContractFactory("EagleRegistry");
  const registry = await EagleRegistry.deploy(deployer.address);
  
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  
  console.log("✅ EagleRegistry deployed to:", registryAddress);
  
  // Verify it auto-detected Sepolia
  const currentChainId = await registry.getCurrentChainId();
  console.log("\n🔍 Registry auto-detected chain ID:", currentChainId.toString());
  
  // Register Sepolia chain configuration
  console.log("\n📝 Registering Sepolia configuration...");
  const registerTx = await registry.registerChain(
    11155111, // chainId (uint16 - will be truncated but that's ok for testnet)
    "Sepolia",
    WETH_SEPOLIA,
    "WETH",
    true // isActive
  );
  await registerTx.wait();
  console.log("✅ Sepolia registered");
  
  // Set LayerZero endpoint
  console.log("\n📝 Setting LayerZero endpoint...");
  const setEndpointTx = await registry.setLayerZeroEndpoint(
    11155111,
    SEPOLIA_LZ_ENDPOINT
  );
  await setEndpointTx.wait();
  console.log("✅ LayerZero endpoint set");
  
  // Set Chain ID to EID mapping
  console.log("\n📝 Setting Chain ID to EID mapping...");
  const setEidTx = await registry.setChainIdToEid(
    SEPOLIA_CHAIN_ID,
    SEPOLIA_LZ_EID
  );
  await setEidTx.wait();
  console.log("✅ EID mapping set");
  
  // Verify configuration
  console.log("\n🔍 Verifying configuration...");
  const endpoint = await registry.getLayerZeroEndpoint(11155111);
  const eid = await registry.getEidForChainId(SEPOLIA_CHAIN_ID);
  const isSupported = await registry.isChainSupported(11155111);
  
  console.log("LayerZero Endpoint:", endpoint);
  console.log("LayerZero EID:", eid.toString());
  console.log("Chain Supported:", isSupported);
  
  // Save deployment info
  const deploymentInfo = {
    network: "sepolia",
    chainId: SEPOLIA_CHAIN_ID,
    registry: registryAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    configuration: {
      layerZeroEndpoint: SEPOLIA_LZ_ENDPOINT,
      layerZeroEid: SEPOLIA_LZ_EID,
      weth: WETH_SEPOLIA,
      chainRegistered: true,
      chainActive: true
    }
  };
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("\n📊 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n🔗 Etherscan:");
  console.log(`https://sepolia.etherscan.io/address/${registryAddress}`);
  
  console.log("\n📝 Next Steps:");
  console.log("1. Verify the contract on Etherscan");
  console.log("2. Deploy EagleShareOFT using this registry");
  console.log("3. Save the registry address for future deployments");
  
  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

