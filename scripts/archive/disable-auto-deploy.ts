import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xe399A4976fFad9C1414dC71139a1A5cF46d44428';
  
  console.log('=== Disabling Auto-Deploy (Temporary Fix) ===\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  // Set threshold to $1M (effectively disables auto-deploy)
  // Users can still deposit, owner can manually deploy later
  const HIGH_THRESHOLD = ethers.parseEther('1000000');
  
  console.log('Setting threshold to $1M (disables auto-deploy)...');
  const tx = await vault.setDeploymentParams(HIGH_THRESHOLD, 300, { gasLimit: 100000 });
  console.log('TX:', tx.hash);
  
  try { await tx.wait(); } catch (e) {}
  
  const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('Status:', receipt?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌\n');
  
  if (receipt?.status === 1) {
    console.log('✅ Auto-deploy DISABLED!');
    console.log('\nNow users can:');
    console.log('  ✅ Deposit any amount');
    console.log('  ✅ Funds stay in vault (safe)');
    console.log('  ⚠️  Owner must manually deploy to Charm');
    console.log('\nTo deploy: Call forceDeployToStrategies()');
  }
}

main().catch(console.error);

