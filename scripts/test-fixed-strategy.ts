import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC";
const NEW_STRATEGY = "0x0Ba80Ce1c8e4487C9EeA179150D09Ec2cbCb5Aa1";
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e";

async function main() {
  console.log("🧪 Testing FIXED SmartCharmStrategy V2\n");

  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("EagleOVaultV2Hybrid", VAULT_ADDRESS);
  const wlfi = await ethers.getContractAt("IERC20", WLFI_ADDRESS);
  const usd1 = await ethers.getContractAt("IERC20", USD1_ADDRESS);
  const meagle = await ethers.getContractAt("IERC20", MEAGLE_ADDRESS);

  console.log("📊 BEFORE Deposit:");
  console.log("  ═══════════════════════════════════════");
  
  const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
  const strategyWlfi = await wlfi.balanceOf(NEW_STRATEGY);
  const strategyUsd1 = await usd1.balanceOf(NEW_STRATEGY);
  const strategyMeagle = await meagle.balanceOf(NEW_STRATEGY);
  const yourEagle = await vault.balanceOf(signer.address);
  
  console.log("  Vault:");
  console.log("    WLFI:", ethers.formatEther(vaultWlfi));
  console.log("    USD1:", ethers.formatEther(vaultUsd1));
  console.log("\n  Strategy (idle tokens):");
  console.log("    WLFI:", ethers.formatEther(strategyWlfi));
  console.log("    USD1:", ethers.formatEther(strategyUsd1));
  console.log("    MEAGLE:", ethers.formatEther(strategyMeagle));
  console.log("\n  Your EAGLE:", ethers.formatEther(yourEagle));
  console.log("  ═══════════════════════════════════════");

  // Deposit
  console.log("\n🔄 Depositing 50 WLFI + 50 USD1...");
  console.log("  This will test the FIXED rebalancing logic!");
  
  const depositAmount = ethers.parseEther("50");
  
  console.log("\n  Approving...");
  let tx = await wlfi.approve(VAULT_ADDRESS, depositAmount);
  await tx.wait();
  tx = await usd1.approve(VAULT_ADDRESS, depositAmount);
  await tx.wait();
  console.log("  ✅ Approved");
  
  console.log("\n  Depositing...");
  tx = await vault.depositDual(depositAmount, depositAmount, signer.address, { gasLimit: 2000000 });
  console.log("  Transaction:", tx.hash);
  const receipt = await tx.wait();
  console.log("  ✅ Confirmed! Gas:", receipt.gasUsed.toString());

  // Check AFTER
  console.log("\n📊 AFTER Deposit:");
  console.log("  ═══════════════════════════════════════");
  
  const [vaultWlfiAfter, vaultUsd1After] = await vault.getVaultBalances();
  const strategyWlfiAfter = await wlfi.balanceOf(NEW_STRATEGY);
  const strategyUsd1After = await usd1.balanceOf(NEW_STRATEGY);
  const strategyMeagleAfter = await meagle.balanceOf(NEW_STRATEGY);
  const yourEagleAfter = await vault.balanceOf(signer.address);
  const totalAssets = await vault.totalAssets();
  
  console.log("  Vault:");
  console.log("    WLFI:", ethers.formatEther(vaultWlfiAfter));
  console.log("    USD1:", ethers.formatEther(vaultUsd1After));
  console.log("\n  Strategy (idle tokens):");
  console.log("    WLFI:", ethers.formatEther(strategyWlfiAfter));
  console.log("    USD1:", ethers.formatEther(strategyUsd1After));
  console.log("    MEAGLE:", ethers.formatEther(strategyMeagleAfter));
  console.log("\n  Your EAGLE:", ethers.formatEther(yourEagleAfter));
  console.log("  Total Assets:", ethers.formatEther(totalAssets));
  console.log("  ═══════════════════════════════════════");

  // Analysis
  const idleWlfiInStrategy = strategyWlfiAfter - strategyWlfi;
  const idleUsd1InStrategy = strategyUsd1After - strategyUsd1;
  
  console.log("\n🔍 Analysis:");
  console.log("  ═══════════════════════════════════════");
  
  if (idleWlfiInStrategy > 10n || idleUsd1InStrategy > 10n) {
    console.log("  ⚠️  Still has unused tokens in strategy");
    console.log("    Unused WLFI:", ethers.formatEther(idleWlfiInStrategy));
    console.log("    Unused USD1:", ethers.formatEther(idleUsd1InStrategy));
    console.log("\n  This might mean:");
    console.log("  • Charm vault near capacity");
    console.log("  • Need to adjust swap logic further");
  } else {
    console.log("  ✅ No significant unused tokens!");
    console.log("  ✅ Rebalancing working correctly!");
    console.log("  ✅ All tokens properly deployed or returned!");
  }
  
  const meagleIncrease = strategyMeagleAfter - strategyMeagle;
  if (meagleIncrease > 0n) {
    console.log("\n  ✅ MEAGLE increased by:", ethers.formatEther(meagleIncrease));
    console.log("  ✅ Successfully deposited to Charm!");
  }
  
  console.log("  ═══════════════════════════════════════");
}

main().catch(console.error);

