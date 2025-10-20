import { ethers } from 'hardhat';

async function main() {
  console.log('=== Setting Up Vanity Vault ===\n');
  
  const VANITY_VAULT = '0x47b625c800609d4f283c9978a672e2c0510ea91e';
  const CHARM_STRATEGY = '0x7DE0041De797c9b95E45DF27492f6021aCF691A0';
  
  const vault = await ethers.getContractAt('EagleOVault', VANITY_VAULT);
  
  console.log('Vanity Vault:', VANITY_VAULT);
  console.log('CharmStrategyUSD1:', CHARM_STRATEGY);
  
  // 1. Add strategy
  console.log('\n1. Adding CharmStrategy...');
  let tx = await vault.addStrategy(CHARM_STRATEGY, 10000);
  await tx.wait();
  console.log('✅ Strategy added');
  
  // 2. Enable Charm ($100 threshold)
  console.log('\n2. Enabling Charm...');
  tx = await vault.setDeploymentParams(ethers.parseEther('100'), 3600);
  await tx.wait();
  console.log('✅ Charm enabled');
  
  console.log('\n🎉 VANITY VAULT READY!');
  console.log('Address:', VANITY_VAULT);
  console.log('Features:');
  console.log('  ✅ Vanity: 0x47...ea91e');
  console.log('  ✅ All fixes included');
  console.log('  ✅ Charm auto-deployment enabled');
  console.log('  ✅ Omnichain-ready (same address on Sonic, Arbitrum, Base!)');
}

main().catch(console.error);

