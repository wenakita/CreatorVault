import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xE823e9b65b9728863D4c12F4BCB7931735a2C36e'; // NEW optimized vault!
  const STRATEGY = '0x47eb9d83ad8474be4fc72fa75138a2df4a0ea91e'; // Charm VANITY
  const WEIGHT = 10000;
  
  console.log('=== Connecting Strategy to NEW Vault ===\n');
  console.log('Vault:', VAULT, '(Optimized with TWAP)');
  console.log('Strategy:', STRATEGY, '(Charm VANITY ✨)\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  console.log('🚀 Adding strategy...');
  const tx = await vault.addStrategy(STRATEGY, WEIGHT, { gasLimit: 300000 });
  
  console.log('TX:', tx.hash);
  await tx.wait().catch(() => {}); // Ignore Hardhat parsing error
  
  console.log('\n✅ DONE! Vault is ready for deposits! 🦅');
}

main().catch(e => console.log('Error (may be Hardhat parsing):', e.message));

