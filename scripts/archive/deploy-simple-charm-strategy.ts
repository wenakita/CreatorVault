import { ethers } from "hardhat";

/**
 * Deploy the SIMPLIFIED CharmStrategyUSD1Simple
 * This version has NO swap logic - Charm handles ratio matching automatically
 */

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🚀 DEPLOYING SIMPLIFIED CHARM STRATEGY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  // Contract addresses (Ethereum Mainnet)
  const VAULT_ADDRESS = "0x32a2544De7a644833fE7659dF95e5bC16E698d99";
  const CHARM_VAULT = "0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71";
  const WLFI = "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6";
  const USD1 = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
  const OWNER = deployer.address;

  console.log("\nConstructor Arguments:");
  console.log("  Vault:      ", VAULT_ADDRESS);
  console.log("  Charm Vault:", CHARM_VAULT);
  console.log("  WLFI:       ", WLFI);
  console.log("  USD1:       ", USD1);
  console.log("  Owner:      ", OWNER);
  console.log("");

  // Deploy
  const Strategy = await ethers.getContractFactory("CharmStrategyUSD1Simple");
  
  console.log("Deploying contract...");
  const strategy = await Strategy.deploy(
    VAULT_ADDRESS,
    CHARM_VAULT,
    WLFI,
    USD1,
    OWNER
  );

  await strategy.waitForDeployment();
  const address = await strategy.getAddress();

  console.log("\n✅ Strategy deployed at:", address);
  console.log("");

  // Initialize approvals
  console.log("Initializing approvals...");
  const tx = await strategy.initializeApprovals();
  await tx.wait();
  console.log("✅ Approvals set!\n");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🎉 DEPLOYMENT COMPLETE!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("Next Steps:");
  console.log("1. Remove old strategy from vault:");
  console.log(`   vault.removeStrategy("0x8d32D6aEd976dC80880f3eF708ecB2169FEe26a8")`);
  console.log("");
  console.log("2. Add new strategy to vault:");
  console.log(`   vault.addStrategy("${address}", 10000)`);
  console.log("");
  console.log("3. Deploy to Charm:");
  console.log(`   vault.forceDeployToStrategies()`);
  console.log("");
  console.log("4. Verify success:");
  console.log(`   npx hardhat run scripts/check-charm-success.ts --network ethereum`);
  console.log("");

  // Save to file
  const fs = require('fs');
  const deploymentInfo = {
    network: "ethereum",
    strategy: address,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    version: "simple",
    constructor: {
      vault: VAULT_ADDRESS,
      charmVault: CHARM_VAULT,
      wlfi: WLFI,
      usd1: USD1,
      owner: OWNER
    }
  };

  fs.writeFileSync(
    'deployments/charm-strategy-simple.json',
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("📄 Deployment info saved to: deployments/charm-strategy-simple.json\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });

