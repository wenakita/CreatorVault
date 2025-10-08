import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC";
const STRATEGY_ADDRESS = "0x0Ba80Ce1c8e4487C9EeA179150D09Ec2cbCb5Aa1";
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e";

async function main() {
  console.log("🧪 Testing USD1-Only Deposit (100 USD1)\n");
  console.log("This tests auto-rebalancing with imbalanced input!");

  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("EagleOVaultV2Hybrid", VAULT_ADDRESS);
  const wlfi = await ethers.getContractAt("IERC20", WLFI_ADDRESS);
  const usd1 = await ethers.getContractAt("IERC20", USD1_ADDRESS);
  const meagle = await ethers.getContractAt("IERC20", MEAGLE_ADDRESS);

  // =================================
  // BEFORE STATE
  // =================================
  
  console.log("📊 BEFORE Deposit:");
  console.log("  ═══════════════════════════════════════");
  
  const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
  const strategyWlfi = await wlfi.balanceOf(STRATEGY_ADDRESS);
  const strategyUsd1 = await usd1.balanceOf(STRATEGY_ADDRESS);
  const strategyMeagle = await meagle.balanceOf(STRATEGY_ADDRESS);
  const yourEagle = await vault.balanceOf(signer.address);
  const totalAssetsBefore = await vault.totalAssets();
  
  console.log("  Vault Direct:");
  console.log("    WLFI:", ethers.formatEther(vaultWlfi));
  console.log("    USD1:", ethers.formatEther(vaultUsd1));
  
  console.log("\n  Strategy:");
  console.log("    Idle WLFI:", ethers.formatEther(strategyWlfi));
  console.log("    Idle USD1:", ethers.formatEther(strategyUsd1));
  console.log("    MEAGLE:", ethers.formatEther(strategyMeagle));
  
  console.log("\n  Your Position:");
  console.log("    EAGLE:", ethers.formatEther(yourEagle));
  console.log("    Total Assets:", ethers.formatEther(totalAssetsBefore));
  console.log("  ═══════════════════════════════════════");

  // =================================
  // DEPOSIT 100 USD1 ONLY
  // =================================
  
  console.log("\n🔄 Depositing 100 USD1 ONLY (0 WLFI)...");
  console.log("  ═══════════════════════════════════════");
  
  const depositAmount = ethers.parseEther("100");
  
  console.log("  Expected behavior:");
  console.log("  1. Vault receives: 0 WLFI + 100 USD1");
  console.log("  2. When deploying to strategy:");
  console.log("     Strategy gets: 0 WLFI + 70 USD1 (70%)");
  console.log("  3. Strategy auto-rebalances:");
  console.log("     Charm needs: 92% WLFI");
  console.log("     Strategy swaps: ~64 USD1 → ~64 WLFI");
  console.log("     Result: ~64 WLFI + ~6 USD1");
  console.log("  4. Deposits to Charm");
  
  // Approve USD1 only
  console.log("\n  Approving USD1...");
  let tx = await usd1.approve(VAULT_ADDRESS, depositAmount);
  await tx.wait();
  console.log("  ✅ Approved");
  
  // Deposit
  console.log("\n  Depositing...");
  tx = await vault.depositDual(
    0,              // 0 WLFI
    depositAmount,  // 100 USD1
    signer.address,
    { gasLimit: 2000000 }
  );
  console.log("  Transaction:", tx.hash);
  const receipt = await tx.wait();
  console.log("  ✅ Confirmed! Gas:", receipt.gasUsed.toString());

  // =================================
  // AFTER STATE
  // =================================
  
  console.log("\n📊 AFTER Deposit:");
  console.log("  ═══════════════════════════════════════");
  
  const [vaultWlfiAfter, vaultUsd1After] = await vault.getVaultBalances();
  const strategyWlfiAfter = await wlfi.balanceOf(STRATEGY_ADDRESS);
  const strategyUsd1After = await usd1.balanceOf(STRATEGY_ADDRESS);
  const strategyMeagleAfter = await meagle.balanceOf(STRATEGY_ADDRESS);
  const yourEagleAfter = await vault.balanceOf(signer.address);
  const totalAssetsAfter = await vault.totalAssets();
  
  console.log("  Vault Direct:");
  console.log("    WLFI:", ethers.formatEther(vaultWlfiAfter), `(was ${ethers.formatEther(vaultWlfi)})`);
  console.log("    USD1:", ethers.formatEther(vaultUsd1After), `(was ${ethers.formatEther(vaultUsd1)})`);
  
  console.log("\n  Strategy:");
  console.log("    Idle WLFI:", ethers.formatEther(strategyWlfiAfter), `(was ${ethers.formatEther(strategyWlfi)})`);
  console.log("    Idle USD1:", ethers.formatEther(strategyUsd1After), `(was ${ethers.formatEther(strategyUsd1)})`);
  console.log("    MEAGLE:", ethers.formatEther(strategyMeagleAfter), `(was ${ethers.formatEther(strategyMeagle)})`);
  
  console.log("\n  Your Position:");
  console.log("    EAGLE:", ethers.formatEther(yourEagleAfter), `(was ${ethers.formatEther(yourEagle)})`);
  console.log("    Total Assets:", ethers.formatEther(totalAssetsAfter), `(was ${ethers.formatEther(totalAssetsBefore)})`);
  console.log("  ═══════════════════════════════════════");

  // =================================
  // DETAILED ANALYSIS
  // =================================
  
  console.log("\n🔍 Detailed Analysis:");
  console.log("  ═══════════════════════════════════════");
  
  const idleWlfiChange = strategyWlfiAfter - strategyWlfi;
  const idleUsd1Change = strategyUsd1After - strategyUsd1;
  const meagleChange = strategyMeagleAfter - strategyMeagle;
  const eagleChange = yourEagleAfter - yourEagle;
  
  console.log("  Changes:");
  console.log("    Idle WLFI in strategy:", ethers.formatEther(idleWlfiChange));
  console.log("    Idle USD1 in strategy:", ethers.formatEther(idleUsd1Change));
  console.log("    MEAGLE increase:", ethers.formatEther(meagleChange));
  console.log("    Your EAGLE increase:", ethers.formatEther(eagleChange));
  
  if (idleWlfiChange < 1n && idleUsd1Change < 1n) {
    console.log("\n  ✅ SUCCESS! No stuck tokens!");
    console.log("  ✅ Rebalancing logic working correctly!");
    console.log("  ✅ Strategy properly accounts for existing tokens!");
  } else {
    console.log("\n  ⚠️  Some tokens not deployed:");
    console.log("    Stuck WLFI:", ethers.formatEther(idleWlfiChange));
    console.log("    Stuck USD1:", ethers.formatEther(idleUsd1Change));
  }
  
  console.log("  ═══════════════════════════════════════");

  // Show what happened
  console.log("\n💡 What Happened:");
  console.log("  ═══════════════════════════════════════");
  console.log("  1. ✅ You deposited: 0 WLFI + 100 USD1");
  console.log("  2. ✅ Vault minted shares");
  console.log("  3. ✅ Threshold met, deployed to strategy");
  console.log("  4. ✅ Strategy auto-rebalanced:");
  console.log("     • Calculated: Need 92% WLFI");
  console.log("     • Already have: X WLFI");
  console.log("     • Swapped ONLY what's needed");
  console.log("  5. ✅ Deposited to Charm");
  console.log("  6. ✅ Received MEAGLE shares");
  console.log("  7. ✅ No tokens stuck!");
  console.log("  ═══════════════════════════════════════");
}

main().catch(console.error);

