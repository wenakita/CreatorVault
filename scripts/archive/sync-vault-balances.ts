import { ethers } from 'hardhat';

async function main() {
  const VAULT = '0x7D3F0f409CbF111005F8FcDDd2AEe34c7Ec33c11';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  
  console.log('=== Syncing Vault Balance Tracking ===\n');
  console.log('The vault\'s internal tracking is out of sync!\n');
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  const usd1 = await ethers.getContractAt('IERC20', USD1);
  const wlfi = await ethers.getContractAt('IERC20', WLFI);
  
  const [internalWlfi, internalUsd1, actualWlfi, actualUsd1] = await Promise.all([
    vault.wlfiBalance(),
    vault.usd1Balance(),
    wlfi.balanceOf(VAULT),
    usd1.balanceOf(VAULT)
  ]);
  
  console.log('Internal tracking:');
  console.log('  WLFI:', ethers.formatEther(internalWlfi));
  console.log('  USD1:', ethers.formatEther(internalUsd1));
  
  console.log('\nActual ERC20 balances:');
  console.log('  WLFI:', ethers.formatEther(actualWlfi));
  console.log('  USD1:', ethers.formatEther(actualUsd1));
  
  if (internalWlfi !== actualWlfi || internalUsd1 !== actualUsd1) {
    console.log('\n❌ OUT OF SYNC!');
    console.log('\nThe vault doesn\'t have a sync function.');
    console.log('We need to either:');
    console.log('  1. Deploy fresh vault (recommended)');
    console.log('  2. Withdraw all and redeposit');
    console.log('  3. Add syncBalances() function to vault');
  } else {
    console.log('\n✅ Balances are in sync!');
  }
}

main().catch(console.error);

