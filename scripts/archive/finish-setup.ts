import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0x7D3F0f409CbF111005F8FcDDd2AEe34c7Ec33c11';
  const STRATEGY = '0x751578461F84289A2b12FCA1950Dc514c904745f';
  
  console.log('=== Finishing Setup (Pre-Approval) ===\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  console.log('🚀 Pre-approving MAX tokens to strategy...');
  console.log('This allows strategy to pull tokens from vault\n');
  
  const tx = await vault.approveTokensToStrategy(
    STRATEGY,
    ethers.MaxUint256,
    ethers.MaxUint256,
    { gasLimit: 200000 }
  );
  
  console.log('TX:', tx.hash);
  console.log('Waiting...\n');
  
  try { await tx.wait(); } catch (e) {}
  
  const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('Status:', receipt?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  if (receipt?.status === 1) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  🎊 SETUP COMPLETE! 🎊');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Vault:', VAULT);
    console.log('✅ Strategy:', STRATEGY);
    console.log('✅ Pre-approved: MAX tokens ✅');
    console.log('\n🎯 READY FOR DEPOSITS AND CHARM!');
    console.log('\nUser flow:');
    console.log('1. Hard refresh browser');
    console.log('2. Approve WLFI + USD1 to vault');
    console.log('3. Deposit');
    console.log('4. Owner calls forceDeployToStrategies()');
    console.log('5. Funds go to Charm! 🦅');
  }
}

main().catch(console.error);

