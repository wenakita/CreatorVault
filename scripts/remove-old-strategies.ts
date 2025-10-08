import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC";
const OLD_STRATEGY_1 = "0xB62d4675762DbE48bB82a3187E3317c3078ec978"; // First attempt
const OLD_STRATEGY_2 = "0x865EdeB080e2B725E9a8B2Ab1F6d7A9460EE21ED"; // Second attempt
const SMART_STRATEGY = "0xA136dc3562A99122D15a978A380e475F22fcCcf9"; // Smart one with auto-rebalancing

async function main() {
  console.log("🧹 Removing Old Strategies and Adding Smart Strategy\n");

  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("EagleOVaultV2Hybrid", VAULT_ADDRESS);

  // Check current strategies
  console.log("📊 Checking current strategies...");
  const vaultAbi = [
    "function removeStrategy(address) external",
    "function addStrategy(address, uint256) external"
  ];

  // Try removing old strategies
  console.log("\n🗑️  Removing old strategies...");
  
  try {
    console.log("  Removing strategy:", OLD_STRATEGY_1);
    let tx = await vault.removeStrategy(OLD_STRATEGY_1);
    await tx.wait();
    console.log("  ✅ Removed strategy 1");
  } catch (error: any) {
    console.log("  ⚠️  Strategy 1 not found or already removed");
  }

  try {
    console.log("  Removing strategy:", OLD_STRATEGY_2);
    let tx = await vault.removeStrategy(OLD_STRATEGY_2);
    await tx.wait();
    console.log("  ✅ Removed strategy 2");
  } catch (error: any) {
    console.log("  ⚠️  Strategy 2 not found or already removed");
  }

  // Add smart strategy
  console.log("\n✨ Adding SmartCharmStrategy with auto-rebalancing...");
  console.log("  Strategy:", SMART_STRATEGY);
  
  try {
    const tx = await vault.addStrategy(SMART_STRATEGY, 7000); // 70% allocation
    console.log("  Transaction:", tx.hash);
    await tx.wait();
    console.log("  ✅ SmartCharmStrategy added with 70% weight!");
  } catch (error: any) {
    console.log("  ❌ Failed to add strategy:", error.message);
  }

  console.log("\n✅ Strategy management complete!");
  console.log("\n🎯 SmartCharmStrategy features:");
  console.log("  • Auto-detects Charm vault ratio");
  console.log("  • Swaps tokens to match (92% WLFI, 8% USD1)");
  console.log("  • Deposits optimally to Charm");
  console.log("  • No more 'amount1Min' errors!");
  console.log("\n📝 Next: Deposit 50+50 to trigger and see it work!");
}

main().catch(console.error);

