import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xE793F6d1A952d7b43FDA52F83030a8E79D683141';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  
  console.log('=== FINAL Charm Test (Transfer-First Method) ===\n');
  
  const [user] = await ethers.getSigners();
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  const usd1 = await ethers.getContractAt('IERC20', USD1);
  
  // Deposit $12 (what you actually have, triggers auto-deploy at $10 threshold)
  const amount = ethers.parseEther('12');
  
  console.log('Depositing: $12 USD1 (above $10 threshold)');
  console.log('Expected: Auto-deploy to Charm ✅\n');
  
  // Approve
  const allowance = await usd1.allowance(user.address, VAULT);
  if (allowance < amount) {
    console.log('Approving...');
    const tx = await usd1.approve(VAULT, ethers.MaxUint256);
    try { await tx.wait(); } catch (e) {}
  }
  
  console.log('🚀 Depositing...');
  const tx = await vault.depositDual(0, amount, user.address, { gasLimit: 5000000 });
  console.log('TX:', tx.hash);
  
  try { await tx.wait(); } catch (e) {}
  
  const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('\nDeposit Status:', receipt?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
  
  if (receipt?.status === 1) {
    // Check if funds deployed to Charm
    const [wlfi, usd1Idle] = await vault.getVaultBalances();
    console.log('\nVault idle balances:');
    console.log('  USD1:', ethers.formatEther(usd1Idle));
    
    if (parseFloat(ethers.formatEther(usd1Idle)) < 1) {
      console.log('\n🎉 CHARM AUTO-DEPLOY WORKS!');
      console.log('✅ Funds deployed to Charm!');
      console.log('✅ Earning yield! 🦅');
    } else {
      console.log('\n⚠️  Funds still in vault');
      console.log('Auto-deploy may not have triggered');
    }
  }
}

main().catch(console.error);

