import { ethers } from "hardhat";

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  💎 DEPOSITING TO NEW VAULT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [owner] = await ethers.getSigners();
  const NEW_VAULT = "0x32a2544De7a644833fE7659dF95e5bC16E698d99";
  
  const vault = await ethers.getContractAt("EagleOVault", NEW_VAULT);
  const WLFI = await ethers.getContractAt("IERC20", "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6");
  const USD1 = await ethers.getContractAt("IERC20", "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d");

  // Check balances
  const wlfiBalance = await WLFI.balanceOf(owner.address);
  const usd1Balance = await USD1.balanceOf(owner.address);

  console.log("Your wallet:");
  console.log("  WLFI:", ethers.formatEther(wlfiBalance));
  console.log("  USD1:", ethers.formatEther(usd1Balance));

  // Deposit all
  console.log("\n💎 Depositing ALL tokens to new vault...");
  console.log("  WLFI:", ethers.formatEther(wlfiBalance));
  console.log("  USD1:", ethers.formatEther(usd1Balance));

  const tx = await vault.depositDual(
    wlfiBalance,
    usd1Balance,
    owner.address,
    { gasLimit: 500000 }
  );

  console.log("\n  📝 Transaction sent:", tx.hash);
  console.log("  ⏳ Waiting for confirmation...");

  const receipt = await tx.wait();

  console.log("\n✅ Deposit complete!");
  console.log("  Gas used:", receipt?.gasUsed?.toString());

  // Check new shares
  const shares = await vault.balanceOf(owner.address);
  console.log("\n💰 Your vEAGLE shares:", ethers.formatEther(shares));

  const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
  console.log("\nVault now holds:");
  console.log("  WLFI:", ethers.formatEther(vaultWlfi));
  console.log("  USD1:", ethers.formatEther(vaultUsd1));

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ✅ DEPOSIT SUCCESSFUL!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("Now deploy to Charm:");
  console.log("  export VAULT_ADDRESS=0x32a2544De7a644833fE7659dF95e5bC16E698d99");
  console.log("  export STRATEGY_ADDRESS=0xF13dFf269D938cBC66B195477D56b813c8692d8A");
  console.log("  npx hardhat run scripts/deploy-to-charm.ts --network ethereum\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });

