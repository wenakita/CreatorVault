import { ethers } from "hardhat";

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  💰 WITHDRAWING FROM OLD VAULT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [owner] = await ethers.getSigners();
  console.log("Your address:", owner.address);

  const OLD_VAULT = "0x244b73dC14C01c350C04EAd7e1D8C3FeFeA6AF58";
  const vault = await ethers.getContractAt("EagleOVault", OLD_VAULT);

  console.log("Old vault:", OLD_VAULT);

  // Check your balance
  const yourShares = await vault.balanceOf(owner.address);
  console.log("\nYour vEAGLE shares:", ethers.formatEther(yourShares));

  if (yourShares === 0n) {
    console.log("❌ You have no shares in this vault!\n");
    return;
  }

  // Check vault balances
  const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
  console.log("\nVault holdings:");
  console.log("  WLFI:", ethers.formatEther(vaultWlfi));
  console.log("  USD1:", ethers.formatEther(vaultUsd1));

  // Withdraw all
  console.log("\n🔄 Withdrawing ALL shares...");
  console.log("  Shares to burn:", ethers.formatEther(yourShares));

  const tx = await vault.withdrawDual(
    yourShares,
    owner.address,
    { gasLimit: 500000 }
  );

  console.log("\n  📝 Transaction sent:", tx.hash);
  console.log("  ⏳ Waiting for confirmation...");

  const receipt = await tx.wait();

  console.log("\n✅ Withdrawal complete!");
  console.log("  Gas used:", receipt?.gasUsed?.toString());

  // Check new balances
  const WLFI = await ethers.getContractAt("IERC20", "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6");
  const USD1 = await ethers.getContractAt("IERC20", "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d");

  const wlfiBalance = await WLFI.balanceOf(owner.address);
  const usd1Balance = await USD1.balanceOf(owner.address);

  console.log("\n💰 Your new wallet balances:");
  console.log("  WLFI:", ethers.formatEther(wlfiBalance));
  console.log("  USD1:", ethers.formatEther(usd1Balance));

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ✅ FUNDS RECOVERED!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("Now deposit to the NEW vault:");
  console.log("  Vault: 0x32a2544De7a644833fE7659dF95e5bC16E698d99");
  console.log("  Visit: https://test.47eagle.com (hard refresh)\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });

