import { ethers } from "hardhat";

/**
 * Complete test and deployment script
 * Tests everything step by step and deploys to Charm
 */

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🧪 COMPREHENSIVE TEST & DEPLOYMENT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [owner] = await ethers.getSigners();
  
  // Current addresses
  const VAULT_ADDRESS = "0x32a2544De7a644833fE7659dF95e5bC16E698d99";
  const STRATEGY_ADDRESS = "0x8d32D6aEd976dC80880f3eF708ecB2169FEe26a8";
  
  // Get contracts
  const vault = await ethers.getContractAt("EagleOVault", VAULT_ADDRESS);
  const strategy = await ethers.getContractAt("CharmStrategyUSD1", STRATEGY_ADDRESS);
  const WLFI = await ethers.getContractAt("IERC20", "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6");
  const USD1 = await ethers.getContractAt("IERC20", "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d");

  console.log("Testing Vault:", VAULT_ADDRESS);
  console.log("Testing Strategy:", STRATEGY_ADDRESS);
  console.log("");

  // TEST 1: Check vault has funds
  console.log("1️⃣ Checking vault funds...");
  const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
  console.log("   WLFI:", ethers.formatEther(vaultWlfi));
  console.log("   USD1:", ethers.formatEther(vaultUsd1));
  
  if (vaultWlfi === 0n && vaultUsd1 === 0n) {
    throw new Error("❌ Vault is empty!");
  }
  console.log("   ✅ Vault has funds\n");

  // TEST 2: Check strategy is added
  console.log("2️⃣ Checking strategy configuration...");
  const strategies = await vault.getStrategies();
  const isActive = strategies[0].some((addr: string) => 
    addr.toLowerCase() === STRATEGY_ADDRESS.toLowerCase()
  );
  
  if (!isActive) {
    throw new Error("❌ Strategy not added to vault!");
  }
  console.log("   ✅ Strategy active\n");

  // TEST 3: Check approvals
  console.log("3️⃣ Checking approvals...");
  
  // Vault → Strategy
  const wlfiVaultToStrat = await WLFI.allowance(VAULT_ADDRESS, STRATEGY_ADDRESS);
  const usd1VaultToStrat = await USD1.allowance(VAULT_ADDRESS, STRATEGY_ADDRESS);
  console.log("   Vault → Strategy:");
  console.log("     WLFI:", wlfiVaultToStrat > 0 ? "✅" : "❌");
  console.log("     USD1:", usd1VaultToStrat > 0 ? "✅" : "❌");

  // Strategy → Charm
  const CHARM_VAULT = "0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71";
  const wlfiStratToCharm = await WLFI.allowance(STRATEGY_ADDRESS, CHARM_VAULT);
  const usd1StratToCharm = await USD1.allowance(STRATEGY_ADDRESS, CHARM_VAULT);
  console.log("   Strategy → Charm:");
  console.log("     WLFI:", wlfiStratToCharm > 0 ? "✅" : "❌");
  console.log("     USD1:", usd1StratToCharm > 0 ? "✅" : "❌");

  if (wlfiStratToCharm === 0n || usd1StratToCharm === 0n) {
    throw new Error("❌ Strategy approvals not set! Run strategy.initializeApprovals()");
  }
  console.log("   ✅ All approvals set\n");

  // TEST 4: Check Charm vault
  console.log("4️⃣ Checking Charm vault...");
  const charmABI = ["function getTotalAmounts() view returns (uint256, uint256)"];
  const charm = await ethers.getContractAt(charmABI, CHARM_VAULT);
  const [charmUsd1, charmWlfi] = await charm.getTotalAmounts();
  console.log("   Charm holdings:");
  console.log("     USD1:", ethers.formatEther(charmUsd1));
  console.log("     WLFI:", ethers.formatEther(charmWlfi));
  
  if (charmWlfi > 0) {
    const ratio = Number(charmUsd1) / Number(charmWlfi);
    console.log("     Ratio:", (ratio * 100).toFixed(2), "% USD1");
  }
  console.log("   ✅ Charm vault accessible\n");

  // TEST 5: Simulate deployment
  console.log("5️⃣ Estimating gas for deployment...");
  try {
    const gasEstimate = await vault.forceDeployToStrategies.estimateGas();
    console.log("   Gas estimate:", gasEstimate.toString());
    console.log("   ✅ Should work!\n");
  } catch (error: any) {
    console.log("   ❌ Gas estimation failed:", error.message);
    console.log("   This means the transaction will likely revert.\n");
    throw error;
  }

  // DEPLOY
  console.log("6️⃣ Deploying to Charm...");
  console.log("   This will:");
  console.log("     • Transfer tokens vault → strategy");
  console.log("     • Swap to match Charm ratio");
  console.log("     • Deposit to Charm");
  console.log("");

  const tx = await vault.forceDeployToStrategies({
    gasLimit: 1000000
  });

  console.log("   Transaction sent:", tx.hash);
  console.log("   Waiting for confirmation...\n");

  const receipt = await tx.wait();
  
  if (receipt?.status === 0) {
    throw new Error("❌ Transaction failed!");
  }

  console.log("   ✅ Transaction confirmed!");
  console.log("   Gas used:", receipt?.gasUsed?.toString());

  // VERIFY
  console.log("\n7️⃣ Verifying deployment...");
  const [stratUsd1, stratWlfi] = await strategy.getTotalAmounts();
  const shares = await strategy.getShareBalance();

  console.log("   Strategy in Charm:");
  console.log("     USD1:", ethers.formatEther(stratUsd1));
  console.log("     WLFI:", ethers.formatEther(stratWlfi));
  console.log("     Shares:", ethers.formatEther(shares));

  if (shares > 0) {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  🎉🎉🎉 SUCCESS! CHARM INTEGRATION COMPLETE! 🎉🎉🎉");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("Your funds are now earning yield on Charm Finance!");
    console.log("View on Etherscan:", `https://etherscan.io/tx/${tx.hash}\n`);
  } else {
    console.log("\n❌ No Charm shares received - something went wrong\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("  ❌ TEST FAILED");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.error("Error:", error.message);
    console.error("\nThis helps us identify exactly what's wrong!");
    console.error("");
    process.exit(1);
  });

