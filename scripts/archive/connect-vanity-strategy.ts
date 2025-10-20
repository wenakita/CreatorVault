import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0x47b625c800609d4f283c9978a672e2c0510ea91e';
  const STRATEGY = '0x47eb9d83ad8474be4fc72fa75138a2df4a0ea91e';
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  console.log('Connecting vanity strategy to vanity vault...');
  console.log('Vault:', VAULT);
  console.log('Strategy:', STRATEGY);
  
  const tx = await vault.addStrategy(STRATEGY, 10000);
  await tx.wait();
  
  console.log('\n✅ Connected!');
  console.log('\n🎊 BOTH VANITY ADDRESSES!');
  console.log('Vault:    0x47b625c8...ea91e');
  console.log('Strategy: 0x47eb9d83...ea91e');
}

main().catch(console.error);

