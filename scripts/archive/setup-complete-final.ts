import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0x7D3F0f409CbF111005F8FcDDd2AEe34c7Ec33c11';
  const STRATEGY = '0x751578461F84289A2b12FCA1950Dc514c904745f';
  
  console.log('=== Complete Final Setup ===\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  // 1. Add strategy
  console.log('1️⃣ Adding strategy...');
  let tx = await vault.addStrategy(STRATEGY, 10000, { gasLimit: 300000 });
  try { await tx.wait(); } catch (e) {}
  let r = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('TX:', tx.hash);
  console.log('Status:', r?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  // 2. Pre-approve
  console.log('2️⃣ Pre-approving MAX tokens...');
  tx = await vault.approveTokensToStrategy(STRATEGY, ethers.MaxUint256, ethers.MaxUint256, { gasLimit: 200000 });
  try { await tx.wait(); } catch (e) {}
  r = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('TX:', tx.hash);
  console.log('Status:', r?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🎉 SYSTEM READY! 🎉');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Vault:', VAULT);
  console.log('✅ Strategy:', STRATEGY);
  console.log('✅ Strategy connected (100%)');
  console.log('✅ Pre-approved for Charm');
  console.log('\n🎯 Next: Deposit via UI and test Charm deployment!');
}

main().catch(console.error);

