import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0x7D3F0f409CbF111005F8FcDDd2AEe34c7Ec33c11';
  
  console.log('=== Deploying Your Funds to Charm Finance ===\n');
  console.log('Vault:', VAULT, '\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  // Check what's in the vault
  const [wlfi, usd1] = await vault.getVaultBalances();
  console.log('Funds to deploy:');
  console.log('  WLFI:', ethers.formatEther(wlfi));
  console.log('  USD1:', ethers.formatEther(usd1), '\n');
  
  console.log('🚀 Calling forceDeployToStrategies()...');
  console.log('This will:');
  console.log('  1. Pull tokens from vault to strategy');
  console.log('  2. Check Charm USD1:WLFI ratio');
  console.log('  3. Swap to match ratio exactly');
  console.log('  4. Deposit to Charm vault\n');
  
  const tx = await vault.forceDeployToStrategies({ gasLimit: 5000000 });
  console.log('TX:', tx.hash);
  console.log('Waiting...\n');
  
  try { await tx.wait(); } catch (e) {}
  
  const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('Status:', receipt?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
  console.log('Gas:', receipt?.gasUsed.toString());
  console.log('Events:', receipt?.logs.length, '\n');
  
  if (receipt?.status === 1) {
    const [newWlfi, newUsd1] = await vault.getVaultBalances();
    console.log('Vault after deployment:');
    console.log('  WLFI:', ethers.formatEther(newWlfi));
    console.log('  USD1:', ethers.formatEther(newUsd1));
    
    if (newWlfi < wlfi / 10n || newUsd1 < usd1 / 10n) {
      console.log('\n🎉🎉🎉 SUCCESS! FUNDS IN CHARM! 🎉🎉🎉');
      console.log('✅ Earning USD1/WLFI LP yield!');
      console.log('✅ Check position: https://alpha.charm.fi/ethereum/vault/0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71');
    } else {
      console.log('\n⚠️  Funds still mostly in vault');
    }
  } else {
    console.log('\n❌ Deployment failed');
    console.log('Check TX:', 'https://etherscan.io/tx/' + tx.hash);
  }
}

main().catch(console.error);

