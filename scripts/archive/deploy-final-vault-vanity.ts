import { ethers } from 'hardhat';

async function main() {
  console.log('=== Deploying Final Vanity Vault ===\n');
  
  const FACTORY = '0xAA28020DDA6b954D16208eccF873D79AC6533833';
  const SALT = '0x0000000000000000000000000000000000000000000000008480000000768713';
  const EXPECTED = '0x47cf4797a92f0cb43276f3a044b812cf640ea91e';
  
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  const USD1_PRICE_FEED = '0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d';
  const WLFI_USD1_POOL = '0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d';
  const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
  
  const [deployer] = await ethers.getSigners();
  
  console.log('🎯 Vanity:', EXPECTED);
  console.log('Pattern: 0x47...ea91e ✅\n');
  
  const EagleOVault = await ethers.getContractFactory('EagleOVault');
  const deployTx = await EagleOVault.getDeployTransaction(
    WLFI, USD1, USD1_PRICE_FEED, WLFI_USD1_POOL, UNISWAP_ROUTER, deployer.address
  );
  
  const factory = await ethers.getContractAt(
    ['function deploy(bytes memory code, bytes32 salt) returns (address)'],
    FACTORY
  );
  
  console.log('🚀 Deploying...');
  const tx = await factory.deploy(deployTx.data, SALT);
  console.log('TX:', tx.hash);
  console.log('Waiting...\n');
  
  const receipt = await tx.wait();
  
  console.log('✅ DEPLOYED!');
  console.log('Address:', EXPECTED);
  console.log('Gas:', receipt!.gasUsed.toString());
  console.log('Cost:', ethers.formatEther(receipt!.gasPrice * receipt!.gasUsed), 'ETH');
  
  const vault = await ethers.getContractAt('EagleOVault', EXPECTED);
  console.log('Owner:', await vault.owner());
  
  console.log('\n💾 SAVE:', EXPECTED);
}

main().catch(console.error);

