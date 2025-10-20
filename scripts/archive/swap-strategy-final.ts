import { ethers } from "hardhat";

async function main() {
  const VAULT = "0x32a2544De7a644833fE7659dF95e5bC16E698d99";
  const OLD_STRATEGY = "0xF13dFf269D938cBC66B195477D56b813c8692d8A";
  const NEW_STRATEGY = "0x8d32D6aEd976dC80880f3eF708ecB2169FEe26a8";

  const vault = await ethers.getContractAt("EagleOVault", VAULT);
  const strategy = await ethers.getContractAt("CharmStrategyUSD1", NEW_STRATEGY);

  console.log("\n🔄 Swapping strategy...\n");

  const tx1 = await vault.removeStrategy(OLD_STRATEGY, { gasLimit: 500000 });
  await tx1.wait();
  console.log("1️⃣ Old strategy removed");

  const tx2 = await vault.addStrategy(NEW_STRATEGY, 10000, { gasLimit: 500000 });
  await tx2.wait();
  console.log("2️⃣ New strategy added");

  const tx3 = await strategy.initializeApprovals({ gasLimit: 300000 });
  await tx3.wait();
  console.log("3️⃣ Approvals initialized");

  console.log("\n✅ Ready! New strategy:", NEW_STRATEGY, "\n");
}

main();

