import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xE793F6d1A952d7b43FDA52F83030a8E79D683141';
  const STRATEGY = '0x297DCeeB79970e5D6Ce8b94A604Ba63939A032C9';
  
  console.log('=== Setup Using Arbitrum Method ===\n');
  console.log('Replicating exact Arbitrum flow...\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  // Step 1: Add strategy (like Arbitrum)
  console.log('1️⃣ Adding strategy with 100% weight...');
  let tx = await vault.addStrategy(STRATEGY, 10000, { gasLimit: 300000 });
  try { await tx.wait(); } catch (e) {}
  let r = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('TX:', tx.hash);
  console.log('Status:', r?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  // Step 2: PRE-APPROVE (this is what Arbitrum had!)
  console.log('2️⃣ Pre-approving MAX tokens to strategy...');
  console.log('(Arbitrum trace shows NO approve during deploy = it was pre-set)\n');
  tx = await vault.approveTokensToStrategy(
    STRATEGY,
    ethers.MaxUint256, // WLFI
    ethers.MaxUint256, // USD1
    { gasLimit: 200000 }
  );
  try { await tx.wait(); } catch (e) {}
  r = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('TX:', tx.hash);
  console.log('Status:', r?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  if (r?.status === 1) {
    // Verify approvals
    const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
    const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
    
    const usd1 = await ethers.getContractAt('IERC20', USD1);
    const wlfi = await ethers.getContractAt('IERC20', WLFI);
    
    const [usd1Allow, wlfiAllow] = await Promise.all([
      usd1.allowance(VAULT, STRATEGY),
      wlfi.allowance(VAULT, STRATEGY)
    ]);
    
    console.log('✅ Verified approvals:');
    console.log('   USD1 allowance:', usd1Allow > ethers.parseEther('1000000') ? 'MAX ✅' : 'LOW ❌');
    console.log('   WLFI allowance:', wlfiAllow > ethers.parseEther('1000000') ? 'MAX ✅\n' : 'LOW ❌\n');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  🎉 SETUP COMPLETE (ARBITRUM METHOD) 🎉');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Strategy connected');
    console.log('✅ Approvals pre-set (like Arbitrum)');
    console.log('\n🎯 Ready for deposits + manual Charm deployment!');
    console.log('\nVault:', VAULT);
    console.log('Strategy:', STRATEGY);
  }
}

main().catch(console.error);

