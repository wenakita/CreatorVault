import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xF1BA178f27d5bB8dd5559CbEF8c35A6fBF670b62';
  const OLD_STRATEGY = '0x796286947B7902e678c430048c7Cc332d2F44945';
  const NEW_STRATEGY = '0xBE328F8Ade13c5638E9B45Ebb1DbD873E64bA9E2';
  
  console.log('=== Swapping to Matching Strategy ===\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  // 1. Remove old strategy
  console.log('1️⃣ Removing old strategy (wrong vault address)...');
  const tx1 = await vault.removeStrategy(OLD_STRATEGY, { gasLimit: 500000 });
  console.log('TX:', tx1.hash);
  try { await tx1.wait(); } catch (e) {}
  const r1 = await ethers.provider.getTransactionReceipt(tx1.hash);
  console.log('Status:', r1?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  // 2. Add new strategy
  console.log('2️⃣ Adding new strategy (vault-matched)...');
  const tx2 = await vault.addStrategy(NEW_STRATEGY, 10000, { gasLimit: 300000 });
  console.log('TX:', tx2.hash);
  try { await tx2.wait(); } catch (e) {}
  const r2 = await ethers.provider.getTransactionReceipt(tx2.hash);
  console.log('Status:', r2?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  // 3. Pre-approve to new strategy
  console.log('3️⃣ Pre-approving tokens to new strategy...');
  const tx3 = await vault.approveTokensToStrategy(
    NEW_STRATEGY,
    ethers.MaxUint256,
    ethers.MaxUint256,
    { gasLimit: 200000 }
  );
  console.log('TX:', tx3.hash);
  try { await tx3.wait(); } catch (e) {}
  const r3 = await ethers.provider.getTransactionReceipt(tx3.hash);
  console.log('Status:', r3?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  if (r1?.status === 1 && r2?.status === 1 && r3?.status === 1) {
    console.log('🎉 STRATEGY SWAP COMPLETE!');
    console.log('✅ Old strategy removed');
    console.log('✅ New strategy added');
    console.log('✅ Tokens pre-approved');
    console.log('\nReady to deploy to Charm! 🦅');
  }
}

main().catch(console.error);

