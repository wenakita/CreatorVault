import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC";
const STRATEGY_ADDRESS = "0x0Ba80Ce1c8e4487C9EeA179150D09Ec2cbCb5Aa1";
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e";

async function main() {
  console.log("📊 EagleOVault Complete Analytics Dashboard\n");
  console.log("═══════════════════════════════════════════════════════════");

  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("EagleOVaultV2Hybrid", VAULT_ADDRESS);
  const strategy = await ethers.getContractAt("SmartCharmStrategy", STRATEGY_ADDRESS);
  const wlfi = await ethers.getContractAt("IERC20", WLFI_ADDRESS);
  const usd1 = await ethers.getContractAt("IERC20", USD1_ADDRESS);
  const meagle = await ethers.getContractAt("IERC20", MEAGLE_ADDRESS);

  // =================================
  // 1. TOTAL VALUE (Most Important!)
  // =================================
  
  console.log("\n💰 1. TOTAL VAULT VALUE");
  console.log("─────────────────────────────────────────────────────────");
  
  const totalAssets = await vault.totalAssets();
  const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
  const [strategyWlfi, strategyUsd1] = await strategy.getTotalAmounts();
  
  console.log("  Direct in Vault:");
  console.log("    WLFI:", ethers.formatEther(vaultWlfi));
  console.log("    USD1:", ethers.formatEther(vaultUsd1));
  console.log("    Subtotal:", ethers.formatEther(vaultWlfi + vaultUsd1), "USD");
  
  console.log("\n  In Strategy #1 (SmartCharmStrategy):");
  console.log("    WLFI:", ethers.formatEther(strategyWlfi));
  console.log("    USD1:", ethers.formatEther(strategyUsd1));
  console.log("    Subtotal:", ethers.formatEther(strategyWlfi + strategyUsd1), "USD");
  
  console.log("\n  ✅ TOTAL VAULT VALUE:", ethers.formatEther(totalAssets), "USD");
  console.log("     (This number is EASY to verify - one function call!)");

  // =================================
  // 2. SHARE PRICE
  // =================================
  
  console.log("\n\n💵 2. SHARE PRICE");
  console.log("─────────────────────────────────────────────────────────");
  
  const totalSupply = await vault.totalSupply();
  const sharePrice = totalSupply > 0n 
    ? Number(totalAssets * 10000n / totalSupply) / 10000
    : 1.0;
  
  console.log("  Total Supply:", ethers.formatEther(totalSupply), "EAGLE");
  console.log("  Total Assets:", ethers.formatEther(totalAssets), "USD");
  console.log("  ✅ 1 EAGLE =", sharePrice.toFixed(4), "USD");
  console.log("     (Simple: totalAssets / totalSupply)");

  // =================================
  // 3. STRATEGY BREAKDOWN
  // =================================
  
  console.log("\n\n📈 3. STRATEGY BREAKDOWN");
  console.log("─────────────────────────────────────────────────────────");
  
  const directValue = vaultWlfi + vaultUsd1;
  const strategyValue = strategyWlfi + strategyUsd1;
  const total = totalAssets;
  
  console.log("  Strategy #0: Direct Holdings (Vault)");
  console.log("    Value:", ethers.formatEther(directValue), "USD");
  console.log("    %:", total > 0n ? Number(directValue * 100n / total) : 0, "%");
  console.log("    APR:", "0% (not earning)");
  
  console.log("\n  Strategy #1: SmartCharmStrategy");
  console.log("    Address:", STRATEGY_ADDRESS);
  console.log("    Value:", ethers.formatEther(strategyValue), "USD");
  console.log("    %:", total > 0n ? Number(strategyValue * 100n / total) : 0, "%");
  console.log("    MEAGLE held:", ethers.formatEther(await meagle.balanceOf(STRATEGY_ADDRESS)));
  console.log("    APR:", "~12-15% (Uniswap V3 fees)");
  console.log("    Protocol:", "Charm Finance → Uniswap V3");
  
  console.log("\n  ✅ Total Strategies: 1");
  console.log("     (Easy to add more - each strategy reports its value!)");

  // =================================
  // 4. YOUR POSITION
  // =================================
  
  console.log("\n\n👤 4. YOUR POSITION");
  console.log("─────────────────────────────────────────────────────────");
  
  const yourShares = await vault.balanceOf(signer.address);
  const yourValue = totalSupply > 0n 
    ? (yourShares * totalAssets) / totalSupply 
    : 0n;
  const yourPercent = totalSupply > 0n 
    ? Number(yourShares * 10000n / totalSupply) / 100
    : 0;
  
  console.log("  Your EAGLE:", ethers.formatEther(yourShares));
  console.log("  Your Value:", ethers.formatEther(yourValue), "USD");
  console.log("  Your %:", yourPercent.toFixed(2), "% of vault");
  console.log("\n  If you withdraw now, you'd get:");
  console.log("    WLFI:", ethers.formatEther(totalSupply > 0n ? (yourShares * (vaultWlfi + strategyWlfi)) / totalSupply : 0n));
  console.log("    USD1:", ethers.formatEther(totalSupply > 0n ? (yourShares * (vaultUsd1 + strategyUsd1)) / totalSupply : 0n));

  // =================================
  // 5. APR CALCULATION (Simplified)
  // =================================
  
  console.log("\n\n📊 5. APR/APY ESTIMATION");
  console.log("─────────────────────────────────────────────────────────");
  
  console.log("  Current value:", ethers.formatEther(totalAssets), "USD");
  console.log("  Share price:", sharePrice.toFixed(4), "USD");
  
  console.log("\n  Estimated APR Breakdown:");
  console.log("    Direct holdings:", "0% (not earning)");
  console.log("    Charm strategy:", "~12-15% (Uniswap V3 fees)");
  console.log("\n  Weighted Average APR:");
  const directPct = total > 0n ? Number(directValue * 100n / total) : 0;
  const strategyPct = total > 0n ? Number(strategyValue * 100n / total) : 0;
  const weightedAPR = (directPct * 0 + strategyPct * 13.5) / 100;
  console.log("    ≈", weightedAPR.toFixed(2), "% APR");
  
  console.log("\n  To track real APR:");
  console.log("    1. Record share price now:", sharePrice.toFixed(4));
  console.log("    2. Record share price in 24h");
  console.log("    3. Calculate: ((newPrice - oldPrice) / oldPrice) × 365");

  // =================================
  // 6. LIQUIDITY & WITHDRAWALS
  // =================================
  
  console.log("\n\n💧 6. LIQUIDITY ANALYSIS");
  console.log("─────────────────────────────────────────────────────────");
  
  console.log("  Available for instant withdrawal:");
  console.log("    Direct:", ethers.formatEther(directValue), "USD");
  console.log("    % of total:", total > 0n ? Number(directValue * 100n / total) : 0, "%");
  
  console.log("\n  Requires strategy withdrawal:");
  console.log("    In strategies:", ethers.formatEther(strategyValue), "USD");
  console.log("    Withdrawal time:", "~1-2 blocks (Charm withdraw)");
  
  console.log("\n  ✅ Withdrawal Coverage:");
  if (directValue > totalAssets / 2n) {
    console.log("    Excellent! >50% instantly available");
  } else if (directValue > totalAssets / 4n) {
    console.log("    Good! >25% instantly available");
  } else {
    console.log("    Low! <25% instantly available");
  }

  // =================================
  // 7. VAULT HEALTH
  // =================================
  
  console.log("\n\n🏥 7. VAULT HEALTH CHECK");
  console.log("─────────────────────────────────────────────────────────");
  
  const isPaused = await vault.paused();
  
  console.log("  Status:", isPaused ? "⚠️  PAUSED" : "✅ ACTIVE");
  console.log("  Total Assets:", ethers.formatEther(totalAssets), "USD");
  console.log("  Total Shares:", ethers.formatEther(totalSupply), "EAGLE");
  console.log("  Share Price:", sharePrice.toFixed(4), "USD");
  
  const warnings = [];
  
  if (isPaused) warnings.push("Vault is paused");
  if (totalSupply > 0n && totalAssets === 0n) warnings.push("Has shares but no assets!");
  if (directValue < totalAssets / 10n) warnings.push("Low liquidity buffer (<10%)");
  
  if (warnings.length === 0) {
    console.log("\n  ✅ VAULT IS HEALTHY!");
  } else {
    console.log("\n  ⚠️  WARNINGS:");
    warnings.forEach(w => console.log("    •", w));
  }

  // =================================
  // 8. QUICK SUMMARY
  // =================================
  
  console.log("\n\n📋 QUICK SUMMARY (Copy for Dashboard)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`
  Total Value: $${ethers.formatEther(totalAssets)}
  Share Price: $${sharePrice.toFixed(4)}
  Total Shares: ${ethers.formatEther(totalSupply)} EAGLE
  
  Distribution:
    • Direct: $${ethers.formatEther(directValue)} (${total > 0n ? Number(directValue * 100n / total) : 0}%)
    • Strategies: $${ethers.formatEther(strategyValue)} (${total > 0n ? Number(strategyValue * 100n / total) : 0}%)
  
  Strategies:
    #1 SmartCharmStrategy: $${ethers.formatEther(strategyValue)} (${total > 0n ? Number(strategyValue * 100n / total) : 0}%)
  
  Estimated APR: ~${weightedAPR.toFixed(2)}%
  
  Your Position:
    • Shares: ${ethers.formatEther(yourShares)} EAGLE (${yourPercent.toFixed(2)}%)
    • Value: $${ethers.formatEther(yourValue)}
  
  Status: ${isPaused ? '⚠️  PAUSED' : '✅ ACTIVE'}
  `);
  console.log("═══════════════════════════════════════════════════════════");

  console.log("\n✅ ALL METRICS AVAILABLE IN ONE SCRIPT!");
  console.log("\n📝 To track APR over time:");
  console.log("  1. Run this daily, save share price");
  console.log("  2. Calculate: (todayPrice - yesterdayPrice) / yesterdayPrice × 365");
  console.log("\n🎯 With 5 strategies, just add them to the breakdown!");
}

main().catch(console.error);

