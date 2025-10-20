import { ethers } from 'hardhat';

async function main() {
  console.log('=== Deploying Final Vault (Direct) ===\n');
  
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');
  
  const WLFI = '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6';
  const USD1 = '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d';
  const USD1_PRICE_FEED = '0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d';
  const WLFI_USD1_POOL = '0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d';
  const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
  
  console.log('🚀 Deploying EagleOVault (all fixes)...\n');
  
  const EagleOVault = await ethers.getContractFactory('EagleOVault');
  const vault = await EagleOVault.deploy(
    WLFI, USD1, USD1_PRICE_FEED, WLFI_USD1_POOL, UNISWAP_ROUTER, deployer.address
  );
  
  console.log('Deploying...');
  await vault.waitForDeployment();
  const address = await vault.getAddress();
  
  console.log('\n✅ VAULT DEPLOYED!');
  console.log('Address:', address);
  
  console.log('\n💾 SAVE THIS:', address);
  console.log('\nConnecting CharmStrategyUSD1...');
  
  // Add strategy
  const STRATEGY = '0x7DE0041De797c9b95E45DF27492f6021aCF691A0';
  let tx = await vault.addStrategy(STRATEGY, 10000);
  await tx.wait();
  console.log('✅ Strategy connected');
  
  // Enable Charm
  tx = await vault.setDeploymentParams(ethers.parseEther('100'), 3600);
  await tx.wait();
  console.log('✅ Charm enabled!');
  
  console.log('\n🎉 READY!');
  console.log('Vault:', address);
  console.log('Update frontend with this address!');
}

main().catch(console.error);

