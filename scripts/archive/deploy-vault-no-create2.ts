import { ethers } from 'hardhat';

async function main() {
  console.log('=== Testing Vault Deployment WITHOUT CREATE2 ===\n');
  console.log('This will prove if the constructor works at all.\n');
  
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  const USD1_PRICE_FEED = '0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d';
  const WLFI_USD1_POOL = '0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d';
  const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
  
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const EagleOVault = await ethers.getContractFactory('EagleOVault');
  
  console.log('\n🚀 Deploying with standard `new` (no CREATE2)...\n');
  
  try {
    const vault = await EagleOVault.deploy(
      WLFI,
      USD1,
      USD1_PRICE_FEED,
      WLFI_USD1_POOL,
      UNISWAP_ROUTER,
      deployer.address,
      {
        gasLimit: 5000000
      }
    );
    
    const deployTx = vault.deploymentTransaction();
    console.log('Deployment TX:', deployTx?.hash);
    console.log('Waiting for confirmation...\n');
    
    await vault.waitForDeployment();
    const address = await vault.getAddress();
    
    console.log('✅ SUCCESS! Vault deployed at:', address);
    console.log('\nThis proves the constructor WORKS.');
    console.log('The issue is CREATE2-specific (not constructor).\n');
    
    // Test owner function
    try {
      const owner = await vault.owner();
      console.log('Owner:', owner, '✅');
    } catch (e: any) {
      console.log('Owner check failed:', e.message);
    }
    
  } catch (error: any) {
    console.log('❌ DEPLOYMENT FAILED!');
    console.log('Error:', error.message);
    console.log('\nThis means the constructor itself is broken.');
  }
}

main().catch(console.error);

