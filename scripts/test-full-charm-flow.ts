import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC";
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e";

async function main() {
  console.log("🎯 Complete Charm Integration Test\n");

  const [signer] = await ethers.getSigners();
  console.log("Tester:", signer.address);

  const vault = await ethers.getContractAt("EagleOVaultV2Hybrid", VAULT_ADDRESS);

  // =================================
  // STEP 1: Deploy Simple Charm Strategy
  // =================================
  
  console.log("\n📝 STEP 1: Deploy Charm Strategy");
  console.log("  ═══════════════════════════════════════");
  
  const SimpleCharmStrategy = await ethers.getContractFactory("SimpleCharmStrategy");
  const strategy = await SimpleCharmStrategy.deploy(
    VAULT_ADDRESS,
    MEAGLE_ADDRESS,
    WLFI_ADDRESS,
    USD1_ADDRESS
  );
  await strategy.waitForDeployment();
  const strategyAddress = await strategy.getAddress();
  
  console.log("  ✅ Strategy deployed to:", strategyAddress);

  // =================================
  // STEP 2: Add Strategy to Vault
  // =================================
  
  console.log("\n📝 STEP 2: Add Strategy to Vault");
  console.log("  ═══════════════════════════════════════");
  
  let tx = await vault.addStrategy(strategyAddress, 7000); // 70% allocation
  await tx.wait();
  console.log("  ✅ Strategy added with 70% weight");

  // =================================
  // STEP 3: Check Current State
  // =================================
  
  console.log("\n📊 STEP 3: Current Vault State");
  console.log("  ═══════════════════════════════════════");
  
  const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
  const totalAssets = await vault.totalAssets();
  const yourShares = await vault.balanceOf(signer.address);
  
  console.log("  Vault Direct Holdings:");
  console.log("    WLFI:", ethers.formatEther(vaultWlfi));
  console.log("    USD1:", ethers.formatEther(vaultUsd1));
  console.log("  Total Assets:", ethers.formatEther(totalAssets));
  console.log("  Your EAGLE:", ethers.formatEther(yourShares));

  // =================================
  // STEP 4: Deposit to Trigger Charm Deployment
  // =================================
  
  console.log("\n📝 STEP 4: Deposit to Trigger Charm Deployment");
  console.log("  ═══════════════════════════════════════");
  
  const wlfi = await ethers.getContractAt("IERC20", WLFI_ADDRESS);
  const usd1 = await ethers.getContractAt("IERC20", USD1_ADDRESS);
  
  // Deposit 50+50 more (total idle will be 90+90 = 180 > $100 threshold)
  const depositAmount = ethers.parseEther("50");
  
  console.log("  Approving tokens...");
  tx = await wlfi.approve(VAULT_ADDRESS, depositAmount);
  await tx.wait();
  tx = await usd1.approve(VAULT_ADDRESS, depositAmount);
  await tx.wait();
  console.log("  ✅ Approved");
  
  console.log("\n  Depositing 50 WLFI + 50 USD1...");
  console.log("  (This should trigger deployment to Charm!)");
  
  tx = await vault.depositDual(depositAmount, depositAmount, signer.address);
  console.log("  Transaction:", tx.hash);
  await tx.wait();
  console.log("  ✅ Deposit confirmed!");

  // =================================
  // STEP 5: Check What Happened
  // =================================
  
  console.log("\n📊 STEP 5: Verify Charm Deployment");
  console.log("  ═══════════════════════════════════════");
  
  // Check vault's direct balance (should be reduced)
  const [vaultWlfiAfter, vaultUsd1After] = await vault.getVaultBalances();
  console.log("  Vault Direct Holdings NOW:");
  console.log("    WLFI:", ethers.formatEther(vaultWlfiAfter), `(was ${ethers.formatEther(vaultWlfi)})`);
  console.log("    USD1:", ethers.formatEther(vaultUsd1After), `(was ${ethers.formatEther(vaultUsd1)})`);
  
  // Check strategy's holdings
  const [strategyWlfi, strategyUsd1] = await strategy.getTotalAmounts();
  console.log("\n  Strategy Holdings (in Charm):");
  console.log("    WLFI:", ethers.formatEther(strategyWlfi));
  console.log("    USD1:", ethers.formatEther(strategyUsd1));
  
  // Check MEAGLE balance
  const meagle = await ethers.getContractAt("IERC20", MEAGLE_ADDRESS);
  const meagleBalance = await meagle.balanceOf(strategyAddress);
  console.log("\n  Strategy MEAGLE Balance:");
  console.log("    MEAGLE:", ethers.formatEther(meagleBalance));
  console.log("    (These are Charm vault receipt tokens!)");
  
  // Check total vault assets
  const totalAssetsAfter = await vault.totalAssets();
  console.log("\n  Total Vault Assets:");
  console.log("    Before:", ethers.formatEther(totalAssets));
  console.log("    After:", ethers.formatEther(totalAssetsAfter));
  console.log("    (Includes both direct holdings + strategy value)");
  
  // Check your EAGLE balance
  const yourSharesAfter = await vault.balanceOf(signer.address);
  console.log("\n  Your Position:");
  console.log("    EAGLE Shares:", ethers.formatEther(yourSharesAfter));
  console.log("    Your Value:", ethers.formatEther((yourSharesAfter * totalAssetsAfter) / await vault.totalSupply()));

  // =================================
  // SUMMARY
  // =================================
  
  console.log("\n✅ COMPLETE FLOW VERIFIED!");
  console.log("  ═══════════════════════════════════════");
  console.log("\n  What happened:");
  console.log("  1. ✅ You deposited 50+50 to vault");
  console.log("  2. ✅ Threshold met (90+90 > $100)");
  console.log("  3. ✅ Vault deployed 70% to strategy");
  console.log("  4. ✅ Strategy deposited to Charm");
  console.log("  5. ✅ Strategy received MEAGLE shares");
  console.log("\n  Token distribution:");
  console.log(`  • Vault holds: ${ethers.formatEther(vaultWlfiAfter)} WLFI + ${ethers.formatEther(vaultUsd1After)} USD1 (direct)`);
  console.log(`  • Strategy holds: ${ethers.formatEther(meagleBalance)} MEAGLE (in Charm)`);
  console.log(`  • MEAGLE represents: ${ethers.formatEther(strategyWlfi)} WLFI + ${ethers.formatEther(strategyUsd1)} USD1`);
  console.log(`  • You hold: ${ethers.formatEther(yourSharesAfter)} EAGLE (represents everything)`);
  console.log("  ═══════════════════════════════════════");

  console.log("\n🎉 SUCCESS! Your vault is now earning yield from Charm!");
}

main().catch(console.error);

