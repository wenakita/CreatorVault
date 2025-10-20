import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xE823e9b65b9728863D4c12F4BCB7931735a2C36e';
  const STRATEGY = '0x796286947B7902e678c430048c7Cc332d2F44945';
  
  console.log('=== Connecting Strategy ===\n');
  console.log('Vault:', VAULT);
  console.log('Strategy:', STRATEGY, '\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  console.log('🚀 Adding strategy with 100% weight...');
  const tx = await vault.addStrategy(STRATEGY, 10000, { gasLimit: 300000 });
  console.log('TX:', tx.hash);
  
  // Wait and ignore Hardhat error
  try {
    await tx.wait();
  } catch (e) {}
  
  // Check if it actually worked
  const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('\nStatus:', receipt?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
  
  if (receipt?.status === 1) {
    console.log('\n🎉 STRATEGY CONNECTED!');
    console.log('Eagle Vault is now FULLY OPERATIONAL! 🦅');
  }
}

main().catch(console.error);

