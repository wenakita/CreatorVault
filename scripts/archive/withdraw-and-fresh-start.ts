import { ethers } from 'hardhat';

async function main() {
  const CURRENT_VAULT = '0x7D3F0f409CbF111005F8FcDDd2AEe34c7Ec33c11';
  
  console.log('=== Withdraw and Fresh Start ===\n');
  console.log('Current vault:', CURRENT_VAULT, '\n');
  
  const [user] = await ethers.getSigners();
  const vault = await ethers.getContractAt('EagleOVault', CURRENT_VAULT);
  
  // Get your shares
  const shares = await vault.balanceOf(user.address);
  console.log('Your shares:', ethers.formatEther(shares), 'vEAGLE');
  
  if (shares > 0n) {
    console.log('\n🚀 Withdrawing ALL shares...');
    const tx = await vault.withdrawDual(shares, user.address, { gasLimit: 3000000 });
    console.log('TX:', tx.hash);
    console.log('Waiting...\n');
    
    try { await tx.wait(); } catch (e) {}
    
    const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    console.log('Status:', receipt?.status === 1 ? 'SUCCESS ✅' : 'FAILED ❌');
    
    if (receipt?.status === 1) {
      // Check what you got back
      const usd1 = await ethers.getContractAt('IERC20', '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d');
      const wlfi = await ethers.getContractAt('IERC20', '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6');
      
      const [usd1Bal, wlfiBal] = await Promise.all([
        usd1.balanceOf(user.address),
        wlfi.balanceOf(user.address)
      ]);
      
      console.log('\n✅ WITHDRAWN!');
      console.log('Your wallet now has:');
      console.log('  USD1:', ethers.formatEther(usd1Bal));
      console.log('  WLFI:', ethers.formatEther(wlfiBal));
      console.log('\n🎯 Ready for fresh vault deployment!');
    }
  } else {
    console.log('No shares to withdraw');
  }
}

main().catch(console.error);

