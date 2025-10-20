import { ethers } from "hardhat";

async function main() {
  const CHARM_VAULT = "0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71";
  
  const charmABI = [
    "function getTotalAmounts() external view returns (uint256 total0, uint256 total1)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function totalSupply() external view returns (uint256)"
  ];

  const charm = await ethers.getContractAt(charmABI, CHARM_VAULT);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🔍 VERIFYING CHARM VAULT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("Charm Vault:", CHARM_VAULT);

  try {
    const token0 = await charm.token0();
    const token1 = await charm.token1();
    const [total0, total1] = await charm.getTotalAmounts();
    const totalSupply = await charm.totalSupply();

    console.log("\nTokens:");
    console.log("  Token0:", token0);
    console.log("  Token1:", token1);

    console.log("\nAmounts:");
    console.log("  Total0:", ethers.formatEther(total0));
    console.log("  Total1:", ethers.formatEther(total1));
    console.log("  Total Supply:", ethers.formatEther(totalSupply));

    const USD1 = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
    const WLFI = "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6";

    console.log("\n✅ Token order verification:");
    console.log("  Token0 is USD1:", token0.toLowerCase() === USD1.toLowerCase() ? "✅ YES" : "❌ NO");
    console.log("  Token1 is WLFI:", token1.toLowerCase() === WLFI.toLowerCase() ? "✅ YES" : "❌ NO");

  } catch (error: any) {
    console.log("\n❌ Error querying Charm vault:", error.message);
    console.log("\nThis might mean:");
    console.log("  • Wrong Charm vault address");
    console.log("  • Contract doesn't exist");
    console.log("  • Interface mismatch\n");
  }
}

main();

