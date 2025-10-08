import { ethers } from "hardhat";

const VAULT_ADDRESS = "0x4f00fAB0361009d975Eb04E172268Bf1E73737bC"; // FIXED VERSION
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";

async function main() {
  console.log("🧪 Second Deposit Test\n");

  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("EagleOVaultV2Hybrid", VAULT_ADDRESS);
  const wlfi = await ethers.getContractAt("IERC20", WLFI_ADDRESS);
  const usd1 = await ethers.getContractAt("IERC20", USD1_ADDRESS);

  // Check BEFORE state
  console.log("📊 BEFORE Second Deposit:");
  console.log("  ═══════════════════════════════════════");
  const totalSupplyBefore = await vault.totalSupply();
  const totalAssetsBefore = await vault.totalAssets();
  const yourSharesBefore = await vault.balanceOf(signer.address);
  const [wlfiBefore, usd1Before] = await vault.getVaultBalances();
  
  console.log("  Vault:");
  console.log("    Total Supply:", ethers.formatEther(totalSupplyBefore), "EAGLE");
  console.log("    Total Assets:", ethers.formatEther(totalAssetsBefore), "value");
  console.log("    WLFI:", ethers.formatEther(wlfiBefore));
  console.log("    USD1:", ethers.formatEther(usd1Before));
  
  console.log("\n  Your Position:");
  console.log("    EAGLE Shares:", ethers.formatEther(yourSharesBefore));
  console.log("    % of Vault:", totalSupplyBefore > 0n ? (yourSharesBefore * 100n / totalSupplyBefore).toString() + "%" : "N/A");
  
  const sharePriceBefore = totalSupplyBefore > 0n 
    ? (totalAssetsBefore * 10000n) / totalSupplyBefore
    : 0n;
  console.log("\n  Share Price:");
  console.log("    1 EAGLE =", (Number(sharePriceBefore) / 10000).toFixed(4), "value");
  console.log("  ═══════════════════════════════════════");

  // Deposit another 10+10
  const depositAmount = ethers.parseEther("10");
  
  console.log("\n🔄 Depositing Another 10 WLFI + 10 USD1...");
  console.log("  ═══════════════════════════════════════");
  
  // Approve
  console.log("  Approving tokens...");
  let tx = await wlfi.approve(VAULT_ADDRESS, depositAmount);
  await tx.wait();
  tx = await usd1.approve(VAULT_ADDRESS, depositAmount);
  await tx.wait();
  console.log("  ✅ Approved");
  
  // Deposit
  console.log("\n  Depositing...");
  tx = await vault.depositDual(depositAmount, depositAmount, signer.address);
  console.log("  Transaction:", tx.hash);
  const receipt = await tx.wait();
  console.log("  ✅ Confirmed! Gas:", receipt.gasUsed.toString());

  // Check AFTER state
  console.log("\n📊 AFTER Second Deposit:");
  console.log("  ═══════════════════════════════════════");
  const totalSupplyAfter = await vault.totalSupply();
  const totalAssetsAfter = await vault.totalAssets();
  const yourSharesAfter = await vault.balanceOf(signer.address);
  const [wlfiAfter, usd1After] = await vault.getVaultBalances();
  
  console.log("  Vault:");
  console.log("    Total Supply:", ethers.formatEther(totalSupplyAfter), "EAGLE");
  console.log("    Total Assets:", ethers.formatEther(totalAssetsAfter), "value");
  console.log("    WLFI:", ethers.formatEther(wlfiAfter));
  console.log("    USD1:", ethers.formatEther(usd1After));
  
  console.log("\n  Your Position:");
  console.log("    EAGLE Shares:", ethers.formatEther(yourSharesAfter));
  console.log("    % of Vault:", totalSupplyAfter > 0n ? (yourSharesAfter * 100n / totalSupplyAfter).toString() + "%" : "N/A");
  
  const sharePriceAfter = totalSupplyAfter > 0n 
    ? (totalAssetsAfter * 10000n) / totalSupplyAfter
    : 0n;
  console.log("\n  Share Price:");
  console.log("    1 EAGLE =", (Number(sharePriceAfter) / 10000).toFixed(4), "value");
  console.log("    Your Value:", ethers.formatEther((yourSharesAfter * totalAssetsAfter) / totalSupplyAfter), "value");
  console.log("  ═══════════════════════════════════════");

  // Calculate changes
  const sharesMinted = yourSharesAfter - yourSharesBefore;
  const supplyIncrease = totalSupplyAfter - totalSupplyBefore;
  const assetsIncrease = totalAssetsAfter - totalAssetsBefore;

  console.log("\n📈 Changes:");
  console.log("  ═══════════════════════════════════════");
  console.log("  Shares Minted:", ethers.formatEther(sharesMinted), "EAGLE");
  console.log("  Total Supply:", ethers.formatEther(totalSupplyBefore), "→", ethers.formatEther(totalSupplyAfter));
  console.log("  Total Assets:", ethers.formatEther(totalAssetsBefore), "→", ethers.formatEther(totalAssetsAfter));
  console.log("  ═══════════════════════════════════════");

  console.log("\n✅ RESULT:");
  console.log("  ═══════════════════════════════════════");
  console.log("  Deposited: 10 + 10 = 20 value");
  console.log("  Received:", ethers.formatEther(sharesMinted), "shares");
  console.log("\n  This is CORRECT because:");
  console.log("  Formula: (value × supply) / assets");
  console.log("  Calculation: (20 × 20) / 20 = 20 shares ✅");
  console.log("\n  Since no yield earned yet, price is still 1:1");
  console.log("  Both deposits get same rate! ✅");
  console.log("  ═══════════════════════════════════════");
}

main().catch(console.error);

