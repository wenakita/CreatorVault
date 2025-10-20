import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xF1BA178f27d5bB8dd5559CbEF8c35A6fBF670b62';
  
  console.log('=== Deploying to Charm Finance NOW ===\n');
  console.log('Vault:', VAULT);
  console.log('(Pre-approved vault - should work!)\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  const [wlfi, usd1] = await vault.getVaultBalances();
  console.log('Idle balances:');
  console.log('  USD1:', ethers.formatEther(usd1));
  console.log('  WLFI:', ethers.formatEther(wlfi), '\n');
  
  console.log('🚀 Calling forceDeployToStrategies()...');
  const tx = await vault.forceDeployToStrategies({ gasLimit: 5000000 });
  console.log('TX:', tx.hash);
  console.log('Waiting...\n');
  
  try { await tx.wait(); } catch (e) {}
  
  const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('Status:', receipt?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
  console.log('Gas:', receipt?.gasUsed.toString());
  
  if (receipt?.status === 1) {
    // Check new balances
    const [newWlfi, newUsd1] = await vault.getVaultBalances();
    console.log('\nNew idle balances:');
    console.log('  USD1:', ethers.formatEther(newUsd1));
    console.log('  WLFI:', ethers.formatEther(newWlfi));
    
    if (parseFloat(ethers.formatEther(newUsd1)) < 1) {
      console.log('\n🎉 SUCCESS! FUNDS DEPLOYED TO CHARM!');
      console.log('✅ Pre-approval method WORKS!');
      console.log('✅ Earning Charm yield! 🦅');
    }
  } else {
    console.log('\n❌ Failed - check TX:', 'https://etherscan.io/tx/' + tx.hash);
  }
}

main().catch(console.error);

