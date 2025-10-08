import { ethers } from "hardhat";

/**
 * Test Charm Finance integration on Arbitrum
 * MEAGLE (0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e) is the Charm vault receipt token
 */

const VAULT_ADDRESS = "0x..."; // UPDATE: Your deployed EagleOVaultV2Hybrid
const CHARM_STRATEGY_ADDRESS = "0x..."; // UPDATE: If you have CharmAlphaVaultStrategy deployed

const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e"; // Charm vault receipt

async function main() {
  console.log("🧪 Testing Charm Finance Integration\n");

  const [signer] = await ethers.getSigners();
  console.log("Tester:", signer.address);

  // =================================
  // UNDERSTAND MEAGLE
  // =================================
  
  console.log("\n🔍 Understanding MEAGLE Token:");
  console.log("  ═══════════════════════════════════════");
  console.log("  MEAGLE is a Charm Finance Alpha Vault receipt token");
  console.log("  It represents ownership in a Charm LP position");
  console.log("  Similar to how EAGLE represents vault shares");
  console.log("  ═══════════════════════════════════════");

  const meagle = await ethers.getContractAt("IERC20", MEAGLE_ADDRESS);
  
  try {
    const decimals = await meagle.decimals();
    const symbol = await meagle.symbol();
    const name = await meagle.name();
    const totalSupply = await meagle.totalSupply();
    const balance = await meagle.balanceOf(signer.address);
    
    console.log("\n  MEAGLE Token Info:");
    console.log("    Name:", name);
    console.log("    Symbol:", symbol);
    console.log("    Decimals:", decimals);
    console.log("    Total Supply:", ethers.utils.formatUnits(totalSupply, decimals));
    console.log("    Your Balance:", ethers.utils.formatUnits(balance, decimals));
  } catch (error) {
    console.log("  ⚠️  Could not fetch MEAGLE info");
  }

  // =================================
  // SCENARIO: USING CHARM VAULT
  // =================================
  
  console.log("\n💡 How to Integrate with Charm:");
  console.log("  ═══════════════════════════════════════");
  console.log("\n  OPTION 1: Direct Interaction with Charm");
  console.log("  ─────────────────────────────────────");
  console.log("  If MEAGLE is a Charm Alpha Vault for WLFI/USD1:");
  console.log("  1. Users can deposit WLFI+USD1 directly to Charm");
  console.log("  2. Get MEAGLE receipt tokens");
  console.log("  3. Then deposit MEAGLE to a different vault");
  console.log("\n  But for EagleOVault, we want:");
  console.log("  - Users deposit ANY token to EagleOVault");
  console.log("  - EagleOVault deposits to Charm internally");
  console.log("  - Users get EAGLE shares (not MEAGLE)");
  
  console.log("\n  OPTION 2: Charm as a Strategy (Recommended)");
  console.log("  ─────────────────────────────────────");
  console.log("  1. Deploy CharmAlphaVaultStrategy");
  console.log("  2. Point it to existing Charm vault (MEAGLE)");
  console.log("  3. Add strategy to EagleOVault");
  console.log("  4. Vault auto-deploys funds to Charm");
  console.log("  ═══════════════════════════════════════");

  // =================================
  // CHECK IF CHARM VAULT EXISTS
  // =================================
  
  console.log("\n🔍 Checking Charm Vault (MEAGLE):");
  console.log("  ═══════════════════════════════════════");
  
  // Charm Alpha Vault interface
  const charmVaultAbi = [
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function getTotalAmounts() external view returns (uint256 total0, uint256 total1)",
    "function totalSupply() external view returns (uint256)",
    "function balanceOf(address) external view returns (uint256)"
  ];
  
  try {
    const charmVault = new ethers.Contract(MEAGLE_ADDRESS, charmVaultAbi, signer);
    
    const token0 = await charmVault.token0();
    const token1 = await charmVault.token1();
    const [total0, total1] = await charmVault.getTotalAmounts();
    const totalSupply = await charmVault.totalSupply();
    
    console.log("  Charm Vault Info:");
    console.log("    Token0:", token0);
    console.log("    Token1:", token1);
    console.log("    Total0:", ethers.utils.formatEther(total0));
    console.log("    Total1:", ethers.utils.formatEther(total1));
    console.log("    Total Supply:", ethers.utils.formatEther(totalSupply));
    
    // Check if tokens match
    const isWlfiUsd1Vault = 
      (token0.toLowerCase() === WLFI_ADDRESS.toLowerCase() && 
       token1.toLowerCase() === USD1_ADDRESS.toLowerCase()) ||
      (token1.toLowerCase() === WLFI_ADDRESS.toLowerCase() && 
       token0.toLowerCase() === USD1_ADDRESS.toLowerCase());
    
    if (isWlfiUsd1Vault) {
      console.log("\n  ✅ This is a WLFI/USD1 Charm vault!");
      console.log("  Perfect for integration with your strategy.");
    } else {
      console.log("\n  ⚠️  This Charm vault uses different tokens");
      console.log("  Token0:", token0);
      console.log("  Token1:", token1);
    }
    
  } catch (error) {
    console.log("  ⚠️  Could not query Charm vault");
    console.log("  MEAGLE might not be a Charm vault or contract not verified");
  }
  
  console.log("  ═══════════════════════════════════════");

  // =================================
  // NEXT STEPS FOR CHARM INTEGRATION
  // =================================
  
  console.log("\n📝 Next Steps for Charm Integration:");
  console.log("  ═══════════════════════════════════════");
  console.log("\n  1. Verify MEAGLE is the right Charm vault:");
  console.log("     - Check on https://arbiscan.io/address/0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e");
  console.log("     - Verify it's a WLFI/USD1 vault");
  
  console.log("\n  2. Deploy CharmAlphaVaultStrategy:");
  console.log("     - Point to MEAGLE address");
  console.log("     - Set EagleOVault as owner");
  
  console.log("\n  3. Add strategy to vault:");
  console.log("     vault.addStrategy(strategyAddress, 7000); // 70%");
  
  console.log("\n  4. Test flow:");
  console.log("     User deposits → Vault → Strategy → Charm → Earn fees");
  
  console.log("\n  5. Monitor:");
  console.log("     - Strategy MEAGLE balance increases");
  console.log("     - Vault totalAssets includes strategy value");
  console.log("     - Users can withdraw proportionally");
  console.log("  ═══════════════════════════════════════");

  // =================================
  // EXAMPLE: DEPOSIT TO EXISTING CHARM VAULT
  // =================================
  
  console.log("\n💡 Example: How Users Could Interact:");
  console.log("  ═══════════════════════════════════════");
  console.log("\n  WITHOUT EagleOVault (traditional):");
  console.log("  ─────────────────────────────────────");
  console.log("  1. User gets WLFI and USD1");
  console.log("  2. User approves Charm vault (MEAGLE)");
  console.log("  3. User deposits to Charm");
  console.log("  4. User gets MEAGLE receipt");
  console.log("  5. MEAGLE stays on Arbitrum only");
  
  console.log("\n  WITH EagleOVault (enhanced):");
  console.log("  ─────────────────────────────────────");
  console.log("  1. User deposits ANY token (ETH, USDC, WBTC)");
  console.log("  2. Vault converts to WLFI+USD1");
  console.log("  3. Vault deposits to Charm (gets MEAGLE internally)");
  console.log("  4. User gets EAGLE shares");
  console.log("  5. EAGLE works on ALL chains (LayerZero)");
  console.log("  6. Vault manages Charm position automatically");
  console.log("  ═══════════════════════════════════════");

  console.log("\n✅ Charm integration analysis complete!");
  console.log("\n🎯 Key Insight:");
  console.log("  Your EagleOVault will HOLD MEAGLE tokens internally");
  console.log("  Users get EAGLE tokens (which represent ownership of the MEAGLE)");
  console.log("  This is the correct architecture! ✅");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

