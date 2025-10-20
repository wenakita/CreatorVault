import { ethers } from "hardhat";

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🧪 MINIMAL CHARM DEPOSIT TEST");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const strategy = await ethers.getContractAt("CharmStrategyUSD1", "0xF13dFf269D938cBC66B195477D56b813c8692d8A");
  const vault = await ethers.getContractAt("EagleOVault", "0x32a2544De7a644833fE7659dF95e5bC16E698d99");

  console.log("Strategy:", await strategy.getAddress());
  console.log("Vault:", await vault.getAddress());

  // Check what Charm vault the strategy is using
  const charmVault = await strategy.charmVault();
  console.log("\nStrategy's Charm Vault:", charmVault);
  console.log("Expected:", "0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71");
  console.log("Match:", charmVault.toLowerCase() === "0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71".toLowerCase() ? "✅" : "❌");

  // Check if Charm vault exists and what it expects
  const charmABI = [
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function getTotalAmounts() view returns (uint256, uint256)"
  ];
  
  const charm = await ethers.getContractAt(charmABI, charmVault);
  const [total0, total1] = await charm.getTotalAmounts();
  
  console.log("\nCharm vault totals:");
  console.log("  USD1 (token0):", ethers.formatEther(total0));
  console.log("  WLFI (token1):", ethers.formatEther(total1));
  
  if (total0 > 0 && total1 > 0) {
    const ratio = Number(total0) / Number(total1);
    console.log("  Ratio USD1:WLFI =", ratio.toFixed(4), "(", (ratio * 100).toFixed(2), "% USD1 )");
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  console.log("💡 The issue might be:");
  console.log("  1. Charm deposit function signature mismatch");
  console.log("  2. Uniswap swap failing (no USD1/WLFI liquidity?)");
  console.log("  3. Math error in ratio calculation\n");
  
  console.log("Let me check Etherscan for the exact error:");
  console.log("https://etherscan.io/tx/0x124130b7eb01503d924ae33649b120c7aa1e19119d94a40e9209906fac9af844\n");
}

main();

