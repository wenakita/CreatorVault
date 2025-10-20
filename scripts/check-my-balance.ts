import { ethers } from 'hardhat';

async function main() {
  const USER = '0x7310Dd6EF89b7f829839F140C6840bc929ba2031';
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  const NEW_VAULT = '0x47b625c800609d4f283c9978a672e2c0510ea91e';
  
  const wlfi = await ethers.getContractAt('IERC20', WLFI);
  const usd1 = await ethers.getContractAt('IERC20', USD1);
  const vault = await ethers.getContractAt('EagleOVault', NEW_VAULT);
  
  const [wlfiBalance, usd1Balance, vaultShares] = await Promise.all([
    wlfi.balanceOf(USER),
    usd1.balanceOf(USER),
    vault.balanceOf(USER)
  ]);
  
  console.log('=== Your Current Balances ===\n');
  console.log('WLFI (wallet):', ethers.formatEther(wlfiBalance));
  console.log('USD1 (wallet):', ethers.formatEther(usd1Balance));
  console.log('vEAGLE (new vault):', ethers.formatEther(vaultShares));
  
  console.log('\nNew Vanity Vault:', NEW_VAULT);
}

main().catch(console.error);

