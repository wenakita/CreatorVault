import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC";

async function main() {
  console.log("🔍 Checking Deployment Status\n");

  const vault = await ethers.getContractAt("EagleOVaultV2Hybrid", VAULT_ADDRESS);

  // Check parameters
  const deploymentThreshold = await vault.deploymentThreshold();
  const minDeploymentInterval = await vault.minDeploymentInterval();
  const lastDeployment = await vault.lastDeployment();
  const totalStrategyWeight = await vault.totalStrategyWeight();
  
  const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
  const idleFunds = vaultWlfi + vaultUsd1;
  
  const now = Math.floor(Date.now() / 1000);
  const timeSinceLastDeployment = now - Number(lastDeployment);

  console.log("📋 Deployment Configuration:");
  console.log("  ═══════════════════════════════════════");
  console.log("  Threshold:", ethers.formatEther(deploymentThreshold), "($100)");
  console.log("  Min Interval:", Number(minDeploymentInterval) / 60, "minutes");
  console.log("  Total Strategy Weight:", Number(totalStrategyWeight) / 100, "%");
  console.log("  ═══════════════════════════════════════");

  console.log("\n📊 Current Status:");
  console.log("  ═══════════════════════════════════════");
  console.log("  Idle Funds:", ethers.formatEther(idleFunds));
  console.log("  Last Deployment:", new Date(Number(lastDeployment) * 1000).toLocaleString());
  console.log("  Time Since:", Math.floor(timeSinceLastDeployment / 60), "minutes ago");
  console.log("  ═══════════════════════════════════════");

  console.log("\n✅ Deployment Criteria:");
  console.log("  ═══════════════════════════════════════");
  
  const hasStrategies = totalStrategyWeight > 0n;
  const meetsThreshold = idleFunds >= deploymentThreshold;
  const meetsInterval = timeSinceLastDeployment >= Number(minDeploymentInterval);
  
  console.log("  1. Has strategies?", hasStrategies ? "✅ Yes" : "❌ No");
  console.log("  2. Meets threshold?", meetsThreshold ? `✅ Yes (${ethers.formatEther(idleFunds)} >= ${ethers.formatEther(deploymentThreshold)})` : "❌ No");
  console.log("  3. Meets interval?", meetsInterval ? `✅ Yes (${Math.floor(timeSinceLastDeployment / 60)}min >= ${Number(minDeploymentInterval) / 60}min)` : `❌ No (${Math.floor(timeSinceLastDeployment / 60)}min < ${Number(minDeploymentInterval) / 60}min)`);
  
  const shouldDeploy = hasStrategies && meetsThreshold && meetsInterval;
  
  console.log("\n  Should Deploy?", shouldDeploy ? "✅ YES" : "❌ NO");
  
  if (!shouldDeploy) {
    console.log("\n  Reason:");
    if (!hasStrategies) console.log("    • No strategies active");
    if (!meetsThreshold) console.log("    • Not enough idle funds");
    if (!meetsInterval) console.log("    • Need to wait", Math.ceil((Number(minDeploymentInterval) - timeSinceLastDeployment) / 60), "more minutes");
  }
  
  console.log("  ═══════════════════════════════════════");

  // Manual trigger option
  if (shouldDeploy) {
    console.log("\n💡 To manually trigger deployment:");
    console.log("  vault.forceDeployToStrategies()");
  } else if (meetsThreshold && hasStrategies && !meetsInterval) {
    console.log("\n💡 To deploy now (bypass interval):");
    console.log("  vault.forceDeployToStrategies()");
    console.log("  This will deploy immediately!");
  }
}

main().catch(console.error);

