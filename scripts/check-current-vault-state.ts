import { ethers } from "hardhat";

async function main() {
  const vault = await ethers.getContractAt("EagleOVault", "0x32a2544De7a644833fE7659dF95e5bC16E698d99");
  const WLFI = await ethers.getContractAt("IERC20", "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6");
  const USD1 = await ethers.getContractAt("IERC20", "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d");
  
  const [owner] = await ethers.getSigners();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  📊 VAULT STATE CHECK");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Vault balances
  const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
  const actualWlfi = await WLFI.balanceOf(await vault.getAddress());
  const actualUsd1 = await USD1.balanceOf(await vault.getAddress());

  console.log("Vault Internal Tracking:");
  console.log("  WLFI:", ethers.formatEther(vaultWlfi));
  console.log("  USD1:", ethers.formatEther(vaultUsd1));

  console.log("\nVault Actual ERC20 Balance:");
  console.log("  WLFI:", ethers.formatEther(actualWlfi));
  console.log("  USD1:", ethers.formatEther(actualUsd1));

  console.log("\nBalances Match:", vaultWlfi === actualWlfi && vaultUsd1 === actualUsd1 ? "✅" : "❌");

  // Your shares
  const yourShares = await vault.balanceOf(owner.address);
  const totalShares = await vault.totalSupply();

  console.log("\nShares:");
  console.log("  Your shares:", ethers.formatEther(yourShares));
  console.log("  Total supply:", ethers.formatEther(totalShares));

  // Strategy status
  const strategies = await vault.getStrategies();
  console.log("\nStrategies:");
  console.log("  Count:", strategies[0].length);
  if (strategies[0].length > 0) {
    console.log("  Strategy:", strategies[0][0]);
    console.log("  Weight:", strategies[1][0].toString());
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (actualWlfi === 0n && actualUsd1 === 0n) {
    console.log("❌ ISSUE: Vault is empty!");
    console.log("   You need to deposit tokens first.\n");
  } else {
    console.log("✅ Vault has tokens - ready to deploy!\n");
  }
}

main();

