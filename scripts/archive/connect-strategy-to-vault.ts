import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0x1e6049cC14a484049392FEd9077c0931A71F8285';
  const STRATEGY = '0x47eb9d83ad8474be4fc72fa75138a2df4a0ea91e';
  const WEIGHT = 10000; // 100% allocation
  
  console.log('=== Connecting Strategy to Vault ===\n');
  console.log('Vault:', VAULT);
  console.log('Strategy:', STRATEGY);
  console.log('Weight:', WEIGHT, '(100%)\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  // Check if strategy is already added
  const activeStrategies = await vault.activeStrategies(STRATEGY);
  if (activeStrategies) {
    console.log('✅ Strategy already connected!');
    return;
  }
  
  console.log('🚀 Adding strategy to vault...');
  const tx = await vault.addStrategy(STRATEGY, WEIGHT, {
    gasLimit: 300000
  });
  
  console.log('TX:', tx.hash);
  console.log('Waiting for confirmation...\n');
  
  await tx.wait();
  
  console.log('✅ STRATEGY CONNECTED!');
  console.log('\nYour Eagle Vault is now ready:');
  console.log('  ✅ Vault deployed');
  console.log('  ✅ Strategy connected (Charm USD1/WLFI)');  
  console.log('  ✅ Ready for deposits! 🦅');
}

main().catch(console.error);

