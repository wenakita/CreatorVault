import { ethers } from "hardhat";

/**
 * Deploy EagleOVault V2 with all necessary configuration
 */
async function main() {
  console.log("🦅 Deploying EagleOVault V2...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");

  // =================================
  // CONFIGURATION
  // =================================
  
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, `(${network.chainId})`);
  
  let WLFI_ADDRESS: string;
  let USD1_ADDRESS: string;
  let UNISWAP_ROUTER: string;
  let WETH9_ADDRESS: string;
  
  if (network.chainId === 1) {
    // Ethereum Mainnet
    WLFI_ADDRESS = "0x..."; // TODO: Set your WLFI address
    USD1_ADDRESS = "0x..."; // TODO: Set your USD1 address
    UNISWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
    WETH9_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  } else if (network.chainId === 11155111) {
    // Sepolia Testnet
    WLFI_ADDRESS = "0x..."; // TODO: Deploy test tokens first
    USD1_ADDRESS = "0x..."; // TODO: Deploy test tokens first
    UNISWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
    WETH9_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  } else {
    throw new Error(`Unsupported network: ${network.chainId}`);
  }

  console.log("\n📋 Configuration:");
  console.log("  WLFI:", WLFI_ADDRESS);
  console.log("  USD1:", USD1_ADDRESS);
  console.log("  Uniswap Router:", UNISWAP_ROUTER);
  console.log("  WETH9:", WETH9_ADDRESS);
  console.log("  Owner:", deployer.address);

  // =================================
  // DEPLOY VAULT
  // =================================
  
  console.log("\n🚀 Deploying EagleOVaultV2...");
  
  const EagleOVaultV2 = await ethers.getContractFactory("EagleOVaultV2");
  const vault = await EagleOVaultV2.deploy(
    WLFI_ADDRESS,
    USD1_ADDRESS,
    UNISWAP_ROUTER,
    WETH9_ADDRESS,
    deployer.address
  );
  
  await vault.deployed();
  console.log("✅ EagleOVaultV2 deployed to:", vault.address);

  // =================================
  // CONFIGURE VAULT
  // =================================
  
  console.log("\n⚙️  Configuring vault...");
  
  // Set deployment parameters
  const deploymentThreshold = ethers.utils.parseEther("10000"); // $10k
  const deploymentInterval = 60 * 60; // 1 hour
  
  console.log("  Setting deployment params...");
  let tx = await vault.setDeploymentParams(deploymentThreshold, deploymentInterval);
  await tx.wait();
  console.log("    ✅ Deployment threshold:", ethers.utils.formatEther(deploymentThreshold));
  console.log("    ✅ Deployment interval:", deploymentInterval / 60, "minutes");
  
  // Set target ratio (50/50 by default)
  console.log("  Setting target ratio...");
  tx = await vault.setTargetRatio(5000); // 50% WLFI, 50% USD1
  await tx.wait();
  console.log("    ✅ Target ratio: 50% WLFI, 50% USD1");
  
  // Set pool fee (1% tier to match Charm vault)
  console.log("  Setting pool fee...");
  tx = await vault.setPoolFee(10000); // 1%
  await tx.wait();
  console.log("    ✅ Pool fee: 1%");

  // =================================
  // ADD STRATEGY (Optional)
  // =================================
  
  // If you have a Charm strategy deployed, add it here
  const CHARM_STRATEGY = process.env.CHARM_STRATEGY_ADDRESS;
  
  if (CHARM_STRATEGY) {
    console.log("\n🎯 Adding Charm strategy...");
    console.log("  Strategy address:", CHARM_STRATEGY);
    
    tx = await vault.addStrategy(CHARM_STRATEGY, 7000); // 70% allocation
    await tx.wait();
    console.log("  ✅ Strategy added with 70% allocation");
  } else {
    console.log("\n⚠️  Skipping strategy addition (CHARM_STRATEGY_ADDRESS not set)");
  }

  // =================================
  // VERIFICATION INFO
  // =================================
  
  console.log("\n📝 Deployment Summary:");
  console.log("  Network:", network.name);
  console.log("  Vault:", vault.address);
  console.log("  Owner:", deployer.address);
  console.log("  WLFI:", WLFI_ADDRESS);
  console.log("  USD1:", USD1_ADDRESS);
  
  if (CHARM_STRATEGY) {
    console.log("  Strategy:", CHARM_STRATEGY);
  }

  // =================================
  // VERIFY ON ETHERSCAN
  // =================================
  
  console.log("\n🔍 To verify on Etherscan, run:");
  console.log(`npx hardhat verify --network ${network.name} ${vault.address} ${WLFI_ADDRESS} ${USD1_ADDRESS} ${UNISWAP_ROUTER} ${WETH9_ADDRESS} ${deployer.address}`);

  // =================================
  // TEST FUNCTIONS
  // =================================
  
  console.log("\n🧪 Testing view functions...");
  
  const [wlfiBalance, usd1Balance] = await vault.getVaultBalances();
  console.log("  Vault balances:", {
    wlfi: ethers.utils.formatEther(wlfiBalance),
    usd1: ethers.utils.formatEther(usd1Balance)
  });
  
  const currentRatio = await vault.getCurrentRatio();
  console.log("  Current ratio:", currentRatio.toNumber() / 100, "% WLFI");
  
  const needsRebalance = await vault.needsRebalance();
  console.log("  Needs rebalance:", needsRebalance);
  
  const shouldDeploy = await vault.shouldDeployToStrategies();
  console.log("  Should deploy to strategies:", shouldDeploy);
  
  const idleFunds = await vault.getIdleFunds();
  console.log("  Idle funds:", ethers.utils.formatEther(idleFunds));

  // =================================
  // NEXT STEPS
  // =================================
  
  console.log("\n✅ Deployment complete!");
  console.log("\n📋 Next steps:");
  console.log("  1. Verify contract on Etherscan");
  console.log("  2. Add vault to your frontend");
  console.log("  3. Test zap deposits on testnet");
  console.log("  4. Deploy strategy contracts if not already deployed");
  console.log("  5. Add strategies to vault");
  console.log("  6. Test with small amounts first");
  console.log("\n🎉 Ready to accept deposits!");

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId,
    vault: vault.address,
    wlfi: WLFI_ADDRESS,
    usd1: USD1_ADDRESS,
    router: UNISWAP_ROUTER,
    weth9: WETH9_ADDRESS,
    owner: deployer.address,
    strategy: CHARM_STRATEGY || null,
    deployedAt: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber()
  };

  console.log("\n💾 Deployment info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

