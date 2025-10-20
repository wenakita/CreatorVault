import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xe399A4976fFad9C1414dC71139a1A5cF46d44428';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  
  console.log('=== Testing SMALL Deposit (Below $10 threshold) ===\n');
  
  const [user] = await ethers.getSigners();
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  const usd1 = await ethers.getContractAt('IERC20', USD1);
  
  // Deposit $5 (below $10 threshold, won't trigger strategy deployment)
  const amount = ethers.parseEther('5');
  
  console.log('User:', user.address);
  console.log('Depositing:', ethers.formatEther(amount), 'USD1 ($5)');
  console.log('This is BELOW $10 threshold - won\'t auto-deploy to strategy\n');
  
  // Check allowance
  const allowance = await usd1.allowance(user.address, VAULT);
  if (allowance < amount) {
    console.log('Approving USD1...');
    const approveTx = await usd1.approve(VAULT, ethers.MaxUint256);
    try { await approveTx.wait(); } catch (e) {}
    console.log('Approved ✅\n');
  }
  
  console.log('🚀 Depositing...');
  const tx = await vault.depositDual(0, amount, user.address, { gasLimit: 2000000 });
  console.log('TX:', tx.hash);
  
  try { await tx.wait(); } catch (e) {}
  
  const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('\nStatus:', receipt?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
  
  if (receipt?.status === 1) {
    console.log('\n✅ SMALL DEPOSIT WORKED!');
    console.log('The issue is in auto-deployment to strategy.');
    console.log('We need to check the forceApprove in _deployToStrategies()');
  } else {
    console.log('\n❌ Even small deposit failed');
    console.log('Issue is in the deposit function itself');
  }
}

main().catch(console.error);

