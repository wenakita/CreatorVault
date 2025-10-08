import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC"; // FIXED VERSION
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";

async function main() {
  console.log("🧪 Testing Vault on Arbitrum\n");

  const [signer] = await ethers.getSigners();
  console.log("Tester:", signer.address);

  // Connect to contracts
  const vault = await ethers.getContractAt("EagleOVaultV2Hybrid", VAULT_ADDRESS);
  const wlfi = await ethers.getContractAt("IERC20", WLFI_ADDRESS);
  const usd1 = await ethers.getContractAt("IERC20", USD1_ADDRESS);

  console.log("\n📊 Checking balances...");
  
  // Your token balances
  const wlfiBalance = await wlfi.balanceOf(signer.address);
  const usd1Balance = await usd1.balanceOf(signer.address);
  const eagleBalance = await vault.balanceOf(signer.address);
  
  console.log("  WLFI:", ethers.formatEther(wlfiBalance));
  console.log("  USD1:", ethers.formatEther(usd1Balance));
  console.log("  EAGLE:", ethers.formatEther(eagleBalance));

  // Check if you have tokens
  if (wlfiBalance == 0n || usd1Balance == 0n) {
    console.log("\n⚠️  You don't have WLFI or USD1 tokens!");
    console.log("  Please get some tokens first to test deposits.");
    return;
  }

  console.log("\n✅ You have tokens! Ready to test deposit.");
  console.log("\n📝 To deposit, run:");
  console.log(`  vault.depositDual(amount, amount, "${signer.address}")`);
  
  // Try direct deposit
  console.log("\n🧪 Testing direct deposit...");
  
  const depositAmount = ethers.parseEther("10");
  
  // Check if we have enough
  if (wlfiBalance < depositAmount || usd1Balance < depositAmount) {
    console.log("  ⚠️  Not enough tokens for 10+10 deposit");
    console.log(`  You have: ${ethers.formatEther(wlfiBalance)} WLFI, ${ethers.formatEther(usd1Balance)} USD1`);
    console.log("  Need: 10 WLFI + 10 USD1");
    return;
  }
  
  // Approve
  console.log("  Approving WLFI...");
  let tx = await wlfi.approve(VAULT_ADDRESS, depositAmount);
  await tx.wait();
  console.log("  ✅ WLFI approved");
  
  console.log("  Approving USD1...");
  tx = await usd1.approve(VAULT_ADDRESS, depositAmount);
  await tx.wait();
  console.log("  ✅ USD1 approved");
  
  // Deposit
  console.log("\n  Depositing 10 WLFI + 10 USD1...");
  tx = await vault.depositDual(depositAmount, depositAmount, signer.address);
  console.log("  Transaction sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("  ✅ Confirmed! Gas used:", receipt.gasUsed.toString());
  
  // Check results
  const eagleAfter = await vault.balanceOf(signer.address);
  const sharesMinted = eagleAfter - eagleBalance;
  
  console.log("\n🎉 Results:");
  console.log("  Shares minted:", ethers.formatEther(sharesMinted));
  console.log("  Your EAGLE balance:", ethers.formatEther(eagleAfter));
  console.log("\n✅ TEST SUCCESSFUL!");
}

main().catch(console.error);

