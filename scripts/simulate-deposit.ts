import { ethers } from "hardhat";

async function main() {
  const VAULT_FINAL = "0x47dc58aad89d87f54dab4055fd7c444948bea91e";
  const USER = "0x7310Dd6EF89b7f829839F140C6840bc929ba2031";
  const WLFI = "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6";
  const USD1 = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";

  const vault = await ethers.getContractAt("EagleOVault", VAULT_FINAL);
  const wlfi = await ethers.getContractAt("IERC20", WLFI);
  const usd1 = await ethers.getContractAt("IERC20", USD1);

  console.log("\n=== Simulating Deposit ===\n");

  const wlfiAmount = ethers.parseEther("846.208891978872800259");
  const usd1Amount = ethers.parseEther("38.763765576700980129");

  console.log("Amounts:");
  console.log("  WLFI:", ethers.formatEther(wlfiAmount));
  console.log("  USD1:", ethers.formatEther(usd1Amount));

  // Check vault state
  const paused = await vault.paused();
  const maxSupply = await vault.maxTotalSupply();
  const currentSupply = await vault.totalSupply();

  console.log("\nVault State:");
  console.log("  Paused:", paused ? "❌ YES" : "✅ No");
  console.log("  Max Supply:", ethers.formatEther(maxSupply));
  console.log("  Current Supply:", ethers.formatEther(currentSupply));

  // Check allowances
  const wlfiAllowance = await wlfi.allowance(USER, VAULT_FINAL);
  const usd1Allowance = await usd1.allowance(USER, VAULT_FINAL);

  console.log("\nAllowances:");
  console.log("  WLFI:", ethers.formatEther(wlfiAllowance));
  console.log("  Needed:", ethers.formatEther(wlfiAmount));
  console.log("  Sufficient:", wlfiAllowance >= wlfiAmount ? "✅" : "❌");
  
  console.log("\n  USD1:", ethers.formatEther(usd1Allowance));
  console.log("  Needed:", ethers.formatEther(usd1Amount));
  console.log("  Sufficient:", usd1Allowance >= usd1Amount ? "✅" : "❌");

  // Check balances
  const wlfiBalance = await wlfi.balanceOf(USER);
  const usd1Balance = await usd1.balanceOf(USER);

  console.log("\nBalances:");
  console.log("  WLFI:", ethers.formatEther(wlfiBalance));
  console.log("  Sufficient:", wlfiBalance >= wlfiAmount ? "✅" : "❌ INSUFFICIENT!");
  
  console.log("\n  USD1:", ethers.formatEther(usd1Balance));
  console.log("  Sufficient:", usd1Balance >= usd1Amount ? "✅" : "❌ INSUFFICIENT!");

  // Try preview
  try {
    const [shares, usdValue] = await vault.previewDepositDual(wlfiAmount, usd1Amount);
    console.log("\nPreview:");
    console.log("  Shares:", ethers.formatEther(shares));
    console.log("  USD Value:", ethers.formatEther(usdValue));
    console.log("  ✅ Preview works");
  } catch (e: any) {
    console.log("\n❌ Preview failed:", e.message);
  }
}

main().catch(console.error);

