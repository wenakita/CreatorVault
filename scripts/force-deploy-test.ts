import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC";
const STRATEGY_ADDRESS = "0x0Ba80Ce1c8e4487C9EeA179150D09Ec2cbCb5Aa1";
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e";

async function main() {
  console.log("🚀 Force Deploy to Strategy (Bypass Interval)\n");

  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("EagleOVaultV2Hybrid", VAULT_ADDRESS);
  const wlfi = await ethers.getContractAt("IERC20", WLFI_ADDRESS);
  const usd1 = await ethers.getContractAt("IERC20", USD1_ADDRESS);
  const meagle = await ethers.getContractAt("IERC20", MEAGLE_ADDRESS);

  console.log("📊 BEFORE Force Deploy:");
  console.log("  ═══════════════════════════════════════");
  
  const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
  const strategyWlfi = await wlfi.balanceOf(STRATEGY_ADDRESS);
  const strategyUsd1 = await usd1.balanceOf(STRATEGY_ADDRESS);
  const strategyMeagle = await meagle.balanceOf(STRATEGY_ADDRESS);
  
  console.log("  Vault has (idle):");
  console.log("    WLFI:", ethers.formatEther(vaultWlfi));
  console.log("    USD1:", ethers.formatEther(vaultUsd1));
  console.log("    Total:", ethers.formatEther(vaultWlfi + vaultUsd1));
  
  console.log("\n  Strategy:");
  console.log("    Idle WLFI:", ethers.formatEther(strategyWlfi));
  console.log("    Idle USD1:", ethers.formatEther(strategyUsd1));
  console.log("    MEAGLE:", ethers.formatEther(strategyMeagle));
  console.log("  ═══════════════════════════════════════");

  // Force deploy
  console.log("\n🚀 Calling forceDeployToStrategies()...");
  console.log("  This will:");
  console.log("  1. Send 70% of idle funds to strategy");
  console.log("  2. Strategy will auto-rebalance");
  console.log("  3. Strategy will swap to match Charm's 92/8 ratio");
  console.log("  4. Deposit to Charm");
  
  const tx = await vault.forceDeployToStrategies({ gasLimit: 2000000 });
  console.log("\n  Transaction:", tx.hash);
  const receipt = await tx.wait();
  console.log("  ✅ Confirmed! Gas:", receipt.gasUsed.toString());

  // Check AFTER
  console.log("\n📊 AFTER Force Deploy:");
  console.log("  ═══════════════════════════════════════");
  
  const [vaultWlfiAfter, vaultUsd1After] = await vault.getVaultBalances();
  const strategyWlfiAfter = await wlfi.balanceOf(STRATEGY_ADDRESS);
  const strategyUsd1After = await usd1.balanceOf(STRATEGY_ADDRESS);
  const strategyMeagleAfter = await meagle.balanceOf(STRATEGY_ADDRESS);
  
  console.log("  Vault has (idle):");
  console.log("    WLFI:", ethers.formatEther(vaultWlfiAfter), `(was ${ethers.formatEther(vaultWlfi)})`);
  console.log("    USD1:", ethers.formatEther(vaultUsd1After), `(was ${ethers.formatEther(vaultUsd1)})`);
  
  console.log("\n  Strategy:");
  console.log("    Idle WLFI:", ethers.formatEther(strategyWlfiAfter), `(was ${ethers.formatEther(strategyWlfi)})`);
  console.log("    Idle USD1:", ethers.formatEther(strategyUsd1After), `(was ${ethers.formatEther(strategyUsd1)})`);
  console.log("    MEAGLE:", ethers.formatEther(strategyMeagleAfter), `(was ${ethers.formatEther(strategyMeagle)})`);
  
  const meagleIncrease = strategyMeagleAfter - strategyMeagle;
  const idleWlfiInStrategy = strategyWlfiAfter - strategyWlfi;
  const idleUsd1InStrategy = strategyUsd1After - strategyUsd1;
  
  console.log("\n  Changes:");
  console.log("    MEAGLE increase:", ethers.formatEther(meagleIncrease));
  console.log("    Idle WLFI in strategy:", ethers.formatEther(idleWlfiInStrategy));
  console.log("    Idle USD1 in strategy:", ethers.formatEther(idleUsd1InStrategy));
  console.log("  ═══════════════════════════════════════");

  // Analysis
  console.log("\n🔍 Analysis:");
  console.log("  ═══════════════════════════════════════");
  
  if (meagleIncrease > 0n) {
    console.log("  ✅ SUCCESS! Deposited to Charm!");
    console.log("    MEAGLE increased by:", ethers.formatEther(meagleIncrease));
  }
  
  if (idleWlfiInStrategy < 1n && idleUsd1InStrategy < 1n) {
    console.log("  ✅ No stuck tokens!");
    console.log("  ✅ Rebalancing logic FIXED and working!");
  } else {
    console.log("  ⚠️  Some tokens idle in strategy:");
    console.log("    WLFI:", ethers.formatEther(idleWlfiInStrategy));
    console.log("    USD1:", ethers.formatEther(idleUsd1InStrategy));
  }
  
  console.log("  ═══════════════════════════════════════");
}

main().catch(console.error);

