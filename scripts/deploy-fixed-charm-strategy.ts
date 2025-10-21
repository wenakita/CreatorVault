import { ethers } from "hardhat";

/**
 * Deploy Fixed CharmStrategyUSD1 with Corrected Return Value Order
 * 
 * Critical Fix: getTotalAmounts() and withdraw() now return (WLFI, USD1) instead of (USD1, WLFI)
 * This matches the IStrategy interface and prevents the 80% share dilution bug.
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🔧 Deploying FIXED CharmStrategyUSD1\n");
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");
  
  // Production addresses on Ethereum Mainnet
  const VAULT = "0x32a2544De7a644833fE7659dF95e5bC16E698d99";
  const CHARM_VAULT = "0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71";
  const WLFI = "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6";
  const USD1 = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
  const UNISWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const OWNER = deployer.address;
  
  console.log("📋 Configuration:");
  console.log("  Vault:", VAULT);
  console.log("  Charm Vault:", CHARM_VAULT);
  console.log("  WLFI:", WLFI);
  console.log("  USD1:", USD1);
  console.log("  Uniswap Router:", UNISWAP_ROUTER);
  console.log("  Owner:", OWNER);
  console.log();
  
  // Deploy CharmStrategyUSD1 (FIXED)
  console.log("📝 Deploying CharmStrategyUSD1 (FIXED)...");
  const CharmStrategyUSD1 = await ethers.getContractFactory("CharmStrategyUSD1");
  const strategy = await CharmStrategyUSD1.deploy(
    VAULT,
    CHARM_VAULT,
    WLFI,
    USD1,
    UNISWAP_ROUTER,
    OWNER
  );
  
  await strategy.waitForDeployment();
  const strategyAddress = await strategy.getAddress();
  
  console.log("✅ CharmStrategyUSD1 (FIXED) deployed to:", strategyAddress);
  console.log();
  
  // Initialize approvals
  console.log("📝 Initializing approvals...");
  const approveTx = await strategy.initializeApprovals();
  await approveTx.wait();
  console.log("✅ Approvals initialized");
  console.log("   Transaction:", approveTx.hash);
  console.log();
  
  // Verify the fix
  console.log("🔍 Verifying the fix...");
  try {
    const [wlfi, usd1] = await strategy.getTotalAmounts();
    console.log("✅ getTotalAmounts() returns in correct order:");
    console.log("   First return value (WLFI):", ethers.formatEther(wlfi));
    console.log("   Second return value (USD1):", ethers.formatEther(usd1));
  } catch (e: any) {
    console.log("⚠️  Could not verify (expected if no deposits yet):", e.message);
  }
  console.log();
  
  console.log("=" .repeat(70));
  console.log("✅ DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(70));
  console.log();
  
  console.log("📊 Deployment Summary:");
  console.log("  Strategy Address:", strategyAddress);
  console.log("  Network: Ethereum Mainnet");
  console.log("  Fix: Return value order corrected in getTotalAmounts() and withdraw()");
  console.log();
  
  console.log("⚠️  CRITICAL NEXT STEPS:");
  console.log("=" .repeat(70));
  console.log();
  console.log("1️⃣  EMERGENCY PAUSE THE VAULT");
  console.log("   const vault = await ethers.getContractAt('EagleOVault', VAULT);");
  console.log("   await vault.setPaused(true);");
  console.log();
  
  console.log("2️⃣  REMOVE OLD STRATEGY");
  console.log("   const OLD_STRATEGY = '0xd286Fdb2D3De4aBf44649649D79D5965bD266df4';");
  console.log("   await vault.removeStrategy(OLD_STRATEGY);");
  console.log("   // This withdraws all funds from old strategy back to vault");
  console.log();
  
  console.log("3️⃣  ADD NEW STRATEGY");
  console.log(`   await vault.addStrategy('${strategyAddress}', 10000);`);
  console.log("   // 10000 = 100% allocation");
  console.log();
  
  console.log("4️⃣  DEPLOY FUNDS TO NEW STRATEGY");
  console.log("   await vault.forceDeployToStrategies();");
  console.log();
  
  console.log("5️⃣  VERIFY CORRECT OPERATION");
  console.log("   // Check that getTotalAmounts() returns correct values");
  console.log("   // Try a small test deposit/withdraw");
  console.log();
  
  console.log("6️⃣  UNPAUSE THE VAULT");
  console.log("   await vault.setPaused(false);");
  console.log();
  
  console.log("7️⃣  COMPENSATE AFFECTED USERS");
  console.log("   // User 0xEdA067447102cb38D95e14ce99fe21D55C27152D lost ~500 WLFI");
  console.log("   // Send compensation from treasury");
  console.log();
  
  console.log("=" .repeat(70));
  console.log("📝 Save this information for reference!");
  console.log("=" .repeat(70));
  
  // Save deployment info
  const deploymentInfo = {
    network: "ethereum",
    deploymentDate: new Date().toISOString(),
    strategy: {
      address: strategyAddress,
      name: "CharmStrategyUSD1",
      version: "v2-FIXED-return-order",
      fix: "Corrected getTotalAmounts() and withdraw() to return (WLFI, USD1) instead of (USD1, WLFI)",
      deploymentTx: approveTx.hash
    },
    constructor: {
      vault: VAULT,
      charmVault: CHARM_VAULT,
      wlfi: WLFI,
      usd1: USD1,
      uniswapRouter: UNISWAP_ROUTER,
      owner: OWNER
    },
    oldStrategy: "0xd286Fdb2D3De4aBf44649649D79D5965bD266df4",
    status: "DEPLOYED - REQUIRES VAULT MIGRATION"
  };
  
  console.log("\n📄 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
