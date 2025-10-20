import { ethers } from "hardhat";

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🔓 APPROVING WLFI TO NEW VAULT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [owner] = await ethers.getSigners();
  const NEW_VAULT = "0x32a2544De7a644833fE7659dF95e5bC16E698d99";
  
  const WLFI = await ethers.getContractAt("IERC20", "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6");
  const USD1 = await ethers.getContractAt("IERC20", "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d");

  console.log("Your address:", owner.address);
  console.log("New vault:", NEW_VAULT);

  // Check current allowances
  const wlfiAllowance = await WLFI.allowance(owner.address, NEW_VAULT);
  const usd1Allowance = await USD1.allowance(owner.address, NEW_VAULT);

  console.log("\nCurrent allowances:");
  console.log("  WLFI:", ethers.formatEther(wlfiAllowance));
  console.log("  USD1:", ethers.formatEther(usd1Allowance));

  // Some tokens (like USDT) require approving to 0 first
  if (wlfiAllowance > 0n) {
    console.log("\n⚠️ WLFI already has approval, resetting to 0 first...");
    const tx0 = await WLFI.approve(NEW_VAULT, 0, { gasLimit: 100000 });
    await tx0.wait();
    console.log("  ✅ Reset to 0");
  }

  console.log("\n🔓 Approving WLFI (MAX)...");
  const tx1 = await WLFI.approve(NEW_VAULT, ethers.MaxUint256, { gasLimit: 100000 });
  console.log("  Transaction:", tx1.hash);
  await tx1.wait();
  console.log("  ✅ WLFI approved");

  console.log("\n🔓 Approving USD1 (MAX)...");
  const tx2 = await USD1.approve(NEW_VAULT, ethers.MaxUint256, { gasLimit: 100000 });
  console.log("  Transaction:", tx2.hash);
  await tx2.wait();
  console.log("  ✅ USD1 approved");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ✅ APPROVALS COMPLETE!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("Now you can deposit via the frontend or script!");
  console.log("  Vault: 0x32a2544De7a644833fE7659dF95e5bC16E698d99\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });

