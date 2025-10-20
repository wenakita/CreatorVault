import { ethers } from "hardhat";

/**
 * Set the vault bridge on EagleShareOFT to enable wrapping
 * 
 * This allows the EagleVaultWrapper to mint/burn OFT tokens
 */
async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Setting vault bridge with account:", signer.address);
  
  // Addresses
  const OFT_ADDRESS = "0x477d42841dC5A7cCBc2f72f4448f5eF6B61eA91E";
  const WRAPPER_ADDRESS = "0xF9CEf2f5E9bb504437b770ED75cA4D46c407ba03";
  
  console.log("\n📍 Addresses:");
  console.log("OFT:", OFT_ADDRESS);
  console.log("Wrapper:", WRAPPER_ADDRESS);
  
  // Get OFT contract
  const oft = await ethers.getContractAt("EagleShareOFT", OFT_ADDRESS);
  
  // Check current state
  console.log("\n🔍 Checking current state...");
  const currentBridge = await oft.vaultBridge();
  console.log("Current vault bridge:", currentBridge);
  
  if (currentBridge !== ethers.ZeroAddress) {
    console.log("\n⚠️  Vault bridge already set to:", currentBridge);
    if (currentBridge === WRAPPER_ADDRESS) {
      console.log("✅ Already configured correctly!");
      return;
    } else {
      console.log("❌ ERROR: Bridge is set to a different address!");
      console.log("   Contract only allows setting bridge once!");
      return;
    }
  }
  
  // Set the vault bridge
  console.log("\n📝 Setting vault bridge to wrapper...");
  const tx = await oft.setVaultBridge(WRAPPER_ADDRESS);
  console.log("Transaction hash:", tx.hash);
  
  console.log("⏳ Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("✅ Confirmed in block:", receipt?.blockNumber);
  
  // Verify
  console.log("\n🔍 Verifying...");
  const newBridge = await oft.vaultBridge();
  console.log("Vault bridge now set to:", newBridge);
  
  const isFeeExempt = await oft.feeExempt(WRAPPER_ADDRESS);
  console.log("Wrapper fee exempt:", isFeeExempt);
  
  if (newBridge === WRAPPER_ADDRESS && isFeeExempt) {
    console.log("\n✅ SUCCESS! Wrapper can now mint/burn OFT tokens");
    console.log("\n🎉 Users can now wrap vEAGLE → EAGLE!");
  } else {
    console.log("\n❌ ERROR: Something went wrong!");
  }
  
  console.log("\n📊 Summary:");
  console.log("✅ OFT contract:", OFT_ADDRESS);
  console.log("✅ Wrapper contract:", WRAPPER_ADDRESS);
  console.log("✅ Vault bridge set:", newBridge === WRAPPER_ADDRESS);
  console.log("✅ Fee exempt:", isFeeExempt);
  console.log("\nEtherscan:", `https://etherscan.io/tx/${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

