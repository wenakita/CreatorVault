import { ethers } from "hardhat";

const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e";
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";

async function main() {
  console.log("🔍 Analyzing MEAGLE Charm Vault\n");

  const [signer] = await ethers.getSigners();

  // Connect to MEAGLE (Charm vault)
  const charmVaultAbi = [
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function getTotalAmounts() external view returns (uint256 total0, uint256 total1)",
    "function totalSupply() external view returns (uint256)",
    "function balanceOf(address) external view returns (uint256)",
    "function deposit(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address to) external returns (uint256 shares, uint256 amount0, uint256 amount1)",
    "function pool() external view returns (address)"
  ];

  const charm = new ethers.Contract(MEAGLE_ADDRESS, charmVaultAbi, signer);

  console.log("📋 MEAGLE Vault Info:");
  console.log("  ═══════════════════════════════════════");

  try {
    const token0 = await charm.token0();
    const token1 = await charm.token1();
    const [total0, total1] = await charm.getTotalAmounts();
    const totalSupply = await charm.totalSupply();
    const pool = await charm.pool();

    console.log("  Token0:", token0);
    console.log("  Token1:", token1);
    console.log("\n  Vault Holdings:");
    console.log("    Total0:", ethers.formatEther(total0));
    console.log("    Total1:", ethers.formatEther(total1));
    console.log("  Total Supply:", ethers.formatEther(totalSupply));
    console.log("  Pool:", pool);

    // Check token ordering
    console.log("\n  Token Ordering:");
    if (token0.toLowerCase() === WLFI_ADDRESS.toLowerCase()) {
      console.log("    ✅ token0 = WLFI");
      console.log("    ✅ token1 = USD1");
    } else if (token0.toLowerCase() === USD1_ADDRESS.toLowerCase()) {
      console.log("    ⚠️  token0 = USD1");
      console.log("    ⚠️  token1 = WLFI");
      console.log("    We need to SWAP the order when depositing!");
    } else {
      console.log("    ❌ Unexpected tokens!");
    }

    // Calculate share price
    if (totalSupply > 0n) {
      const totalValue = total0 + total1;
      const sharePrice = (totalValue * 10000n) / totalSupply;
      console.log("\n  MEAGLE Share Price:");
      console.log("    1 MEAGLE =", (Number(sharePrice) / 10000).toFixed(4), "value");
    }

    console.log("  ═══════════════════════════════════════");

    // Test if we can call the contract
    console.log("\n✅ MEAGLE vault is accessible and working!");
    console.log("\n📝 To deposit:");
    console.log("  charm.deposit(");
    console.log(`    amount0,  // ${token0 === WLFI_ADDRESS.toLowerCase() ? 'WLFI' : 'USD1'}`);
    console.log(`    amount1,  // ${token1 === WLFI_ADDRESS.toLowerCase() ? 'WLFI' : 'USD1'}`);
    console.log("    amount0Min,");
    console.log("    amount1Min,");
    console.log("    to");
    console.log("  )");

  } catch (error: any) {
    console.log("  ❌ Error querying vault:", error.message);
  }
}

main().catch(console.error);

