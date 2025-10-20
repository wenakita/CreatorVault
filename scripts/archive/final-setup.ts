import { ethers } from "hardhat";

async function main() {
  const VAULT = "0x32a2544De7a644833fE7659dF95e5bC16E698d99";
  const STRATEGY = "0xF13dFf269D938cBC66B195477D56b813c8692d8A";

  const vault = await ethers.getContractAt("EagleOVault", VAULT);
  const strategy = await ethers.getContractAt("CharmStrategyUSD1", STRATEGY);

  console.log("\n🚀 Setting up new system...\n");

  const tx1 = await vault.addStrategy(STRATEGY, 10000, { gasLimit: 500000 });
  await tx1.wait();
  console.log("1️⃣ Strategy added");

  const tx2 = await vault.setDeploymentParams(ethers.parseEther("10"), 300, { gasLimit: 200000 });
  await tx2.wait();
  console.log("2️⃣ Threshold set to $10");

  const tx3 = await strategy.initializeApprovals({ gasLimit: 300000 });
  await tx3.wait();
  console.log("3️⃣ Strategy approvals set");

  console.log("\n✅ DONE!\n");
  console.log("NEW ADDRESSES:");
  console.log("  Vault:   ", VAULT);
  console.log("  Strategy:", STRATEGY);
  console.log("\nUpdate frontend and deposit to THIS vault!\n");
}

main();

