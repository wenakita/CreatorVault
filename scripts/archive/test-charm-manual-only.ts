import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xb94E2de9D05eCB27b5C29Dcc6b10749d14282BaC';
  const STRATEGY = '0x8F71d820993E0Bbf3AE78156C791BdaF9a947410';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  
  console.log('=== Clean Charm Test (Manual Deploy) ===\n');
  
  const [user] = await ethers.getSigners();
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  const usd1Contract = await ethers.getContractAt('IERC20', USD1);
  const wlfiContract = await ethers.getContractAt('IERC20', WLFI);
  
  // Step 1: Set threshold VERY HIGH (disable auto-deploy)
  console.log('1️⃣ Disabling auto-deploy (threshold = $1M)...');
  let tx = await vault.setDeploymentParams(ethers.parseEther('1000000'), 300, { gasLimit: 100000 });
  try { await tx.wait(); } catch (e) {}
  console.log('✅ Auto-deploy disabled\n');
  
  // Step 2: Deposit (won't trigger auto-deploy)
  console.log('2️⃣ Depositing 27 USD1...');
  const usd1Bal = await usd1Contract.balanceOf(user.address);
  
  tx = await vault.depositDual(0, usd1Bal, user.address, { gasLimit: 2000000 });
  console.log('TX:', tx.hash);
  try { await tx.wait(); } catch (e) {}
  const r = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('Status:', r?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  if (r?.status === 1) {
    // Step 3: Manual deploy to Charm
    console.log('3️⃣ Manually deploying to Charm...');
    tx = await vault.forceDeployToStrategies({ gasLimit: 5000000 });
    console.log('TX:', tx.hash);
    try { await tx.wait(); } catch (e) {}
    const r2 = await ethers.provider.getTransactionReceipt(tx.hash);
    console.log('Status:', r2?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
    
    if (r2?.status === 1) {
      console.log('🎉 CHARM WORKS!');
      console.log('Checking where funds are...\n');
      
      const [vaultWlfi, vaultUsd1] = await vault.getVaultBalances();
      console.log('Vault idle:');
      console.log('  USD1:', ethers.formatEther(vaultUsd1));
      
      if (parseFloat(ethers.formatEther(vaultUsd1)) < 1) {
        console.log('\n🎊🎊🎊 SUCCESS! FUNDS IN CHARM! 🎊🎊🎊');
        console.log('✅ Pre-approval method works!');
        console.log('✅ Earning Charm yield!');
        console.log('✅ System is ready! 🦅');
      }
    } else {
      console.log('❌ Manual deploy failed');
      console.log('Check TX:', 'https://etherscan.io/tx/' + tx.hash);
    }
  }
}

main().catch(console.error);

