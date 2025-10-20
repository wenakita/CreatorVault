import { ethers } from "hardhat";

async function main() {
  const USD1 = await ethers.getContractAt("IERC20", "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d");
  const WLFI = await ethers.getContractAt("IERC20", "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6");
  
  const STRATEGY = "0x2bF32B2F5F077c7126f8F0289d05352F321f1D67";
  const VAULT = "0x244b73dC14C01c350C04EAd7e1D8C3FeFeA6AF58";

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🔍 STRATEGY TOKEN BALANCES");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const stratUsd1 = await USD1.balanceOf(STRATEGY);
  const stratWlfi = await WLFI.balanceOf(STRATEGY);
  const vaultUsd1 = await USD1.balanceOf(VAULT);
  const vaultWlfi = await WLFI.balanceOf(VAULT);

  console.log("Strategy Balances:");
  console.log("  USD1:", ethers.formatEther(stratUsd1));
  console.log("  WLFI:", ethers.formatEther(stratWlfi));

  console.log("\nVault Balances:");
  console.log("  USD1:", ethers.formatEther(vaultUsd1));
  console.log("  WLFI:", ethers.formatEther(vaultWlfi));

  if (stratUsd1 === 0n && stratWlfi === 0n) {
    console.log("\n❌ ISSUE: Strategy has NO tokens!");
    console.log("   The vault → strategy transfer might be failing.\n");
  } else {
    console.log("\n✅ Strategy has tokens\n");
  }
}

main();

