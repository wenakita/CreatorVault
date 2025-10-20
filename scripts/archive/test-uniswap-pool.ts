import { ethers } from "hardhat";

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🔍 CHECKING UNISWAP USD1/WLFI POOL");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const POOL_ADDRESS = "0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d";
  
  const poolABI = [
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function fee() external view returns (uint24)",
    "function liquidity() external view returns (uint128)",
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
  ];

  const pool = await ethers.getContractAt(poolABI, POOL_ADDRESS);

  try {
    const token0 = await pool.token0();
    const token1 = await pool.token1();
    const fee = await pool.fee();
    const liquidity = await pool.liquidity();
    const [sqrtPriceX96, tick] = await pool.slot0();

    console.log("Pool Address:", POOL_ADDRESS);
    console.log("\nTokens:");
    console.log("  Token0:", token0);
    console.log("  Token1:", token1);
    console.log("\nPool Details:");
    console.log("  Fee:", fee, `(${fee/10000}%)`);
    console.log("  Liquidity:", liquidity.toString());
    console.log("  Current Tick:", tick.toString());
    console.log("  SqrtPriceX96:", sqrtPriceX96.toString());

    if (liquidity === 0n) {
      console.log("\n❌ POOL HAS NO LIQUIDITY!");
      console.log("   This is why swaps are failing.");
      console.log("   The USD1/WLFI pool needs liquidity first.\n");
    } else {
      console.log("\n✅ Pool has liquidity - swaps should work\n");
    }
  } catch (error: any) {
    console.error("\n❌ Error reading pool:", error.message);
    console.log("\nThis might mean the pool doesn't exist or has issues.\n");
  }
}

main();

