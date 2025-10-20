import { ethers } from "hardhat";

/**
 * Deploy the FIXED CharmStrategyUSD1 (with line 264 fix)
 * This includes swap logic for maximum capital efficiency
 */

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🚀 DEPLOYING FIXED CHARM STRATEGY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("ETH balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.003")) {
    console.log("⚠️  Warning: Low ETH balance. Need ~0.005 ETH for deployment\n");
  }

  // Contract addresses (Ethereum Mainnet)
  const VAULT_ADDRESS = "0x32a2544De7a644833fE7659dF95e5bC16E698d99";
  const CHARM_VAULT = "0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71";
  const WLFI = "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6";
  const USD1 = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
  const UNISWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const OWNER = deployer.address;

  console.log("\n📋 Constructor Arguments:");
  console.log("  Vault:           ", VAULT_ADDRESS);
  console.log("  Charm Vault:     ", CHARM_VAULT);
  console.log("  WLFI:            ", WLFI);
  console.log("  USD1:            ", USD1);
  console.log("  Uniswap Router:  ", UNISWAP_ROUTER);
  console.log("  Owner:           ", OWNER);
  console.log("");

  // Deploy
  console.log("📦 Deploying CharmStrategyUSD1...");
  const Strategy = await ethers.getContractFactory("CharmStrategyUSD1");
  
  const strategy = await Strategy.deploy(
    VAULT_ADDRESS,
    CHARM_VAULT,
    WLFI,
    USD1,
    UNISWAP_ROUTER,
    OWNER,
    {
      gasLimit: 3000000
    }
  );

  console.log("⏳ Waiting for deployment...");
  await strategy.waitForDeployment();
  const address = await strategy.getAddress();

  console.log("\n✅ Strategy deployed at:", address);
  console.log("   View on Etherscan: https://etherscan.io/address/" + address);
  console.log("");

  // Initialize approvals
  console.log("🔐 Initializing approvals...");
  const approveTx = await strategy.initializeApprovals({
    gasLimit: 300000
  });
  await approveTx.wait();
  console.log("✅ Approvals initialized!\n");

  // Verify the fix is in place
  console.log("🔍 Verifying strategy is initialized...");
  const isInit = await strategy.isInitialized();
  const charmVault = await strategy.charmVault();
  console.log("  Is Initialized:", isInit);
  console.log("  Charm Vault:", charmVault);
  console.log("");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🎉 DEPLOYMENT COMPLETE!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("📝 Next Steps:\n");
  console.log("1. Remove old buggy strategy:");
  console.log(`   export OLD_STRATEGY=0x8d32D6aEd976dC80880f3eF708ecB2169FEe26a8`);
  console.log(`   export VAULT=0x32a2544De7a644833fE7659dF95e5bC16E698d99`);
  console.log(`   cast send $VAULT "removeStrategy(address)" $OLD_STRATEGY \\`);
  console.log(`     --rpc-url https://eth.llamarpc.com --private-key $PK --legacy`);
  console.log("");
  console.log("2. Add new fixed strategy:");
  console.log(`   export NEW_STRATEGY=${address}`);
  console.log(`   cast send $VAULT "addStrategy(address,uint256)" $NEW_STRATEGY 10000 \\`);
  console.log(`     --rpc-url https://eth.llamarpc.com --private-key $PK --legacy`);
  console.log("");
  console.log("3. Deploy to Charm:");
  console.log(`   npx hardhat run scripts/test-and-deploy-charm.ts --network ethereum`);
  console.log("");

  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    network: "ethereum",
    strategy: address,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    version: "fixed-with-swaps",
    fix: "line 264 - uses USD1.balanceOf(address(this)) after swap",
    constructor: {
      vault: VAULT_ADDRESS,
      charmVault: CHARM_VAULT,
      wlfi: WLFI,
      usd1: USD1,
      uniswapRouter: UNISWAP_ROUTER,
      owner: OWNER
    }
  };

  try {
    fs.mkdirSync('deployments', { recursive: true });
    fs.writeFileSync(
      'deployments/charm-strategy-fixed.json',
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("💾 Deployment info saved to: deployments/charm-strategy-fixed.json\n");
  } catch (e) {
    console.log("⚠️  Could not save deployment info:", e);
  }

  console.log("Strategy Address:", address);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });

