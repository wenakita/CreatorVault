import { ethers } from "hardhat";

async function main() {
  const vault = await ethers.getContractAt("EagleOVault", "0x244b73dC14C01c350C04EAd7e1D8C3FeFeA6AF58");

  const [wlfi, usd1] = await vault.getVaultBalances();
  const threshold = await vault.deploymentThreshold();
  const totalStrategyWeight = await vault.totalStrategyWeight();

  const wlfiPrice = await vault.getWLFIPrice();
  const usd1Price = await vault.getUSD1Price();
  
  const totalValue = (wlfi * wlfiPrice + usd1 * usd1Price) / BigInt(10**18);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  📊 DEPLOYMENT THRESHOLD CHECK");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("Vault Balances:");
  console.log("  WLFI:", ethers.formatEther(wlfi));
  console.log("  USD1:", ethers.formatEther(usd1));
  console.log("\nValue:");
  console.log("  Total USD Value:", "$" + ethers.formatEther(totalValue));
  console.log("  Deployment Threshold:", "$" + ethers.formatEther(threshold));
  console.log("  Total Strategy Weight:", totalStrategyWeight.toString());

  console.log("\n" + (totalValue >= threshold ? "✅" : "❌"), "Meets threshold:", totalValue >= threshold);
  console.log((totalStrategyWeight > 0 ? "✅" : "❌"), "Has active strategies:", totalStrategyWeight > 0);

  if (totalValue < threshold) {
    console.log("\n❌ ISSUE FOUND: Vault value is below deployment threshold!");
    console.log(`   Need at least $${ethers.formatEther(threshold)} to deploy`);
    console.log(`   Current value: $${ethers.formatEther(totalValue)}`);
    console.log(`   Shortfall: $${ethers.formatEther(threshold - totalValue)}\n`);
  } else if (totalStrategyWeight === 0n) {
    console.log("\n❌ ISSUE FOUND: No strategies configured!");
  } else {
    console.log("\n✅ Should be able to deploy!\n");
  }
}

main();

