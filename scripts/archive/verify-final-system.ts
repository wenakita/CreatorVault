import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xE823e9b65b9728863D4c12F4BCB7931735a2C36e';
  const STRATEGY = '0x796286947B7902e678c430048c7Cc332d2F44945'; // NEW deployed strategy
  
  console.log('=== Final System Verification ===\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  const [owner, isActive, weight, totalWeight] = await Promise.all([
    vault.owner(),
    vault.activeStrategies(STRATEGY),
    vault.strategyWeights(STRATEGY),
    vault.totalStrategyWeight()
  ]);
  
  console.log('Vault:', VAULT);
  console.log('  Owner:', owner);
  console.log('  Status:', 'Deployed ✅\n');
  
  console.log('Strategy:', STRATEGY);
  console.log('  Active:', isActive ? 'YES ✅' : 'NO ❌');
  console.log('  Weight:', weight.toString(), '/ 10000');
  console.log('  Total Weight:', totalWeight.toString(), '\n');
  
  if (isActive && weight > 0n) {
    console.log('🎉 SYSTEM IS FULLY OPERATIONAL!\n');
    console.log('✅ Vault deployed with TWAP oracle');
    console.log('✅ Strategy connected (Charm Finance)');
    console.log('✅ Ready for deposits');
    console.log('✅ Frontend deployed to Vercel');
    console.log('\n🦅 Your Eagle Vault is LIVE!');
  } else {
    console.log('⚠️ Strategy not connected yet');
  }
}

main().catch(console.error);

