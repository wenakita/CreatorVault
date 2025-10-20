import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xcd033522d822d8A127d04f1812a6Ba8C0DA798ae';
  const STRATEGY = '0x796286947B7902e678c430048c7Cc332d2F44945';
  
  console.log('=== Setting Up FINAL Vault (Foundry Deployed!) ===\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  // 1. Add strategy
  console.log('1️⃣ Adding Charm strategy...');
  const tx1 = await vault.addStrategy(STRATEGY, 10000, { gasLimit: 300000 });
  console.log('TX:', tx1.hash);
  try { await tx1.wait(); } catch (e) {}
  const r1 = await ethers.provider.getTransactionReceipt(tx1.hash);
  console.log('Status:', r1?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  // 2. Set threshold to $10
  console.log('2️⃣ Setting threshold to $10...');
  const tx2 = await vault.setDeploymentParams(ethers.parseEther('10'), 300, { gasLimit: 100000 });
  console.log('TX:', tx2.hash);
  try { await tx2.wait(); } catch (e) {}
  const r2 = await ethers.provider.getTransactionReceipt(tx2.hash);
  console.log('Status:', r2?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  console.log('✅ VAULT READY FOR TESTING!');
  console.log('Address:', VAULT);
}

main().catch(console.error);

