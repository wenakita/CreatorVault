import { ethers } from "hardhat";

async function main() {
  const poolABI = [
    "function liquidity() external view returns (uint128)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function fee() external view returns (uint24)"
  ];

  const POOL = "0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d";  // USD1/WLFI 1% pool
  const pool = await ethers.getContractAt(poolABI, POOL);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🏊 UNISWAP USD1/WLFI POOL CHECK");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const token0 = await pool.token0();
  const token1 = await pool.token1();
  const fee = await pool.fee();
  const liquidity = await pool.liquidity();

  console.log("Pool:", POOL);
  console.log("\nTokens:");
  console.log("  Token0:", token0);
  console.log("  Token1:", token1);
  console.log("  Fee:", fee.toString(), `(${Number(fee)/10000}%)`);

  console.log("\nLiquidity:", liquidity.toString());

  if (liquidity === 0n) {
    console.log("\n❌ CRITICAL: Pool has ZERO liquidity!");
    console.log("   Cannot swap USD1 ↔ WLFI");
    console.log("   This is why Charm deployment is failing!\n");
  } else {
    console.log("\n✅ Pool has liquidity\n");
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main();

