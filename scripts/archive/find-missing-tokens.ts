import { ethers } from "hardhat";

async function main() {
  const USD1 = await ethers.getContractAt("IERC20", "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d");
  const WLFI = await ethers.getContractAt("IERC20", "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6");
  
  const VAULT = "0x32a2544De7a644833fE7659dF95e5bC16E698d99";
  const STRATEGY = "0x8d32D6aEd976dC80880f3eF708ecB2169FEe26a8";
  const CHARM_VAULT = "0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71";
  const YOUR_WALLET = "0x7310Dd6EF89b7f829839F140C6840bc929ba2031";

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🔍 FINDING YOUR TOKENS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const balances = {
    wallet: {
      usd1: await USD1.balanceOf(YOUR_WALLET),
      wlfi: await WLFI.balanceOf(YOUR_WALLET)
    },
    vault: {
      usd1: await USD1.balanceOf(VAULT),
      wlfi: await WLFI.balanceOf(VAULT)
    },
    strategy: {
      usd1: await USD1.balanceOf(STRATEGY),
      wlfi: await WLFI.balanceOf(STRATEGY)
    },
    charmVault: {
      usd1: await USD1.balanceOf(CHARM_VAULT),
      wlfi: await WLFI.balanceOf(CHARM_VAULT)
    }
  };

  console.log("Your Wallet:");
  console.log("  USD1:", ethers.formatEther(balances.wallet.usd1));
  console.log("  WLFI:", ethers.formatEther(balances.wallet.wlfi));

  console.log("\nVault:", VAULT);
  console.log("  USD1:", ethers.formatEther(balances.vault.usd1));
  console.log("  WLFI:", ethers.formatEther(balances.vault.wlfi));

  console.log("\nStrategy:", STRATEGY);
  console.log("  USD1:", ethers.formatEther(balances.strategy.usd1));
  console.log("  WLFI:", ethers.formatEther(balances.strategy.wlfi));

  console.log("\nCharm Vault:", CHARM_VAULT);
  console.log("  USD1:", ethers.formatEther(balances.charmVault.usd1));
  console.log("  WLFI:", ethers.formatEther(balances.charmVault.wlfi));

  const total = {
    usd1: balances.wallet.usd1 + balances.vault.usd1 + balances.strategy.usd1,
    wlfi: balances.wallet.wlfi + balances.vault.wlfi + balances.strategy.wlfi
  };

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\nTotal Accounted For:");
  console.log("  USD1:", ethers.formatEther(total.usd1));
  console.log("  WLFI:", ethers.formatEther(total.wlfi));

  console.log("\n💡 If tokens are missing from all these locations,");
  console.log("   check recent failed transactions on Etherscan\n");
}

main();

