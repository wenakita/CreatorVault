import { ethers } from 'hardhat';

async function main() {
  console.log('=== Deploying Optimized Eagle Vault ===\n');
  
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  const USD1_PRICE_FEED = '0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d';
  const WLFI_USD1_POOL = '0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d';
  const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
  
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('\\n🚀 Deploying EagleOVault (optimized with TWAP)...\\n');
  
  const EagleOVault = await ethers.getContractFactory('EagleOVault');
  const vault = await EagleOVault.deploy(
    WLFI,
    USD1,
    USD1_PRICE_FEED,
    WLFI_USD1_POOL,
    UNISWAP_ROUTER,
    deployer.address
  );
  
  console.log('Deployment TX:', vault.deploymentTransaction()?.hash);
  console.log('Waiting for confirmation...\\n');
  
  await vault.waitForDeployment();
  const address = await vault.getAddress();
  
  console.log('✅ VAULT DEPLOYED!');
  console.log('Address:', address);
  console.log('\\n✨ Features:');
  console.log('  ✅ TWAP oracle (manipulation resistant)');
  console.log('  ✅ Chainlink USD1 price feed');
  console.log('  ✅ Dual-token support (WLFI + USD1)');
  console.log('  ✅ Strategy-ready');
  console.log('\\nUpdate frontend/src/config/contracts.ts with this address!');
}

main().catch(console.error);

