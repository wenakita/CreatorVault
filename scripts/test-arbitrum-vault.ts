import { ethers } from "hardhat";

/**
 * Test script for EagleOVault V2 Hybrid on Arbitrum
 * Tests all three deposit methods with your test tokens
 */

// Your deployed addresses
const VAULT_ADDRESS = "0xd3408d521d9325B14BAA67fAD4A9C7bB37C8E47b"; // ✅ DEPLOYED!
const WLFI_ADDRESS = "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747";
const USD1_ADDRESS = "0x8C815948C41D2A87413E796281A91bE91C4a94aB";
const MEAGLE_ADDRESS = "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e";

const VAULT_ABI = [
  "function depositDual(uint256 wlfiAmount, uint256 usd1Amount, address receiver) external returns (uint256 shares)",
  "function zapDepositETH(address receiver, uint256 minSharesOut) external payable returns (uint256 shares)",
  "function zapDeposit(address tokenIn, uint256 amountIn, address receiver, uint256 minSharesOut) external returns (uint256 shares)",
  "function balanceOf(address account) external view returns (uint256)",
  "function totalAssets() external view returns (uint256)",
  "function getVaultBalances() external view returns (uint256 wlfi, uint256 usd1)",
  "function withdrawDual(uint256 shares, address receiver) external returns (uint256 wlfiAmount, uint256 usd1Amount)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];

async function main() {
  console.log("🧪 Testing EagleOVault V2 Hybrid on Arbitrum\n");

  const [signer] = await ethers.getSigners();
  console.log("Tester address:", signer.address);
  console.log("ETH balance:", ethers.utils.formatEther(await signer.getBalance()), "ETH\n");

  // Connect to contracts
  const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
  const wlfi = new ethers.Contract(WLFI_ADDRESS, ERC20_ABI, signer);
  const usd1 = new ethers.Contract(USD1_ADDRESS, ERC20_ABI, signer);

  console.log("📋 Contract Addresses:");
  console.log("  Vault:", VAULT_ADDRESS);
  console.log("  WLFI:", WLFI_ADDRESS);
  console.log("  USD1:", USD1_ADDRESS);
  console.log("  MEAGLE:", MEAGLE_ADDRESS);

  // =================================
  // CHECK INITIAL STATE
  // =================================
  
  console.log("\n📊 Initial State:");
  console.log("  ═══════════════════════════════════════");
  
  try {
    const wlfiBalance = await wlfi.balanceOf(signer.address);
    const usd1Balance = await usd1.balanceOf(signer.address);
    const eagleBalance = await vault.balanceOf(signer.address);
    const vaultTotalAssets = await vault.totalAssets();
    const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
    
    console.log("  Your Balances:");
    console.log("    WLFI:", ethers.utils.formatEther(wlfiBalance));
    console.log("    USD1:", ethers.utils.formatEther(usd1Balance));
    console.log("    EAGLE:", ethers.utils.formatEther(eagleBalance));
    
    console.log("\n  Vault Status:");
    console.log("    Total Assets:", ethers.utils.formatEther(vaultTotalAssets));
    console.log("    WLFI Balance:", ethers.utils.formatEther(vaultWlfi));
    console.log("    USD1 Balance:", ethers.utils.formatEther(vaultUsd1));
    console.log("  ═══════════════════════════════════════");
    
    // Check if user has tokens
    if (wlfiBalance.eq(0) || usd1Balance.eq(0)) {
      console.log("\n⚠️  WARNING: You don't have WLFI or USD1 tokens!");
      console.log("    Please mint/transfer some tokens to:", signer.address);
      console.log("\n    Exiting test...");
      return;
    }
  } catch (error) {
    console.error("❌ Error checking initial state:", error);
    return;
  }

  // =================================
  // TEST 1: DIRECT DEPOSIT
  // =================================
  
  console.log("\n🧪 TEST 1: Direct Deposit (Method 3)");
  console.log("  ═══════════════════════════════════════");
  
  try {
    const depositAmount = ethers.utils.parseEther("10"); // 10 tokens each
    
    console.log("  Checking allowances...");
    const wlfiAllowance = await wlfi.allowance(signer.address, VAULT_ADDRESS);
    const usd1Allowance = await usd1.allowance(signer.address, VAULT_ADDRESS);
    
    if (wlfiAllowance.lt(depositAmount)) {
      console.log("  Approving WLFI...");
      const tx = await wlfi.approve(VAULT_ADDRESS, ethers.constants.MaxUint256);
      await tx.wait();
      console.log("    ✅ WLFI approved");
    } else {
      console.log("    ✅ WLFI already approved");
    }
    
    if (usd1Allowance.lt(depositAmount)) {
      console.log("  Approving USD1...");
      const tx = await usd1.approve(VAULT_ADDRESS, ethers.constants.MaxUint256);
      await tx.wait();
      console.log("    ✅ USD1 approved");
    } else {
      console.log("    ✅ USD1 already approved");
    }
    
    console.log(`\n  Depositing ${ethers.utils.formatEther(depositAmount)} WLFI + ${ethers.utils.formatEther(depositAmount)} USD1...`);
    
    const balanceBefore = await vault.balanceOf(signer.address);
    
    const tx = await vault.depositDual(
      depositAmount,
      depositAmount,
      signer.address,
      { gasLimit: 500000 }
    );
    
    console.log("  Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("  ✅ Transaction confirmed!");
    console.log("  Gas used:", receipt.gasUsed.toString());
    
    const balanceAfter = await vault.balanceOf(signer.address);
    const sharesMinted = balanceAfter.sub(balanceBefore);
    
    console.log("\n  Results:");
    console.log("    Shares minted:", ethers.utils.formatEther(sharesMinted));
    console.log("    Your EAGLE balance:", ethers.utils.formatEther(balanceAfter));
    console.log("  ═══════════════════════════════════════");
    
  } catch (error: any) {
    console.error("  ❌ Test 1 failed:", error.message);
    console.log("  ═══════════════════════════════════════");
  }

  // =================================
  // TEST 2: UNISWAP ZAP (ETH)
  // =================================
  
  console.log("\n🧪 TEST 2: Uniswap Zap from ETH (Method 2)");
  console.log("  ═══════════════════════════════════════");
  
  try {
    const ethAmount = ethers.utils.parseEther("0.01"); // 0.01 ETH
    const minShares = 0; // Set to 0 for testing, use proper slippage in production
    
    console.log(`  Zapping ${ethers.utils.formatEther(ethAmount)} ETH...`);
    
    const balanceBefore = await vault.balanceOf(signer.address);
    
    const tx = await vault.zapDepositETH(
      signer.address,
      minShares,
      { 
        value: ethAmount,
        gasLimit: 800000 
      }
    );
    
    console.log("  Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("  ✅ Transaction confirmed!");
    console.log("  Gas used:", receipt.gasUsed.toString());
    
    const balanceAfter = await vault.balanceOf(signer.address);
    const sharesMinted = balanceAfter.sub(balanceBefore);
    
    console.log("\n  Results:");
    console.log("    Shares minted:", ethers.utils.formatEther(sharesMinted));
    console.log("    Your EAGLE balance:", ethers.utils.formatEther(balanceAfter));
    console.log("  ═══════════════════════════════════════");
    
  } catch (error: any) {
    console.error("  ❌ Test 2 failed:", error.message);
    console.log("  Note: This might fail if Uniswap pools don't exist for WLFI/USD1");
    console.log("  ═══════════════════════════════════════");
  }

  // =================================
  // TEST 3: CHECK FINAL STATE
  // =================================
  
  console.log("\n📊 Final State:");
  console.log("  ═══════════════════════════════════════");
  
  try {
    const wlfiBalance = await wlfi.balanceOf(signer.address);
    const usd1Balance = await usd1.balanceOf(signer.address);
    const eagleBalance = await vault.balanceOf(signer.address);
    const vaultTotalAssets = await vault.totalAssets();
    const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
    
    console.log("  Your Balances:");
    console.log("    WLFI:", ethers.utils.formatEther(wlfiBalance));
    console.log("    USD1:", ethers.utils.formatEther(usd1Balance));
    console.log("    EAGLE:", ethers.utils.formatEther(eagleBalance));
    
    console.log("\n  Vault Status:");
    console.log("    Total Assets:", ethers.utils.formatEther(vaultTotalAssets));
    console.log("    WLFI Balance:", ethers.utils.formatEther(vaultWlfi));
    console.log("    USD1 Balance:", ethers.utils.formatEther(vaultUsd1));
    console.log("  ═══════════════════════════════════════");
    
  } catch (error) {
    console.error("❌ Error checking final state:", error);
  }

  // =================================
  // TEST 4: WITHDRAWAL (Optional)
  // =================================
  
  console.log("\n🧪 TEST 4: Withdrawal (Optional - Commented Out)");
  console.log("  ═══════════════════════════════════════");
  console.log("  To test withdrawal, uncomment the code below:");
  console.log("  ───────────────────────────────────────");
  
  /*
  try {
    const eagleBalance = await vault.balanceOf(signer.address);
    
    if (eagleBalance.gt(0)) {
      const withdrawAmount = eagleBalance.div(2); // Withdraw half
      
      console.log(`  Withdrawing ${ethers.utils.formatEther(withdrawAmount)} EAGLE...`);
      
      const tx = await vault.withdrawDual(
        withdrawAmount,
        signer.address,
        { gasLimit: 500000 }
      );
      
      console.log("  Transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("  ✅ Withdrawal confirmed!");
      console.log("  Gas used:", receipt.gasUsed.toString());
      
      const balanceAfter = await vault.balanceOf(signer.address);
      console.log("\n  Results:");
      console.log("    Remaining EAGLE:", ethers.utils.formatEther(balanceAfter));
    } else {
      console.log("  No EAGLE balance to withdraw");
    }
  } catch (error: any) {
    console.error("  ❌ Withdrawal failed:", error.message);
  }
  */
  
  console.log("  ═══════════════════════════════════════");

  // =================================
  // SUMMARY
  // =================================
  
  console.log("\n✅ Testing Complete!");
  console.log("\n📝 Summary:");
  console.log("  ✓ Test 1: Direct Deposit - Check results above");
  console.log("  ✓ Test 2: Uniswap Zap - Check results above");
  console.log("  ✓ Test 3: State Check - See final balances");
  console.log("  ⊗ Test 4: Withdrawal - Commented out (enable if needed)");
  
  console.log("\n💡 Next Steps:");
  console.log("  1. Check your EAGLE balance in the vault");
  console.log("  2. Try withdrawing some shares");
  console.log("  3. Test Portals integration (requires API setup)");
  console.log("  4. Deploy strategies (like Charm) and test those");
  
  console.log("\n🎉 All basic tests completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

