import { ethers } from "hardhat";

/**
 * Deploy EagleShareOFT on Sepolia
 * 
 * Deploys the OFT token that can be bridged across chains via LayerZero
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying EagleShareOFT with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  
  // IMPORTANT: Update this address after deploying the registry
  const REGISTRY_ADDRESS = process.env.SEPOLIA_REGISTRY_ADDRESS || "";
  const SEPOLIA_LZ_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f"; // Sepolia LayerZero endpoint

  if (!REGISTRY_ADDRESS) {
    console.error("\n❌ ERROR: SEPOLIA_REGISTRY_ADDRESS not set!");
    console.log("\nPlease set the registry address:");
    console.log("export SEPOLIA_REGISTRY_ADDRESS=<your_registry_address>");
    console.log("\nOr deploy the registry first:");
    console.log("npx hardhat run scripts/deploy-registry-sepolia.ts --network sepolia");
    process.exit(1);
  }
  
  console.log("\n📋 Configuration:");
  console.log("Registry:", REGISTRY_ADDRESS);
  console.log("Deployer:", deployer.address);
  
  // Verify registry exists
  console.log("\n🔍 Verifying registry...");
  const registryCode = await ethers.provider.getCode(REGISTRY_ADDRESS);
  if (registryCode === "0x") {
    console.error("❌ Registry not found at address!");
    process.exit(1);
  }
  console.log("✅ Registry exists");
  
  // Get registry info
  const registry = await ethers.getContractAt("EagleRegistry", REGISTRY_ADDRESS);
  const currentChainId = await registry.getCurrentChainId();
  const layerZeroEndpoint = await registry.getLayerZeroEndpoint(currentChainId);
  
  console.log("Chain ID:", currentChainId.toString());
  console.log("LayerZero Endpoint:", layerZeroEndpoint);
  
  // Prepare fee configuration (zero fees for testnet)
  const feeConfig = {
    buyFee: 0,          // 0% buy fee
    sellFee: 0,         // 0% sell fee
    treasuryShare: 5000, // 50%
    vaultShare: 5000,    // 50%
    treasury: deployer.address,
    vaultBeneficiary: deployer.address,
    feesEnabled: false   // Disabled for testnet
  };
  
  console.log("\n📝 Fee Configuration:");
  console.log("Buy Fee:", feeConfig.buyFee, "bp");
  console.log("Sell Fee:", feeConfig.sellFee, "bp");
  console.log("Fees Enabled:", feeConfig.feesEnabled);
  
  // Deploy EagleShareOFT
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
  
  console.log("✅ EagleShareOFT deployed to:", oftAddress);
  
  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  const name = await oft.name();
  const symbol = await oft.symbol();
  const decimals = await oft.decimals();
  const owner = await oft.owner();
  const endpoint = await oft.endpoint();
  
  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Decimals:", decimals.toString());
  console.log("Owner:", owner);
  console.log("Endpoint:", endpoint);
  
  // Check fee configuration
  const swapFeeConfig = await oft.swapFeeConfig();
  console.log("\n💰 Fee Configuration:");
  console.log("Buy Fee:", swapFeeConfig.buyFee.toString(), "bp");
  console.log("Sell Fee:", swapFeeConfig.sellFee.toString(), "bp");
  console.log("Fees Enabled:", swapFeeConfig.feesEnabled);
  
  // Save deployment info
  const deploymentInfo = {
    network: "sepolia",
    chainId: 11155111,
    oft: oftAddress,
    registry: REGISTRY_ADDRESS,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    configuration: {
      name: "Eagle Vault Shares",
      symbol: "EAGLE",
      decimals: 18,
      feesEnabled: false,
      layerZeroEndpoint: endpoint
    }
  };
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("\n📊 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n🔗 Etherscan:");
  console.log(`https://sepolia.etherscan.io/address/${oftAddress}`);
  
  console.log("\n📝 Next Steps:");
  console.log("1. Verify the contract on Etherscan");
  console.log("2. Configure LayerZero peers (connect to other chains)");
  console.log("3. Test minting and bridging");
  console.log("4. Set up vault bridge if needed:");
  console.log(`   await oft.setVaultBridge(wrapperAddress)`);
  
  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

