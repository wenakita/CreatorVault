import { ethers } from 'hardhat';

async function main() {
  console.log('=== Verifying Vanity Deployment Setup ===\n');
  
  const FACTORY = '0x4e59b44847b379578588920cA78FbF26c0B4956C';
  const SALT = '0x000000000000000000000000000000000000000000000000d0000000034dfe36';
  const EXPECTED_ADDRESS = '0x47b625c800609d4f283c9978a672e2c0510ea91e';
  
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  const USD1_PRICE_FEED = '0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d';
  const WLFI_USD1_POOL = '0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d';
  const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
  
  const [deployer] = await ethers.getSigners();
  
  // Get init code
  const EagleOVault = await ethers.getContractFactory('EagleOVault');
  const deployTx = await EagleOVault.getDeployTransaction(
    WLFI, USD1, USD1_PRICE_FEED, WLFI_USD1_POOL, UNISWAP_ROUTER, deployer.address
  );
  
  const initCode = deployTx.data as string;
  const initCodeHash = ethers.keccak256(initCode);
  
  console.log('Init Code Hash:', initCodeHash);
  console.log('Init Code Length:', initCode.length);
  
  // Calculate expected address
  const computed = ethers.getCreate2Address(FACTORY, SALT, initCodeHash);
  
  console.log('\nExpected Address:', EXPECTED_ADDRESS);
  console.log('Computed Address:', computed);
  console.log('Match:', computed.toLowerCase() === EXPECTED_ADDRESS.toLowerCase() ? '✅' : '❌ MISMATCH!');
  
  // Check if address already has code
  const code = await ethers.provider.getCode(EXPECTED_ADDRESS);
  console.log('\nTarget Address Status:', code !== '0x' ? '❌ Already deployed' : '✅ Empty');
  
  if (computed.toLowerCase() !== EXPECTED_ADDRESS.toLowerCase()) {
    console.log('\n⚠️  ADDRESS MISMATCH!');
    console.log('The init code has changed. Need to remine for a new salt.');
    console.log('Current init code hash:', initCodeHash);
  }
  
  // Check factory
  const factoryCode = await ethers.provider.getCode(FACTORY);
  console.log('\nFactory Status:', factoryCode !== '0x' ? '✅ Deployed' : '❌ Not found');
}

main().catch(console.error);

