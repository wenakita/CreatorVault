import { ethers } from "hardhat";

async function main() {
  const vault = await ethers.getContractAt("EagleOVault", "0x244b73dC14C01c350C04EAd7e1D8C3FeFeA6AF58");
  const strategy = await ethers.getContractAt("CharmStrategyUSD1", "0xc46664701ACfDb742Bac22CDBdAC1A4f6B8895de");

  console.log("1️⃣ Removing old strategy...");
  try {
    const tx1 = await vault.removeStrategy("0x2bF32B2F5F077c7126f8F0289d05352F321f1D67", { gasLimit: 500000 });
    await tx1.wait();
    console.log("   ✅ Old strategy removed");
  } catch (e) {
    console.log("   ⚠️ Could not remove old strategy (may not exist)");
  }

  console.log("\n2️⃣ Adding new strategy...");
  const tx2 = await vault.addStrategy("0xc46664701ACfDb742Bac22CDBdAC1A4f6B8895de", 10000, { gasLimit: 500000 });
  await tx2.wait();
  console.log("   ✅ Strategy added");

  console.log("\n3️⃣ Approving vault → strategy...");
  const tx3 = await vault.approveTokensToStrategy("0xc46664701ACfDb742Bac22CDBdAC1A4f6B8895de", ethers.MaxUint256, ethers.MaxUint256, { gasLimit: 200000 });
  await tx3.wait();
  console.log("   ✅ Approvals set");

  console.log("\n4️⃣ Initializing strategy approvals...");
  const tx4 = await strategy.initializeApprovals({ gasLimit: 300000 });
  await tx4.wait();
  console.log("   ✅ Strategy approvals set");

  console.log("\n✅ READY TO DEPLOY TO CHARM!\n");
}

main();

