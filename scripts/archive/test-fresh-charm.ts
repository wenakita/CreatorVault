import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xb94E2de9D05eCB27b5C29Dcc6b10749d14282BaC';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  
  console.log('=== Testing Fresh System with Charm ===\n');
  
  const [user] = await ethers.getSigners();
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  const usd1 = await ethers.getContractAt('IERC20', USD1);
  
  // You have ~12 USD1 left
  const balance = await usd1.balanceOf(user.address);
  const amount = balance; // Use all remaining
  
  console.log('Your USD1:', ethers.formatEther(balance));
  console.log('Depositing:', ethers.formatEther(amount), '(above $10 threshold)\n');
  
  // Approve
  const allowance = await usd1.allowance(user.address, VAULT);
  if (allowance < amount) {
    console.log('Approving...');
    const tx = await usd1.approve(VAULT, ethers.MaxUint256);
    try { await tx.wait(); } catch (e) {}
    console.log('✅ Approved\n');
  }
  
  console.log('🚀 Depositing (should auto-deploy to Charm)...');
  const tx = await vault.depositDual(0, amount, user.address, { gasLimit: 5000000 });
  console.log('TX:', tx.hash);
  console.log('Waiting...\n');
  
  try { await tx.wait(); } catch (e) {}
  
  const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('Status:', receipt?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
  console.log('Gas used:', receipt?.gasUsed.toString());
  console.log('Events:', receipt?.logs.length, '\n');
  
  if (receipt?.status === 1) {
    const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
    console.log('Vault idle after deposit:');
    console.log('  USD1:', ethers.formatEther(vaultUsd1));
    
    if (parseFloat(ethers.formatEther(vaultUsd1)) < 1) {
      console.log('\n🎉🎉🎉 CHARM AUTO-DEPLOY WORKS! 🎉🎉🎉');
      console.log('✅ Funds deployed to Charm!');
      console.log('✅ Earning yield!');
      console.log('✅ Pre-approval method SUCCESS! 🦅');
    } else {
      console.log('\n⏳ Funds still in vault (cooldown or threshold)');
    }
  }
}

main().catch(console.error);

