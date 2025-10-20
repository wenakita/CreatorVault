import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xE793F6d1A952d7b43FDA52F83030a8E79D683141';
  const STRATEGY = '0x297DCeeB79970e5D6Ce8b94A604Ba63939A032C9';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  
  console.log('=== Full Charm Flow Test (Arbitrum Method) ===\n');
  
  const [user] = await ethers.getSigners();
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  const usd1Contract = await ethers.getContractAt('IERC20', USD1);
  const wlfiContract = await ethers.getContractAt('IERC20', WLFI);
  
  // Get your balances
  const [usd1Bal, wlfiBal] = await Promise.all([
    usd1Contract.balanceOf(user.address),
    wlfiContract.balanceOf(user.address)
  ]);
  
  console.log('Your wallet:');
  console.log('  USD1:', ethers.formatEther(usd1Bal));
  console.log('  WLFI:', ethers.formatEther(wlfiBal), '\n');
  
  // STEP 1: Deposit (no auto-deploy)
  console.log('1️⃣ Depositing all USD1 + WLFI...');
  let tx = await vault.depositDual(wlfiBal, usd1Bal, user.address, { gasLimit: 2000000 });
  console.log('TX:', tx.hash);
  try { await tx.wait(); } catch (e) {}
  let r = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('Status:', r?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  if (r?.status === 1) {
    const shares = await vault.balanceOf(user.address);
    console.log('✅ Deposited! You have:', ethers.formatEther(shares), 'vEAGLE\n');
    
    // STEP 2: Manual deploy to Charm
    console.log('2️⃣ Manually deploying to Charm...');
    console.log('Strategy will:');
    console.log('   - Pull 27 USD1 + 81 WLFI from vault (approved!)');
    console.log('   - Check Charm USD1:WLFI ratio');
    console.log('   - Swap to match ratio exactly');
    console.log('   - Deposit to Charm vault\n');
    
    tx = await vault.forceDeployToStrategies({ gasLimit: 5000000 });
    console.log('TX:', tx.hash);
    console.log('Waiting...\n');
    
    try { await tx.wait(); } catch (e) {}
    r = await ethers.provider.getTransactionReceipt(tx.hash);
    
    console.log('Status:', r?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
    console.log('Gas used:', r?.gasUsed.toString());
    console.log('Events:', r?.logs.length, '\n');
    
    if (r?.status === 1) {
      // Check where funds went
      const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
      const stratAmounts = await ethers.getContractAt('IStrategy', STRATEGY).then(s => s.getTotalAmounts());
      
      console.log('Vault idle:');
      console.log('  USD1:', ethers.formatEther(vaultUsd1));
      console.log('  WLFI:', ethers.formatEther(vaultWlfi));
      
      console.log('\nStrategy holdings:');
      console.log('  USD1:', ethers.formatEther(stratAmounts[1]));
      console.log('  WLFI:', ethers.formatEther(stratAmounts[0]));
      
      if (stratAmounts[0] > 0n || stratAmounts[1] > 0n) {
        console.log('\n🎉🎉🎉 CHARM WORKS! 🎉🎉🎉');
        console.log('✅ Funds deployed to Charm!');
        console.log('✅ Earning USD1/WLFI LP yield!');
        console.log('✅ Arbitrum method SUCCESS! 🦅');
      } else {
        console.log('\n⚠️  Funds not in strategy yet');
      }
    } else {
      console.log('\n❌ Deployment failed');
      console.log('Check TX:', 'https://etherscan.io/tx/' + tx.hash);
    }
  } else {
    console.log('❌ Deposit failed - check TX:', 'https://etherscan.io/tx/' + tx.hash);
  }
}

main().catch(console.error);

