import { ethers } from "hardhat";

async function main() {
  console.log("🦅 Deploying EagleOVault V2 Hybrid on Arbitrum...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Your test tokens on Arbitrum
  const WLFI = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
  const USD1 = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
  const MEAGLE = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e";
  
  // Arbitrum infrastructure
  const UNISWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const PORTALS_ROUTER = "0xbf5a7f3629fb325e2a8453d595ab103465f75e62";
  const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

  console.log("\n📋 Configuration:");
  console.log("  WLFI:", WLFI);
  console.log("  USD1:", USD1);
  console.log("  MEAGLE:", MEAGLE);

  // Deploy
  console.log("\n🚀 Deploying...");
  const Vault = await ethers.getContractFactory("EagleOVaultV2Hybrid");
  const vault = await Vault.deploy(WLFI, USD1, UNISWAP_ROUTER, PORTALS_ROUTER, WETH, deployer.address);
  await vault.waitForDeployment();
  
  const vaultAddress = await vault.getAddress();
  console.log("✅ Deployed to:", vaultAddress);

  // Configure
  console.log("\n⚙️  Configuring...");
  const threshold = ethers.parseEther("100");
  const interval = 5 * 60; // 5 minutes
  
  const tx = await vault.setDeploymentParams(threshold, interval);
  await tx.wait();
  console.log("✅ Configured!");

  // Summary
  console.log("\n═══════════════════════════════════════");
  console.log("✅ DEPLOYMENT COMPLETE!");
  console.log("═══════════════════════════════════════");
  console.log("\nVault Address:", vaultAddress);
  console.log("\nUpdate test script with this address:");
  console.log(`  const VAULT_ADDRESS = "${vaultAddress}";`);
  console.log("\nThen run:");
  console.log(`  npx hardhat run scripts/test-arbitrum-vault.ts --network arbitrum`);
  console.log("\n═══════════════════════════════════════");
}

main().catch(console.error);

