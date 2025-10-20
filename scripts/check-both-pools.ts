import { ethers } from "hardhat";

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🏊 CHECKING BOTH USD1/WLFI POOLS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const poolABI = [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function fee() view returns (uint24)",
    "function liquidity() view returns (uint128)"
  ];

  // Pool 1: The one from vault deployment
  console.log("Pool 1: 0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d");
  try {
    const pool1 = await ethers.getContractAt(poolABI, "0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d");
    const fee1 = await pool1.fee();
    const liq1 = await pool1.liquidity();
    console.log("  Fee:", fee1.toString(), `(${Number(fee1)/10000}%)`);
    console.log("  Liquidity:", liq1.toString());
    console.log("  Status:", liq1 > 0 ? "✅ Active" : "❌ Empty");
  } catch (e: any) {
    console.log("  ❌ Error:", e.message);
  }

  // Pool 2: The one you mentioned
  console.log("\nPool 2: 0xf9f5e6f7a44ee10c72e67bded6654afaf4d0c85d");
  try {
    const pool2 = await ethers.getContractAt(poolABI, "0xf9f5e6f7a44ee10c72e67bded6654afaf4d0c85d");
    const fee2 = await pool2.fee();
    const liq2 = await pool2.liquidity();
    const token0 = await pool2.token0();
    const token1 = await pool2.token1();
    
    console.log("  Token0:", token0);
    console.log("  Token1:", token1);
    console.log("  Fee:", fee2.toString(), `(${Number(fee2)/10000}%)`);
    console.log("  Liquidity:", liq2.toString());
    console.log("  Status:", liq2 > 0 ? "✅ Active" : "❌ Empty");
  } catch (e: any) {
    console.log("  ❌ Error:", e.message);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n💡 We need to use the pool with 1% fee for swaps");
  console.log("   and ensure it has liquidity!\n");
}

main();

