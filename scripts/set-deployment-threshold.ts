import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xE823e9b65b9728863D4c12F4BCB7931735a2C36e';
  
  console.log('=== Updating Deployment Threshold ===\n');
  console.log('Vault:', VAULT);
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  const currentThreshold = await vault.deploymentThreshold();
  const currentInterval = await vault.minDeploymentInterval();
  
  console.log('Current Threshold:', ethers.formatEther(currentThreshold), 'USD');
  console.log('Current Interval:', currentInterval.toString(), 'seconds\n');
  
  const NEW_THRESHOLD = ethers.parseEther('10'); // $10 USD
  
  console.log('🚀 Setting new threshold to $10...');
  const tx = await vault.setDeploymentParams(NEW_THRESHOLD, currentInterval, {
    gasLimit: 100000
  });
  
  console.log('TX:', tx.hash);
  
  // Ignore Hardhat parsing error
  try {
    await tx.wait();
  } catch (e) {}
  
  // Check if it worked
  const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('\nStatus:', receipt?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
  
  if (receipt?.status === 1) {
    console.log('\n✅ Threshold updated to $10!');
    console.log('Funds will now deploy to Charm with just $10 in vault.');
  }
}

main().catch(console.error);

