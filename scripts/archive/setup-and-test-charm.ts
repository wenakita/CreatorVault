import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xF1BA178f27d5bB8dd5559CbEF8c35A6fBF670b62';
  const STRATEGY = '0x796286947B7902e678c430048c7Cc332d2F44945';
  
  console.log('=== Setup & Test Charm with Manual Approval ===\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  // 1. Add strategy
  console.log('1️⃣ Adding strategy...');
  const tx1 = await vault.addStrategy(STRATEGY, 10000, { gasLimit: 300000 });
  try { await tx1.wait(); } catch (e) {}
  const r1 = await ethers.provider.getTransactionReceipt(tx1.hash);
  console.log('Status:', r1?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  // 2. Set threshold to $10
  console.log('2️⃣ Setting threshold to $10...');
  const tx2 = await vault.setDeploymentParams(ethers.parseEther('10'), 300, { gasLimit: 100000 });
  try { await tx2.wait(); } catch (e) {}
  const r2 = await ethers.provider.getTransactionReceipt(tx2.hash);
  console.log('Status:', r2?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  // 3. PRE-APPROVE tokens to strategy (THE KEY STEP!)
  console.log('3️⃣ Pre-approving USD1/WLFI to strategy...');
  const tx3 = await vault.approveTokensToStrategy(
    STRATEGY,
    ethers.MaxUint256, // WLFI
    ethers.MaxUint256, // USD1
    { gasLimit: 200000 }
  );
  console.log('TX:', tx3.hash);
  try { await tx3.wait(); } catch (e) {}
  const r3 = await ethers.provider.getTransactionReceipt(tx3.hash);
  console.log('Status:', r3?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  if (r3?.status === 1) {
    console.log('✅ VAULT IS READY!');
    console.log('Now _deployToStrategies() will work because');
    console.log('approvals are already set!\n');
    console.log('Test: Deposit $12+ and it should auto-deploy to Charm! 🦅');
  } else {
    console.log('❌ Pre-approval failed');
    console.log('Even manual approve() fails - deeper issue');
  }
}

main().catch(console.error);

