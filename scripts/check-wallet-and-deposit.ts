import { ethers } from "hardhat";

async function main() {
  const [owner] = await ethers.getSigners();
  const VAULT = "0x32a2544De7a644833fE7659dF95e5bC16E698d99";
  
  const vault = await ethers.getContractAt("EagleOVault", VAULT);
  const WLFI = await ethers.getContractAt("IERC20", "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6");
  const USD1 = await ethers.getContractAt("IERC20", "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  💰 WALLET CHECK");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const wlfiBalance = await WLFI.balanceOf(owner.address);
  const usd1Balance = await USD1.balanceOf(owner.address);
  const yourShares = await vault.balanceOf(owner.address);

  console.log("Your wallet:", owner.address);
  console.log("\nToken balances:");
  console.log("  WLFI:", ethers.formatEther(wlfiBalance));
  console.log("  USD1:", ethers.formatEther(usd1Balance));
  console.log("\nVault shares:");
  console.log("  vEAGLE:", ethers.formatEther(yourShares));

  if (wlfiBalance === 0n && usd1Balance === 0n && yourShares === 0n) {
    console.log("\n❌ No tokens and no shares!");
    console.log("   Did you withdraw everything?\n");
    return;
  }

  if (yourShares > 0n) {
    console.log("\n✅ You have vault shares!");
    console.log("   But vault shows 0 balance - this is strange.");
    console.log("   Checking vault actual balances...\n");
    
    const actualWlfi = await WLFI.balanceOf(VAULT);
    const actualUsd1 = await USD1.balanceOf(VAULT);
    console.log("Vault actual ERC20 balances:");
    console.log("  WLFI:", ethers.formatEther(actualWlfi));
    console.log("  USD1:", ethers.formatEther(actualUsd1));
  }

  if (wlfiBalance > 0n || usd1Balance > 0n) {
    console.log("\n💡 You have tokens - want to deposit?");
    console.log("\nTo deposit 50 WLFI + 10 USD1:");
    console.log("  1. Make sure approvals are set (we did this earlier)");
    console.log("  2. Use the frontend at https://test.47eagle.com");
    console.log("  3. Or run the deposit script\n");
  }
}

main();

