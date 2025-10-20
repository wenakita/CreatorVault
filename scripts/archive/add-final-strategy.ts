import { ethers } from "hardhat";

async function main() {
  const vault = await ethers.getContractAt("EagleOVault", "0x32a2544De7a644833fE7659dF95e5bC16E698d99");
  const strategy = await ethers.getContractAt("CharmStrategyUSD1", "0x8d32D6aEd976dC80880f3eF708ecB2169FEe26a8");

  console.log("Adding strategy...");
  const tx1 = await vault.addStrategy("0x8d32D6aEd976dC80880f3eF708ecB2169FEe26a8", 10000, {gasLimit: 500000});
  await tx1.wait();
  console.log("✅ Strategy added");

  console.log("Initializing approvals...");
  const tx2 = await strategy.initializeApprovals({gasLimit: 300000});
  await tx2.wait();
  console.log("✅ Approvals set");

  console.log("\n✅ READY TO DEPLOY TO CHARM!\n");
}

main();

