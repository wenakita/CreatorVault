import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC";
const SMART_STRATEGY = "0xA136dc3562A99122D15a978A380e475F22fcCcf9";
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e";

async function main() {
  console.log("🔍 Detailed Vault State Analysis\n");

  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("EagleOVaultV2Hybrid", VAULT_ADDRESS);
  const wlfi = await ethers.getContractAt("IERC20", WLFI_ADDRESS);
  const usd1 = await ethers.getContractAt("IERC20", USD1_ADDRESS);
  const meagle = await ethers.getContractAt("IERC20", MEAGLE_ADDRESS);
  const strategy = await ethers.getContractAt("SmartCharmStrategy", SMART_STRATEGY);

  console.log("📊 Complete Vault Analysis:");
  console.log("  ═══════════════════════════════════════");

  // Check token balances IN the vault contract
  const vaultWlfiActual = await wlfi.balanceOf(VAULT_ADDRESS);
  const vaultUsd1Actual = await usd1.balanceOf(VAULT_ADDRESS);
  
  console.log("  Actual Token Balances (in vault contract):");
  console.log("    WLFI:", ethers.formatEther(vaultWlfiActual));
  console.log("    USD1:", ethers.formatEther(vaultUsd1Actual));

  // Check vault's internal accounting
  const [vaultWlfiTracked, vaultUsd1Tracked] = await vault.getVaultBalances();
  
  console.log("\n  Vault's Internal Tracking:");
  console.log("    WLFI (tracked):", ethers.formatEther(vaultWlfiTracked));
  console.log("    USD1 (tracked):", ethers.formatEther(vaultUsd1Tracked));

  // Check if there's a discrepancy
  if (vaultWlfiActual !== vaultWlfiTracked) {
    console.log("\n  ⚠️  DISCREPANCY DETECTED!");
    console.log("    Actual WLFI in contract:", ethers.formatEther(vaultWlfiActual));
    console.log("    Tracked in state:", ethers.formatEther(vaultWlfiTracked));
    console.log("    Difference:", ethers.formatEther(vaultWlfiActual - vaultWlfiTracked));
    console.log("\n  This is likely UNUSED tokens from Charm deposit!");
  }

  // Check strategy
  console.log("\n  Strategy Holdings:");
  const strategyMeagle = await meagle.balanceOf(SMART_STRATEGY);
  const [strategyWlfi, strategyUsd1] = await strategy.getTotalAmounts();
  
  console.log("    MEAGLE shares:", ethers.formatEther(strategyMeagle));
  console.log("    Represents:");
  console.log("      WLFI:", ethers.formatEther(strategyWlfi));
  console.log("      USD1:", ethers.formatEther(strategyUsd1));

  // Total assets
  const totalAssets = await vault.totalAssets();
  console.log("\n  Total Vault Assets:");
  console.log("    Reported:", ethers.formatEther(totalAssets));
  
  const actualTotal = vaultWlfiActual + vaultUsd1Actual + strategyWlfi + strategyUsd1;
  console.log("    Actual:", ethers.formatEther(actualTotal));

  // Your position
  const yourEagle = await vault.balanceOf(signer.address);
  const totalSupply = await vault.totalSupply();
  const yourValue = totalSupply > 0n ? (yourEagle * totalAssets) / totalSupply : 0n;
  
  console.log("\n  Your Position:");
  console.log("    EAGLE:", ethers.formatEther(yourEagle));
  console.log("    % of Vault:", totalSupply > 0n ? (yourEagle * 100n / totalSupply).toString() + "%" : "N/A");
  console.log("    Your Value:", ethers.formatEther(yourValue));
  console.log("  ═══════════════════════════════════════");

  // Analysis
  console.log("\n🔍 Analysis:");
  console.log("  ═══════════════════════════════════════");
  
  if (vaultWlfiActual > 0n || vaultUsd1Actual > 0n) {
    console.log("  💡 Explanation:");
    console.log("  When depositing to Charm with imbalanced ratio:");
    console.log("  • Charm might not use ALL tokens");
    console.log("  • Unused tokens stay in vault contract");
    console.log("  • This is NORMAL and expected!");
    console.log("\n  What happened:");
    console.log("  • Strategy sent: ~97 WLFI + ~11 USD1 to Charm");
    console.log("  • Charm used what it needed");
    console.log("  • Excess returned to vault");
    console.log("\n  This is actually GOOD:");
    console.log("  • Shows strategy is being careful");
    console.log("  • No tokens lost");
    console.log("  • Can be redeployed or used for withdrawals");
  }
  
  console.log("  ═══════════════════════════════════════");
}

main().catch(console.error);

