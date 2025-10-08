import { ethers } from "hardhat";

const POOL_ADDRESS = "0xfA4e46E9C3ae698A06431679B07dC75dba7935e3";
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";

async function main() {
  console.log("🔍 Checking Uniswap V3 Pool for WLFI/USD1\n");

  const poolAbi = [
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function fee() external view returns (uint24)",
    "function liquidity() external view returns (uint128)",
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
  ];

  const pool = new ethers.Contract(POOL_ADDRESS, poolAbi, ethers.provider);

  console.log("📋 Pool Info:");
  console.log("  ═══════════════════════════════════════");
  console.log("  Pool Address:", POOL_ADDRESS);

  try {
    const token0 = await pool.token0();
    const token1 = await pool.token1();
    const fee = await pool.fee();
    const liquidity = await pool.liquidity();

    console.log("\n  Tokens:");
    console.log("    Token0:", token0);
    console.log("    Token1:", token1);
    
    console.log("\n  Pool Configuration:");
    console.log("    Fee Tier:", fee, `(${Number(fee) / 10000}%)`);
    console.log("    Liquidity:", liquidity.toString());

    // Verify tokens
    const isWlfiUsd1Pool = 
      (token0.toLowerCase() === WLFI_ADDRESS.toLowerCase() && token1.toLowerCase() === USD1_ADDRESS.toLowerCase()) ||
      (token1.toLowerCase() === WLFI_ADDRESS.toLowerCase() && token0.toLowerCase() === USD1_ADDRESS.toLowerCase());

    console.log("\n  Verification:");
    if (isWlfiUsd1Pool) {
      console.log("    ✅ This IS the WLFI/USD1 pool!");
    } else {
      console.log("    ❌ This is NOT a WLFI/USD1 pool!");
    }

    console.log("\n  Token Ordering:");
    if (token0.toLowerCase() === WLFI_ADDRESS.toLowerCase()) {
      console.log("    token0 = WLFI");
      console.log("    token1 = USD1");
    } else {
      console.log("    token0 = USD1");
      console.log("    token1 = WLFI");
    }

    console.log("  ═══════════════════════════════════════");

    console.log("\n🔧 For Strategy Configuration:");
    console.log("  ═══════════════════════════════════════");
    console.log(`  poolFee should be: ${fee}`);
    console.log(`  Current in SmartCharmStrategy: 10000 (1%)`);
    
    if (Number(fee) !== 10000) {
      console.log("\n  ⚠️  MISMATCH! Strategy using wrong fee tier!");
      console.log(`  Strategy should use: ${fee}`);
      console.log("\n  This is why swaps are failing!");
    } else {
      console.log("\n  ✅ Fee tier matches!");
    }

    console.log("  ═══════════════════════════════════════");

  } catch (error: any) {
    console.log("  ❌ Error querying pool:", error.message);
  }
}

main().catch(console.error);

