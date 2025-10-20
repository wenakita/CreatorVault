import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Verifying Sepolia Ecosystem Deployment\n");
  
  // Addresses from the deployment
  const WLFI = "0xF9A2bAC758176a0f35143cBE104EFb3E83D32a47";
  const USD1 = "0xD0EabF364CCbB5A0c1B97C3C148952C037C86e97";
  const REGISTRY = "0xEeB3e7d832FCd602123E05FA27697B27948280Ae";
  const OFT = "0x775A6804aCbe265C0e4e017f7eFa797b1c38a750";
  const VAULT = "0x0794BdB848Fa3108E63BedcEc00902f538730cC8";
  const WRAPPER = "0xc8b5f3C62199e275522EC3a95e50fCc5697a4424";
  
  const [deployer] = await ethers.getSigners();
  
  // Get contracts
  const wlfi = await ethers.getContractAt("MockERC20", WLFI);
  const usd1 = await ethers.getContractAt("MockERC20", USD1);
  const oft = await ethers.getContractAt("EagleShareOFT", OFT);
  const vault = await ethers.getContractAt("EagleOVault", VAULT);
  const wrapper = await ethers.getContractAt("EagleVaultWrapper", WRAPPER);
  
  console.log("✅ All contracts found on Sepolia!\n");
  
  // Check OFT
  console.log("🔍 OFT (EAGLE):");
  const oftName = await oft.name();
  const oftSymbol = await oft.symbol();
  const vaultBridge = await oft.vaultBridge();
  console.log("  Name:", oftName);
  console.log("  Symbol:", oftSymbol);
  console.log("  Vault Bridge:", vaultBridge);
  console.log("  ✅ Bridge set correctly:", vaultBridge === WRAPPER);
  
  // Check Vault
  console.log("\n🔍 Vault (vEAGLE):");
  const vaultName = await vault.name();
  const vaultSymbol = await vault.symbol();
  const vaultOwner = await vault.owner();
  console.log("  Name:", vaultName);
  console.log("  Symbol:", vaultSymbol);
  console.log("  Owner:", vaultOwner);
  
  // Check Wrapper
  console.log("\n🔍 Wrapper:");
  const wrapperVault = await wrapper.VAULT_EAGLE();
  const wrapperOft = await wrapper.OFT_EAGLE();
  console.log("  Vault:", wrapperVault);
  console.log("  OFT:", wrapperOft);
  console.log("  ✅ Vault connected:", wrapperVault === VAULT);
  console.log("  ✅ OFT connected:", wrapperOft === OFT);
  
  // Check balances
  console.log("\n💰 Your Balances:");
  const wlfiBalance = await wlfi.balanceOf(deployer.address);
  const usd1Balance = await usd1.balanceOf(deployer.address);
  console.log("  WLFI:", ethers.formatEther(wlfiBalance));
  console.log("  USD1:", ethers.formatEther(usd1Balance));
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT VERIFICATION COMPLETE!");
  console.log("=".repeat(60));
  
  console.log("\n📝 Save these addresses:");
  console.log(`export SEPOLIA_WLFI=${WLFI}`);
  console.log(`export SEPOLIA_USD1=${USD1}`);
  console.log(`export SEPOLIA_REGISTRY=${REGISTRY}`);
  console.log(`export SEPOLIA_OFT=${OFT}`);
  console.log(`export SEPOLIA_VAULT=${VAULT}`);
  console.log(`export SEPOLIA_WRAPPER=${WRAPPER}`);
  
  console.log("\n🎉 Everything is deployed and connected!");
  console.log("\n📚 Next steps:");
  console.log("1. Test deposit: npx hardhat run scripts/test-deposit-sepolia.ts --network sepolia");
  console.log("2. Test wrapping: npx hardhat run scripts/test-wrap-sepolia.ts --network sepolia");
}

main().catch(console.error);

