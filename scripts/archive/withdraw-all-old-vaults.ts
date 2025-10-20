import { ethers } from 'hardhat';

async function main() {
  const OLD_VAULTS = [
    '0xe399A4976fFad9C1414dC71139a1A5cF46d44428',
    '0xE9FD722306A50E0425cFb3BbD8d3c7605068b6E5',
    '0xF1BA178f27d5bB8dd5559CbEF8c35A6fBF670b62',
    '0xcd033522d822d8A127d04f1812a6Ba8C0DA798ae',
  ];
  
  console.log('=== Withdrawing from All Old Vaults ===\n');
  
  const [user] = await ethers.getSigners();
  let totalUsd1 = 0n;
  let totalWlfi = 0n;
  
  for (const vaultAddress of OLD_VAULTS) {
    try {
      const vault = await ethers.getContractAt('EagleOVault', vaultAddress);
      const shares = await vault.balanceOf(user.address);
      
      if (shares > 0n) {
        console.log(`📍 Vault: ${vaultAddress.slice(0, 10)}...`);
        console.log(`   Shares: ${ethers.formatEther(shares)}`);
        
        // Withdraw all shares
        console.log('   Withdrawing...');
        const tx = await vault.withdrawDual(shares, user.address, { gasLimit: 3000000 });
        console.log('   TX:', tx.hash);
        
        try { await tx.wait(); } catch (e) {}
        
        const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
        console.log('   Status:', receipt?.status === 1 ? 'SUCCESS ✅\n' : 'FAILED ❌\n');
        
        if (receipt?.status === 1) {
          // Parse withdrawal amounts from events if needed
          console.log('   ✅ Withdrawn!\n');
        }
      }
    } catch (e: any) {
      console.log(`   Skipping (${e.message.slice(0, 30)}...)\n`);
    }
  }
  
  // Check final balance
  const usd1 = await ethers.getContractAt('IERC20', '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d');
  const wlfi = await ethers.getContractAt('IERC20', '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6');
  
  const [usd1Bal, wlfiBal] = await Promise.all([
    usd1.balanceOf(user.address),
    wlfi.balanceOf(user.address)
  ]);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🎉 WITHDRAWAL COMPLETE! 🎉');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Your wallet balances:');
  console.log('  USD1:', ethers.formatEther(usd1Bal));
  console.log('  WLFI:', ethers.formatEther(wlfiBal));
  console.log('\n🎯 Now deposit to fresh vault: 0xb94E2de9D05eCB27b5C29Dcc6b10749d14282BaC');
}

main().catch(console.error);

