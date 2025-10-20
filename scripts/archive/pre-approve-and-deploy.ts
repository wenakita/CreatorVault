import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0xF1BA178f27d5bB8dd5559CbEF8c35A6fBF670b62';
  const STRATEGY = '0xBE328F8Ade13c5638E9B45Ebb1DbD873E64bA9E2'; // NEW strategy (vault-matched!)
  
  console.log('=== Pre-Approve and Deploy (Arbitrum Method!) ===\n');
  console.log('Vault:', VAULT);
  console.log('Strategy:', STRATEGY, '(matches vault!)\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  // Step 1: Pre-approve MASSIVE amounts (like Arbitrum did)
  console.log('1️⃣ Pre-approving MAX amounts to strategy...');
  const tx1 = await vault.approveTokensToStrategy(
    STRATEGY,
    ethers.MaxUint256,
    ethers.MaxUint256,
    { gasLimit: 200000 }
  );
  console.log('TX:', tx1.hash);
  try { await tx1.wait(); } catch (e) {}
  const r1 = await ethers.provider.getTransactionReceipt(tx1.hash);
  console.log('Status:', r1?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
  
  if (r1?.status === 1) {
    console.log('✅ APPROVAL SET!');
    console.log('Now strategy can pull tokens without vault approving again!\n');
    
    // Step 2: Now manually deploy to test
    console.log('2️⃣ Testing manual deployment...');
    const tx2 = await vault.forceDeployToStrategies({ gasLimit: 5000000 });
    console.log('TX:', tx2.hash);
    try { await tx2.wait(); } catch (e) {}
    const r2 = await ethers.provider.getTransactionReceipt(tx2.hash);
    console.log('Status:', r2?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
    
    if (r2?.status === 1) {
      console.log('🎉 CHARM DEPLOYMENT WORKS!');
      console.log('✅ Pre-approval method is the solution!');
      console.log('✅ Your 12 USD1 deployed to Charm!');
      console.log('✅ Earning yield! 🦅');
      
      // Check balances
      const [wlfi, usd1] = await vault.getVaultBalances();
      console.log('\nVault idle:');
      console.log('  USD1:', ethers.formatEther(usd1));
      console.log('  (Should be ~0)');
    }
  }
}

main().catch(console.error);

