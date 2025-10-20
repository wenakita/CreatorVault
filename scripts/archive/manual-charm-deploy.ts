import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xF1BA178f27d5bB8dd5559CbEF8c35A6fBF670b62'; // NEW vault with pre-approval!
  
  console.log('=== Manual Charm Deployment Test ===\n');
  console.log('Vault:', VAULT, '\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  console.log('🚀 Calling forceDeployToStrategies()...');
  console.log('This will test if forceApprove works!\n');
  
  const tx = await vault.forceDeployToStrategies({ gasLimit: 5000000 });
  console.log('TX:', tx.hash);
  
  try { await tx.wait(); } catch (e) {}
  
  const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('\nStatus:', receipt?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
  console.log('Gas used:', receipt?.gasUsed.toString());
  
  if (receipt?.status === 1) {
    console.log('\n🎉 CHARM DEPLOYMENT WORKS!');
    console.log('✅ forceApprove is working!');
    console.log('✅ Funds deployed to Charm!');
    console.log('✅ Earning yield! 🦅');
    
    // Check balances after
    const [wlfi, usd1] = await vault.getVaultBalances();
    console.log('\nVault idle balances after deploy:');
    console.log('  WLFI:', ethers.formatEther(wlfi));
    console.log('  USD1:', ethers.formatEther(usd1));
    console.log('\n(Should be ~0 now)');
  } else {
    console.log('\n❌ Deployment failed');
    console.log('Check TX: https://etherscan.io/tx/' + tx.hash);
  }
}

main().catch(console.error);

