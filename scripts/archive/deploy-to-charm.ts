import { ethers } from "hardhat";

/**
 * Deploy to Charm Script
 * 
 * This script actually deploys funds from the vault to Charm Finance.
 * Should only be run after complete-charm-integration.ts confirms everything is ready.
 */

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🚀 DEPLOYING TO CHARM FINANCE 🚀");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [owner] = await ethers.getSigners();
  console.log("Owner address:", owner.address);

  // Contract addresses
  const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "0x7D3F0f409CbF111005F8FcDDd2AEe34c7Ec33c11";
  const STRATEGY_ADDRESS = process.env.STRATEGY_ADDRESS || "0x751578461F84289A2b12FCA1950Dc514c904745f";
  
  // Get contract instances
  const vault = await ethers.getContractAt("EagleOVault", VAULT_ADDRESS);
  const strategy = await ethers.getContractAt("CharmStrategyUSD1", STRATEGY_ADDRESS);

  console.log("\n📍 Contract Addresses:");
  console.log("  Vault:    ", VAULT_ADDRESS);
  console.log("  Strategy: ", STRATEGY_ADDRESS);

  // ===================================
  // PRE-FLIGHT CHECKS
  // ===================================
  console.log("\n✈️  Pre-flight checks...");
  
  // 1. Check vault has funds
  const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
  console.log("  Vault WLFI: ", ethers.formatEther(vaultWlfi));
  console.log("  Vault USD1: ", ethers.formatEther(vaultUsd1));

  if (vaultWlfi === 0n && vaultUsd1 === 0n) {
    throw new Error("❌ Vault is empty! Nothing to deploy.");
  }

  // 2. Check strategy is initialized
  const isInitialized = await strategy.isInitialized();
  if (!isInitialized) {
    throw new Error("❌ Strategy not initialized!");
  }
  console.log("  Strategy initialized: ✅");

  // 3. Check strategy is active
  const strategies = await vault.getStrategies();
  const isActive = strategies[0].some((addr: string) => 
    addr.toLowerCase() === STRATEGY_ADDRESS.toLowerCase()
  );
  if (!isActive) {
    throw new Error("❌ Strategy not added to vault!");
  }
  console.log("  Strategy active: ✅");

  // ===================================
  // DEPLOYMENT
  // ===================================
  console.log("\n🎯 Deploying to Charm Finance...");
  console.log("  This will:");
  console.log("    1. Transfer tokens from vault to strategy");
  console.log("    2. Swap to match Charm's ratio");
  console.log("    3. Deposit to Charm vault");
  console.log("    4. Return unused tokens to vault");
  
  console.log("\n  Proceeding in 3 seconds...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    const tx = await vault.forceDeployToStrategies({
      gasLimit: 1000000, // 1M gas for small deployment
    });
    
    console.log("\n  📝 Transaction sent:", tx.hash);
    console.log("  ⏳ Waiting for confirmation...");
    
    const receipt = await tx.wait();
    
    console.log("  ✅ Transaction confirmed!");
    console.log("  Gas used:", receipt?.gasUsed?.toString());
    
    // ===================================
    // POST-DEPLOYMENT VERIFICATION
    // ===================================
    console.log("\n🔍 Verifying deployment...");
    
    const [newVaultWlfi, newVaultUsd1] = await vault.getVaultBalances();
    const [stratWlfi, stratUsd1] = await strategy.getTotalAmounts();
    const shares = await strategy.getShareBalance();
    
    console.log("\n  📊 Vault balances (after):");
    console.log("    WLFI: ", ethers.formatEther(newVaultWlfi));
    console.log("    USD1: ", ethers.formatEther(newVaultUsd1));
    
    console.log("\n  📊 Strategy balances:");
    console.log("    WLFI in Charm: ", ethers.formatEther(stratWlfi));
    console.log("    USD1 in Charm: ", ethers.formatEther(stratUsd1));
    console.log("    Charm LP shares: ", ethers.formatEther(shares));
    
    const deployed = stratWlfi + stratUsd1;
    const remaining = newVaultWlfi + newVaultUsd1;
    
    console.log("\n  📈 Summary:");
    console.log("    Deployed to Charm: ~$" + ethers.formatEther(deployed));
    console.log("    Remaining in vault: ~$" + ethers.formatEther(remaining));
    console.log("    Deployment success: ", deployed > 0n ? "✅" : "❌");

    if (deployed === 0n) {
      console.log("\n  ⚠️  WARNING: No funds deployed to Charm!");
      console.log("  Check transaction logs for errors.");
    }

  } catch (error: any) {
    console.error("\n❌ Deployment failed!");
    console.error("Error:", error.message);
    
    if (error.data) {
      console.error("Error data:", error.data);
    }
    
    throw error;
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ✅ CHARM DEPLOYMENT COMPLETE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  console.log("🎉 Funds are now earning yield on Charm Finance!");
  console.log("🔗 View on Etherscan:");
  console.log("   https://etherscan.io/address/" + STRATEGY_ADDRESS + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });
