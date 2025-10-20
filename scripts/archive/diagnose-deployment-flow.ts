import { ethers } from "hardhat";

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🔍 DIAGNOSING DEPLOYMENT FLOW");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const [owner] = await ethers.getSigners();
  const vault = await ethers.getContractAt("EagleOVault", "0x244b73dC14C01c350C04EAd7e1D8C3FeFeA6AF58");
  const strategy = await ethers.getContractAt("CharmStrategyUSD1", "0x2bF32B2F5F077c7126f8F0289d05352F321f1D67");

  console.log("Owner:", owner.address);
  console.log("Vault:", await vault.getAddress());
  console.log("Strategy:", await strategy.getAddress());

  // Check all conditions
  console.log("\n1️⃣ Checking vault balances...");
  const [wlfi, usd1] = await vault.getVaultBalances();
  console.log("   WLFI:", ethers.formatEther(wlfi));
  console.log("   USD1:", ethers.formatEther(usd1));

  console.log("\n2️⃣ Checking strategy configuration...");
  const strategies = await vault.getStrategies();
  console.log("   Active strategies:", strategies[0].length);
  console.log("   Strategy address:", strategies[0][0]);
  console.log("   Strategy weight:", strategies[1][0].toString());
  
  const totalWeight = await vault.totalStrategyWeight();
  console.log("   Total weight:", totalWeight.toString());

  console.log("\n3️⃣ Checking if strategy is in the list...");
  const strategyAddress = await strategy.getAddress();
  const isActive = await vault.activeStrategies(strategyAddress);
  const weight = await vault.strategyWeights(strategyAddress);
  console.log("   Is active:", isActive);
  console.log("   Weight:", weight.toString());

  console.log("\n4️⃣ Checking approvals...");
  const USD1 = await ethers.getContractAt("IERC20", "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d");
  const WLFI = await ethers.getContractAt("IERC20", "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6");
  
  const usd1Approval = await USD1.allowance(await vault.getAddress(), strategyAddress);
  const wlfiApproval = await WLFI.allowance(await vault.getAddress(), strategyAddress);
  console.log("   USD1 approval:", ethers.formatEther(usd1Approval));
  console.log("   WLFI approval:", ethers.formatEther(wlfiApproval));

  console.log("\n5️⃣ Testing direct strategy deposit call...");
  console.log("   This will attempt to call strategy.deposit() with 1 USD1");
  
  try {
    // Try to estimate gas for the call
    const gas = await strategy.deposit.estimateGas(0, ethers.parseEther("1"));
    console.log("   ✅ Gas estimate succeeded:", gas.toString());
    console.log("   This means the deposit call should work!");
  } catch (error: any) {
    console.log("   ❌ Gas estimate failed:", error.message);
    
    if (error.message.includes("OnlyVault")) {
      console.log("\n   🔍 ERROR: Strategy rejects calls not from vault");
      console.log("   This is expected - only vault can call strategy.deposit()");
    }
  }

  console.log("\n6️⃣ Summary of issues:");
  
  const issues = [];
  if (wlfi === 0n && usd1 === 0n) {
    issues.push("❌ Vault has no tokens to deploy");
  }
  if (totalWeight === 0n) {
    issues.push("❌ No strategy weights configured");
  }
  if (!isActive) {
    issues.push("❌ Strategy not active in vault");
  }
  if (usd1Approval === 0n || wlfiApproval === 0n) {
    issues.push("❌ Missing approvals");
  }

  if (issues.length === 0) {
    console.log("   ✅ All preconditions met!");
    console.log("\n   The issue must be in the vault's _deployToStrategies() logic.");
    console.log("   Let me check if there's a minimum deployment interval...\n");
    
    const lastDeployment = await vault.lastDeployment();
    const minInterval = await vault.minDeploymentInterval();
    const now = Math.floor(Date.now() / 1000);
    const timeSince = now - Number(lastDeployment);
    
    console.log("   Last deployment:", new Date(Number(lastDeployment) * 1000).toLocaleString());
    console.log("   Min interval:", minInterval.toString(), "seconds");
    console.log("   Time since last:", timeSince, "seconds");
    console.log("   Can deploy:", timeSince >= Number(minInterval) ? "✅ YES" : "❌ NO");
  } else {
    issues.forEach(issue => console.log("  ", issue));
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main();

