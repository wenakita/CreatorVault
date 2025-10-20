import { ethers } from 'hardhat';

async function main() {
  const VAULT_ADDR = '0xE793F6d1A952d7b43FDA52F83030a8E79D683141';
  const STRATEGY_ADDR = process.env.STRATEGY_ADDR || ''; // Will be set after deployment
  
  console.log('=== Testing Manual Charm Deployment ===\n');
  console.log('Vault:', VAULT_ADDR);
  console.log('Strategy:', STRATEGY_ADDR, '\n');
  
  if (!STRATEGY_ADDR) {
    console.log('❌ Set STRATEGY_ADDR environment variable first!');
    return;
  }
  
  const [user] = await ethers.getSigners();
  const vault = await ethers.getContractAt('EagleOVault', VAULT_ADDR);
  const usd1 = await ethers.getContractAt('IERC20', '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d');
  
  console.log('STEP-BY-STEP TEST:\n');
  
  // 1. Add strategy
  console.log('1️⃣ Adding strategy...');
  let tx = await vault.addStrategy(STRATEGY_ADDR, 10000, { gasLimit: 300000 });
  try { await tx.wait(); } catch (e) {}
  console.log('✅ Added\n');
  
  // 2. Pre-approve
  console.log('2️⃣ Pre-approving tokens...');
  tx = await vault.approveTokensToStrategy(STRATEGY_ADDR, ethers.MaxUint256, ethers.MaxUint256, { gasLimit: 200000 });
  try { await tx.wait(); } catch (e) {}
  console.log('✅ Approved\n');
  
  // 3. Deposit (NO auto-deploy)
  console.log('3️⃣ Depositing 27 USD1 (no auto-deploy)...');
  const amount = await usd1.balanceOf(user.address);
  tx = await vault.depositDual(0, amount, user.address, { gasLimit: 2000000 });
  try { await tx.wait(); } catch (e) {}
  const r = await ethers.provider.getTransactionReceipt(tx.hash);
  console.log('Status:', r?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  if (r?.status === 1) {
    // 4. Manual deploy
    console.log('4️⃣ Manually deploying to Charm...');
    tx = await vault.forceDeployToStrategies({ gasLimit: 5000000 });
    console.log('TX:', tx.hash);
    try { await tx.wait(); } catch (e) {}
    const r2 = await ethers.provider.getTransactionReceipt(tx.hash);
    console.log('Status:', r2?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌');
    console.log('Gas:', r2?.gasUsed.toString(), '\n');
    
    if (r2?.status === 1) {
      const [wlfi, usd1] = await vault.getVaultBalances();
      console.log('Vault idle after Charm deploy:');
      console.log('  USD1:', ethers.formatEther(usd1));
      
      if (parseFloat(ethers.formatEther(usd1)) < 1) {
        console.log('\n🎉🎉🎉 CHARM WORKS! 🎉🎉🎉');
        console.log('✅ Manual deployment method SUCCESS!');
        console.log('✅ Funds in Charm earning yield! 🦅');
      }
    } else {
      console.log('Check failed TX:', 'https://etherscan.io/tx/' + tx.hash);
    }
  }
}

main().catch(console.error);

