import { ethers } from 'hardhat';

async function main() {
  console.log('=== Withdrawing from Vault ===\n');
  
  const VAULT = '0xF87299c517116Df23EdD0DE485387a79AA2175A2';
  const [deployer] = await ethers.getSigners();
  
  console.log('Vault:', VAULT);
  console.log('Your Address:', deployer.address);
  
  const vault = await ethers.getContractAt('EagleOVault', VAULT);
  
  // Check your shares
  const yourShares = await vault.balanceOf(deployer.address);
  const totalSupply = await vault.totalSupply();
  const totalAssets = await vault.totalAssets();
  
  console.log('\nYour Position:');
  console.log('  Shares:', ethers.formatEther(yourShares));
  console.log('  % of Vault:', (Number(yourShares) / Number(totalSupply) * 100).toFixed(4), '%');
  
  if (yourShares === 0n) {
    console.log('\n❌ You have no shares to withdraw!');
    return;
  }
  
  const yourValue = Number(totalAssets) * Number(yourShares) / Number(totalSupply);
  console.log('  Estimated Value:', yourValue.toFixed(2), 'USD');
  
  console.log('\n🔄 Withdrawing ALL shares...');
  
  const tx = await vault.withdrawDual(yourShares, deployer.address);
  console.log('TX sent:', tx.hash);
  console.log('Waiting for confirmation...\n');
  
  const receipt = await tx.wait();
  
  if (receipt?.status === 0) {
    console.log('❌ Withdrawal failed!');
    return;
  }
  
  console.log('✅ WITHDRAWAL SUCCESSFUL!');
  console.log('Block:', receipt.blockNumber);
  console.log('Gas used:', receipt.gasUsed.toString());
  
  // Check new balances
  const wlfiToken = await ethers.getContractAt('IERC20', '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6');
  const usd1Token = await ethers.getContractAt('IERC20', '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d');
  
  const wlfiBalance = await wlfiToken.balanceOf(deployer.address);
  const usd1Balance = await usd1Token.balanceOf(deployer.address);
  
  console.log('\nYour New Balances:');
  console.log('  WLFI:', ethers.formatEther(wlfiBalance));
  console.log('  USD1:', ethers.formatEther(usd1Balance));
  
  console.log('\n🎉 Withdrawal complete!');
  console.log('Etherscan:', `https://etherscan.io/tx/${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

