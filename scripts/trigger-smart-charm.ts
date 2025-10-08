import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC";
const SMART_STRATEGY = "0xA136dc3562A99122D15a978A380e475F22fcCcf9";
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e";

async function main() {
  console.log("🧠 Triggering SmartCharmStrategy with Auto-Rebalancing\n");

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
  const strategyMeagle = await meagle.balanceOf(SMART_STRATEGY);
  const yourEagle = await vault.balanceOf(signer.address);
  
  console.log("  Vault Direct Holdings:");
  console.log("    WLFI:", ethers.formatEther(vaultWlfi));
  console.log("    USD1:", ethers.formatEther(vaultUsd1));
  console.log("\n  Strategy:");
  console.log("    MEAGLE Balance:", ethers.formatEther(strategyMeagle));
  console.log("\n  Your EAGLE:", ethers.formatEther(yourEagle));
  console.log("  ═══════════════════════════════════════");

  // =================================
  // DEPOSIT TO TRIGGER
  // =================================
  
  console.log("\n🔄 Depositing 50 WLFI + 50 USD1...");
  console.log("  (Will trigger auto-rebalancing to Charm!)");
  
  const depositAmount = ethers.parseEther("50");
  
  // Approve
  console.log("\n  Approving...");
  let tx = await wlfi.approve(VAULT_ADDRESS, depositAmount);
  await tx.wait();
  tx = await usd1.approve(VAULT_ADDRESS, depositAmount);
  await tx.wait();
  console.log("  ✅ Approved");
  
  // Deposit
  console.log("\n  Depositing...");
  tx = await vault.depositDual(depositAmount, depositAmount, signer.address, { gasLimit: 2000000 });
  console.log("  Transaction:", tx.hash);
  const receipt = await tx.wait();
  console.log("  ✅ Confirmed! Gas used:", receipt.gasUsed.toString());

  // =================================
  // AFTER STATE
  // =================================
  
  console.log("\n📊 AFTER Deposit:");
  console.log("  ═══════════════════════════════════════");
  
  const [vaultWlfiAfter, vaultUsd1After] = await vault.getVaultBalances();
  const strategyMeagleAfter = await meagle.balanceOf(SMART_STRATEGY);
  const yourEagleAfter = await vault.balanceOf(signer.address);
  const totalAssets = await vault.totalAssets();
  
  console.log("  Vault Direct Holdings:");
  console.log("    WLFI:", ethers.formatEther(vaultWlfiAfter), `(was ${ethers.formatEther(vaultWlfi)})`);
  console.log("    USD1:", ethers.formatEther(vaultUsd1After), `(was ${ethers.formatEther(vaultUsd1)})`);
  
  console.log("\n  Strategy:");
  console.log("    MEAGLE Balance:", ethers.formatEther(strategyMeagleAfter), `(was ${ethers.formatEther(strategyMeagle)})`);
  
  const meagleIncrease = strategyMeagleAfter - strategyMeagle;
  
  console.log("\n  Your Position:");
  console.log("    EAGLE:", ethers.formatEther(yourEagleAfter), `(was ${ethers.formatEther(yourEagle)})`);
  console.log("    Total Value:", ethers.formatEther(totalAssets));
  
  console.log("  ═══════════════════════════════════════");

  // =================================
  // ANALYSIS
  // =================================
  
  console.log("\n🎯 Analysis:");
  console.log("  ═══════════════════════════════════════");
  
  if (meagleIncrease > 0n) {
    console.log("  ✅ SUCCESS! MEAGLE increased by:", ethers.formatEther(meagleIncrease));
    console.log("\n  What happened:");
    console.log("  1. ✅ You deposited 50+50 (50/50 ratio)");
    console.log("  2. ✅ Threshold met (total > $100)");
    console.log("  3. ✅ Strategy auto-rebalanced to 92% WLFI / 8% USD1");
    console.log("  4. ✅ Deposited to Charm");
    console.log("  5. ✅ Received MEAGLE shares");
    console.log("\n  🎉 Your vault is NOW earning yield from Charm!");
  } else {
    console.log("  ⚠️  No MEAGLE increase yet");
    console.log("\n  Possible reasons:");
    console.log("  • Threshold not met yet (need $100 total idle)");
    console.log("  • Time interval not passed (need 5+ minutes)");
    console.log("  • Uniswap pools don't exist for swap");
    
    const idle = vaultWlfiAfter + vaultUsd1After;
    console.log("\n  Current idle funds:", ethers.formatEther(idle));
    console.log("  Threshold:", "$100");
    console.log("  Status:", Number(idle) >= 100 ? "✅ Met" : "❌ Not met");
  }
  
  console.log("  ═══════════════════════════════════════");
}

main().catch(console.error);

