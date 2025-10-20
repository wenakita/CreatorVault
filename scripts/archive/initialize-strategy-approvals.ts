import { ethers } from "hardhat";

/**
 * Initialize Strategy Approvals
 * 
 * This script calls initializeApprovals() on the CharmStrategyUSD1
 * to set max approvals for Uniswap Router and Charm Vault
 */

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🔓 INITIALIZING STRATEGY APPROVALS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [owner] = await ethers.getSigners();
  console.log("Owner address:", owner.address);

  const STRATEGY_ADDRESS = process.env.STRATEGY_ADDRESS || "0x2bF32B2F5F077c7126f8F0289d05352F321f1D67";
  
  console.log("\n📍 Strategy Address:", STRATEGY_ADDRESS);

  // Get strategy contract
  const strategy = await ethers.getContractAt("CharmStrategyUSD1", STRATEGY_ADDRESS);

  // Check if already initialized
  console.log("\n🔍 Checking current status...");
  const isInitialized = await strategy.isInitialized();
  console.log("  Strategy initialized:", isInitialized);

  if (!isInitialized) {
    console.log("\n❌ Strategy not initialized! Cannot set approvals.");
    return;
  }

  console.log("\n🔓 Setting approvals...");
  console.log("  This will approve:");
  console.log("    • WLFI → Uniswap Router (MAX)");
  console.log("    • USD1 → Uniswap Router (MAX)");
  console.log("    • WLFI → Charm Vault (MAX)");
  console.log("    • USD1 → Charm Vault (MAX)");

  const tx = await strategy.initializeApprovals({
    gasLimit: 300000
  });

  console.log("\n  📝 Transaction sent:", tx.hash);
  console.log("  ⏳ Waiting for confirmation...");

  await tx.wait();

  console.log("\n✅ Approvals initialized successfully!");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ✅ STRATEGY READY FOR DEPLOYMENT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("Now you can deploy to Charm:");
  console.log("  export VAULT_ADDRESS=" + process.env.VAULT_ADDRESS || "0x244b73dC14C01c350C04EAd7e1D8C3FeFeA6AF58");
  console.log("  export STRATEGY_ADDRESS=" + STRATEGY_ADDRESS);
  console.log("  npx hardhat run scripts/deploy-to-charm.ts --network ethereum\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });

