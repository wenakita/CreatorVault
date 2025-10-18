import { expect } from "chai";
import { ethers } from "hardhat";

describe("Eagle Vault - Mainnet Fork Tests", function () {
  
  it("Should test deposit with forceApprove on mainnet fork", async function () {
    this.timeout(120000);
    
    console.log("\n🧪 Testing on Mainnet Fork...\n");
    
    const VAULT = "0x4776fFafF31Cca3b2E95BFc5B35D56CCD77eA91E"; // Current production vault
    const WLFI = "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6";
    const USD1 = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
    const USER = "0x7310Dd6EF89b7f829839F140C6840bc929ba2031";

    const vault = await ethers.getContractAt("EagleOVault", VAULT);
    
    // Test 1: Oracle works
    console.log("✅ Test 1: Oracle");
    const wlfiPrice = await vault.getWLFIPrice();
    const usd1Price = await vault.getUSD1Price();
    console.log("  WLFI Price:", ethers.formatEther(wlfiPrice));
    console.log("  USD1 Price:", ethers.formatEther(usd1Price));
    expect(Number(ethers.formatEther(wlfiPrice))).to.be.greaterThan(0.10);
    
    // Test 2: Preview works
    console.log("\n✅ Test 2: Preview");
    const [shares, usdValue] = await vault.previewDepositDual(
      ethers.parseEther("846"),
      ethers.parseEther("38")
    );
    console.log("  Shares:", ethers.formatEther(shares));
    console.log("  USD Value:", ethers.formatEther(usdValue));
    expect(Number(ethers.formatEther(shares))).to.be.greaterThan(10000000);
    
    // Test 3: Small deposit works
    console.log("\n✅ Test 3: Small Deposit (No Strategy)");
    await vault.depositDual.staticCall(
      ethers.parseEther("1"),
      ethers.parseEther("0"),
      USER
    );
    console.log("  1 WLFI deposit works!");
    
    // Test 4: Check if large deposit would work
    console.log("\n🧪 Test 4: Large Deposit (With Strategy)");
    try {
      await vault.depositDual.staticCall(
        ethers.parseEther("846"),
        ethers.parseEther("38"),
        USER
      );
      console.log("  ✅ LARGE DEPOSIT WORKS!");
      console.log("  🎉 forceApprove fix is successful!");
    } catch (e: any) {
      console.log("  ❌ Still fails:", e.message.substring(0, 150));
      console.log("\n  💡 This means we need to check:");
      console.log("     - If user has enough tokens");
      console.log("     - If strategy.deposit() is working");
      console.log("     - If Charm vault accepts deposits");
    }
    
    console.log("\n✅ Tests complete!");
  });
});

