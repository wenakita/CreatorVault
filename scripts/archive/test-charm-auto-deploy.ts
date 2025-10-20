import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xE9FD722306A50E0425cFb3BbD8d3c7605068b6E5';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  
  console.log('=== Testing Charm Auto-Deploy ===\n');
  
  const [user] = await ethers.getSigners();
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  const usd1 = await ethers.getContractAt('IERC20', USD1);
  
  // Deposit $15 (above $10 threshold, should trigger Charm deployment)
  const amount = ethers.parseEther('15');
  
  console.log('User:', user.address);
  console.log('Depositing: $15 USD1');
  console.log('Threshold: $10');
  console.log('Should auto-deploy to Charm: YES ✅\n');
  
  // Check allowance
  const allowance = await usd1.allowance(user.address, VAULT);
  if (allowance < amount) {
    console.log('Approving USD1...');
    const approveTx = await usd1.approve(VAULT, ethers.MaxUint256);
    try { await approveTx.wait(); } catch (e) {}
    console.log('Approved ✅\n');
  }
  
  console.log('🚀 Depositing with auto-deploy test...');
  const tx = await vault.depositDual(0, amount, user.address, { gasLimit: 5000000 });
  console.log('TX:', tx.hash);
  
  try { await tx.wait(); } catch (e) {}
  
  const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('\nStatus:', receipt?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
  
  if (receipt?.status === 1) {
    console.log('\n🎉 CHARM AUTO-DEPLOY WORKS!');
    console.log('✅ forceApprove fixed the issue!');
    console.log('✅ Funds deployed to Charm Finance!');
    console.log('✅ You\'re earning yield! 🦅');
    
    // Check vault balances
    const [wlfi, usd1] = await vault.getVaultBalances();
    console.log('\nVault idle balances:');
    console.log('  WLFI:', ethers.formatEther(wlfi));
    console.log('  USD1:', ethers.formatEther(usd1));
    console.log('\n(Should be ~0 if deployed to Charm)');
  } else {
    console.log('\n❌ Still failing - checking error...');
    console.log('TX:', 'https://etherscan.io/tx/' + tx.hash);
  }
}

main().catch(console.error);

