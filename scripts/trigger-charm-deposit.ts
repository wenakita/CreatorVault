import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC";
const STRATEGY_ADDRESS = "0xB62d4675762DbE48bB82a3187E3317c3078ec978"; // From previous test
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e";

async function main() {
  console.log("🎯 Trigger Charm Deployment Test\n");

  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("EagleOVaultV2Hybrid", VAULT_ADDRESS);
  const wlfi = await ethers.getContractAt("IERC20", WLFI_ADDRESS);
  const usd1 = await ethers.getContractAt("IERC20", USD1_ADDRESS);
  const meagle = await ethers.getContractAt("IERC20", MEAGLE_ADDRESS);

  // Check current state
  console.log("📊 BEFORE Deposit:");
  console.log("  ═══════════════════════════════════════");
  const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
  const totalAssets = await vault.totalAssets();
  const strategyMeagle = await meagle.balanceOf(STRATEGY_ADDRESS);
  
  console.log("  Vault Direct Holdings:");
  console.log("    WLFI:", ethers.formatEther(vaultWlfi));
  console.log("    USD1:", ethers.formatEther(vaultUsd1));
  console.log("  Total Assets:", ethers.formatEther(totalAssets));
  console.log("\n  Strategy MEAGLE Balance:", ethers.formatEther(strategyMeagle));
  console.log("  ═══════════════════════════════════════");

  // Deposit enough to trigger deployment (need >100 total)
  // Current: 20+20 = 40
  // Need: 100 total
  // Deposit: 50+50 = 100 more → total 140 > threshold
  
  const depositAmount = ethers.parseEther("50");
  
  console.log("\n🔄 Depositing 50 WLFI + 50 USD1...");
  console.log("  (Total idle will be 70+70 = 140 > $100 threshold)");
  console.log("  This SHOULD trigger deployment to Charm!");
  
  // Approve
  console.log("\n  Approving...");
  let tx = await wlfi.approve(VAULT_ADDRESS, depositAmount);
  await tx.wait();
  tx = await usd1.approve(VAULT_ADDRESS, depositAmount);
  await tx.wait();
  console.log("  ✅ Approved");
  
  // Deposit
  console.log("\n  Depositing...");
  tx = await vault.depositDual(depositAmount, depositAmount, signer.address, { gasLimit: 1000000 });
  console.log("  Transaction:", tx.hash);
  await tx.wait();
  console.log("  ✅ Confirmed!");

  // Check AFTER state
  console.log("\n📊 AFTER Deposit:");
  console.log("  ═══════════════════════════════════════");
  const [vaultWlfiAfter, vaultUsd1After] = await vault.getVaultBalances();
  const totalAssetsAfter = await vault.totalAssets();
  const strategyMeagleAfter = await meagle.balanceOf(STRATEGY_ADDRESS);
  
  console.log("  Vault Direct Holdings:");
  console.log("    WLFI:", ethers.formatEther(vaultWlfiAfter), `(was ${ethers.formatEther(vaultWlfi)})`);
  console.log("    USD1:", ethers.formatEther(vaultUsd1After), `(was ${ethers.formatEther(vaultUsd1)})`);
  
  console.log("\n  Strategy MEAGLE Balance:");
  console.log("    MEAGLE:", ethers.formatEther(strategyMeagleAfter), `(was ${ethers.formatEther(strategyMeagle)})`);
  
  const meagleIncrease = strategyMeagleAfter - strategyMeagle;
  if (meagleIncrease > 0n) {
    console.log("    ✅ MEAGLE increased by:", ethers.formatEther(meagleIncrease));
    console.log("    ✅ CHARM DEPLOYMENT SUCCESSFUL!");
  } else {
    console.log("    ⚠️  No MEAGLE increase - deployment didn't trigger");
    console.log("    Possible reasons:");
    console.log("      - Threshold not met yet");
    console.log("      - Time interval not passed");
    console.log("      - Strategy not active");
  }
  
  console.log("\n  Total Assets:", ethers.formatEther(totalAssetsAfter), `(was ${ethers.formatEther(totalAssets)})`);
  console.log("  ═══════════════════════════════════════");

  // Show breakdown
  const directValue = vaultWlfiAfter + vaultUsd1After;
  const strategyValue = totalAssetsAfter - directValue;
  
  console.log("\n💰 Value Breakdown:");
  console.log("  ═══════════════════════════════════════");
  console.log("  Direct (in vault):", ethers.formatEther(directValue));
  console.log("  Strategy (in Charm):", ethers.formatEther(strategyValue));
  console.log("  Total:", ethers.formatEther(totalAssetsAfter));
  console.log("  ═══════════════════════════════════════");
}

main().catch(console.error);

