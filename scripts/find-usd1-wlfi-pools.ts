import { ethers } from "hardhat";

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🔍 FINDING USD1/WLFI POOLS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const USD1 = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
  const WLFI = "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6";

  const poolABI = [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function fee() view returns (uint24)",
    "function liquidity() view returns (uint128)"
  ];

  // Check different fee tiers
  const pools = [
    { fee: "0.05%", address: "TBD" },
    { fee: "0.3%", address: "0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d" },
    { fee: "1%", address: "TBD" },
  ];

  console.log("Checking pool: 0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d");
  const pool = await ethers.getContractAt(poolABI, "0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d");
  
  const fee = await pool.fee();
  const liquidity = await pool.liquidity();
  
  console.log("  Fee:", fee.toString(), `(${Number(fee)/10000}%)`);
  console.log("  Liquidity:", liquidity.toString());
  console.log("  Has liquidity:", liquidity > 0 ? "✅" : "❌");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n💡 The pool at 0x4637...c73d has 0.3% fee");
  console.log("   If you need 1% fee, we need to find that pool address");
  console.log("   Or update strategy to use 0.3% fee (3000)\n");
}

main();

