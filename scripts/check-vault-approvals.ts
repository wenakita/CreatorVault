import { ethers } from "hardhat";

async function main() {
  const vault = await ethers.getContractAt("EagleOVault", "0x244b73dC14C01c350C04EAd7e1D8C3FeFeA6AF58");
  const strategy = "0x2bF32B2F5F077c7126f8F0289d05352F321f1D67";
  const WLFI = await ethers.getContractAt("IERC20", "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6");
  const USD1 = await ethers.getContractAt("IERC20", "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d");

  const wlfiAllowance = await WLFI.allowance(await vault.getAddress(), strategy);
  const usd1Allowance = await USD1.allowance(await vault.getAddress(), strategy);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  📊 VAULT → STRATEGY APPROVALS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("Vault:", await vault.getAddress());
  console.log("Strategy:", strategy);
  console.log("\nApprovals:");
  console.log("  WLFI:", ethers.formatEther(wlfiAllowance), wlfiAllowance > 0 ? "✅" : "❌");
  console.log("  USD1:", ethers.formatEther(usd1Allowance), usd1Allowance > 0 ? "✅" : "❌");
  
  if (wlfiAllowance === 0n || usd1Allowance === 0n) {
    console.log("\n❌ Missing approvals! Run:");
    console.log("   npx hardhat run scripts/approve-vault-to-strategy.ts --network ethereum\n");
  } else {
    console.log("\n✅ Approvals are set!\n");
  }
}

main();

