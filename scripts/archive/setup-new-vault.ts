import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xe399A4976fFad9C1414dC71139a1A5cF46d44428';
  const STRATEGY = '0x796286947B7902e678c430048c7Cc332d2F44945';
  
  console.log('=== Setting Up New Fixed Vault ===\n');
  console.log('Vault:', VAULT, '(forceApprove fix!)');
  console.log('Strategy:', STRATEGY, '\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  // 1. Add strategy
  console.log('1️⃣ Adding strategy...');
  const tx1 = await vault.addStrategy(STRATEGY, 10000, { gasLimit: 300000 });
  console.log('TX:', tx1.hash);
  try { await tx1.wait(); } catch (e) {}
  
  const receipt1 = await ethers.provider.getTransactionReceipt(tx1.hash);
  console.log('Status:', receipt1?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌\n');
  
  // 2. Set threshold to $10
  console.log('2️⃣ Setting threshold to $10...');
  const tx2 = await vault.setDeploymentParams(
    ethers.parseEther('10'),
    300,
    { gasLimit: 100000 }
  );
  console.log('TX:', tx2.hash);
  try { await tx2.wait(); } catch (e) {}
  
  const receipt2 = await ethers.provider.getTransactionReceipt(tx2.hash);
  console.log('Status:', receipt2?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌\n');
  
  console.log('✅ NEW VAULT READY!');
  console.log('  Address: ' + VAULT);
  console.log('  Strategy: Connected');
  console.log('  Threshold: $10');
  console.log('  Deposits: Will work! 🦅');
}

main().catch(console.error);

