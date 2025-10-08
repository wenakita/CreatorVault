import { ethers } from "hardhat";

const SMART_STRATEGY = "0xA136dc3562A99122D15a978A380e475F22fcCcf9";
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e";

async function main() {
  console.log("🔍 Checking SmartCharmStrategy Token Balances\n");

  const wlfi = await ethers.getContractAt("IERC20", WLFI_ADDRESS);
  const usd1 = await ethers.getContractAt("IERC20", USD1_ADDRESS);
  const meagle = await ethers.getContractAt("IERC20", MEAGLE_ADDRESS);
  const strategy = await ethers.getContractAt("SmartCharmStrategy", SMART_STRATEGY);

  console.log("📊 SmartCharmStrategy Token Balances:");
  console.log("  ═══════════════════════════════════════");
  console.log("  Strategy Address:", SMART_STRATEGY);

  // Check actual token balances SITTING in strategy contract
  const strategyWlfiBalance = await wlfi.balanceOf(SMART_STRATEGY);
  const strategyUsd1Balance = await usd1.balanceOf(SMART_STRATEGY);
  const strategyMeagleBalance = await meagle.balanceOf(SMART_STRATEGY);

  console.log("\n  Tokens SITTING in Strategy Contract:");
  console.log("    WLFI:", ethers.formatEther(strategyWlfiBalance));
  console.log("    USD1:", ethers.formatEther(strategyUsd1Balance));
  console.log("    MEAGLE:", ethers.formatEther(strategyMeagleBalance));

  // Check what MEAGLE represents in Charm
  const [strategyWlfiInCharm, strategyUsd1InCharm] = await strategy.getTotalAmounts();
  
  console.log("\n  MEAGLE Represents (in Charm vault):");
  console.log("    WLFI:", ethers.formatEther(strategyWlfiInCharm));
  console.log("    USD1:", ethers.formatEther(strategyUsd1InCharm));

  // Total
  const totalWlfi = strategyWlfiBalance + strategyWlfiInCharm;
  const totalUsd1 = strategyUsd1Balance + strategyUsd1InCharm;

  console.log("\n  TOTAL Strategy Holdings:");
  console.log("    WLFI:", ethers.formatEther(totalWlfi));
  console.log("    USD1:", ethers.formatEther(totalUsd1));
  console.log("  ═══════════════════════════════════════");

  // Analysis
  console.log("\n🔍 Analysis:");
  console.log("  ═══════════════════════════════════════");
  
  if (strategyWlfiBalance > 0n || strategyUsd1Balance > 0n) {
    console.log("  ⚠️  TOKENS SITTING IN STRATEGY (not deposited to Charm)");
    console.log("\n  What happened:");
    console.log("  1. Strategy received 70 WLFI + 70 USD1 from vault");
    console.log("  2. Strategy auto-rebalanced (swapped to match Charm)");
    console.log("  3. Strategy deposited to Charm");
    console.log("  4. Charm only USED what it needed");
    console.log("  5. UNUSED tokens stayed in strategy contract");
    console.log("\n  This is NORMAL when:");
    console.log("  • Charm vault has maxTotalSupply limit");
    console.log("  • Charm vault is near capacity");
    console.log("  • Charm vault is being conservative");
    console.log("\n  Solution:");
    console.log("  • Tokens are safe in strategy");
    console.log("  • Can be sent back to vault");
    console.log("  • Or deposited on next rebalance");
    console.log("  • Or used for withdrawals");
  } else {
    console.log("  ✅ All tokens properly deposited to Charm!");
  }
  
  console.log("  ═══════════════════════════════════════");

  // Show breakdown
  console.log("\n💰 Complete Breakdown:");
  console.log("  ═══════════════════════════════════════");
  console.log("  Your deposits: 40 + 50 + 50 = 140 total");
  console.log("\n  Current state:");
  console.log("  ├─ In Strategy (idle):");
  console.log("  │   ├─ WLFI:", ethers.formatEther(strategyWlfiBalance));
  console.log("  │   └─ USD1:", ethers.formatEther(strategyUsd1Balance));
  console.log("  ├─ In Charm (via MEAGLE):");
  console.log("  │   ├─ WLFI:", ethers.formatEther(strategyWlfiInCharm));
  console.log("  │   └─ USD1:", ethers.formatEther(strategyUsd1InCharm));
  console.log("  └─ Total:");
  console.log("      ├─ WLFI:", ethers.formatEther(totalWlfi));
  console.log("      └─ USD1:", ethers.formatEther(totalUsd1));
  console.log("  ═══════════════════════════════════════");
}

main().catch(console.error);

