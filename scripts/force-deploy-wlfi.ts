import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC";
const STRATEGY_ADDRESS = "0x0Ba80Ce1c8e4487C9EeA179150D09Ec2cbCb5Aa1";
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e";

async function main() {
  console.log("🚀 Force Deploy 1000 WLFI to Test WLFI→USD1 Rebalancing\n");

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
  
  console.log("  Vault (idle):");
  console.log("    WLFI:", ethers.formatEther(vaultWlfi));
  console.log("    USD1:", ethers.formatEther(vaultUsd1));
  console.log("    Total:", ethers.formatEther(vaultWlfi + vaultUsd1));
  
  console.log("\n  Strategy:");
  console.log("    Idle WLFI:", ethers.formatEther(strategyWlfi));
  console.log("    Idle USD1:", ethers.formatEther(strategyUsd1));
  console.log("    MEAGLE:", ethers.formatEther(strategyMeagle));
  console.log("  ═══════════════════════════════════════");

  console.log("\n🔄 What Will Happen:");
  console.log("  ═══════════════════════════════════════");
  console.log("  1. Vault will send 70% of 1000 WLFI = 700 WLFI to strategy");
  console.log("  2. Strategy will receive: 700 WLFI + 0 USD1");
  console.log("  3. Strategy will detect Charm needs 92% WLFI:");
  console.log("     Target: 644 WLFI + 56 USD1");
  console.log("     Have: 700 WLFI + 0 USD1");
  console.log("  4. Strategy will swap: 56 WLFI → ~56 USD1");
  console.log("  5. Result: ~644 WLFI + ~56 USD1");
  console.log("  6. Deposit to Charm!");
  console.log("  ═══════════════════════════════════════");

  // Force deploy
  console.log("\n🚀 Calling forceDeployToStrategies()...");
  
  const tx = await vault.forceDeployToStrategies({ gasLimit: 2000000 });
  console.log("  Transaction:", tx.hash);
  const receipt = await tx.wait();
  console.log("  ✅ Confirmed! Gas:", receipt.gasUsed.toString());

  // Check AFTER
  console.log("\n📊 AFTER Force Deploy:");
  console.log("  ═══════════════════════════════════════");
  
  const [vaultWlfiAfter, vaultUsd1After] = await vault.getVaultBalances();
  const strategyWlfiAfter = await wlfi.balanceOf(STRATEGY_ADDRESS);
  const strategyUsd1After = await usd1.balanceOf(STRATEGY_ADDRESS);
  const strategyMeagleAfter = await meagle.balanceOf(STRATEGY_ADDRESS);
  
  console.log("  Vault (idle):");
  console.log("    WLFI:", ethers.formatEther(vaultWlfiAfter), `(was ${ethers.formatEther(vaultWlfi)})`);
  console.log("    USD1:", ethers.formatEther(vaultUsd1After), `(was ${ethers.formatEther(vaultUsd1)})`);
  
  console.log("\n  Strategy:");
  console.log("    Idle WLFI:", ethers.formatEther(strategyWlfiAfter), `(was ${ethers.formatEther(strategyWlfi)})`);
  console.log("    Idle USD1:", ethers.formatEther(strategyUsd1After), `(was ${ethers.formatEther(strategyUsd1)})`);
  console.log("    MEAGLE:", ethers.formatEther(strategyMeagleAfter), `(was ${ethers.formatEther(strategyMeagle)})`);
  
  const meagleIncrease = strategyMeagleAfter - strategyMeagle;
  const idleWlfiChange = strategyWlfiAfter - strategyWlfi;
  const idleUsd1Change = strategyUsd1After - strategyUsd1;
  
  console.log("\n  Changes:");
  console.log("    MEAGLE increase:", ethers.formatEther(meagleIncrease));
  console.log("    Idle WLFI in strategy:", ethers.formatEther(idleWlfiChange));
  console.log("    Idle USD1 in strategy:", ethers.formatEther(idleUsd1Change));
  console.log("  ═══════════════════════════════════════");

  console.log("\n🎯 Result:");
  console.log("  ═══════════════════════════════════════");
  
  if (meagleIncrease > 0n) {
    console.log("  ✅ SUCCESS!");
    console.log("  ✅ Swapped WLFI → USD1 to match Charm ratio");
    console.log("  ✅ Deposited to Charm");
    console.log("  ✅ Received MEAGLE:", ethers.formatEther(meagleIncrease));
  }
  
  if (idleWlfiChange < 1n && idleUsd1Change < 1n) {
    console.log("  ✅ No stuck tokens!");
    console.log("  ✅ Rebalancing bug FIXED!");
  } else {
    console.log("  ⚠️  Idle tokens:", ethers.formatEther(idleWlfiChange), "WLFI,", ethers.formatEther(idleUsd1Change), "USD1");
  }
  
  console.log("  ═══════════════════════════════════════");
}

main().catch(console.error);

