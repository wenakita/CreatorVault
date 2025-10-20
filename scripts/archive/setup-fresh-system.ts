import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xb94E2de9D05eCB27b5C29Dcc6b10749d14282BaC';
  const STRATEGY = '0x8F71d820993E0Bbf3AE78156C791BdaF9a947410';
  
  console.log('=== Setting Up Fresh System (Arbitrum Method!) ===\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  // 1. Add strategy
  console.log('1️⃣ Adding strategy (100% weight)...');
  const tx1 = await vault.addStrategy(STRATEGY, 10000, { gasLimit: 300000 });
  try { await tx1.wait(); } catch (e) {}
  const r1 = await ethers.provider.getTransactionReceipt(tx1.hash);
  console.log('Status:', r1?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  // 2. Set threshold
  console.log('2️⃣ Setting threshold to $10...');
  const tx2 = await vault.setDeploymentParams(ethers.parseEther('10'), 300, { gasLimit: 100000 });
  try { await tx2.wait(); } catch (e) {}
  const r2 = await ethers.provider.getTransactionReceipt(tx2.hash);
  console.log('Status:', r2?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  // 3. PRE-APPROVE (KEY STEP - like Arbitrum!)
  console.log('3️⃣ Pre-approving MAX tokens (Arbitrum method)...');
  const tx3 = await vault.approveTokensToStrategy(
    STRATEGY,
    ethers.MaxUint256,
    ethers.MaxUint256,
    { gasLimit: 200000 }
  );
  console.log('TX:', tx3.hash);
  try { await tx3.wait(); } catch (e) {}
  const r3 = await ethers.provider.getTransactionReceipt(tx3.hash);
  console.log('Status:', r3?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  if (r1?.status === 1 && r2?.status === 1 && r3?.status === 1) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  🎉 SYSTEM READY FOR CHARM! 🎉');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Strategy: Connected');
    console.log('✅ Threshold: $10');
    console.log('✅ Approvals: PRE-SET (Arbitrum method)');
    console.log('\n🎯 Ready for deposits with Charm auto-deploy! 🦅');
  }
}

main().catch(console.error);

