import { ethers } from "hardhat";

async function main() {
  const STRATEGY = "0x8d32D6aEd976dC80880f3eF708ecB2169FEe26a8";
  const CHARM_VAULT = "0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71";
  const UNISWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  
  const WLFI = await ethers.getContractAt("IERC20", "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6");
  const USD1 = await ethers.getContractAt("IERC20", "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🔍 STRATEGY APPROVALS CHECK");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const wlfiToCharm = await WLFI.allowance(STRATEGY, CHARM_VAULT);
  const usd1ToCharm = await USD1.allowance(STRATEGY, CHARM_VAULT);
  const wlfiToUni = await WLFI.allowance(STRATEGY, UNISWAP_ROUTER);
  const usd1ToUni = await USD1.allowance(STRATEGY, UNISWAP_ROUTER);

  console.log("Strategy → Charm Vault:");
  console.log("  WLFI:", ethers.formatEther(wlfiToCharm), wlfiToCharm > 0 ? "✅" : "❌");
  console.log("  USD1:", ethers.formatEther(usd1ToCharm), usd1ToCharm > 0 ? "✅" : "❌");

  console.log("\nStrategy → Uniswap Router:");
  console.log("  WLFI:", ethers.formatEther(wlfiToUni), wlfiToUni > 0 ? "✅" : "❌");
  console.log("  USD1:", ethers.formatEther(usd1ToUni), usd1ToUni > 0 ? "✅" : "❌");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (wlfiToCharm === 0n || usd1ToCharm === 0n) {
    console.log("❌ Missing Charm approvals!");
    console.log("   Run: cast send 0x8d32D6aEd976dC80880f3eF708ecB2169FEe26a8 'initializeApprovals()' ...\n");
  } else {
    console.log("✅ All approvals set!\n");
  }
}

main();

