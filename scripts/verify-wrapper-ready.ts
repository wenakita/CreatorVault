import { ethers } from "hardhat";

/**
 * Verify wrapper is ready for wrapping operations
 */
async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Checking with account:", signer.address);
  
  // Addresses
  const VAULT_ADDRESS = "0x32a2544De7a644833fE7659dF95e5bC16E698d99";
  const OFT_ADDRESS = "0x477d42841dC5A7cCBc2f72f4448f5eF6B61eA91E";
  const WRAPPER_ADDRESS = "0xF9CEf2f5E9bb504437b770ED75cA4D46c407ba03";
  
  console.log("\n📍 Contract Addresses:");
  console.log("Vault (vEAGLE):", VAULT_ADDRESS);
  console.log("OFT (EAGLE):", OFT_ADDRESS);
  console.log("Wrapper:", WRAPPER_ADDRESS);
  
  // Get contracts
  const vault = await ethers.getContractAt("EagleOVault", VAULT_ADDRESS);
  const oft = await ethers.getContractAt("EagleShareOFT", OFT_ADDRESS);
  const wrapper = await ethers.getContractAt("EagleVaultWrapper", WRAPPER_ADDRESS);
  
  console.log("\n🔍 Checking OFT Configuration...");
  
  // Check vault bridge
  const vaultBridge = await oft.vaultBridge();
  console.log("Vault bridge:", vaultBridge);
  console.log("✅ Vault bridge set:", vaultBridge === WRAPPER_ADDRESS);
  
  // Check fee exempt
  const isFeeExempt = await oft.feeExempt(WRAPPER_ADDRESS);
  console.log("✅ Wrapper fee exempt:", isFeeExempt);
  
  console.log("\n🔍 Checking Wrapper Configuration...");
  
  // Check wrapper config
  const wrapperVault = await wrapper.VAULT_EAGLE();
  const wrapperOft = await wrapper.OFT_EAGLE();
  console.log("Wrapper vault token:", wrapperVault);
  console.log("Wrapper OFT token:", wrapperOft);
  console.log("✅ Vault matches:", wrapperVault === VAULT_ADDRESS);
  console.log("✅ OFT matches:", wrapperOft === OFT_ADDRESS);
  
  // Check fees
  const [depositFee, withdrawFee] = await wrapper.getFees();
  console.log("\n💰 Wrapper Fees:");
  console.log("Deposit fee (wrap):", depositFee.toString(), "bp (", Number(depositFee) / 100, "%)");
  console.log("Withdraw fee (unwrap):", withdrawFee.toString(), "bp (", Number(withdrawFee) / 100, "%)");
  
  // Check user balance
  const userVaultBalance = await vault.balanceOf(signer.address);
  const userOftBalance = await oft.balanceOf(signer.address);
  console.log("\n👤 Your Balances:");
  console.log("vEAGLE:", ethers.formatEther(userVaultBalance));
  console.log("EAGLE:", ethers.formatEther(userOftBalance));
  
  // Check allowance
  const allowance = await vault.allowance(signer.address, WRAPPER_ADDRESS);
  console.log("\n🔓 Allowance:");
  console.log("vEAGLE approved for wrapper:", ethers.formatEther(allowance));
  
  // Check if whitelisted
  const isWhitelisted = await wrapper.isWhitelisted(signer.address);
  console.log("Whitelisted (no fees):", isWhitelisted);
  
  console.log("\n📊 Wrapper Statistics:");
  const totalLocked = await wrapper.totalLocked();
  const totalMinted = await wrapper.totalMinted();
  const isBalanced = await wrapper.isBalanced();
  console.log("Total locked (vEAGLE):", ethers.formatEther(totalLocked));
  console.log("Total minted (EAGLE):", ethers.formatEther(totalMinted));
  console.log("✅ Bridge balanced:", isBalanced);
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ WRAPPER STATUS CHECK");
  console.log("=".repeat(60));
  
  const allGood = 
    vaultBridge === WRAPPER_ADDRESS &&
    isFeeExempt &&
    wrapperVault === VAULT_ADDRESS &&
    wrapperOft === OFT_ADDRESS &&
    isBalanced;
  
  if (allGood) {
    console.log("\n🎉 ALL SYSTEMS GO!");
    console.log("\n✅ You can now wrap vEAGLE → EAGLE");
    console.log("✅ You can now unwrap EAGLE → vEAGLE");
    
    if (userVaultBalance > 0n) {
      console.log("\n💡 To wrap your vEAGLE:");
      console.log("1. Approve the wrapper to spend your vEAGLE");
      console.log("2. Call wrapper.wrap(amount)");
      
      if (allowance === 0n) {
        console.log("\n⚠️  You need to approve the wrapper first!");
        console.log(`   vault.approve("${WRAPPER_ADDRESS}", amount)`);
      }
    } else {
      console.log("\n💡 You need some vEAGLE to wrap!");
      console.log("   Deposit to the vault first to get vEAGLE shares");
    }
  } else {
    console.log("\n❌ CONFIGURATION ISSUES DETECTED!");
    console.log("\nPlease fix the issues above before wrapping");
  }
  
  console.log("\n🔗 Etherscan Links:");
  console.log("Vault:", `https://etherscan.io/address/${VAULT_ADDRESS}`);
  console.log("OFT:", `https://etherscan.io/address/${OFT_ADDRESS}`);
  console.log("Wrapper:", `https://etherscan.io/address/${WRAPPER_ADDRESS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

