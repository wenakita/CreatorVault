import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xF1BA178f27d5bB8dd5559CbEF8c35A6fBF670b62';
  const NEW_STRATEGY = '0xBE328F8Ade13c5638E9B45Ebb1DbD873E64bA9E2';
  
  console.log('=== Connecting Matching Strategy ===\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  // 1. Add new strategy
  console.log('1️⃣ Adding NEW strategy (vault-matched)...');
  const tx1 = await vault.addStrategy(NEW_STRATEGY, 10000, { gasLimit: 300000 });
  try { await tx1.wait(); } catch (e) {}
  const r1 = await ethers.provider.getTransactionReceipt(tx1.hash);
  console.log('Status:', r1?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  // 2. Pre-approve tokens to NEW strategy
  console.log('2️⃣ Pre-approving tokens to NEW strategy...');
  const tx2 = await vault.approveTokensToStrategy(
    NEW_STRATEGY,
    ethers.MaxUint256,
    ethers.MaxUint256,
    { gasLimit: 200000 }
  );
  try { await tx2.wait(); } catch (e) {}
  const r2 = await ethers.provider.getTransactionReceipt(tx2.hash);
  console.log('Status:', r2?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  if (r1?.status === 1 && r2?.status === 1) {
    console.log('🎉 READY FOR CHARM!');
    console.log('✅ Strategy connected');
    console.log('✅ Tokens pre-approved');
    console.log('✅ Now forceDeployToStrategies() should work!');
  }
}

main().catch(console.error);

