import { ethers } from "hardhat";

async function main() {
  const strategy = await ethers.getContractAt("CharmStrategyUSD1", "0x8d32D6aEd976dC80880f3eF708ecB2169FEe26a8");
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🎉 CHECKING FOR SUCCESS!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [usd1, wlfi] = await strategy.getTotalAmounts();
  const shares = await strategy.getShareBalance();

  console.log("Strategy in Charm:");
  console.log("  USD1:", ethers.formatEther(usd1));
  console.log("  WLFI:", ethers.formatEther(wlfi));
  console.log("  Charm LP Shares:", ethers.formatEther(shares));

  if (shares > 0) {
    console.log("\n🎉🎉🎉 SUCCESS! 🎉🎉🎉");
    console.log("\nYour funds are now in Charm Finance!");
    console.log("You're earning Uniswap V3 trading fees!\n");
  } else {
    console.log("\n❌ No shares - deployment might have failed");
    console.log("Check latest transaction on Etherscan\n");
  }
}

main();

