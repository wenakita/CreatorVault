import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0x7D3F0f409CbF111005F8FcDDd2AEe34c7Ec33c11';
  const STRATEGY = '0x751578461F84289A2b12FCA1950Dc514c904745f';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  
  console.log('=== Testing USD1-Only Charm Deployment ===\n');
  console.log('Maybe we can deploy JUST USD1 to Charm?\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  const strategy = await ethers.getContractAt('CharmStrategyUSD1', STRATEGY);
  const usd1 = await ethers.getContractAt('IERC20', USD1);
  
  // Check actual USD1 balance
  const vaultUsd1 = await usd1.balanceOf(VAULT);
  const allowance = await usd1.balanceOf(VAULT, STRATEGY);
  
  console.log('USD1 in vault:', ethers.formatEther(vaultUsd1));
  console.log('\nStrategy can deposit with just USD1');
  console.log('It will swap some USD1 → WLFI to match Charm ratio\n');
  
  console.log('🚀 Calling strategy.deposit(0, 10) directly...');
  console.log('(0 WLFI, 10 USD1)\n');
  
  try {
    const tx = await strategy.deposit(0, ethers.parseEther('10'), { gasLimit: 5000000 });
    console.log('TX:', tx.hash);
    try { await tx.wait(); } catch (e) {}
    const r = await ethers.provider.getTransactionReceipt(tx.hash);
    console.log('Status:', r?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
    
    if (r?.status === 1) {
      console.log('\n🎉 USD1-only deposit WORKS!');
      console.log('Strategy swapped and deposited to Charm!');
    }
  } catch (error: any) {
    console.log('Error:', error.message.slice(0, 80));
    console.log('\nLikely: OnlyVault modifier (we\'re not calling as vault)');
  }
}

main().catch(console.error);

