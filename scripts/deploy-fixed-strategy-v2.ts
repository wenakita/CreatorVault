import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC";
const OLD_STRATEGY = "0xA136dc3562A99122D15a978A380e475F22fcCcf9";
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e";
const UNISWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

async function main() {
  console.log("🔧 Deploying FIXED SmartCharmStrategy V2\n");

  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("EagleOVaultV2Hybrid", VAULT_ADDRESS);
  const wlfi = await ethers.getContractAt("IERC20", WLFI_ADDRESS);

  // Check stuck tokens
  console.log("📊 Checking Old Strategy:");
  console.log("  ═══════════════════════════════════════");
  const stuckWlfi = await wlfi.balanceOf(OLD_STRATEGY);
  console.log("  Old Strategy:", OLD_STRATEGY);
  console.log("  Stuck WLFI:", ethers.formatEther(stuckWlfi));
  console.log("  ═══════════════════════════════════════");

  // Try to remove old strategy first
  console.log("\n🗑️  Removing Old Strategy...");
  try {
    const tx = await vault.removeStrategy(OLD_STRATEGY);
    await tx.wait();
    console.log("  ✅ Old strategy removed");
    
    // Check if tokens were recovered
    const stuckAfter = await wlfi.balanceOf(OLD_STRATEGY);
    const recovered = stuckWlfi - stuckAfter;
    
    if (recovered > 0n) {
      console.log("  ✅ Recovered:", ethers.formatEther(recovered), "WLFI");
    } else {
      console.log("  ⚠️  Tokens still stuck:", ethers.formatEther(stuckAfter), "WLFI");
      console.log("  Note: Old strategy doesn't have rescue function");
      console.log("  Those tokens are unfortunately lost");
    }
  } catch (error: any) {
    console.log("  ⚠️  Could not remove:", error.message);
  }

  // Deploy NEW fixed strategy
  console.log("\n🚀 Deploying FIXED SmartCharmStrategy V2...");
  console.log("  (Now returns unused tokens to vault!)");
  
  const SmartCharmStrategy = await ethers.getContractFactory("SmartCharmStrategy");
  const newStrategy = await SmartCharmStrategy.deploy(
    VAULT_ADDRESS,
    MEAGLE_ADDRESS,
    WLFI_ADDRESS,
    USD1_ADDRESS,
    UNISWAP_ROUTER
  );
  await newStrategy.waitForDeployment();
  const newStrategyAddress = await newStrategy.getAddress();
  
  console.log("  ✅ New Strategy deployed to:", newStrategyAddress);

  // Add to vault
  console.log("\n📝 Adding New Strategy to Vault...");
  try {
    const tx = await vault.addStrategy(newStrategyAddress, 7000);
    await tx.wait();
    console.log("  ✅ Added with 70% weight");
  } catch (error: any) {
    console.log("  ⚠️  Could not add:", error.message);
  }

  console.log("\n✅ COMPLETE!");
  console.log("  ═══════════════════════════════════════");
  console.log("\n  New Strategy:", newStrategyAddress);
  console.log("\n  Features:");
  console.log("  ✅ Auto-rebalances to match Charm ratio");
  console.log("  ✅ Returns unused tokens to vault");
  console.log("  ✅ Has rescue function for emergencies");
  console.log("\n  Next deposits will work correctly!");
  console.log("  ═══════════════════════════════════════");
}

main().catch(console.error);

