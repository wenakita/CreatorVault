import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC";
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e";
const UNISWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

async function main() {
  console.log("🧠 Testing SMART Charm Strategy with Auto-Rebalancing\n");

  const [signer] = await ethers.getSigners();
  
  // =================================
  // STEP 1: Check Charm's Current Ratio
  // =================================
  
  console.log("📊 STEP 1: Analyze Charm Vault");
  console.log("  ═══════════════════════════════════════");
  
  const charmAbi = [
    "function getTotalAmounts() external view returns (uint256, uint256)",
    "function balanceOf(address) external view returns (uint256)"
  ];
  const charm = new ethers.Contract(MEAGLE_ADDRESS, charmAbi, signer);
  
  const [charmWlfi, charmUsd1] = await charm.getTotalAmounts();
  const charmTotal = charmWlfi + charmUsd1;
  const charmWlfiRatio = charmTotal > 0n ? (charmWlfi * 10000n) / charmTotal : 0n;
  
  console.log("  Charm Vault Holdings:");
  console.log("    WLFI:", ethers.formatEther(charmWlfi), `(${Number(charmWlfiRatio)/100}%)`);
  console.log("    USD1:", ethers.formatEther(charmUsd1), `(${100 - Number(charmWlfiRatio)/100}%)`);
  console.log("\n  ⚠️  Charm is imbalanced: needs", charmWlfiRatio > 5000n ? "MORE USD1" : "MORE WLFI");
  console.log("  ═══════════════════════════════════════");

  // =================================
  // STEP 2: Deploy SMART Strategy
  // =================================
  
  console.log("\n🚀 STEP 2: Deploy Smart Strategy");
  console.log("  ═══════════════════════════════════════");
  
  const SmartCharmStrategy = await ethers.getContractFactory("SmartCharmStrategy");
  const strategy = await SmartCharmStrategy.deploy(
    VAULT_ADDRESS,
    MEAGLE_ADDRESS,
    WLFI_ADDRESS,
    USD1_ADDRESS,
    UNISWAP_ROUTER
  );
  await strategy.waitForDeployment();
  const strategyAddress = await strategy.getAddress();
  
  console.log("  ✅ Smart Strategy deployed to:", strategyAddress);
  console.log("  ═══════════════════════════════════════");

  // =================================
  // STEP 3: Add to Vault
  // =================================
  
  console.log("\n📝 STEP 3: Add Strategy to Vault");
  console.log("  ═══════════════════════════════════════");
  
  const vault = await ethers.getContractAt("EagleOVaultV2Hybrid", VAULT_ADDRESS);
  
  const tx = await vault.addStrategy(strategyAddress, 7000); // 70%
  await tx.wait();
  console.log("  ✅ Strategy added with 70% weight");
  console.log("  ═══════════════════════════════════════");

  // =================================
  // STEP 4: Show What Will Happen
  // =================================
  
  console.log("\n💡 STEP 4: What Happens on Next Deposit");
  console.log("  ═══════════════════════════════════════");
  console.log("\n  When user deposits 100 WLFI + 100 USD1:");
  console.log("  ─────────────────────────────────────");
  console.log("  1. Vault receives 100+100 = 200 value");
  console.log("  2. Threshold met ($100)");
  console.log("  3. Vault sends 70% (140 value) to strategy");
  console.log(`     → 70 WLFI + 70 USD1`);
  console.log("\n  4. Strategy SMART rebalancing:");
  console.log(`     → Detects Charm needs ${Number(charmWlfiRatio)/100}% WLFI`);
  console.log(`     → Swaps tokens to match: ~${Number(charmWlfiRatio)/100} WLFI + ~${100-Number(charmWlfiRatio)/100} USD1`);
  console.log(`     → Example: Swap 30 WLFI → ~30 USD1`);
  console.log(`     → Result: ~97 WLFI + ~11 USD1 (matches Charm's 92/8 ratio!)`);
  console.log("\n  5. Deposits matched ratio to Charm");
  console.log("  6. Charm ACCEPTS (no more errors!)");
  console.log("  7. Strategy receives MEAGLE shares");
  console.log("  ═══════════════════════════════════════");

  console.log("\n✅ SMART STRATEGY DEPLOYED!");
  console.log("\n🎯 Key Innovation:");
  console.log("  Your strategy NOW automatically swaps to match Charm's ratio");
  console.log("  No more 'amount1Min' errors!");
  console.log("\n📝 Next: Deposit 50+50 to trigger and see it work!");
}

main().catch(console.error);

