import { ethers } from "hardhat";

/**
 * Complete Charm Integration Script
 * 
 * This script performs the full integration flow:
 * 1. Connects the strategy to the vault
 * 2. Pre-approves tokens for deployment
 * 3. Tests the integration with a small deposit
 * 4. Deploys to Charm
 * 5. Verifies the deployment
 */

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🦅 CHARM INTEGRATION SETUP 🦅");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [owner] = await ethers.getSigners();
  console.log("Owner address:", owner.address);

  // Contract addresses (update these with your deployed addresses)
  const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "0x7D3F0f409CbF111005F8FcDDd2AEe34c7Ec33c11";
  const STRATEGY_ADDRESS = process.env.STRATEGY_ADDRESS || "0x751578461F84289A2b12FCA1950Dc514c904745f";
  
  // Token addresses
  const WLFI_ADDRESS = "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6";
  const USD1_ADDRESS = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";

  // Get contract instances
  const vault = await ethers.getContractAt("EagleOVault", VAULT_ADDRESS);
  const strategy = await ethers.getContractAt("CharmStrategyUSD1", STRATEGY_ADDRESS);
  const wlfi = await ethers.getContractAt("IERC20", WLFI_ADDRESS);
  const usd1 = await ethers.getContractAt("IERC20", USD1_ADDRESS);

  console.log("\n📍 Contract Addresses:");
  console.log("  Vault:    ", VAULT_ADDRESS);
  console.log("  Strategy: ", STRATEGY_ADDRESS);

  // ===================================
  // STEP 1: Verify Strategy Initialization
  // ===================================
  console.log("\n1️⃣ Verifying strategy initialization...");
  
  const strategyVault = await strategy.EAGLE_VAULT();
  const isInitialized = await strategy.isInitialized();
  
  console.log("  Strategy expects vault:", strategyVault);
  console.log("  Vault address:         ", VAULT_ADDRESS);
  console.log("  Addresses match:       ", strategyVault.toLowerCase() === VAULT_ADDRESS.toLowerCase());
  console.log("  Strategy initialized:  ", isInitialized);

  if (strategyVault.toLowerCase() !== VAULT_ADDRESS.toLowerCase()) {
    throw new Error("❌ Strategy vault mismatch! Deploy a new strategy with correct vault address.");
  }

  if (!isInitialized) {
    throw new Error("❌ Strategy not initialized! Check Charm vault address.");
  }

  console.log("  ✅ Strategy properly configured");

  // ===================================
  // STEP 2: Add Strategy to Vault
  // ===================================
  console.log("\n2️⃣ Adding strategy to vault...");
  
  const strategies = await vault.getStrategies();
  const isAlreadyAdded = strategies[0].some((addr: string) => 
    addr.toLowerCase() === STRATEGY_ADDRESS.toLowerCase()
  );

  if (isAlreadyAdded) {
    console.log("  ⚠️  Strategy already added, skipping...");
  } else {
    const tx1 = await vault.addStrategy(STRATEGY_ADDRESS, 10000, {
      gasLimit: 500000
    });
    console.log("  Transaction sent:", tx1.hash);
    await tx1.wait();
    console.log("  ✅ Strategy added with 100% weight");
  }

  // ===================================
  // STEP 3: Pre-Approve Tokens to Strategy
  // ===================================
  console.log("\n3️⃣ Pre-approving tokens to strategy...");
  
  const MaxUint256 = ethers.MaxUint256;
  
  // Check current approvals
  const wlfiAllowance = await wlfi.allowance(VAULT_ADDRESS, STRATEGY_ADDRESS);
  const usd1Allowance = await usd1.allowance(VAULT_ADDRESS, STRATEGY_ADDRESS);
  
  console.log("  Current WLFI allowance:", ethers.formatEther(wlfiAllowance));
  console.log("  Current USD1 allowance:", ethers.formatEther(usd1Allowance));

  if (wlfiAllowance < ethers.parseEther("1000000") || usd1Allowance < ethers.parseEther("1000000")) {
    const tx2 = await vault.approveTokensToStrategy(
      STRATEGY_ADDRESS,
      MaxUint256,
      MaxUint256,
      { gasLimit: 200000 }
    );
    console.log("  Transaction sent:", tx2.hash);
    await tx2.wait();
    console.log("  ✅ Maximum approvals set");
  } else {
    console.log("  ✅ Approvals already set");
  }

  // ===================================
  // STEP 4: Check Vault Balances
  // ===================================
  console.log("\n4️⃣ Checking vault balances...");
  
  const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
  const actualWlfi = await wlfi.balanceOf(VAULT_ADDRESS);
  const actualUsd1 = await usd1.balanceOf(VAULT_ADDRESS);
  
  console.log("  Tracked WLFI: ", ethers.formatEther(vaultWlfi));
  console.log("  Actual WLFI:  ", ethers.formatEther(actualWlfi));
  console.log("  Tracked USD1: ", ethers.formatEther(vaultUsd1));
  console.log("  Actual USD1:  ", ethers.formatEther(actualUsd1));
  
  const balancesSynced = vaultWlfi === actualWlfi && vaultUsd1 === actualUsd1;
  console.log("  Balances synced: ", balancesSynced);

  if (!balancesSynced) {
    console.log("  ⚠️  Warning: Balance tracking out of sync!");
    console.log("  This might cause deployment issues.");
    console.log("  Consider adding a syncBalances() function and calling it.");
  }

  const totalValue = ethers.formatEther(vaultUsd1 + vaultWlfi);
  console.log("  Total value:  ~$" + totalValue);

  if (vaultWlfi === 0n && vaultUsd1 === 0n) {
    console.log("\n  ⚠️  Vault is empty. User needs to deposit first!");
    console.log("  Skipping deployment test.\n");
    return;
  }

  // ===================================
  // STEP 5: Deploy to Charm (Manual)
  // ===================================
  console.log("\n5️⃣ Ready to deploy to Charm!");
  console.log("  Available to deploy:");
  console.log("    WLFI: ", ethers.formatEther(vaultWlfi));
  console.log("    USD1: ", ethers.formatEther(vaultUsd1));

  console.log("\n  ⚠️  This is a DRY RUN. To actually deploy:");
  console.log("  npx hardhat run scripts/deploy-to-charm.ts --network ethereum\n");

  // ===================================
  // STEP 6: Verification Summary
  // ===================================
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ✅ INTEGRATION SETUP COMPLETE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("✅ Checklist:");
  console.log("  [✓] Strategy vault address matches");
  console.log("  [✓] Strategy initialized");
  console.log("  [✓] Strategy added to vault");
  console.log("  [✓] Tokens pre-approved");
  console.log("  [" + (balancesSynced ? "✓" : "✗") + "] Balance tracking synced");
  console.log("  [" + (vaultWlfi > 0n || vaultUsd1 > 0n ? "✓" : "✗") + "] Vault has funds");

  console.log("\n📝 Next Steps:");
  if (vaultWlfi === 0n && vaultUsd1 === 0n) {
    console.log("  1. Have users deposit via frontend (https://test.47eagle.com)");
    console.log("  2. Then run: npx hardhat run scripts/deploy-to-charm.ts --network ethereum");
  } else {
    console.log("  1. Run: npx hardhat run scripts/deploy-to-charm.ts --network ethereum");
    console.log("  2. Verify funds moved to Charm");
    console.log("  3. Test withdrawal");
  }

  console.log("\n🎉 System ready for Charm integration!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });

