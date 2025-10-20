import { ethers } from "hardhat";

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🔧 LOWERING DEPLOYMENT THRESHOLD");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [owner] = await ethers.getSigners();
  console.log("Owner:", owner.address);

  const vault = await ethers.getContractAt("EagleOVault", "0x244b73dC14C01c350C04EAd7e1D8C3FeFeA6AF58");

  const currentThreshold = await vault.deploymentThreshold();
  console.log("\nCurrent threshold:", "$" + ethers.formatEther(currentThreshold));

  // Set to $10 for testing
  const newThreshold = ethers.parseEther("10");
  console.log("New threshold:", "$" + ethers.formatEther(newThreshold));

  console.log("\n📝 Sending transaction...");
  const tx = await vault.setDeploymentParams(
    newThreshold,
    5 * 60  // 5 minutes interval (unchanged)
  );

  console.log("  Transaction:", tx.hash);
  console.log("  Waiting for confirmation...");
  await tx.wait();

  console.log("\n✅ Deployment threshold lowered to $10!");
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ✅ READY TO DEPLOY TO CHARM");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("Now run:");
  console.log("  export VAULT_ADDRESS=0x244b73dC14C01c350C04EAd7e1D8C3FeFeA6AF58");
  console.log("  export STRATEGY_ADDRESS=0x2bF32B2F5F077c7126f8F0289d05352F321f1D67");
  console.log("  npx hardhat run scripts/deploy-to-charm.ts --network ethereum\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });

