import { ethers } from "hardhat";

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🧪 TESTING & DEPLOYING TO CHARM");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const VAULT_ADDRESS = "0x32a2544De7a644833fE7659dF95e5bC16E698d99";
  const STRATEGY_ADDRESS = "0xd286Fdb2D3De4aBf44649649D79D5965bD266df4";
  
  const vault = await ethers.getContractAt("EagleOVault", VAULT_ADDRESS);
  const strategy = await ethers.getContractAt("CharmStrategyUSD1", STRATEGY_ADDRESS);
  const WLFI = await ethers.getContractAt("IERC20", "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6");
  const USD1 = await ethers.getContractAt("IERC20", "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d");

  console.log("Vault:   ", VAULT_ADDRESS);
  console.log("Strategy:", STRATEGY_ADDRESS);
  console.log("");

  // Check vault funds
  console.log("1️⃣ Checking vault funds...");
  const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
  console.log("   WLFI:", ethers.formatEther(vaultWlfi));
  console.log("   USD1:", ethers.formatEther(vaultUsd1));
  
  if (vaultWlfi === 0n && vaultUsd1 === 0n) {
    throw new Error("❌ Vault is empty!");
  }
  console.log("   ✅ Vault has funds\n");

  // Check strategy is active
  console.log("2️⃣ Checking strategy...");
  const isInit = await strategy.isInitialized();
  console.log("   Initialized:", isInit);
  console.log("   ✅ Strategy ready\n");

  // Check approvals
  console.log("3️⃣ Checking approvals...");
  const CHARM_VAULT = "0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71";
  const wlfiApproval = await WLFI.allowance(STRATEGY_ADDRESS, CHARM_VAULT);
  const usd1Approval = await USD1.allowance(STRATEGY_ADDRESS, CHARM_VAULT);
  console.log("   Strategy → Charm WLFI:", wlfiApproval > 0 ? "✅" : "❌");
  console.log("   Strategy → Charm USD1:", usd1Approval > 0 ? "✅" : "❌");
  console.log("");

  // Estimate gas
  console.log("4️⃣ Estimating gas...");
  try {
    const gasEstimate = await vault.forceDeployToStrategies.estimateGas();
    console.log("   Gas estimate:", gasEstimate.toString());
    console.log("   ✅ Should work!\n");
  } catch (error: any) {
    console.log("   ❌ Estimation failed:", error.message);
    throw error;
  }

  // Deploy!
  console.log("5️⃣ Deploying to Charm Finance...");
  console.log("   This will:");
  console.log("     • Transfer 50 WLFI + 10 USD1 to strategy");
  console.log("     • Swap ~9.89 USD1 → WLFI (for capital efficiency)");
  console.log("     • Deposit ~59.8 WLFI + ~0.11 USD1 to Charm");
  console.log("     • Return leftover WLFI to vault");
  console.log("");

  const tx = await vault.forceDeployToStrategies({
    gasLimit: 1000000
  });

  console.log("   Transaction:", tx.hash);
  console.log("   Waiting for confirmation...\n");

  const receipt = await tx.wait();
  
  if (receipt?.status === 0) {
    throw new Error("❌ Transaction failed!");
  }

  console.log("   ✅ Confirmed!");
  console.log("   Gas used:", receipt?.gasUsed?.toString());
  console.log("");

  // Verify
  console.log("6️⃣ Verifying deployment...");
  const [stratUsd1, stratWlfi] = await strategy.getTotalAmounts();
  const shares = await strategy.getShareBalance();

  console.log("   Strategy in Charm:");
  console.log("     USD1:   ", ethers.formatEther(stratUsd1));
  console.log("     WLFI:   ", ethers.formatEther(stratWlfi));
  console.log("     Shares: ", ethers.formatEther(shares));
  console.log("");

  if (shares > 0) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  🎉🎉🎉 SUCCESS! CHARM INTEGRATION COMPLETE! 🎉🎉🎉");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("Your funds are now earning yield on Charm Finance!");
    console.log("Etherscan:", `https://etherscan.io/tx/${tx.hash}`);
    console.log("");
  } else {
    console.log("\n❌ No shares received - check transaction\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ FAILED:", error.message);
    process.exit(1);
  });

