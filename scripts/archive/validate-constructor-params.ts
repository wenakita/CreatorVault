import { ethers } from 'hardhat';

async function main() {
  console.log('=== Validating EagleOVault Constructor Parameters ===\n');
  
  const params = {
    WLFI: '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6',
    USD1: '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d',
    USD1_PRICE_FEED: '0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d',
    WLFI_USD1_POOL: '0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d',
    UNISWAP_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  };
  
  const [deployer] = await ethers.getSigners();
  console.log('Owner:', deployer.address, '\n');
  
  for (const [name, address] of Object.entries(params)) {
    const code = await ethers.provider.getCode(address);
    const exists = code !== '0x';
    console.log(`${name.padEnd(20)}${address}  ${exists ? '✅' : '❌ NOT DEPLOYED'}`);
    
    if (!exists) {
      console.log(`  ⚠️  ERROR: ${name} contract not found!`);
    }
  }
  
  console.log('\n=== Summary ===');
  console.log('If all are ✅, the constructor params are valid.');
  console.log('If any are ❌, the vault deployment will fail.');
}

main().catch(console.error);

